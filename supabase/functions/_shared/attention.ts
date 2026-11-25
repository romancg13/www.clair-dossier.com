// Boîte d'attention ClairDossier — module PUR (aucune dépendance Deno/Supabase/IA),
// partagé par le site (espace client, démo) et, au besoin, par le worker.
//
// À partir de la dernière analyse (AnalysisData), des échéances enregistrées et
// de la couverture documentaire, produit une liste PRIORISÉE et BORNÉE de points
// d'attention. Règles strictement DÉTERMINISTES : aucun appel de modèle, aucune
// date ni aucun fait inventé — chaque point reprend une donnée déjà présente et
// indique sa nature (fait documenté, déclaration, hypothèse, contradiction,
// information absente), sa source, sa conséquence et la prochaine action.
//
// Règle métier imposée : une facture échue SANS preuve documentée de
// non-paiement est un « paiement à vérifier », jamais un « impayé ».
import { deadlineKey, type Evidence } from './ai-pipeline.ts';
import { FACT_LABEL, KIND_LABEL, frDate, sources, type AnalysisData, type CoverageInfo, type DeadlineRow } from './analysis-model.ts';

/* ── Types ──────────────────────────────────────────────────────────────── */

export type AttentionLevel = 'urgent' | 'important' | 'a_confirmer';
export type AttentionNature = 'documented' | 'asserted_by_party' | 'hypothesis' | 'contradiction' | 'difference' | 'contested' | 'missing';
export type AttentionCategory =
  | 'echeance_depassee'
  | 'paiement_a_verifier'
  | 'echeance_proche'
  | 'contradiction'
  | 'analyse_partielle'
  | 'piece_manquante'
  | 'fait_non_source'
  | 'hypothese'
  | 'declaration';

export const LEVEL_LABEL: Record<AttentionLevel, string> = { urgent: 'Urgent', important: 'Important', a_confirmer: 'À confirmer' };

/** Nature de l'information — libellés dérivés de FACT_LABEL / KIND_LABEL (une seule source de vocabulaire). */
export const NATURE_LABEL: Record<AttentionNature, string> = {
  documented: `Fait ${FACT_LABEL.documented}`,
  asserted_by_party: `Fait ${FACT_LABEL.asserted_by_party}`,
  hypothesis: KIND_LABEL.hypothesis,
  contradiction: 'Contradiction entre pièces',
  difference: 'Différence entre documents',
  contested: 'Point contesté',
  missing: 'Information absente',
};

export interface AttentionItem {
  /** Identifiant stable (catégorie + clé) : sert de clé d'affichage et aux tests. */
  id: string;
  level: AttentionLevel;
  category: AttentionCategory;
  nature: AttentionNature;
  /** Information importante, en une phrase. */
  title: string;
  /** Source lisible : pièce et page, ou mention explicite de l'absence de source. */
  source: string;
  evidence: Evidence[];
  consequence: string;
  /** Prochaine action proposée à l'utilisateur. */
  action: string;
  /** Date concernée (échéances), au format ISO. */
  date?: string;
}

/** Échéance enregistrée (dossier_deadlines) — seules ces colonnes sont nécessaires ; ai_key est facultative. */
export type AttentionDeadline = Pick<DeadlineRow, 'title' | 'due_date' | 'priority' | 'done'> & { ai_key?: string | null };

export interface AttentionInput {
  analysis: AnalysisData;
  coverage: CoverageInfo;
  /** Échéances enregistrées : elles priment sur celles de l'analyse (corrections, « fait », ajouts manuels). */
  deadlines?: AttentionDeadline[];
  /** Date du jour (AAAA-MM-JJ) — injectée pour rester déterministe. */
  today: string;
  /** Nom des pièces par identifiant. */
  documentNames?: Record<string, string>;
  /** Nombre de points affichés d'emblée ; le reste est replié. */
  max?: number;
}

export interface AttentionResult {
  /** Points affichés d'emblée (au plus `max`), du plus pressant au moins pressant. */
  items: AttentionItem[];
  /** Points repliés. */
  more: AttentionItem[];
  total: number;
}

