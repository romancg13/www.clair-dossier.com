// Modèle d'analyse ClairDossier — partie PURE des livrables (catalogue, types,
// chronologie déterministe, corrections humaines, libellés). Aucune dépendance
// lourde : importable par le site (espace client, démo) sans embarquer pdf-lib.
// La génération des fichiers (PDF/DOCX/XLSX/CSV/ICS) reste dans deliverables.ts,
// qui ré-exporte tout ce module (API du worker et des tests inchangée).
import { deadlineKey, type Evidence } from './ai-pipeline.ts';

/* ── Catalogue ──────────────────────────────────────────────────────────── */

export const DELIVERABLE_CATALOG = [
  { key: 'resume', label: 'Résumé IA', slug: 'Resume-IA', description: 'Synthèse courte et détaillée, faits sourcés, points d’attention et prochaines actions.' },
  { key: 'dashboard', label: 'Dashboard', slug: 'Dashboard', description: 'Vue d’ensemble : couverture documentaire, échéances proches, contradictions, pièces manquantes.' },
  { key: 'chronologie', label: 'Chronologie', slug: 'Chronologie', description: 'Événements datés et sourcés, date du document distinguée de la date de l’événement.' },
  { key: 'dates', label: 'Dates modifiables', slug: 'Dates-modifiables', description: 'Date extraite, date retenue, motif, source, auteur et historique des corrections.' },
  { key: 'echeances', label: 'Échéances et calendrier', slug: 'Echeances', description: 'Dates mentionnées, calculées ou à confirmer ; calendrier ICS à importer.' },
  { key: 'relances', label: 'Relances e-mails', slug: 'Relances', description: 'Projets de messages contextualisés — brouillons, jamais envoyés automatiquement.' },
] as const;

export type DeliverableKey = (typeof DELIVERABLE_CATALOG)[number]['key'];

/** Livrable d'appartenance d'un fichier généré (`<slug>-r<révision>.<ext>`), sinon null. */
export function deliverableKeyOf(fileName: string): DeliverableKey | null {
  const hit = DELIVERABLE_CATALOG.find((d) => new RegExp(`^${d.slug}-r\\d+\\.[a-z]+$`, 'i').test(fileName));
  return hit ? hit.key : null;
}

/* ── Modèle de données ──────────────────────────────────────────────────── */

export type Precision = 'day' | 'month' | 'year' | 'unknown';
type Sourced = { evidence: Evidence[]; unverified?: boolean };

export interface ChronoEvent extends Sourced {
  key: string;
  date: string;
  precision: Precision;
  kind: 'document_date' | 'event_date';
  label: string;
}

export interface AnalysisData {
  summary_short: string;
  summary_long: string;
  parties: ({ name: string; role: string } & Sourced)[];
  facts: ({ text: string; status: 'documented' | 'asserted_by_party' | 'inferred' | 'missing' } & Sourced)[];
  deadlines: ({ title: string; date: string | null; kind: 'mentioned' | 'computed' | 'hypothesis'; basis: string; priority: 'haute' | 'normale' | 'basse' } & Sourced)[];
  contradictions: ({ text: string } & Sourced)[];
  missing_items: { text: string; why: string }[];
  attention_points: string[];
  next_actions: string[];
  reminder_drafts: { audience: 'client' | 'third_party'; subject: string; body: string; suggested_date: string | null; recipient_hint: string }[];
  events: ChronoEvent[];
}

export interface CoverageInfo {
  total: number;
  extracted: number;
  unsupported: number;
  failed: number;
  pending: number;
  complete: boolean;
  stripped_references?: number;
}

export interface PieceRef {
  id: string;
  file_name: string;
  created_at: string;
}

/** Correction humaine d'un événement (table append-only ai_event_overrides). */
export interface EventOverride {
  event_key: string;
  retained_date: string | null;
  label: string | null;
  hidden: boolean;
  reason: string;
  author: string;
  created_at: string;
}

/** Échéance telle qu'enregistrée dans dossier_deadlines (corrections et ajouts manuels inclus). */
export interface DeadlineRow {
  ai_key: string | null;
  title: string;
  due_date: string;
  due_time: string | null;
  priority: 'haute' | 'normale' | 'basse';
  done: boolean;
  user_edited: boolean;
  description: string | null;
}

