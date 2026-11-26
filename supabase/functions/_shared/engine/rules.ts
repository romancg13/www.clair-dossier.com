// Fournisseur DÉTERMINISTE (« règles ») : extraction et consolidation sans réseau.
// Sert de repli quand aucun fournisseur IA n'est disponible, aux tests et aux
// gros lots de recette. Chaque élément cite l'extrait EXACT dont il provient.
// Il ne lit pas les scans ni les photos (lecture visuelle = fournisseur IA).
import type { PreparedPiece } from './reading.ts';
import type { AnalysisOutput, ExtractionOutput } from './schemas.ts';
import { capitalize, findAmounts, findDates, fold, frEuro, frLongDate, pdfParagraphs, sentences, shortLabel, squash, tidy, type DateHit } from './text-rules.ts';

type Quote = { page: number | null; locator: string | null; quote: string };
interface Unit { page: number | null; locator: string | null; text: string }

/** Paragraphes à repères d'une pièce lisible (PDF texte, texte à repères). */
export function unitsOf(piece: PreparedPiece): Unit[] {
  if (piece.pageTexts) return piece.pageTexts.flatMap((t, i) => pdfParagraphs(t).map((text) => ({ page: i + 1, locator: null, text })));
  if (piece.text) {
    return piece.text.split('\n').filter(Boolean).map((line) => {
      const m = /^\[([^\]]+)\]\s?(.*)$/.exec(line);
      return m ? { page: null, locator: m[1], text: m[2] } : { page: null, locator: null, text: line };
    });
  }
  return [];
}

const DOC_TYPES: { type: string; short: string; test: (head: string, all: string, piece: PreparedPiece) => boolean }[] = [
  { type: 'courriel', short: 'le courriel', test: (_h, _a, p) => p.mime === 'message/rfc822' },
  { type: 'relevé de charges', short: 'le relevé de charges', test: (h) => /releve de charges/.test(h.slice(0, 200)) },
  { type: "avis d'échéance", short: "l'avis d'échéance", test: (h) => /avis d.echeance/.test(h) },
  { type: 'bail commercial', short: 'le bail', test: (h) => /^\s*bail\b|\bbail commercial n/.test(h.slice(0, 60)) },
  { type: 'contrat', short: 'le contrat', test: (h) => /^\s*contrat\b/.test(h) },
  { type: 'facture', short: 'la facture', test: (h) => /\bfacture n/.test(h) },
  { type: 'devis', short: 'le devis', test: (h) => /^\s*devis\b|\bdevis n/.test(h) },
  { type: 'courrier', short: 'le courrier', test: (_h, a) => /(lettre recommandee|objet\s*:|\bmadame,|\bmonsieur,)/.test(a) },
];

/** Pièces citées : type → libellé court (« le bail »). */
const REFERENCED: { re: RegExp; type: string; short: string }[] = [
  { re: /\bbail(?: commercial)?\b/i, type: 'bail commercial', short: 'le bail' },
  { re: /\bcontrat\b/i, type: 'contrat', short: 'le contrat' },
  { re: /\brelev[ée] de charges\b/i, type: 'relevé de charges', short: 'le relevé de charges' },
  { re: /\bavis d.[ée]ch[ée]ance\b/i, type: "avis d'échéance", short: "l'avis d'échéance" },
  { re: /\bfacture\b/i, type: 'facture', short: 'la facture' },
  { re: /\bdevis\b/i, type: 'devis', short: 'le devis' },
];

const TOPICS = ['charges', 'loyer', 'facture', 'honoraires', 'depot', 'taxe', 'salaire', 'indemnite', 'devis', 'acompte'];
export function topicsOf(s: string): string[] {
  const f = fold(s);
  return TOPICS.filter((t) => f.includes(t));
}
export function yearsOf(s: string): string[] {
  return [...new Set(s.match(/\b20\d{2}\b/g) ?? [])];
}

/**
 * Dates d'une phrase, hors bornes de plage : « du 1er octobre 2026 au 31 décembre 2026 »,
 * « Période : 01/10/2026 – 31/12/2026 », « du 1er au 31 décembre 2026 ». Seules les bornes sont
 * écartées : « règlement du solde au plus tard le 15 janvier 2027 » garde son échéance.
 * Un tiret ne fait une plage que pour une paire isolée, dans une phrase qui annonce une période :
 * « à payer : 05/01/2027 - 05/02/2027 - 05/03/2027 » est une liste d'échéances.
 */
