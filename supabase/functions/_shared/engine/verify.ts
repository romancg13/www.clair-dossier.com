// Vérifications déterministes appliquées APRÈS tout fournisseur (règles ou IA) :
// preuves rattachées à la bonne pièce, extraits retrouvés dans le texte source,
// garde-fous sur la sortie consolidée. Rien de ce que déclare le modèle n'est cru seul.
import type { AnalysisOutput, ExtractionOutput } from './schemas.ts';
import type { PreparedPiece } from './reading.ts';
import { findAmounts, findDates, fold } from './text-rules.ts';

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

/** Mots vides : ils ne comptent pas comme mots significatifs d'un passage. */
const STOP = new Set(
  'a au aux avec ce ces cet cette dans de des du elle en est et il ils je la le les leur leurs lui ma mais me mes mon ne nos notre nous on ont ou par pas pour qu que qui sa se ses son sont sur ta te tes ton tu un une vos votre vous y d l n s c j m t'.split(' '),
);
/** Mots d'une dénomination qui ne désignent personne à eux seuls (forme sociale, civilité, nature de l'entité). */
const GENERIC_NAME = new Set('sarl sas sasu sa sci eurl snc scp selarl societe ste cabinet monsieur madame mme mlle maitre entreprise ets etablissements groupe compagnie association agence syndic gestion'.split(' '));
const words = (q: string) => q.split(/[ ']+/).filter(Boolean);
/** Mot significatif : nombre, ou mot d'au moins trois lettres qui n'est pas un mot vide. */
const significant = (w: string) => /\d/.test(w) || (/^[a-z]{3,}$/.test(w) && !STOP.has(w));
/** Passage : au moins deux mots significatifs (dont un d'au moins trois caractères). Un mot isolé n'en est jamais un. */
const isPassage = (q: string) => {
  const sig = words(q).filter(significant);
  return sig.length >= 2 && sig.some((w) => w.replace(/[^a-z0-9]/g, '').length >= 3);
};
/** Aucun mot significatif dans ce qui reste d'un extrait une fois sa valeur typée retirée. */
const onlyValue = (quote: string, valueText: string) => !words(norm(quote.replace(valueText, ' '))).some(significant);
const best = (evidence: { status?: QuoteStatus }[]): QuoteStatus | null =>
  evidence.some((v) => v.status === 'found') ? 'found' : evidence.some((v) => v.status === 'unknown') ? 'unknown' : evidence.length ? 'not_found' : null;

/**
 * Statut d'un extrait consolidé, contrôlé contre l'extraction (déjà vérifiée) de la pièce qu'il cite.
 * Un mot isolé ne suffit JAMAIS, même long et réellement présent (« janvier », « réponse ») : il se
 * retrouve dans presque toute pièce et ne soutient aucun fait. L'extrait est « trouvé » seulement si :
 *  1. PASSAGE — il compte au moins deux mots significatifs et figure, sur des limites de mots, DANS une
 *     preuve de l'extraction. Seul ce sens vaut : un passage plus long qui contiendrait une preuve
 *     courte (un nom de partie, un montant) peut être inventé autour d'elle ;
 *  2. VALEUR TYPÉE — il se réduit à une date complète, un montant ou une référence, et cette valeur
 *     concorde avec une valeur extraite de la même pièce dont la preuve est retrouvée (une date écrite
 *     autrement que dans la pièce reste ainsi vérifiable) ;
 *  3. NOM DE PARTIE (`partyName`, éléments « parties » seulement) — c'est un mot distinctif figurant dans
 *     une preuve d'une partie extraite de la même pièce, et cette partie est bien celle que l'élément
 *     désigne. La présence du mot dans une autre preuve de la pièce ne compte pas.
 * Sinon : « non retrouvé » (ou « inconnu » pour une pièce lue visuellement) — l'élément reste « à vérifier ».
 */
export function consolidatedQuoteStatus(e: DEv, extractions: Map<string, { data: StoredExtraction; vision: boolean }>, opts: { partyName?: string } = {}): QuoteStatus {
  const x = extractions.get(e.document_id);
  if (!x) return 'not_found';
  const q = norm(e.quote);
  if (q.length < 3) return 'not_found'; // même seuil que quoteStatus : un extrait vide ne prouve rien
  const miss: QuoteStatus = x.vision ? 'unknown' : 'not_found';
  const ev = (k: 'parties' | 'dates' | 'amounts' | 'references' | 'obligations' | 'requests' | 'alleged_facts' | 'referenced_documents') =>
    (x.data[k] as unknown as { evidence: VerifiedQuote[] }[]).flatMap((i) => i.evidence);
  const all: VerifiedQuote[] = (['parties', 'dates', 'amounts', 'references', 'obligations', 'requests', 'alleged_facts', 'referenced_documents'] as const).flatMap(ev);
  // 1. Passage contenu dans une preuve de la pièce.
  if (isPassage(q)) {
    const hits = all.filter((v) => within(norm(v.quote), q));
    if (hits.length) return best(hits) ?? miss;
  }
  // 2. Valeur typée seule, concordante avec une valeur extraite de la pièce.
  const dates = findDates(e.quote);
  if (dates.length === 1 && onlyValue(e.quote, dates[0].text)) {
    const iso = dates[0].iso;
    const st = best([...x.data.dates.filter((d) => d.precision === 'day' && d.date === iso).flatMap((d) => d.evidence as VerifiedQuote[]), ...all.filter((v) => findDates(v.quote).some((h) => h.iso === iso))]);
    return st ?? miss;
  }
  const amounts = findAmounts(e.quote);
  if (amounts.length === 1 && onlyValue(e.quote, amounts[0].text)) {
    const value = amounts[0].value;
    const same = (n: number) => Math.abs(n - value) < 0.005;
    const st = best([...x.data.amounts.filter((a) => same(a.amount)).flatMap((a) => a.evidence as VerifiedQuote[]), ...all.filter((v) => findAmounts(v.quote).some((h) => same(h.value)))]);
    return st ?? miss;
  }
  const ref = x.data.references.filter((r) => norm(r.value) === q && /\d/.test(q));
  if (ref.length) return best(ref.flatMap((r) => r.evidence as VerifiedQuote[])) ?? miss;
  // 3. Nom de partie court : comparaison aux parties extraites de la même pièce, jamais la simple présence d'un mot.
  if (opts.partyName !== undefined) {
    const distinctive = (name: string) => words(name).filter((w) => significant(w) && !GENERIC_NAME.has(w));
    const wanted = norm(opts.partyName);
    // Même partie : noms identiques, ou tous les mots distinctifs du plus court présents dans l'autre
    // (« Lumen » / « Lumen SARL », mais pas « Jean Dupont » / « Jean Martin »).
    const covers = (a: string, b: string) => distinctive(a).length > 0 && distinctive(a).every((w) => words(b).includes(w));
    const hits = x.data.parties
      .filter((p) => {
        const name = norm(p.name);
        return (name === wanted || covers(name, wanted) || covers(wanted, name)) && (name === q || distinctive(q).length > 0);
      })
      // Le mot cité doit figurer dans une preuve de CETTE partie, sur des limites de mots.
      .flatMap((p) => (p.evidence as VerifiedQuote[]).filter((v) => within(norm(v.quote), q)));
    const st = best(hits);
    if (st) return st;
  }
  return miss;
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
  const clean = <T extends { evidence: DEv[] }>(items: T[], party = false): (T & { unverified: boolean })[] =>
    items.map((it) => {
      // Le nom que l'élément désigne n'est transmis que pour les parties : seul un nom de partie peut être vérifié par comparaison.
      const opts = party ? { partyName: (it as unknown as { name: string }).name } : {};
      const kept = it.evidence.filter((e) => ctx.knownDocs.has(e.document_id)).map((e) => ({ ...e, status: consolidatedQuoteStatus(e, ctx.extractions, opts) }));
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
      parties: clean(a.parties, true),
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
