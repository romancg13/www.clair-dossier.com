// Les six livrables ClairDossier, générés depuis UNE base structurée
// (analyse consolidée + chronologie déterministe + corrections humaines).
// Partagé par `ai-worker` (Deno, via deno.json) et le site (démo navigateur) ;
// testé sous Node (tests/deliverables.test.ts). Aucun HTML/JS produit par le
// modèle n'est exécuté : tout passe par des gabarits maîtrisés.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { buildIcs, deadlineKey, toCsv, type Evidence } from './ai-pipeline.ts';
import { buildDocx, buildXlsx, type DocBlock } from './office.ts';

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

const KIND_LABEL = { mentioned: 'Date mentionnée dans une pièce', computed: 'Date calculée', hypothesis: 'Hypothèse à confirmer' } as const;
const FACT_LABEL = { documented: 'documenté', asserted_by_party: 'déclaré par une partie', inferred: 'déduit', missing: 'manquant' } as const;

function sources(ev: Evidence[], names: Map<string, string>): string {
  if (!ev.length) return 'non sourcé';
  return ev.map((e) => `${names.get(e.document_id) ?? 'pièce'}${e.page ? ` p.${e.page}` : ''}`).join(' ; ');
}

export function coverageLabel(c: CoverageInfo): string {
  return c.complete
    ? `Analyse complète — ${c.extracted} pièce${c.extracted > 1 ? 's' : ''} exploitée${c.extracted > 1 ? 's' : ''}${c.unsupported ? `, ${c.unsupported} format(s) non pris en charge` : ''}`
    : `Analyse PARTIELLE — ${c.extracted}/${c.total} pièces exploitées${c.pending ? `, ${c.pending} en attente` : ''}${c.failed ? `, ${c.failed} en échec` : ''}${c.unsupported ? `, ${c.unsupported} non prise(s) en charge` : ''}`;
}

/* ── Rendu PDF (gabarit maîtrisé, polices standard) ─────────────────────── */

type PdfBlock = DocBlock | { kind: 'kpis'; items: { label: string; value: string }[] };