const RANGE_WORD = /^\s*(au|a|jusqu.au)\s*$/;
const RANGE_DASH = /^\s*[-–—]\s*$/;
const RANGE_CUE = /\b(periode|exercice|trimestre|semestre|couvrant|allant)\b/;
const RANGE_OPEN = /\bdu\s+(1er|[0-3]?\d)(\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)|\/[01]?\d)?\s+(au|jusqu.au)\s*$/;
function datesOutsideRanges(s: string): DateHit[] {
  const found = findDates(s);
  const link = (i: number, re: RegExp) => i >= 0 && i + 1 < found.length && re.test(fold(s.slice(found[i].index + found[i].text.length, found[i + 1].index)));
  const cue = RANGE_CUE.test(fold(s));
  const joined = (i: number) => link(i, RANGE_WORD) || (cue && link(i, RANGE_DASH) && !link(i - 1, RANGE_DASH) && !link(i + 1, RANGE_DASH));
  return found.filter((d, i) => !joined(i) && !joined(i - 1) && !RANGE_OPEN.test(fold(s.slice(0, d.index))));
}

/** Somme en faveur du client (solde créditeur, trop-perçu) : ni réclamée, ni due par lui. */
const CREDIT_TO = 'en votre faveur|en faveur d(?:u|e la|es) (?:locataire|preneur|client)s?|en faveur de votre (?:societe|entreprise)|crediteur|a votre credit';
const CREDIT = new RegExp(`(${CREDIT_TO}|trop[- ]?percu)`, 'g');
/** Bénéficiaire cité juste après le montant : « un solde de 270,00 € en votre faveur ». */
const CREDIT_AFTER = new RegExp(`^\\s*(\\([^)]*\\)\\s*)?,?\\s*(${CREDIT_TO})`);
/** « En faveur de … » réclamant : tout bénéficiaire autre que le client (bailleur, propriétaire, SCI…). */
const FAVOR_THIRD = /en faveur (?!d(?:u|e la|es) (?:locataire|preneur|client)|de votre (?:societe|entreprise))/;
/**
 * Indice d'une autre somme placé APRÈS la mention du crédit (« trop-perçu de 270 €, le solde en faveur du
 * bailleur s'élève à… »). Les mots de contexte du crédit lui-même (régularisation, provisions, charges)
 * n'en sont pas : « Solde créditeur après régularisation : 270,00 € » reste un crédit.
 */
const KIND_CUE = /(reclam|en faveur|appel|demand|solde|reste|restant|a payer|exigible|doit|regle|paye|verse|acquitte|total)/;
function creditToClient(b: string): boolean {
  const last = [...b.matchAll(CREDIT)].pop();
  if (!last) return false;
  // Une autre somme entre le crédit et ce montant : le crédit portait sur elle.
  const tail = b.slice((last.index ?? 0) + last[0].length);
  return !KIND_CUE.test(tail) && !findAmounts(tail).length;
}

function amountKind(before: string, sentence: string, after = ''): ExtractionOutput['amounts'][number]['kind'] {
  const b = fold(before.slice(-70));
  const s = fold(sentence);
  if (creditToClient(b) || CREDIT_AFTER.test(fold(after))) return 'other';
  if (/(reclam|regularisation|appel|demand)/.test(b) || FAVOR_THIRD.test(b)) return 'claimed';
  if (/(solde|reste|restant|du\b|a payer|exigible|doit)/.test(b)) return 'due';
  if (/(regle|paye|verse|provision|acquitte)/.test(b)) return 'paid';
  if (/total/.test(b)) return 'total';
  if (/(ecart|difference)/.test(b)) return 'other';
  if (/reclam/.test(s) || FAVOR_THIRD.test(s)) return 'claimed';
  return 'other';
}

