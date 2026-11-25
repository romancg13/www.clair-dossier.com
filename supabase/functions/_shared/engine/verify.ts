// Vérifications déterministes appliquées APRÈS tout fournisseur (règles ou IA) :
// preuves rattachées à la bonne pièce, extraits retrouvés dans le texte source,
// garde-fous sur la sortie consolidée. Rien de ce que déclare le modèle n'est cru seul.
import type { AnalysisOutput, ExtractionOutput } from './schemas.ts';
import type { PreparedPiece } from './reading.ts';
import { findDates, fold } from './text-rules.ts';

export type QuoteStatus = 'found' | 'not_found' | 'unknown';
const norm = (s: string) => fold(s).replace(/[’'`´]/g, "'").replace(/[^a-z0-9€'%]+/g, ' ').trim();
/**
 * `q` figure-t-il dans `hay` sur des limites de mots (textes déjà normalisés) ? Un fragment coupé
 * au milieu d'un mot ou d'un nombre ne compte pas : « 5 janvier 2027 » n'est pas dans « 15 janvier
 * 2027 », ni « 3 480,00 € » dans « 13 480,00 € ». L'apostrophe sert de limite (« l'article 5 »).
 */
const within = (hay: string, q: string) => {
  for (let i = hay.indexOf(q); i >= 0; i = hay.indexOf(q, i + 1))
    if (!/[a-z0-9]/.test(hay[i - 1] ?? '') && !/[a-z0-9]/.test(hay[i + q.length] ?? '')) return true;
  return false;
};

/** L'extrait figure-t-il dans le texte de la page (ou du document) ? */
export function quoteStatus(quote: string, piece: PreparedPiece, page: number | null): QuoteStatus {
  const q = norm(quote);
  if (q.length < 3) return 'not_found';
  const texts = piece.pageTexts ? (page && piece.pageTexts[page - 1] !== undefined ? [piece.pageTexts[page - 1]] : piece.pageTexts) : piece.text ? [piece.text] : null;
  if (!texts) return 'unknown'; // scan ou photo : aucun texte de contrôle
  return texts.some((t) => within(norm(t), q)) ? 'found' : 'not_found';
}

export type VerifiedQuote = ExtractionOutput['parties'][number]['evidence'][number] & { status: QuoteStatus };
export type StoredExtraction = Omit<ExtractionOutput, never> & { verification: { found: number; not_found: number; unknown: number; pages: number | null } };

/** Marque chaque preuve d'une extraction (found / not_found / unknown) et retire les pages hors document. */
export function verifyExtraction(x: ExtractionOutput, piece: PreparedPiece): StoredExtraction {
  const counts = { found: 0, not_found: 0, unknown: 0 };
  const fix = <T extends { evidence: ExtractionOutput['parties'][number]['evidence'] }>(items: T[]): T[] =>
    items.map((it) => ({
      ...it,
      evidence: it.evidence.map((e) => {
        const page = e.page !== null && piece.pages !== null && (e.page < 1 || e.page > piece.pages) ? null : e.page;
        const status = quoteStatus(e.quote, piece, page);
        counts[status]++;
        return { ...e, page, status };
      }),
    }));
  const out = {
    ...x,
    parties: fix(x.parties),
    dates: fix(x.dates),
    amounts: fix(x.amounts),
    references: fix(x.references),
    obligations: fix(x.obligations),
    requests: fix(x.requests),
    alleged_facts: fix(x.alleged_facts),
    referenced_documents: fix(x.referenced_documents),
  };
  return { ...out, verification: { ...counts, pages: piece.pages } };
}

type DEv = AnalysisOutput['facts'][number]['evidence'][number] & { status?: QuoteStatus };

/**
 * Statut d'un extrait consolidé, retrouvé DANS une preuve de l'extraction de la même pièce.
 * Seul le sens « extrait consolidé contenu dans une preuve » vaut : un passage plus long qui
 * contiendrait une preuve courte (un nom de partie, un montant) peut être inventé autour d'elle.
 * Correspondance sur des limites de mots ; un mot isolé de moins de quatre lettres ou un nombre
 * seul ne suffit pas. Limite connue : un mot isolé plus long (« janvier ») reste « trouvé ».
 */
export function consolidatedQuoteStatus(e: DEv, extractions: Map<string, { data: StoredExtraction; vision: boolean }>): QuoteStatus {
  const x = extractions.get(e.document_id);
  if (!x) return 'not_found';
  const all: VerifiedQuote[] = (['parties', 'dates', 'amounts', 'references', 'obligations', 'requests', 'alleged_facts', 'referenced_documents'] as const).flatMap((k) =>
    (x.data[k] as unknown as { evidence: VerifiedQuote[] }[]).flatMap((i) => i.evidence),
  );
  const q = norm(e.quote);
  if (q.length < 3) return 'not_found'; // même seuil que quoteStatus : un extrait vide ne prouve rien
  // Contenu minimal : deux mots, ou un mot d'au moins quatre lettres. Un nombre isolé (« 2027 »)
  // se retrouve dans presque toute preuve et ne prouve rien à lui seul.
  if (!q.includes(' ') && !/[a-z]{4,}/.test(q)) return 'not_found';
  const hit = all.find((v) => within(norm(v.quote), q));
  if (hit) return hit.status ?? 'unknown';
  return x.vision ? 'unknown' : 'not_found';
}

export interface Reliability {
  level: 'elevee' | 'a_verifier';
  reasons: string[];
}

/** Fiabilité OBJECTIVE d'un élément : jamais déclarée par le modèle. */
export function reliability(evidence: DEv[], opts: { contradicted?: boolean; hypothesis?: boolean } = {}): Reliability {
  const reasons: string[] = [];
  if (!evidence.length) reasons.push('non sourcé');
  else if (!evidence.some((e) => e.status === 'found')) reasons.push(evidence.some((e) => e.status === 'unknown') ? 'lecture visuelle (scan ou photo) à vérifier' : 'extrait non retrouvé dans la pièce');
  if (opts.contradicted) reasons.push('contredit par une autre pièce');
  // Aligné sur rendus/view.ts reliabilityOf : une hypothèse est « à confirmer », pas forcément absente des pièces.
  if (opts.hypothesis) reasons.push('date à confirmer');
  return { level: reasons.length ? 'a_verifier' : 'elevee', reasons };
}

const sentencesOf = (s: string) => s.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [];

/**
 * Garde-fous sur la sortie consolidée : preuves hors dossier retirées et
 * comptées, extraits marqués, situation bornée à deux phrases, jalons limités
 * aux événements existants, pas de priorité haute sur une hypothèse, date
 * d'action seulement si elle est une échéance écrite.
 */
export function guardAnalysis(
  a: AnalysisOutput,
  ctx: { knownDocs: Set<string>; eventKeys: Set<string>; extractions: Map<string, { data: StoredExtraction; vision: boolean }> },
): { analysis: AnalysisOutput & { guard: { stripped: number; notes: string[] } } } {
  let stripped = 0;
  const notes: string[] = [];
  const clean = <T extends { evidence: DEv[] }>(items: T[]): (T & { unverified: boolean })[] =>
    items.map((it) => {
      const kept = it.evidence.filter((e) => ctx.knownDocs.has(e.document_id)).map((e) => ({ ...e, status: consolidatedQuoteStatus(e, ctx.extractions) }));
      stripped += it.evidence.length - kept.length;
      return { ...it, evidence: kept, unverified: !kept.some((e) => e.status === 'found') };
    });
  const deadlines = clean(a.deadlines).map((d0) => {
    // Une « date écrite » doit figurer dans un extrait retrouvé : sinon (date mal lue, jour et
    // mois inversés…), elle redevient une date à confirmer et ne peut pas fixer l'action.
    const misread = d0.kind === 'mentioned' && Boolean(d0.date) && !d0.unverified && !(d0.evidence as DEv[]).some((e) => e.status === 'found' && findDates(e.quote).some((h) => h.iso === d0.date));
    if (misread) notes.push(`date de « ${d0.title} » absente de l'extrait cité : ramenée à « à confirmer »`);
    const d = misread ? { ...d0, kind: 'hypothesis' as const, unverified: true } : d0;
    if (d.kind === 'hypothesis' && d.priority === 'haute') {
      notes.push(`priorité ramenée à « normale » pour l'hypothèse « ${d.title} »`);
      return { ...d, priority: 'normale' as const };
    }
    return d;
  });
  const sit = sentencesOf(a.situation);
  if (sit.length > 2) notes.push('situation ramenée à deux phrases');
  const milestones = a.milestones.filter((m) => ctx.eventKeys.has(m.event_key)).slice(0, 5);
  if (milestones.length !== a.milestones.length) notes.push('jalons hors chronologie retirés ou limités à 5');
  const writtenDates = new Set(deadlines.filter((d) => d.kind === 'mentioned' && !d.unverified && d.date).map((d) => d.date as string));
  const primary = a.primary_action.due_date && !writtenDates.has(a.primary_action.due_date) ? { ...a.primary_action, due_date: null } : a.primary_action;
  if (primary !== a.primary_action) notes.push("date de l'action retirée (pas une échéance écrite vérifiée)");
  return {
    analysis: {
      ...a,
      situation: sit.slice(0, 2).join(' '),
      parties: clean(a.parties),
      facts: clean(a.facts),
      key_facts: clean(a.key_facts).slice(0, 5),
      amounts: clean(a.amounts),
      deadlines,
      contradictions: clean(a.contradictions).map((c) => ({ ...c, event_keys: c.event_keys.filter((k) => ctx.eventKeys.has(k)) })),
      missing_items: clean(a.missing_items),
      milestones,
      primary_action: primary,
      guard: { stripped, notes },
    },
  };
}