// Polices standard = jeu WinAnsi : on normalise les espaces fines et on remplace le reste.
const WINANSI_OK = /[\x20-\x7E\xA0-\xFFŒœŠšŸŽž–—‘’‚“”„†‡•…‰‹›€™]/;
function pdfSafe(s: string): string {
  return Array.from(s.replace(/[    ]/g, ' ').replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<='))
    .map((c) => (c === '\n' || WINANSI_OK.test(c) ? c : '?'))
    .join('');
}

const NAVY = rgb(0x0d / 255, 0x1b / 255, 0x3d / 255);
const GOLD = rgb(0xc7 / 255, 0xa6 / 255, 0x54 / 255);
const SLATE = rgb(0.39, 0.45, 0.55);
const CREAM = rgb(0.98, 0.97, 0.94);

async function renderPdf(title: string, subtitle: string, blocks: PdfBlock[], demo: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor('ClairDossier');
  pdf.setProducer('ClairDossier');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 54, LH = 14.5;
  let page: PDFPage;
  let y = 0;
  const wrap = (text: string, f: PDFFont, size: number, width: number): string[] => {
    const out: string[] = [];
    for (const para of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) > width && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const header = (first: boolean) => {
    page = pdf.addPage([W, H]);
    const band = first ? 96 : 34;
    page.drawRectangle({ x: 0, y: H - band, width: W, height: band, color: NAVY });
    page.drawText('ClairDossier', { x: M, y: H - 22, size: 9.5, font: bold, color: GOLD });
    if (demo) page.drawText('DÉMONSTRATION — DONNÉES FICTIVES', { x: W - M - bold.widthOfTextAtSize('DÉMONSTRATION — DONNÉES FICTIVES', 8), y: H - 22, size: 8, font: bold, color: GOLD });
    if (first) {
      page.drawText(pdfSafe(title), { x: M, y: H - 56, size: 20, font: bold, color: rgb(1, 1, 1) });
      // Sous-titre complet, sur deux lignes au besoin (jamais tronqué en silence).
      wrap(subtitle, font, 8.5, W - 2 * M)
        .slice(0, 2)
        .forEach((l, i) => page.drawText(l, { x: M, y: H - 76 - i * 11, size: 8.5, font, color: GOLD }));
    }
    y = H - band - 30;
  };
  const ensure = (h: number) => {
    if (y - h < M + 20) header(false);
  };
  const text = (s: string, f: PDFFont, size: number, color = NAVY, indent = 0) => {
    for (const l of wrap(s, f, size, W - 2 * M - indent)) {
      ensure(LH);
      page.drawText(l, { x: M + indent, y, size, font: f, color });
      y -= LH * (size / 10.5);
    }
  };
  header(true);
  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
      case 'subtitle':
        break; // portés par l'en-tête
      case 'heading':
        y -= 8;
        ensure(3 * LH);
        page!.drawRectangle({ x: M, y: y - 3, width: 3, height: 12, color: GOLD });
        text(b.text.toUpperCase(), bold, 9.5, NAVY, 10);
        y -= 3;
        break;
      case 'bullet':
        text(`•  ${b.text}`, font, 10, NAVY, 6);
        break;
      case 'note':
        y -= 6;
        text(b.text, font, 8, SLATE);
        break;
      case 'kpis': {
        ensure(70);
        const gap = 10;
        const w = (W - 2 * M - gap * (b.items.length - 1)) / b.items.length;
        b.items.forEach((k, i) => {
          const x = M + i * (w + gap);
          page!.drawRectangle({ x, y: y - 52, width: w, height: 58, color: CREAM, borderColor: GOLD, borderWidth: 0.6 });
          page!.drawText(pdfSafe(k.value), { x: x + 10, y: y - 22, size: 17, font: bold, color: NAVY });
          wrap(k.label, font, 7.5, w - 20).slice(0, 2).forEach((l, j) => page!.drawText(l, { x: x + 10, y: y - 36 - j * 9, size: 7.5, font, color: SLATE }));
        });
        y -= 72;
        break;
      }
      default:
        text(b.text, font, 10.5);
        y -= 4;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.4, color: GOLD });
    p.drawText(pdfSafe('Document généré automatiquement (IA) à partir des pièces du dossier — à vérifier ; ne constitue pas un conseil juridique.'), { x: M, y: 28, size: 7, font, color: SLATE });
    p.drawText(`${i + 1}/${pages.length}`, { x: W - M - 20, y: 28, size: 7, font, color: SLATE });
  });
  return pdf.save();
}

/* ── Génération des livrables ───────────────────────────────────────────── */

export interface OutFile {
  key: DeliverableKey;
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface DeliverableInput {
  title: string;
  revision: number;
  generatedAt: Date;
  analysis: AnalysisData;
  coverage: CoverageInfo;
  pieces: PieceRef[];
  overrides?: EventOverride[];
  /** Échéances en base (corrections humaines et ajouts manuels) ; à défaut, celles de l'analyse. */
  deadlineRows?: DeadlineRow[];
  demo?: boolean;
}

export const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  ics: 'text/calendar;charset=utf-8',
} as const;

type MergedDeadline = { title: string; date: string | null; time: string | null; origin: string; basis: string; priority: string; sources: string; done: boolean; uid: string };

function mergeDeadlines(a: AnalysisData, rows: DeadlineRow[] | undefined, names: Map<string, string>): MergedDeadline[] {
  const fromAnalysis = a.deadlines.map((d) => ({
    title: d.title, date: d.date, time: null as string | null, origin: KIND_LABEL[d.kind], basis: d.basis, priority: d.priority,
    sources: sources(d.evidence, names), done: false, uid: d.date ? deadlineKey(d.title, d.date) : `nd-${deadlineKey(d.title, '0000')}`,
  }));
  if (!rows) return fromAnalysis;
  const byKey = new Map(fromAnalysis.map((d) => [d.uid, d]));
  const out: MergedDeadline[] = fromAnalysis.filter((d) => !d.date); // dates à déterminer : uniquement dans l'analyse
  for (const r of rows) {
    const base = r.ai_key ? byKey.get(r.ai_key) : undefined;
    out.push({
      title: r.title, date: r.due_date, time: r.due_time, priority: r.priority, done: r.done, uid: r.ai_key ?? deadlineKey(r.title, r.due_date),
      origin: !r.ai_key ? 'Ajoutée manuellement' : r.user_edited ? `${base?.origin ?? 'Échéance détectée'} — corrigée par vous` : (base?.origin ?? 'Échéance détectée'),
      basis: base?.basis ?? r.description ?? '', sources: base?.sources ?? '—',
    });
  }
  return out.sort((x, y) => (x.date ?? '9999').localeCompare(y.date ?? '9999'));
}