/* ── Chronologie déterministe ───────────────────────────────────────────── */

type ExtractedDate = { date: string; precision: Precision; label: string; kind: 'document_date' | 'event_date' | 'deadline'; evidence: { page: number | null; quote: string }[] };

/**
 * Chronologie construite SANS modèle à partir des extractions par pièce :
 * aucune date n'est inventée, chaque événement garde toutes ses sources et
 * les doublons (même date, même libellé) sont fusionnés.
 */
export function buildChronology(extractions: { document_id: string; data: { dates?: ExtractedDate[] } | null }[]): ChronoEvent[] {
  const byKey = new Map<string, ChronoEvent>();
  for (const x of extractions) {
    for (const d of x.data?.dates ?? []) {
      if (d.kind === 'deadline' || !/^\d{4}(-\d{2}){0,2}$/.test(d.date)) continue;
      const key = deadlineKey(d.label, d.date);
      const evidence = d.evidence.map((e) => ({ document_id: x.document_id, page: e.page, quote: e.quote }));
      const prev = byKey.get(key);
      if (prev) prev.evidence.push(...evidence);
      else byKey.set(key, { key, date: d.date, precision: d.precision, kind: d.kind, label: d.label, evidence });
    }
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'fr'));
}

export interface RetainedEvent extends ChronoEvent {
  retained_date: string;
  retained_label: string;
  hidden: boolean;
  edited: boolean;
  reason?: string;
  author?: string;
  edited_at?: string;
}

/** Applique la DERNIÈRE correction humaine de chaque événement (l'historique complet reste en base). */
export function applyOverrides(events: ChronoEvent[], overrides: EventOverride[]): RetainedEvent[] {
  const latest = new Map<string, EventOverride>();
  for (const o of [...overrides].sort((a, b) => a.created_at.localeCompare(b.created_at))) latest.set(o.event_key, o);
  return events
    .map((e) => {
      const o = latest.get(e.key);
      return {
        ...e,
        retained_date: o?.retained_date ?? e.date,
        retained_label: o?.label ?? e.label,
        hidden: o?.hidden ?? false,
        edited: Boolean(o),
        reason: o?.reason,
        author: o?.author,
        edited_at: o?.created_at,
      };
    })
    .sort((a, b) => a.retained_date.localeCompare(b.retained_date) || a.retained_label.localeCompare(b.retained_label, 'fr'));
}

/* ── Mise en forme ──────────────────────────────────────────────────────── */

export function frDate(iso: string | null | undefined): string {
  if (!iso) return 'à déterminer';
  const [y, m, d] = iso.split('-');
  return d ? `${d}/${m}/${y}` : m ? `${m}/${y}` : y;
}

export const KIND_LABEL = { mentioned: 'Date mentionnée dans une pièce', computed: 'Date calculée', hypothesis: 'Hypothèse à confirmer' } as const;
export const FACT_LABEL = { documented: 'documenté', asserted_by_party: 'déclaré par une partie', inferred: 'déduit', missing: 'manquant' } as const;

export function sources(ev: Evidence[], names: Map<string, string>): string {
  if (!ev.length) return 'non sourcé';
  return ev.map((e) => `${names.get(e.document_id) ?? 'pièce'}${e.page ? ` p.${e.page}` : ''}`).join(' ; ');
}

export function coverageLabel(c: CoverageInfo): string {
  return c.complete
    ? `Analyse complète — ${c.extracted} pièce${c.extracted > 1 ? 's' : ''} exploitée${c.extracted > 1 ? 's' : ''}${c.unsupported ? `, ${c.unsupported} format(s) non pris en charge` : ''}`
    : `Analyse PARTIELLE — ${c.extracted}/${c.total} pièces exploitées${c.pending ? `, ${c.pending} en attente` : ''}${c.failed ? `, ${c.failed} en échec` : ''}${c.unsupported ? `, ${c.unsupported} non prise(s) en charge` : ''}`;
}