function partiesOf(units: Unit[], all: string): ExtractionOutput['parties'] {
  const out = new Map<string, ExtractionOutput['parties'][number]>();
  const fall = fold(all);
  const add = (name: string, role: string, u: Unit, quote: string) => {
    const key = fold(name).replace(/\s+/g, ' ').trim();
    if (key.length < 4 || out.has(key)) return;
    out.set(key, { name: squash(name), role, evidence: [{ page: u.page, locator: u.locator, quote }] });
  };
  for (const u of units) {
    for (const m of u.text.matchAll(/\bSCI(?: des| de la| du| de)? [A-ZÉ][\wÀ-ÿ'-]+/g)) add(m[0], /bailleur|proprietaire/.test(fall) ? 'bailleur' : 'société civile immobilière', u, m[0]);
    for (const m of u.text.matchAll(/\bCabinet [A-ZÉ][\wÀ-ÿ-]+(?: [A-ZÉ][\wÀ-ÿ-]+){0,2}/g)) add(m[0], /gestion/.test(fold(m[0])) ? 'gestionnaire pour le bailleur' : 'cabinet', u, m[0]);
    // Fin de chaque nom de SCI de l'unité : « SCI des Tilleuls Atelier Lumen SARL » (colonnes accolées) = deux parties, pas une.
    const finsSci = new Set([...u.text.matchAll(/\bSCI(?: des| de la| du| de)? [A-ZÉ][\wÀ-ÿ'-]+/g)].map((m) => m.index + m[0].length));
    for (const m of u.text.matchAll(/\b([A-ZÉ][\wÀ-ÿ'-]+(?: [A-ZÉ][\wÀ-ÿ'-]+){0,2}) (SARL|SAS|SASU|EURL|EI)\b/g)) {
      const premier = m[1].split(' ')[0];
      const nom = finsSci.has(m.index + premier.length) && m[1].includes(' ') ? m[0].slice(premier.length + 1) : m[0];
      add(nom, /(preneur|locataire)/.test(fall) ? 'locataire (preneur)' : 'société', u, nom);
    }
    if (u.locator === 'en-tête De') {
      const m = /^"?([^"<]+?)"?\s*</.exec(u.text);
      if (m) add(m[1], 'expéditeur du courriel', u, m[1].trim());
    }
    if (u.locator === 'en-tête À') {
      // Destinataire nommé (« Hélène Verdier <…> ») ou simple adresse (« gestion@… »).
      const m = /^"?([^"<,]+?)"?\s*(<|,|$)/.exec(u.text);
      if (m) add(m[1], 'destinataire du courriel', u, m[1].trim());
    }
    for (const m of u.text.matchAll(/\b(?:Mme|Madame|M\.|Monsieur) ([A-ZÉ][\wÀ-ÿ-]+ [A-ZÉ][\wÀ-ÿ-]+)/g)) add(m[1], /g[ée]rante?/.test(u.text) ? 'gérant(e)' : 'personne citée', u, m[0]);
  }
  return [...out.values()];
}

/** Extraction par règles d'une pièce lisible (texte disponible). */
export function extractByRules(piece: PreparedPiece, fileName: string): ExtractionOutput {
  const units = unitsOf(piece);
  const all = units.map((u) => u.text).join('\n');
  const head = fold(units.slice(0, 6).map((u) => u.text).join('\n'));
  const fall = fold(all);
  const typeDef = DOC_TYPES.find((t) => t.test(head, fall, piece));
  const docType = typeDef?.type ?? 'document';
  const issuer =
    piece.mime === 'message/rfc822'
      ? (/^"?([^"<]+?)"?\s*</.exec(units.find((u) => u.locator === 'en-tête De')?.text ?? '')?.[1] ?? null)
      : (units[0] && units[0].text.length < 60 && !findDates(units[0].text).length && !fold(units[0].text).includes(fold(typeDef?.type ?? '\u0000')) ? units[0].text.replace(/\s+[—-].*$/, '') : null);

  const dates: ExtractionOutput['dates'] = [];
  const amounts: ExtractionOutput['amounts'] = [];
  const references: ExtractionOutput['references'] = [];
  const requests: ExtractionOutput['requests'] = [];
  const alleged: ExtractionOutput['alleged_facts'] = [];
  const obligations: ExtractionOutput['obligations'] = [];
  const referenced: ExtractionOutput['referenced_documents'] = [];
  const sheetHasEuro = /€/.test(all);
  const sheetName = (u: Unit) => /^feuille (.+), ligne/.exec(u.locator ?? '')?.[1] ?? '';

  for (const u of units) {
    for (const s of sentences(u.text)) {
      const fs = fold(s);
      const ev: Quote[] = [{ page: u.page, locator: u.locator, quote: s }];
      // Dates (les bornes d'une plage ne sont pas des événements ; les autres dates de la phrase sont gardées)
      for (const d of datesOutsideRanges(s)) {
        const isHeaderDate = u.locator === 'en-tête Date';
        const before = fold(s.slice(0, d.index));
        let kind: ExtractionOutput['dates'][number]['kind'] = 'event_date';
        // « Marseille, le 12 octobre 2026 » : la phrase s'arrête à la date (ligne d'en-tête). Une incise
        // (« Pour mémoire, le 2 octobre 2026, vous avez réglé… ») se poursuit : ce n'est pas la date du document.
        const placeLine = /^[a-zà-ÿ' -]{2,30}, le\s*$/.test(before) && !/^\s*(,\s*\S|[a-zà-ÿ])/.test(s.slice(d.index + d.text.length));
        if (isHeaderDate || placeLine || /(fait a .{2,40}, le\s*$|emis le\s*$|etabli le\s*$|en date du\s*$)/.test(before)) kind = 'document_date';
        else if (/(avant le|au plus tard|exigible|date limite|echeance de paiement|a regler|a payer|reponse .* attendue)/.test(fs)) kind = 'deadline';
        let label: string;
        const signed = /(bail(?: commercial)?|contrat|avenant|acte)([^,.;]{0,40}?),?\s*sign[ée]e?s? le\s*$/i.exec(s.slice(0, d.index));
        if (kind === 'document_date') label = docType === 'bail commercial' || docType === 'contrat' ? `Signature du ${docType}` : `${capitalize(docType)}${issuer ? ` (${issuer})` : ''}`;
        else if (signed) label = `Signature du ${squash(signed[1] + signed[2])}`.replace(/\s+n°/, ' n°');
        else {
          label = shortLabel(s, [`avant le ${d.text}`, `au plus tard le ${d.text}`, `le ${d.text}`, `du ${d.text}`, `au ${d.text}`, d.text]);
          if (label.length < 14) label = `${capitalize(docType)} : ${label.toLowerCase()}`;
        }
        dates.push({ date: d.iso, precision: 'day', label, kind, evidence: ev });
        if (signed) referenced.push({ label: `${signed[1]}${signed[2]}`.trim(), short_label: REFERENCED.find((r) => r.re.test(signed[1]))?.short ?? `le ${signed[1].toLowerCase()}`, date: d.iso, evidence: ev });
      }
      // Montants (lignes de tableur traitées à part, cellule par cellule)
      const hits = u.locator?.startsWith('feuille') ? [] : findAmounts(s);
      hits.forEach((a, k) => {
        const after = s.slice(a.index + a.text.length, hits[k + 1]?.index ?? s.length);
        amounts.push({ amount: a.value, currency: 'EUR', label: shortLabel(s, [a.text, /\(([^)]*euros?)\)/i.exec(s)?.[0] ?? '\u0000']), kind: amountKind(s.slice(0, a.index), s, after), evidence: ev });
      });
      // Références (numéros)
      for (const m of s.matchAll(/\b(?:n°|référence\s*:?)\s*([A-Z0-9][A-Z0-9 -]{3,24}[0-9])/gi)) {
        references.push({ value: m[1].trim(), label: shortLabel(s.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0), [], 40) || 'référence', evidence: ev });
      }
      // Pièces citées (jointes, signées, en référence)
      if (/(joint|ci-joint|annex|pieces jointes|reference\s*:)/.test(fs)) {
        for (const r of REFERENCED) {
          if (r.re.test(s) && r.type !== docType && !referenced.some((x) => x.short_label === r.short)) referenced.push({ label: r.type, short_label: r.short, date: null, evidence: ev });
        }
      }
      if (/(je vous demande|merci de|veuillez|nous vous remercions de bien vouloir|je sollicite)/.test(fs)) requests.push({ text: s, evidence: ev });
      if (/^(je |j'|le loyer .* a ete regle|nous contestons)/.test(fs) && /(conteste|regle|paye|propose|demande)/.test(fs)) alleged.push({ text: s, asserted_by: issuer ?? 'expéditeur', evidence: ev });
      if (/^le (preneur|bailleur|locataire|client|prestataire) (verse|assure|justifie|doit|s'engage|paie)/.test(fs)) obligations.push({ text: s, owner: capitalize(/^le (\w+)/.exec(fs)?.[1] ?? ''), evidence: ev });
    }
    // Lignes de tableur : montants sans symbole, colonne en euros.
    if (u.locator?.startsWith('feuille') && sheetHasEuro) {
      const cells = u.text.split(' ; ');
      const last = Number(cells[cells.length - 1].replace(',', '.'));
      if (cells.length > 1 && Number.isFinite(last) && /(total|solde|reste|montant|a payer|provisions?)/.test(fold(cells[0]))) {
        const label = `${cells[0]} (${sheetName(u)})`;
        amounts.push({ amount: last, currency: 'EUR', label, kind: amountKind(cells[0], cells[0]), evidence: [{ page: null, locator: u.locator, quote: u.text }] });
      }
    }
  }

  const docDate = dates.find((d) => d.kind === 'document_date')?.date ?? null;
  const objet = units.find((u) => /^objet\s*:/i.test(u.text) || u.locator === 'en-tête Objet')?.text.replace(/^objet\s*:\s*/i, '');
  const firstLong = units.map((u) => u.text).find((t) => t.length > 50 && !findDates(t).length) ?? '';
  const summary = tidy(`${capitalize(docType)}${issuer ? ` de ${issuer}` : ''}${docDate ? ` du ${frLongDate(docDate)}` : ''} : ${objet ?? firstLong}`).slice(0, 300);

  return {
    document_type: docType,
    language: 'fr',
    summary,
    parties: partiesOf(units, all),
    dates,
    amounts,
    references,
    obligations,
    requests,
    alleged_facts: alleged,
    referenced_documents: referenced,
    missing_elements: [],
    quality: { readable: true, notes: `Lecture par règles déterministes (${fileName}).` },
  };
}

/* ── Consolidation par règles ───────────────────────────────────────────── */

export interface ConsolidationPiece {
  document_id: string;
  file_name: string;
  data: ExtractionOutput;
}
export interface ConsolidationEvent {
  key: string;
  date: string;
  kind: 'document_date' | 'event_date';
  label: string;
  evidence: { document_id: string; page: number | null; locator?: string | null; quote: string }[];
}
export interface ConsolidationInput {
  today: string;
  title: string;
  typology: string | null;
  objective: string | null;
  pieces: ConsolidationPiece[];
  events: ConsolidationEvent[];
  total: number;
  unreadable: { document_id: string; file_name: string; reason: string }[];
  /** Autres pièces du dossier non exploitées par ce fournisseur (noms seulement). */
  others?: { document_id: string; file_name: string }[];
}

type DQ = AnalysisOutput['facts'][number]['evidence'][number];
const dq = (id: string, e: Quote): DQ => ({ document_id: id, page: e.page, locator: e.locator, quote: e.quote });

export function consolidateByRules(input: ConsolidationInput): AnalysisOutput {
  const { pieces, today } = input;
  const typeOf = new Map(pieces.map((p) => [p.document_id, p.data.document_type]));
  const allAmounts = pieces.flatMap((p) => p.data.amounts.map((a) => ({ ...a, id: p.document_id, file: p.file_name, docType: p.data.document_type })));
  const allDates = pieces.flatMap((p) => p.data.dates.map((d) => ({ ...d, id: p.document_id, file: p.file_name })));

  // Contradictions de montants : même objet (charges, loyer…), années compatibles, réclamé/dû, valeurs différentes, pièces différentes.
  const contradictions: AnalysisOutput['contradictions'] = [];
  const seenPairs = new Set<string>();
  // Les pièces émises par un tiers (courrier, facture, relevé) priment sur les déclarations du titulaire (courriel).
  const rank = (t: string) => ['courrier', 'facture', "avis d'échéance", 'relevé de charges', 'bail commercial', 'contrat', 'devis', 'document'].indexOf(t) + 1 || 9;
  const cmp = allAmounts.filter((a) => a.kind === 'claimed' || a.kind === 'due').sort((a, b) => rank(a.docType) - rank(b.docType));
  // Mise en forme des montants gardée en mémoire le temps de la comparaison : chaque paire relit les écarts déjà
  // relevés, et la mise en forme (Intl) dominait le calcul d'un gros dossier. Résultat strictement identique.
  const euros = new Map<number, string>();
  const euro = (v: number) => euros.get(v) ?? (euros.set(v, frEuro(v)), euros.get(v)!);
  for (let i = 0; i < cmp.length; i++) {
    for (let j = i + 1; j < cmp.length; j++) {
      const a = cmp[i], b = cmp[j];
      if (a.id === b.id || a.amount === b.amount) continue;
      const typed = (t: string) => (['courrier', 'courriel', 'document'].includes(t) ? '' : t);
      const ta = topicsOf(`${a.label} ${typed(a.docType)}`), tb = topicsOf(`${b.label} ${typed(b.docType)}`);
      if (!ta.some((t) => tb.includes(t))) continue;
      const ya = yearsOf(`${a.label} ${a.evidence[0]?.quote ?? ''}`), yb = yearsOf(`${b.label} ${b.evidence[0]?.quote ?? ''}`);
      if (ya.length && yb.length && !ya.some((y) => yb.includes(y))) continue;
      const pair = [a.amount, b.amount].sort((x, y) => x - y).join('/');
      const haut = euro(Math.max(a.amount, b.amount)), bas = euro(Math.min(a.amount, b.amount));
      const existing = contradictions.find((c) => c.kind === 'amount' && c.text.includes(haut) && c.text.includes(bas));
      if (existing) {
        for (const x of [a, b]) if (!existing.evidence.some((e) => e.document_id === x.id && e.quote === x.evidence[0].quote)) existing.evidence.push(dq(x.id, x.evidence[0]));
        continue;
      }
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      const [hi, lo] = a.amount > b.amount ? [a, b] : [b, a];
      contradictions.push({
        kind: 'amount',
        text: `Montants différents : ${frEuro(hi.amount)} (${hi.docType}) contre ${frEuro(lo.amount)} (${lo.docType}), soit un écart de ${frEuro(Math.round((hi.amount - lo.amount) * 100) / 100)}.`,
        event_keys: [],
        evidence: [dq(hi.id, hi.evidence[0]), dq(lo.id, lo.evidence[0])],
      });
    }
  }

  // Pièces citées : absentes du lot → manquantes ; présentes avec une autre date → contradiction de date.
  const missing: AnalysisOutput['missing_items'] = [];
  for (const p of pieces) {
    for (const r of p.data.referenced_documents) {
      const def = REFERENCED.find((x) => x.short === r.short_label);
      const present = pieces.filter((q) => q.document_id !== p.document_id && def && q.data.document_type === def.type);
      // Pièce déposée mais pas encore lue (scan en attente de lecture) : présente d'après son nom.
      const toks = def ? fold(def.type).split(/[^a-z]+/).filter((t) => t.length >= 4) : [];
      const byName = toks.length > 0 && (input.others ?? []).some((o) => toks.every((t) => fold(o.file_name).includes(t)));
      if (!present.length && byName) continue;
      if (!present.length) {
        if (!missing.some((m) => m.short_label === r.short_label)) missing.push({ text: `${capitalize(r.short_label)} est cité mais ne figure pas dans le dossier.`, why: 'Pièce citée par une autre pièce : utile pour vérifier les montants et les dates.', kind: 'referenced', short_label: r.short_label, evidence: [dq(p.document_id, r.evidence[0])] });
        continue;
      }
      if (r.date) {
        for (const q of present) {
          // La date citée est comparée à toutes les dates propres de la pièce (établie le…, fait à…, le…).
          const owns = q.data.dates.filter((d) => d.kind === 'document_date');
          const own = owns[0];
          if (own && !owns.some((d) => d.date === r.date)) {
            const k1 = input.events.find((e) => e.date === r.date && e.evidence.some((x) => x.document_id === p.document_id))?.key;
            const k2 = input.events.find((e) => e.date === own.date && e.evidence.some((x) => x.document_id === q.document_id))?.key;
            contradictions.push({
              kind: 'date',
              text: `Date différente pour ${r.short_label} : le ${frLongDate(r.date)} selon ${DOC_TYPES.find((t) => t.type === typeOf.get(p.document_id))?.short ?? 'une autre pièce'}, le ${frLongDate(own.date)} selon ${r.short_label} lui-même.`,
              event_keys: [k1, k2].filter((k): k is string => Boolean(k)),
              evidence: [dq(p.document_id, r.evidence[0]), dq(q.document_id, own.evidence[0])],
            });
          }
        }
      }
    }
  }
  for (const u of input.unreadable) missing.push({ text: `« ${u.file_name} » n'a pas pu être lue.`, why: u.reason, kind: 'unreadable', short_label: `une copie lisible de « ${u.file_name} »`, evidence: [] });

  // Échéances : dates limites écrites (confirmées si à venir), rendez-vous proposés (à confirmer).
  const deadlines: AnalysisOutput['deadlines'] = [];
  // Courriel du titulaire à un tiers : la date qu'il y demande (« je … vous demande … avant le … »)
  // engage le tiers, pas le client. Le titulaire écrit à un tiers quand l'expéditeur n'est pas un
  // gestionnaire (bailleur, cabinet) et que le destinataire en est un, ou quand l'expéditeur est nommé
  // comme gérant ou locataire dans le dossier et que le destinataire est quelqu'un d'autre.
  const THIRD = /(gestionnaire|bailleur|cabinet|societe civile)/;
  const holders = pieces.flatMap((p) => p.data.parties).filter((x) => /(gerant|locataire|preneur)/.test(fold(x.role))).map((x) => fold(x.name));
  const isHolder = (name: string) => name.length >= 4 && holders.some((h) => h.includes(name) || name.includes(h));
  const sentToThird = (id: string) => {
    if (typeOf.get(id) !== 'courriel') return false;
    const parties = pieces.find((p) => p.document_id === id)?.data.parties ?? [];
    const at = (locator: string) => parties.find((x) => x.evidence[0]?.locator === locator);
    const from = at('en-tête De'), to = at('en-tête À');
    if (THIRD.test(fold(from?.role ?? ''))) return false;
    if (THIRD.test(fold(to?.role ?? ''))) return true;
    return !!from && !!to && isHolder(fold(from.name)) && !isHolder(fold(to.name));
  };
  const askedOfThird = new Set<AnalysisOutput['deadlines'][number]>();
  for (const d of allDates) {
    const fs = fold(d.evidence[0]?.quote ?? '');
    if (d.kind === 'deadline') {
      // Demande à la première personne, où qu'elle soit dans la phrase (« Par conséquent, je vous demande… »).
      const asked = /(^|[\s,;:(])(je |j['’]|nous )/.test(fs) && /(\bvous (demande|demandons|prie|prions|remercie|remercions|saurais gre|saurions gre)\b|sollicit)/.test(fs) && sentToThird(d.id);
      const toClient = !asked && /(votre|vous|preneur|locataire|a payer|exigible)/.test(fs);
      const x: AnalysisOutput['deadlines'][number] = { title: d.label, date: d.date, kind: 'mentioned', basis: `Date écrite dans ${typeOf.get(d.id)}`, priority: d.date >= today ? 'haute' : 'normale', owner: toClient ? 'client' : 'tiers', owner_name: null, evidence: [dq(d.id, d.evidence[0])] };
      deadlines.push(x);
      if (asked) askedOfThird.add(x);
    } else if (d.kind === 'event_date' && d.date >= today && /(rendez-vous|reunion|audience|propose)/.test(fs)) {
      deadlines.push({ title: `${d.label} (proposition, non confirmée)`, date: d.date, kind: 'hypothesis', basis: 'Proposition écrite, sans confirmation dans les pièces', priority: 'normale', owner: 'client', owner_name: null, evidence: [dq(d.id, d.evidence[0])] });
    }
  }
  const dedup = new Map<string, AnalysisOutput['deadlines'][number]>();
  // À date égale, l'échéance du client prime sur celle demandée au tiers.
  for (const d of [...deadlines].sort((a, b) => Number(askedOfThird.has(a)) - Number(askedOfThird.has(b)))) if (!dedup.has(`${d.date}|${d.kind}`)) dedup.set(`${d.date}|${d.kind}`, d);
  const dl = [...dedup.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const nextConfirmed = dl.find((d) => d.kind === 'mentioned' && !askedOfThird.has(d) && d.date && d.date >= today);

  // Faits : montants réclamés / dus, allégations, références de pièces.
  const facts: AnalysisOutput['facts'] = [];
  for (const a of allAmounts.filter((x) => x.kind !== 'other')) facts.push({ text: `${a.label} : ${frEuro(a.amount)}.`, status: 'documented', evidence: [dq(a.id, a.evidence[0])] });
  for (const p of pieces) for (const f of p.data.alleged_facts) facts.push({ text: f.text, status: 'asserted_by_party', evidence: f.evidence.map((e) => dq(p.document_id, e)) });

  const claimed = allAmounts.filter((a) => a.kind === 'claimed').sort((a, b) => rank(a.docType) - rank(b.docType) || b.amount - a.amount || a.label.length - b.label.length)[0];
  const amountC = contradictions.find((c) => c.kind === 'amount');
  const dateC = contradictions.find((c) => c.kind === 'date');
  const referencedMissing = missing.find((m) => m.kind === 'referenced');
  const unreadableMissing = missing.find((m) => m.kind === 'unreadable');
  const issuerOf = (id: string) => pieces.find((p) => p.document_id === id)?.data.parties.find((x) => /gestionnaire|bailleur|cabinet/.test(x.role))?.name;

  const s1 = claimed
    ? `Au ${frLongDate(today)}, ${issuerOf(claimed.id) ?? 'votre interlocuteur'} réclame ${frEuro(claimed.amount)}${/charges/i.test(claimed.label) ? ' au titre des charges' : ''}${yearsOf(claimed.label)[0] ? ` ${yearsOf(claimed.label)[0]}` : ''}.`
    : pieces.length
      ? `Au ${frLongDate(today)}, ${pieces.length} pièce${pieces.length > 1 ? 's' : ''} de votre dossier ${pieces.length > 1 ? 'ont été lues' : 'a été lue'}.`
      : `Au ${frLongDate(today)}, aucune pièce de votre dossier n'a encore pu être lue.`;
  // « others » mêle pièces illisibles et lectures reportées : seules ces dernières sont « en attente ».
  const unreadableIds = new Set(input.unreadable.map((u) => u.document_id));
  const pending = (input.others ?? []).filter((o) => !unreadableIds.has(o.document_id)).length;
  const unreadableCount = input.unreadable.length;
  const s2parts: string[] = [];
  if (amountC) s2parts.push(amountC.text.replace(/^Montants différents : /, 'Les pièces ne concordent pas : ').replace(/\.$/, ''));
  if (nextConfirmed) s2parts.push(`réponse attendue avant le ${frLongDate(nextConfirmed.date!)}`);
  if (!s2parts.length && referencedMissing) s2parts.push(`il manque ${referencedMissing.short_label} pour vérifier`);
  if (!s2parts.length && pending) s2parts.push(`${pending} pièce${pending > 1 ? 's sont' : ' est'} en attente de lecture : vous serez prévenu dès que les résultats seront prêts`);
  if (!s2parts.length && unreadableCount) s2parts.push(`${unreadableCount} pièce${unreadableCount > 1 ? 's n\'ont' : ' n\'a'} pas pu être lue${unreadableCount > 1 ? 's' : ''} : merci de ${unreadableCount > 1 ? 'les' : 'la'} redéposer dans une version lisible`);
  const s2 = s2parts.length ? `${capitalize(s2parts.join(' ; '))}.` : '';
  const situation = tidy(`${s1} ${s2}`);

  let primary: AnalysisOutput['primary_action'];
  if (referencedMissing) primary = { label: `Joindre ${referencedMissing.short_label}`, owner: 'client', rationale: referencedMissing.text, due_date: null };
  else if (unreadableMissing) primary = { label: 'Redéposer une pièce lisible', owner: 'client', rationale: unreadableMissing.text, due_date: null };
  else if (dateC) primary = { label: 'Vérifier la date', owner: 'client', rationale: dateC.text, due_date: null };
  else if (amountC) primary = { label: 'Vérifier le montant', owner: 'client', rationale: amountC.text, due_date: nextConfirmed?.date ?? null };
  else if (nextConfirmed) primary = { label: 'Préparer votre réponse', owner: nextConfirmed.owner, rationale: nextConfirmed.title, due_date: nextConfirmed.date };
  else primary = { label: 'Rien à faire pour le moment', owner: 'personne', rationale: pending && !pieces.length ? 'La lecture de vos pièces est en attente ; aucune action de votre part n\'est nécessaire.' : 'Aucune échéance ni pièce manquante relevée.', due_date: null };

  // Jalons : événements datés les plus utiles (signature, courriers, contestation, rendez-vous), 3 à 5.
  const score = (e: ConsolidationEvent) => (/signature/i.test(e.label) ? 3 : 0) + (/(courrier|courriel)/i.test(e.label) ? 2 : 0) + (/(conteste|rendez-vous|regl|propose)/i.test(fold(e.label)) ? 2 : 0) + (e.kind === 'document_date' ? 1 : 0);
  const milestones = [...input.events].sort((a, b) => score(b) - score(a) || a.date.localeCompare(b.date)).slice(0, 5).map((e) => ({ event_key: e.key, importance: (score(e) >= 3 ? 'majeure' : 'utile') as 'majeure' | 'utile' }));

  const keyFacts = [
    ...(claimed ? [{ text: `Somme réclamée : ${frEuro(claimed.amount)} (${shortLabel(claimed.label, [], 70)}).`, status: 'documented' as const, evidence: [dq(claimed.id, claimed.evidence[0])] }] : []),
    ...(amountC ? [{ text: amountC.text, status: 'documented' as const, evidence: amountC.evidence }] : []),
    ...(nextConfirmed ? [{ text: `Date limite écrite : ${frLongDate(nextConfirmed.date!)} (${nextConfirmed.title}).`, status: 'documented' as const, evidence: nextConfirmed.evidence }] : []),
    ...(dateC ? [{ text: dateC.text, status: 'documented' as const, evidence: dateC.evidence }] : []),
    ...facts.filter((f) => f.status === 'asserted_by_party').slice(0, 2),
  ].slice(0, 5);

  const third = pieces.flatMap((p) => p.data.parties).find((x) => /gestionnaire|cabinet/.test(x.role));
  const drafts: AnalysisOutput['reminder_drafts'] = [];
  if (amountC || referencedMissing) {
    drafts.push({
      audience: 'third_party',
      subject: amountC ? 'Demande de justificatifs avant règlement' : `Demande de copie : ${referencedMissing!.short_label}`,
      body: amountC
        ? `Bonjour,\n\nNous avons bien reçu votre demande. ${amountC.text} Pourriez-vous nous adresser le détail et les justificatifs correspondants ?${nextConfirmed ? ` Nous reviendrons vers vous avant le ${frLongDate(nextConfirmed.date!)}.` : ''}\n\nCordialement,`
        : `Bonjour,\n\nPourriez-vous nous transmettre une copie de ${referencedMissing!.short_label} ?\n\nCordialement,`,
      suggested_date: null,
      recipient_hint: third?.name ?? 'votre interlocuteur',
      condition: 'À envoyer seulement si vous n’avez pas déjà reçu ces éléments ; relisez et adaptez avant tout envoi.',
      related_deadline: nextConfirmed?.date ?? null,
    });
  }

  const attention = [
    ...contradictions.map((c) => c.text),
    ...missing.map((m) => m.text),
    ...(input.total > pieces.length ? [`${input.total - pieces.length} pièce(s) non exploitée(s).`] : []),
  ];

  return {
    situation,
    summary_short: situation,
    summary_long: pieces.map((p) => `• ${p.data.summary}`).join('\n'),
    parties: (() => {
      const m = new Map<string, AnalysisOutput['parties'][number]>();
      for (const p of pieces) for (const x of p.data.parties) if (!m.has(fold(x.name))) m.set(fold(x.name), { name: x.name, role: x.role, evidence: x.evidence.map((e) => dq(p.document_id, e)) });
      return [...m.values()];
    })(),
    facts,
    key_facts: keyFacts,
    amounts: allAmounts.filter((a) => a.kind !== 'other').map((a) => ({ label: a.label, amount: a.amount, currency: a.currency, kind: a.kind, evidence: [dq(a.id, a.evidence[0])] })),
    deadlines: dl,
    contradictions,
    missing_items: missing,
    milestones,
    primary_action: primary,
    attention_points: attention,
    next_actions: [primary.label, ...(nextConfirmed && primary.label !== 'Préparer votre réponse' ? [`Préparer la réponse attendue avant le ${frLongDate(nextConfirmed.date!)}`] : [])],
    reminder_drafts: drafts,
  };
}
