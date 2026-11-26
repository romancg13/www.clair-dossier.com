// Schémas du moteur documentaire — version 3 (rétrocompatible en lecture avec la v2).
//
// Deux familles : les schémas de SORTIE imposés au fournisseur (stricts, sans
// valeur par défaut, compatibles « structured outputs ») et les types de
// données stockées. Une donnée v2 (worker Supabase actuel) reste lisible : les
// champs ajoutés en v3 sont facultatifs dans AnalysisData (analysis-model.ts).
import { z } from 'zod';

export const SCHEMA_VERSION = '3';

/** Preuve dans une pièce : page (PDF) ou repère (e-mail, tableur, texte) + extrait exact. */
export const PieceQuote = z.object({
  page: z.number().int().nullable(),
  locator: z.string().nullable(),
  quote: z.string(),
});

const Ev = z.array(PieceQuote);

export const ExtractionOutputSchema = z.object({
  document_type: z.string(),
  language: z.string(),
  summary: z.string(),
  parties: z.array(z.object({ name: z.string(), role: z.string(), evidence: Ev })),
  dates: z.array(
    z.object({
      date: z.string(),
      precision: z.enum(['day', 'month', 'year', 'unknown']),
      label: z.string(),
      kind: z.enum(['document_date', 'event_date', 'deadline']),
      evidence: Ev,
    }),
  ),
  amounts: z.array(
    z.object({
      amount: z.number(),
      currency: z.string(),
      label: z.string(),
      kind: z.enum(['due', 'paid', 'claimed', 'total', 'other']),
      evidence: Ev,
    }),
  ),
  references: z.array(z.object({ value: z.string(), label: z.string(), evidence: Ev })),
  obligations: z.array(z.object({ text: z.string(), owner: z.string(), evidence: Ev })),
  requests: z.array(z.object({ text: z.string(), evidence: Ev })),
  alleged_facts: z.array(z.object({ text: z.string(), asserted_by: z.string(), evidence: Ev })),
  /** Pièces citées par ce document (« bail signé le… », « relevé joint ») — sert à détecter les manquants. */
  referenced_documents: z.array(z.object({ label: z.string(), short_label: z.string(), date: z.string().nullable(), evidence: Ev })),
  missing_elements: z.array(z.string()),
  quality: z.object({ readable: z.boolean(), notes: z.string() }),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

/** Preuve consolidée : pièce + page/repère + extrait. */
export const DocQuote = z.object({
  document_id: z.string(),
  page: z.number().int().nullable(),
  locator: z.string().nullable(),
  quote: z.string(),
});
const DEv = z.array(DocQuote);
const Owner = z.enum(['client', 'cabinet', 'tiers', 'personne']);

export const AnalysisOutputSchema = z.object({
  /** Deux phrases au plus, datées en clair, au présent, sans conseil juridique. */
  situation: z.string(),
  summary_short: z.string(),
  summary_long: z.string(),
  parties: z.array(z.object({ name: z.string(), role: z.string(), evidence: DEv })),
  facts: z.array(z.object({ text: z.string(), status: z.enum(['documented', 'asserted_by_party', 'inferred', 'missing']), evidence: DEv })),
  /** 3 à 5 faits déterminants, sourcés. */
  key_facts: z.array(z.object({ text: z.string(), status: z.enum(['documented', 'asserted_by_party', 'inferred', 'missing']), evidence: DEv })),
  amounts: z.array(z.object({ label: z.string(), amount: z.number(), currency: z.string(), kind: z.enum(['due', 'paid', 'claimed', 'total', 'other']), evidence: DEv })),
  deadlines: z.array(
    z.object({
      title: z.string(),
      date: z.string().nullable(),
      kind: z.enum(['mentioned', 'computed', 'hypothesis']),
      basis: z.string(),
      priority: z.enum(['haute', 'normale', 'basse']),
      owner: Owner,
      owner_name: z.string().nullable(),
      evidence: DEv,
    }),
  ),
  contradictions: z.array(z.object({ text: z.string(), kind: z.enum(['date', 'amount', 'other']), event_keys: z.array(z.string()), evidence: DEv })),
  missing_items: z.array(z.object({ text: z.string(), why: z.string(), kind: z.enum(['referenced', 'usual', 'unreadable']), short_label: z.string(), evidence: DEv })),
  /** 3 à 5 jalons choisis parmi les clés d'événements fournies ; importance ≠ certitude. */
  milestones: z.array(z.object({ event_key: z.string(), importance: z.enum(['majeure', 'utile']) })),
  primary_action: z.object({ label: z.string(), owner: Owner, rationale: z.string(), due_date: z.string().nullable() }),
  attention_points: z.array(z.string()),
  next_actions: z.array(z.string()),
  reminder_drafts: z.array(
    z.object({
      audience: z.enum(['client', 'third_party']),
      subject: z.string(),
      body: z.string(),
      suggested_date: z.string().nullable(),
      recipient_hint: z.string(),
      condition: z.string(),
      related_deadline: z.string().nullable(),
    }),
  ),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

/** Validation locale stricte (le fournisseur valide aussi ; on ne s'y fie pas seul). */
export function validate<T>(schema: z.ZodType<T>, data: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(data);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ') };
}

/* ── Forme « filaire » de la synthèse, envoyée au fournisseur ─────────────────
 * Même contenu que AnalysisOutputSchema, SANS AUCUN type multiple (nullable) : l'API refusait la grammaire
 * compilée (« The compiled grammar is too large », 400, recette du 25/11/2026). Conventions : chaîne vide = absent,
 * page 0 = pas de page. fromWire() rend exactement la forme stockée (AnalysisOutput) : rien d'autre ne change. */
const WQuote = z.object({ document_id: z.string(), page: z.number().int(), locator: z.string(), quote: z.string() });
const WEv = z.array(WQuote);
const Status = z.enum(['documented', 'asserted_by_party', 'inferred', 'missing']);
export const AnalysisWireSchema = z.object({
  situation: z.string(),
  summary_short: z.string(),
  summary_long: z.string(),
  parties: z.array(z.object({ name: z.string(), role: z.string(), evidence: WEv })),
  facts: z.array(z.object({ text: z.string(), status: Status, evidence: WEv })),
  key_facts: z.array(z.object({ text: z.string(), status: Status, evidence: WEv })),
  amounts: z.array(z.object({ label: z.string(), amount: z.number(), currency: z.string(), kind: z.enum(['due', 'paid', 'claimed', 'total', 'other']), evidence: WEv })),
  deadlines: z.array(z.object({ title: z.string(), date: z.string(), kind: z.enum(['mentioned', 'computed', 'hypothesis']), basis: z.string(), priority: z.enum(['haute', 'normale', 'basse']), owner: Owner, owner_name: z.string(), evidence: WEv })),
  contradictions: z.array(z.object({ text: z.string(), kind: z.enum(['date', 'amount', 'other']), event_keys: z.array(z.string()), evidence: WEv })),
  missing_items: z.array(z.object({ text: z.string(), why: z.string(), kind: z.enum(['referenced', 'usual', 'unreadable']), short_label: z.string(), evidence: WEv })),
  milestones: z.array(z.object({ event_key: z.string(), importance: z.enum(['majeure', 'utile']) })),
  primary_action: z.object({ label: z.string(), owner: Owner, rationale: z.string(), due_date: z.string() }),
  attention_points: z.array(z.string()),
  next_actions: z.array(z.string()),
  reminder_drafts: z.array(z.object({ audience: z.enum(['client', 'third_party']), subject: z.string(), body: z.string(), suggested_date: z.string(), recipient_hint: z.string(), condition: z.string(), related_deadline: z.string() })),
});
export type AnalysisWire = z.infer<typeof AnalysisWireSchema>;

const vide = (s: string) => (s.trim() ? s : null);
const ev = (l: AnalysisWire['parties'][number]['evidence']) => l.map((q) => ({ document_id: q.document_id, page: q.page > 0 ? q.page : null, locator: vide(q.locator), quote: q.quote }));
/** Forme filaire → forme stockée (chaînes vides et pages 0 redeviennent null). */
export function fromWire(w: AnalysisWire): AnalysisOutput {
  return {
    ...w,
    parties: w.parties.map((x) => ({ ...x, evidence: ev(x.evidence) })),
    facts: w.facts.map((x) => ({ ...x, evidence: ev(x.evidence) })),
    key_facts: w.key_facts.map((x) => ({ ...x, evidence: ev(x.evidence) })),
    amounts: w.amounts.map((x) => ({ ...x, evidence: ev(x.evidence) })),
    deadlines: w.deadlines.map((x) => ({ ...x, date: vide(x.date), owner_name: vide(x.owner_name), evidence: ev(x.evidence) })),
    contradictions: w.contradictions.map((x) => ({ ...x, evidence: ev(x.evidence) })),
    missing_items: w.missing_items.map((x) => ({ ...x, evidence: ev(x.evidence) })),
    primary_action: { ...w.primary_action, due_date: vide(w.primary_action.due_date) },
    reminder_drafts: w.reminder_drafts.map((x) => ({ ...x, suggested_date: vide(x.suggested_date), related_deadline: vide(x.related_deadline) })),
  };
}