export async function buildDeliverables(input: DeliverableInput): Promise<OutFile[]> {
  const { analysis: a, coverage: cov, revision: rev, title, demo = false } = input;
  const names = new Map(input.pieces.map((p) => [p.id, p.file_name]));
  const stamp = input.generatedAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const sub = `${title} — révision ${rev} — ${stamp} — ${coverageLabel(cov)}`;
  const enc = new TextEncoder();
  const name = (key: DeliverableKey, ext: string) => `${DELIVERABLE_CATALOG.find((d) => d.key === key)!.slug}-r${rev}.${ext}`;
  const events = applyOverrides(a.events, input.overrides ?? []);
  const visible = events.filter((e) => !e.hidden);
  const deadlines = mergeDeadlines(a, input.deadlineRows, names);
  const today = input.generatedAt.toISOString().slice(0, 10);
  const upcoming = deadlines.filter((d) => !d.done && d.date && d.date >= today);
  const files: OutFile[] = [];
  const legal = 'Document généré automatiquement par ClairDossier à partir des pièces déposées. Il doit être vérifié et ne constitue ni un conseil ni un acte juridique.';

  // 1. Résumé IA (PDF + DOCX)
  const resume: DocBlock[] = [
    { kind: 'title', text: 'Résumé du dossier' },
    { kind: 'subtitle', text: sub },
    { kind: 'heading', text: 'En bref' },
    { kind: 'para', text: a.summary_short },
    { kind: 'heading', text: 'Synthèse détaillée' },
    { kind: 'para', text: a.summary_long },
    { kind: 'heading', text: 'Parties' },
    ...a.parties.map((p): DocBlock => ({ kind: 'bullet', text: `${p.name} — ${p.role} [${sources(p.evidence, names)}]` })),
    { kind: 'heading', text: 'Faits' },
    ...a.facts.map((f): DocBlock => ({ kind: 'bullet', text: `[${FACT_LABEL[f.status]}] ${f.text} [${sources(f.evidence, names)}]` })),
    { kind: 'heading', text: 'Points d’attention' },
    ...a.attention_points.map((t): DocBlock => ({ kind: 'bullet', text: t })),
    { kind: 'heading', text: 'Contradictions entre pièces' },
    ...(a.contradictions.length ? a.contradictions.map((c): DocBlock => ({ kind: 'bullet', text: `${c.text} [${sources(c.evidence, names)}]` })) : [{ kind: 'para', text: 'Aucune contradiction relevée entre les pièces exploitées.' } as DocBlock]),
    { kind: 'heading', text: 'Éléments manquants' },
    ...(a.missing_items.length ? a.missing_items.map((m): DocBlock => ({ kind: 'bullet', text: `${m.text} — ${m.why}` })) : [{ kind: 'para', text: 'Aucun.' } as DocBlock]),
    { kind: 'heading', text: 'Prochaines actions proposées' },
    ...a.next_actions.map((t): DocBlock => ({ kind: 'bullet', text: t })),
    { kind: 'heading', text: 'Pièces exploitées' },
    ...input.pieces.map((p): DocBlock => ({ kind: 'bullet', text: p.file_name })),
    { kind: 'note', text: legal },
  ];
  files.push({ key: 'resume', name: name('resume', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Résumé du dossier', sub, resume, demo) });
  files.push({ key: 'resume', name: name('resume', 'docx'), mime: MIME.docx, bytes: buildDocx(resume, `Résumé — ${title}`) });

  // 2. Dashboard (PDF ; la version interactive est l'onglet DashBoard de l'espace client)
  const latest = [...input.pieces].sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 5);
  files.push({ key: 'dashboard', name: name('dashboard', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Tableau de bord du dossier', sub, [
    { kind: 'kpis', items: [
      { label: 'pièces exploitées', value: `${cov.extracted}/${cov.total}` },
      { label: 'échéances à venir', value: String(upcoming.length) },
      { label: 'contradictions relevées', value: String(a.contradictions.length) },
      { label: 'éléments manquants', value: String(a.missing_items.length) },
    ] },
    { kind: 'heading', text: 'En bref' },
    { kind: 'para', text: a.summary_short },
    { kind: 'heading', text: 'Prochaines échéances' },
    ...(upcoming.length ? upcoming.slice(0, 6).map((d): DocBlock => ({ kind: 'bullet', text: `${frDate(d.date)} — ${d.title} (${d.origin})` })) : [{ kind: 'para', text: 'Aucune échéance à venir.' } as DocBlock]),
    { kind: 'heading', text: 'Points d’attention' },
    ...a.attention_points.slice(0, 6).map((t): DocBlock => ({ kind: 'bullet', text: t })),
    { kind: 'heading', text: 'Pièces manquantes' },
    ...(a.missing_items.length ? a.missing_items.map((m): DocBlock => ({ kind: 'bullet', text: m.text })) : [{ kind: 'para', text: 'Aucune.' } as DocBlock]),
    { kind: 'heading', text: 'Derniers ajouts' },
    ...latest.map((p): DocBlock => ({ kind: 'bullet', text: `${p.file_name} — déposée le ${frDate(p.created_at.slice(0, 10))}` })),
    { kind: 'note', text: `${coverageLabel(cov)}. ${legal}` },
  ], demo) });

  // 3. Chronologie (PDF + XLSX + CSV)
  const chronoRows = visible.map((e) => [frDate(e.retained_date), frDate(e.date), e.precision === 'day' ? 'jour' : e.precision === 'month' ? 'mois' : e.precision === 'year' ? 'année' : 'inconnue', e.kind === 'document_date' ? 'Date du document' : 'Événement', e.retained_label, sources(e.evidence, names), e.edited ? 'oui' : 'non', e.reason ?? '']);
  files.push({ key: 'chronologie', name: name('chronologie', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Chronologie', sub, [
    { kind: 'heading', text: `Événements (${visible.length})` },
    ...visible.map((e): DocBlock => ({ kind: 'bullet', text: `${frDate(e.retained_date)}${e.precision !== 'day' ? ' (approx.)' : ''} — ${e.kind === 'document_date' ? 'date du document' : 'événement'} — ${e.retained_label}${e.edited ? ' [date corrigée]' : ''} [${sources(e.evidence, names)}]` })),
    { kind: 'note', text: 'Les dates approximatives restent indiquées comme telles ; une date corrigée par vous prévaut sur la date extraite (historique dans « Dates modifiables »).' },
  ], demo) });
  const chronoHeaders = ['Date retenue', 'Date extraite', 'Précision', 'Nature', 'Événement', 'Sources', 'Corrigée', 'Motif de correction'];
  files.push({ key: 'chronologie', name: name('chronologie', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([{ name: 'Chronologie', headers: chronoHeaders, rows: chronoRows, widths: [13, 13, 10, 16, 48, 40, 10, 30] }]) });
  files.push({ key: 'chronologie', name: name('chronologie', 'csv'), mime: MIME.csv, bytes: enc.encode(toCsv(chronoHeaders, chronoRows)) });

  // 4. Dates modifiables (XLSX + CSV) — état retenu + historique complet
  const datesHeaders = ['Clé', 'Date extraite', 'Date retenue', 'Événement', 'Sources', 'Statut', 'Motif', 'Auteur', 'Modifiée le'];
  const datesRows = events.map((e) => [e.key, frDate(e.date), frDate(e.retained_date), e.retained_label, sources(e.evidence, names), e.hidden ? 'masquée' : e.edited ? 'corrigée' : 'extraite', e.reason ?? '', e.author ?? '', e.edited_at ? frDate(e.edited_at.slice(0, 10)) : '']);
  const history = [...(input.overrides ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at)).map((o) => [o.created_at.replace('T', ' ').slice(0, 16), o.event_key, frDate(o.retained_date), o.label ?? '', o.hidden ? 'masquée' : '', o.reason, o.author]);
  files.push({ key: 'dates', name: name('dates', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([
    { name: 'Dates', headers: datesHeaders, rows: datesRows, widths: [26, 13, 13, 44, 36, 11, 30, 20, 13] },
    { name: 'Historique', headers: ['Horodatage (UTC)', 'Clé', 'Date retenue', 'Libellé retenu', 'Masquage', 'Motif', 'Auteur'], rows: history, widths: [18, 26, 13, 36, 10, 36, 20] },
  ]) });
  files.push({ key: 'dates', name: name('dates', 'csv'), mime: MIME.csv, bytes: enc.encode(toCsv(datesHeaders, datesRows)) });

  // 5. Échéances et calendrier (PDF + ICS + XLSX)
  const group = (label: string, list: MergedDeadline[]): PdfBlock[] => list.length
    ? [{ kind: 'heading', text: `${label} (${list.length})` }, ...list.map((d): DocBlock => ({ kind: 'bullet', text: `${frDate(d.date)}${d.time ? ` ${d.time.slice(0, 5)}` : ''} — ${d.title} — priorité ${d.priority}${d.done ? ' — terminée' : ''}${d.basis ? ` — ${d.basis}` : ''} [${d.sources}]` }))]
    : [];
  files.push({ key: 'echeances', name: name('echeances', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Échéances et calendrier', sub, [
    ...group('Dates mentionnées dans les pièces', deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.mentioned))),
    ...group('Dates calculées', deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.computed))),
    ...group('Hypothèses à confirmer par un professionnel', deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.hypothesis))),
    ...group('Échéances détectées ou ajoutées', deadlines.filter((d) => !Object.values(KIND_LABEL).some((k) => d.origin.startsWith(k)))),
    { kind: 'note', text: 'Une date calculée ou une hypothèse n’est pas une date juridiquement validée. Le calendrier ICS joint s’importe dans Outlook, Google Agenda ou Calendrier (dates sans heure conservées comme journées entières).' },
  ], demo) });
  files.push({ key: 'echeances', name: name('echeances', 'ics'), mime: MIME.ics, bytes: enc.encode(buildIcs(deadlines.filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && !d.done).map((d) => ({ uid: `${d.uid}@clair-dossier.com`, date: d.date!, time: d.time, summary: `${title} — ${d.title}`, description: `${d.origin}. ${d.basis}` })), `ClairDossier — ${title}`, input.generatedAt)) });
  files.push({ key: 'echeances', name: name('echeances', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([{ name: 'Échéances', headers: ['Date', 'Heure', 'Échéance', 'Nature', 'Base / motif', 'Priorité', 'Statut', 'Sources'], rows: deadlines.map((d) => [frDate(d.date), d.time?.slice(0, 5) ?? '', d.title, d.origin, d.basis, d.priority, d.done ? 'terminée' : 'à venir', d.sources]), widths: [12, 8, 40, 32, 44, 10, 10, 36] }]) });

  // 6. Relances e-mails (DOCX éditable + PDF) — brouillons uniquement
  const drafts: DocBlock[] = [
    { kind: 'title', text: 'Relances — projets de messages' },
    { kind: 'subtitle', text: `${sub} — BROUILLONS : aucun envoi automatique` },
    ...a.reminder_drafts.flatMap((r): DocBlock[] => [
      { kind: 'heading', text: `${r.audience === 'client' ? 'Pour vous' : 'Vers un tiers — à valider avant tout envoi'} · ${r.suggested_date ? `prévu le ${frDate(r.suggested_date)}` : 'date à définir'}` },
      { kind: 'para', text: `Destinataire : ${r.recipient_hint}` },
      { kind: 'para', text: `Objet : ${r.subject}` },
      { kind: 'para', text: r.body },
    ]),
    { kind: 'note', text: 'Les courriers adressés à des tiers (mise en demeure, reconnaissance, renonciation…) sont des projets : ils ne sont jamais envoyés par ClairDossier et doivent être relus, au besoin par un professionnel du droit.' },
  ];
  files.push({ key: 'relances', name: name('relances', 'docx'), mime: MIME.docx, bytes: buildDocx(drafts, `Relances — ${title}`) });
  files.push({ key: 'relances', name: name('relances', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Relances — projets de messages', `${sub} — brouillons`, drafts, demo) });
  return files;
}
