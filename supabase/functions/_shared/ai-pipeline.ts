// Moteur documentaire IA — helpers PURS (aucune dépendance Deno/Supabase/Anthropic),
// partagés par la fonction `ai-worker` et testés sous Node (tests/ai-pipeline.test.ts).
//
// Règle : tout ce qui sort du modèle est une DONNÉE non fiable ; ces fonctions
// vérifient de façon déterministe ce que le worker enregistre et publie.

export type InputKind = 'pdf' | 'image' | 'docx' | 'sheet' | 'text' | 'unsupported';

/** Type de lecture d'une pièce, décidé sur le MIME réel puis l'extension. */
export function detectInputKind(fileName: string, mime: string | null | undefined): InputKind {
  const m = (mime ?? '').toLowerCase();
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (/^image\/(jpeg|png|webp|gif)$/.test(m) || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (m.includes('wordprocessingml') || ext === 'docx') return 'docx';
  if (m.includes('spreadsheetml') || ext === 'xlsx' || m === 'text/csv' || ext === 'csv') return 'sheet';
  if (m.startsWith('text/') || ['txt', 'md', 'eml'].includes(ext) || m === 'message/rfc822') return 'text';
  return 'unsupported';
}

/** Référence à une pièce : document, page (si connue) et extrait justificatif. */
export interface Evidence {
  document_id: string;
  page: number | null;
  quote: string;
}

export interface EvidenceCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Chaque preuve doit pointer une pièce du dossier, citer un extrait non vide et
 * une page plausible. Les preuves d'une extraction de pièce unique doivent
 * toutes porter sur CETTE pièce (aucune fuite inter-dossier possible).
 */
export function checkEvidence(
  evidences: Evidence[],
  knownDocumentIds: ReadonlySet<string>,
  pagesByDocument: ReadonlyMap<string, number | null>,
): EvidenceCheck {
  const problems: string[] = [];
  evidences.forEach((e, i) => {
    if (!knownDocumentIds.has(e.document_id)) problems.push(`preuve ${i}: pièce inconnue ${e.document_id}`);
    if (!e.quote || !e.quote.trim()) problems.push(`preuve ${i}: extrait vide`);
    const pages = pagesByDocument.get(e.document_id) ?? null;
    if (e.page !== null && (!Number.isInteger(e.page) || e.page < 1)) problems.push(`preuve ${i}: page invalide ${e.page}`);
    if (e.page !== null && pages !== null && e.page > pages) problems.push(`preuve ${i}: page ${e.page} > ${pages}`);
  });
  return { ok: problems.length === 0, problems };
}

/** Parcourt récursivement un objet et collecte tous les tableaux `evidence`. */
export function collectEvidence(node: unknown, out: Evidence[] = []): Evidence[] {
  if (Array.isArray(node)) {
    for (const item of node) collectEvidence(item, out);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'evidence' && Array.isArray(value)) {
        for (const e of value) {
          if (e && typeof e === 'object' && typeof (e as Evidence).document_id === 'string') out.push(e as Evidence);
        }
      } else {
        collectEvidence(value, out);
      }
    }
  }
  return out;
}

/* ── Coût ───────────────────────────────────────────────────────────────── */

/** Tarifs API Anthropic ($ par million de jetons) — à vérifier à chaque changement de modèle. */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

/** Coût en centimes d'euro (approximation 1 USD ≈ 0,92 EUR, arrondi au 1/100 de centime). */
export function estimateCostCents(model: string, inputTokens: number, outputTokens: number, usdToEur = 0.92): number {
  const p = MODEL_PRICES_USD_PER_MTOK[model];
  if (!p) return 0;
  const usd = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  return Math.round(usd * usdToEur * 100 * 100) / 100;
}

/* ── Exports texte ──────────────────────────────────────────────────────── */

/** CSV RFC 4180 (séparateur « ; » attendu par Excel en français), BOM UTF-8. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

export interface IcsEvent {
  uid: string;
  /** Date ISO `YYYY-MM-DD` ; une échéance sans heure reste une journée entière. */
  date: string;
  time?: string | null;
  summary: string;
  description?: string;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Calendrier ICS (RFC 5545). Les dates sans heure sont des `VALUE=DATE` (pas de fuseau appliqué). */
export function buildIcs(events: IcsEvent[], calendarName: string, stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClairDossier//Echeances//FR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];
  for (const e of events) {
    const d = e.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`);
    if (e.time) {
      const hhmm = e.time.replace(/:/g, '').slice(0, 4);
      lines.push(`DTSTART;TZID=Europe/Paris:${d}T${hhmm}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d}`);
    }
    lines.push(`SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/* ── Couverture ─────────────────────────────────────────────────────────── */

export interface Coverage {
  total: number;
  extracted: number;
  unsupported: number;
  failed: number;
  pending: number;
  complete: boolean;
}

/** Couverture documentaire : « analyse complète » uniquement si TOUTES les pièces lisibles sont extraites. */
export function coverage(statuses: Array<'ok' | 'unsupported' | 'error' | null>): Coverage {
  const total = statuses.length;
  const extracted = statuses.filter((s) => s === 'ok').length;
  const unsupported = statuses.filter((s) => s === 'unsupported').length;
  const failed = statuses.filter((s) => s === 'error').length;
  const pending = statuses.filter((s) => s === null).length;
  return { total, extracted, unsupported, failed, pending, complete: total > 0 && pending === 0 && failed === 0 };
}

/** Clé stable d'une échéance IA (même libellé + même date ⇒ même ligne à la réanalyse). */
export function deadlineKey(title: string, date: string): string {
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${date}:${slug}`;
}

/** Nom de fichier sûr pour le stockage (même règle que le site). */
export function safeFileName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
}