export const ATTENTION_MAX = 5;
/** Jalons de rappel d'une échéance proche, en jours. */
export const NEAR_MILESTONES = [1, 3, 7] as const;

/* ── Outils ─────────────────────────────────────────────────────────────── */

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

/** Écart en jours entiers entre deux dates AAAA-MM-JJ (b − a), indépendant du fuseau. */
export function daysBetween(a: string, b: string): number {
  const t = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Jalon atteint par une échéance à venir : J-1 (≤ 1 j), J-3 (≤ 3 j), J-7 (≤ 7 j), sinon null. */
export function milestone(daysLeft: number): 1 | 3 | 7 | null {
  if (daysLeft < 0) return null;
  return NEAR_MILESTONES.find((m) => daysLeft <= m) ?? null;
}

const PAYMENT = /factur|paiement|reglement|solde|loyer|acompte|creance/;
const NON_PAYMENT = /impaye|non[- ]paiement|non[- ]regle|pas ete (regle|paye|honore)|n'a pas (regle|paye)|rejet de (prelevement|cheque|virement)|sans provision|aucun (paiement|reglement|versement|encaissement)/;

/** Une échéance porte-t-elle sur un paiement ? (intitulé ou base de calcul) */
export function isPaymentDeadline(title: string, basis = ''): boolean {
  return PAYMENT.test(norm(`${title} ${basis}`));
}

/**
 * Preuve de non-paiement : un fait DOCUMENTÉ (statut « documenté », source
 * présente et vérifiée) qui constate l'absence de paiement. Une déclaration
 * d'une partie ou une déduction ne suffit pas.
 */
export function nonPaymentProof(analysis: AnalysisData): AnalysisData['facts'][number] | null {
  return analysis.facts.find((f) => f.status === 'documented' && f.evidence.length > 0 && !f.unverified && NON_PAYMENT.test(norm(f.text))) ?? null;
}

const tokens = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
function overlaps(a: string, b: string): boolean {
  const ta = tokens(a);
  let n = 0;
  for (const w of tokens(b)) if (ta.has(w)) n++;
  return n >= 2;
}

const LEVEL_RANK: Record<AttentionLevel, number> = { urgent: 0, important: 1, a_confirmer: 2 };
const CATEGORY_RANK: Record<AttentionCategory, number> = {
  echeance_depassee: 0,
  paiement_a_verifier: 1,
  echeance_proche: 2,
  contradiction: 3,
  analyse_partielle: 4,
  piece_manquante: 5,
  fait_non_source: 6,
  hypothese: 7,
  declaration: 8,
};

/* ── Échéances ──────────────────────────────────────────────────────────── */

type MergedDeadline = {
  key: string;
  title: string;
  date: string | null;
  priority: 'haute' | 'normale' | 'basse';
  kind: 'mentioned' | 'computed' | 'hypothesis' | 'manual';
  basis: string;
  evidence: Evidence[];
};

/**
 * Rapproche les échéances de l'analyse et celles enregistrées dans le dossier :
 * la ligne enregistrée prime (date corrigée, échéance marquée « faite » → retirée),
 * les ajouts manuels sont conservés, rien n'est compté deux fois.
 */
function mergeDeadlines(analysis: AnalysisData, rows: AttentionDeadline[] | undefined): MergedDeadline[] {
  const left = [...(rows ?? [])];
  const take = (title: string, date: string | null) => {
    const key = date ? deadlineKey(title, date) : null;
    let i = key ? left.findIndex((r) => r.ai_key === key || deadlineKey(r.title, r.due_date) === key) : -1;
    if (i < 0) i = left.findIndex((r) => norm(r.title) === norm(title));
    return i < 0 ? null : left.splice(i, 1)[0];
  };
  const out: MergedDeadline[] = [];
  for (const d of analysis.deadlines) {
    const row = take(d.title, d.date);
    if (row?.done) continue;
    const date = row?.due_date ?? d.date;
    out.push({ key: deadlineKey(d.title, d.date ?? 'sans-date'), title: row?.title ?? d.title, date, priority: row?.priority ?? d.priority, kind: d.kind, basis: d.basis, evidence: d.unverified ? [] : d.evidence });
  }
  for (const r of left) {
    if (r.done) continue;
    out.push({ key: deadlineKey(r.title, r.due_date), title: r.title, date: r.due_date, priority: r.priority, kind: 'manual', basis: '', evidence: [] });
  }
  return out;
}

function deadlineItems(analysis: AnalysisData, rows: AttentionDeadline[] | undefined, today: string, names: Map<string, string>): AttentionItem[] {
  const proof = nonPaymentProof(analysis);
  const items: AttentionItem[] = [];
  for (const d of mergeDeadlines(analysis, rows)) {
    const hypothetical = d.kind === 'hypothesis' || (d.kind !== 'manual' && d.evidence.length === 0);
    const nature: AttentionNature = d.kind === 'manual' ? 'asserted_by_party' : hypothetical ? 'hypothesis' : 'documented';
    const source = d.kind === 'manual' ? 'Échéance saisie dans le dossier — aucune pièce associée' : `${KIND_LABEL[d.kind]} — ${sources(d.evidence, names)}`;
    const base = { nature, source, evidence: d.evidence };

    if (!d.date) {
      items.push({ ...base, id: `hypothese:${d.key}`, level: 'a_confirmer', category: 'hypothese', nature: 'hypothesis', title: `Échéance sans date : ${d.title}`, consequence: 'Sans date retenue, aucun rappel ne peut être programmé pour cette échéance.', action: 'Vérifier la date dans vos pièces puis la saisir dans l’onglet Échéances.' });
      continue;
    }
    const left = daysBetween(today, d.date);
    if (left < 0) {
      const late = `depuis ${plural(-left, 'jour')} (${frDate(d.date)})`;
      if (isPaymentDeadline(d.title, d.basis) && !hypothetical) {
        if (proof) {
          items.push({ ...base, id: `echeance_depassee:${d.key}`, date: d.date, level: 'urgent', category: 'echeance_depassee', title: `Échéance de paiement dépassée ${late}, non-paiement documenté : ${d.title}`, source: `${source} · non-paiement : ${sources(proof.evidence, names)}`, evidence: [...d.evidence, ...proof.evidence], consequence: 'Les pièces établissent que le paiement n’est pas intervenu à l’échéance.', action: 'Relire le projet de relance fourni et décider de la suite, au besoin avec un professionnel.' });
        } else {
          items.push({ ...base, id: `paiement_a_verifier:${d.key}`, date: d.date, level: 'important', category: 'paiement_a_verifier', title: `Paiement à vérifier — échéance passée ${late} : ${d.title}`, consequence: 'Aucune pièce ne prouve ni le paiement ni son absence : à ce stade, la facture ne peut pas être qualifiée d’impayée.', action: 'Vérifier l’encaissement sur votre relevé bancaire, puis déposer le relevé — ou marquer l’échéance comme faite si le paiement est arrivé.' });
        }
        continue;
      }
      items.push({ ...base, id: `echeance_depassee:${d.key}`, date: d.date, level: hypothetical ? 'important' : d.priority === 'basse' ? 'important' : 'urgent', category: 'echeance_depassee', title: `${hypothetical ? 'Date indicative dépassée' : 'Échéance dépassée'} ${late} : ${d.title}`, consequence: hypothetical ? 'Cette date est une hypothèse : elle n’a pas été confirmée par une pièce.' : 'La date est passée sans que l’échéance soit marquée comme faite.', action: hypothetical ? 'Confirmer ou corriger cette date, puis marquer l’échéance comme faite si elle a été traitée.' : 'Traiter l’échéance, ou la marquer comme faite si c’est déjà le cas.' });
      continue;
    }
    const m = milestone(left);
    if (m) {
      const when = left === 0 ? 'aujourd’hui' : left === 1 ? 'demain' : `dans ${left} jours`;
      items.push({ ...base, id: `echeance_proche:${d.key}`, date: d.date, level: m === 1 ? 'urgent' : m === 3 ? 'important' : d.priority === 'haute' ? 'important' : 'a_confirmer', category: 'echeance_proche', title: `J-${m} — échéance ${when} (${frDate(d.date)}) : ${d.title}`, consequence: hypothetical ? 'Date à confirmer : elle ne repose sur aucune pièce.' : `Il reste ${plural(left, 'jour')} pour agir avant cette date.`, action: hypothetical ? 'Confirmer la date avant de vous organiser.' : 'Préparer dès maintenant ce que cette échéance demande.' });
      continue;
    }
    if (hypothetical) {
      items.push({ ...base, id: `hypothese:${d.key}`, date: d.date, level: 'a_confirmer', category: 'hypothese', nature: 'hypothesis', title: `Échéance à confirmer (${frDate(d.date)}) : ${d.title}`, consequence: d.basis ? `Date proposée, non tirée d’une pièce — ${d.basis}.` : 'Date proposée, non tirée d’une pièce.', action: 'Confirmer ou corriger cette date dans l’onglet Échéances.' });
    }
  }
  return items;
}

/* ── Construction ───────────────────────────────────────────────────────── */


/**
 * Nature d'un écart relevé entre pièces. Deux documents différents ne sont pas
 * « contradictoires » par défaut : une position adverse est une CONTESTATION,
 * une simple variation (version, montant actualisé, date d'édition) est une
 * DIFFÉRENCE documentaire ; seule une incompatibilité affirmée sur un même fait
 * reste une contradiction. Règle déterministe, sur le texte de l'écart.
 */
export function divergenceNature(text: string): 'contradiction' | 'difference' | 'contested' {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(contest\w*|conteste|invoqu\w*|reclam\w*|refus\w*|oppos\w*|reproch\w*|allegu\w*|soutien\w*|pretend\w*|litige)\b/.test(t)) return 'contested';
  if (/\b(version\w*|differ\w*|ecart\w*|variante\w*|mise a jour|actualis\w*|n'est pas identique|autre date|autre montant)\b/.test(t) && !/\b(contradi\w*|incompatib\w*|alors que|tandis que)\b/.test(t)) return 'difference';
  return 'contradiction';
}
const DIVERGENCE_CONSEQUENCE = {
  contradiction: 'Deux pièces ne disent pas la même chose : tant que ce point n’est pas tranché, vos documents le signalent sans conclure.',
  contested: 'L’autre partie conteste ce point : vos documents présentent les deux positions sans conclure.',
  difference: 'Ces documents diffèrent sur ce point, sans se contredire : vos documents retiennent le plus récent et le signalent.',
} as const;

export function buildAttention(input: AttentionInput): AttentionResult {
  const { analysis: a, coverage: c, today } = input;
  const names = new Map(Object.entries(input.documentNames ?? {}));
  const max = Math.max(1, input.max ?? ATTENTION_MAX);
  const items: AttentionItem[] = deadlineItems(a, input.deadlines, today, names);

  a.contradictions.forEach((x, i) => {
    items.push({ id: `contradiction:${i}`, level: 'important', category: 'contradiction', nature: divergenceNature(x.text), title: x.text, source: sources(x.evidence, names), evidence: x.evidence, consequence: DIVERGENCE_CONSEQUENCE[divergenceNature(x.text)], action: 'Relire les pièces citées et déposer celle qui tranche, ou préciser le point par écrit.' });
  });

  if (!c.complete) {
    const todo = c.failed ? 'Redéposer les pièces en échec dans un format lisible (PDF, photo nette).' : c.pending ? 'Aucune action de votre part : la lecture se poursuit.' : 'Vérifier les pièces non exploitées.';
    const parts = [c.pending ? `${c.pending} en attente` : '', c.failed ? `${c.failed} en échec` : '', c.unsupported ? `${c.unsupported} non prise(s) en charge` : ''].filter(Boolean).join(', ');
    items.push({ id: 'analyse_partielle', level: 'important', category: 'analyse_partielle', nature: 'missing', title: `Analyse partielle : ${c.extracted}/${c.total} pièces exploitées${parts ? ` (${parts})` : ''}`, source: 'Couverture documentaire de la dernière analyse', evidence: [], consequence: 'Les conclusions ne tiennent pas compte des pièces non lues et peuvent changer.', action: todo });
  } else if (c.unsupported > 0) {
    items.push({ id: 'analyse_partielle', level: 'a_confirmer', category: 'analyse_partielle', nature: 'missing', title: `${plural(c.unsupported, 'pièce')} dans un format non pris en charge`, source: 'Couverture documentaire de la dernière analyse', evidence: [], consequence: 'Le contenu de ces pièces n’a pas été lu.', action: 'Redéposer ces pièces en PDF ou en image (JPG, PNG) si elles comptent pour le dossier.' });
  }

  a.missing_items.forEach((m, i) => {
    items.push({ id: `piece_manquante:${i}`, level: 'a_confirmer', category: 'piece_manquante', nature: 'missing', title: `Pièce manquante : ${m.text}`, source: 'Aucune pièce du dossier', evidence: [], consequence: m.why ? `${m.why.charAt(0).toUpperCase()}${m.why.slice(1)}.`.replace(/\.\.$/, '.') : 'Cette information ne figure dans aucune pièce.', action: 'Déposer la pièce dans l’onglet Pièces si vous l’avez.' });
  });

  a.facts.forEach((f, i) => {
    const unsourced = f.evidence.length === 0 || Boolean(f.unverified);
    if (f.status === 'missing') {
      // Déjà signalée comme pièce manquante : pas de doublon.
      if (a.missing_items.some((m) => overlaps(m.text, f.text))) return;
      items.push({ id: `piece_manquante:fait-${i}`, level: 'a_confirmer', category: 'piece_manquante', nature: 'missing', title: f.text, source: 'Aucune pièce du dossier', evidence: [], consequence: 'Cette information ne figure dans aucune pièce.', action: 'Déposer la pièce correspondante si vous l’avez.' });
    } else if (f.status === 'documented' && unsourced) {
      items.push({ id: `fait_non_source:${i}`, level: 'a_confirmer', category: 'fait_non_source', nature: 'missing', title: `Fait non sourcé : ${f.text}`, source: 'Aucune source vérifiée', evidence: [], consequence: 'Ce fait est présenté comme établi, mais aucune pièce vérifiée ne l’appuie.', action: 'Déposer la pièce qui l’établit, ou ne pas vous y fier en l’état.' });
    } else if (f.status === 'inferred') {
      items.push({ id: `hypothese:fait-${i}`, level: 'a_confirmer', category: 'hypothese', nature: 'hypothesis', title: f.text, source: unsourced ? 'Déduction sans pièce à l’appui' : `Déduit de : ${sources(f.evidence, names)}`, evidence: unsourced ? [] : f.evidence, consequence: 'Il s’agit d’une déduction, pas d’un fait établi par une pièce.', action: 'Confirmer ou infirmer ce point, idéalement par une pièce.' });
    } else if (f.status === 'asserted_by_party') {
      items.push({ id: `declaration:${i}`, level: 'a_confirmer', category: 'declaration', nature: 'asserted_by_party', title: f.text, source: unsourced ? 'Déclaration sans pièce à l’appui' : `Déclaration relevée dans : ${sources(f.evidence, names)}`, evidence: unsourced ? [] : f.evidence, consequence: 'C’est la déclaration d’une partie : aucune pièce ne la confirme à elle seule.', action: 'Rechercher une pièce qui la confirme ou la contredit.' });
    }
  });

  const sorted = items
    .map((it, i) => ({ it, i }))
    .sort((x, y) => LEVEL_RANK[x.it.level] - LEVEL_RANK[y.it.level] || CATEGORY_RANK[x.it.category] - CATEGORY_RANK[y.it.category] || (x.it.date ?? '').localeCompare(y.it.date ?? '') || x.i - y.i)
    .map((x) => x.it);
  return { items: sorted.slice(0, max), more: sorted.slice(max), total: sorted.length };
}

/* ── « Ce qui a changé depuis votre dernière visite » ───────────────────── */

/** État du dossier comparable d'une visite à l'autre. */
export interface DossierSnapshot {
  /** Pièces et documents non supprimés. */
  documents: { id: string; file_name: string; created_at: string; kind?: string | null }[];
  /** Échéances enregistrées (corrections et ajouts manuels inclus). */
  deadlines: { title: string; due_date: string }[];
  /** Corrections humaines de la chronologie (append-only). */
  corrections: { event_key: string; created_at: string }[];
  /** Dernière révision publiée des rendus, ou null. */
  revision: { number: number; created_at: string } | null;
}

/** Repère de la dernière visite, conservé par appareil (localStorage) — jamais en base. */
export interface VisitMark {
  at: string;
  revision: number | null;
  /** Empreintes des échéances connues (jamais leur intitulé : rien de lisible n'est conservé sur l'appareil). */
  deadlineKeys: string[];
}

/** Empreinte courte et stable (FNV-1a 32 bits) — sert uniquement à reconnaître une échéance déjà vue. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
const deadlinePrint = (d: { title: string; due_date: string }) => fingerprint(deadlineKey(d.title, d.due_date));

export type ChangeKind = 'pieces' | 'documents' | 'echeances' | 'corrections' | 'revision';
export interface ChangeEntry {
  kind: ChangeKind;
  count: number;
  label: string;
  /** Détail borné (noms de pièces, intitulés d'échéances). */
  details: string[];
}
export interface ChangeSummary {
  /** Aucune visite antérieure connue sur cet appareil : rien à comparer. */
  firstVisit: boolean;
  since: string | null;
  entries: ChangeEntry[];
  total: number;
}

const DETAILS_MAX = 3;
const bounded = (list: string[]) => (list.length > DETAILS_MAX ? [...list.slice(0, DETAILS_MAX), `et ${list.length - DETAILS_MAX} de plus`] : list);

/** Repère à enregistrer à la fin du chargement : il servira de point de comparaison à la prochaine visite. */
export function visitMark(state: DossierSnapshot, at: string): VisitMark {
  return { at, revision: state.revision?.number ?? null, deadlineKeys: state.deadlines.map(deadlinePrint) };
}

/**
 * Compare l'état actuel du dossier au repère de la dernière visite : nouvelles
 * pièces, nouveaux documents, échéances nouvelles ou modifiées, corrections de
 * dates et nouvelle révision des rendus. Fonction pure — aucune lecture de
 * l'horloge ni du stockage.
 */
export function whatChanged(state: DossierSnapshot, last: VisitMark | null): ChangeSummary {
  if (!last) return { firstVisit: true, since: null, entries: [], total: 0 };
  const after = (iso: string) => new Date(iso).getTime() > new Date(last.at).getTime();
  const entries: ChangeEntry[] = [];
  const push = (kind: ChangeKind, list: string[], one: string, many: string) => {
    if (list.length) entries.push({ kind, count: list.length, label: `${list.length} ${list.length > 1 ? many : one}`, details: bounded(list) });
  };

  const fresh = state.documents.filter((d) => after(d.created_at));
  push('pieces', fresh.filter((d) => d.kind !== 'deliverable').map((d) => d.file_name), 'nouvelle pièce', 'nouvelles pièces');

  const prev = state.revision && last.revision !== null ? state.revision.number > last.revision : state.revision ? after(state.revision.created_at) : false;
  if (state.revision && prev) {
    entries.push({ kind: 'revision', count: 1, label: `Nouvelle révision de vos documents (révision ${state.revision.number})`, details: last.revision ? [`Révision précédente : ${last.revision}`] : [] });
  } else {
    // Rendus déposés hors révision (documents remis par l'équipe).
    push('documents', fresh.filter((d) => d.kind === 'deliverable').map((d) => d.file_name), 'nouveau document disponible', 'nouveaux documents disponibles');
  }

  const known = new Set(last.deadlineKeys);
  push('echeances', state.deadlines.filter((d) => !known.has(deadlinePrint(d))).map((d) => `${frDate(d.due_date)} — ${d.title}`), 'échéance nouvelle ou modifiée', 'échéances nouvelles ou modifiées');

  const fixed = state.corrections.filter((c) => after(c.created_at));
  if (fixed.length) entries.push({ kind: 'corrections', count: fixed.length, label: `${fixed.length} ${fixed.length > 1 ? 'corrections' : 'correction'} de la chronologie`, details: [] });

  return { firstVisit: false, since: last.at, entries, total: entries.reduce((n, e) => n + e.count, 0) };
}
