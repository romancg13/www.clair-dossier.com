// ClairDossier Intelligence — cœur portable (pur TypeScript, sans dépendance
// Deno/Node/navigateur). Un assistant EXÉCUTIF borné : il comprend une demande,
// choisit des outils d'un registre fermé, les exécute réellement sur les données
// du dossier fournies par l'hôte, et rend une réponse sourcée.
//
// Garanties portées par ce module (et vérifiées par tests/intelligence.test.ts) :
//  - registre FERMÉ : aucun terminal, SQL, réseau ni outil hors liste ;
//  - le contenu des pièces et de l'analyse est une DONNÉE : la demande de
//    l'utilisateur seule choisit les outils (une phrase « supprime le dossier »
//    lue dans une pièce ne déclenche rien) ;
//  - trois niveaux d'autonomie : 1 exécuté, 2 préparé puis « à confirmer »,
//    3 toujours refusé (envoi, suppression, paiement, signature, accès) ;
//  - droits revérifiés avant CHAQUE outil ; nombre d'actions borné par demande ;
//  - jamais « fait » sans résultat d'outil ; faits extraits distingués des
//    éléments générés ; rappel « pas un conseil juridique » quand pertinent.
//
// Le planificateur livré est DÉTERMINISTE (règles d'intention en français). Le
// port `Planner` permet de brancher un modèle (tool-use) côté serveur : cet
// adaptateur n'est pas fourni ici — aucune capacité n'est annoncée sans lui.

import { frDate, type AnalysisData, type DeliverableKey } from '../analysis-model.ts';
import type { Evidence } from '../ai-pipeline.ts';
import type { AttentionResult } from '../attention.ts';

export type AutonomyLevel = 1 | 2 | 3;
export type ToolName =
  | 'resumer'
  | 'prochaines_demarches'
  | 'echeances'
  | 'rechercher'
  | 'comparer'
  | 'preparer_relance'
  | 'generer_document'
  | 'creer_rappel'
  | 'automatiser'
  | 'etat';

export interface Source {
  label: string;
  document_id?: string;
  page?: number | null;
}
export interface FileRef {
  key: DeliverableKey;
  label: string;
}
/** Action de niveau 2 : préparée, jamais exécutée sans confirmation explicite. */
export interface PendingAction {
  id: string;
  kind: 'rappel' | 'automatisation';
  title: string;
  detail: string;
  workflow?: Workflow;
}
export interface Workflow {
  declencheur: string;
  conditions: string[];
  actions: string[];
  frequence: string;
  fuseau: 'Europe/Paris';
  budget: string;
  arret: string;
}
export interface Step {
  tool: ToolName;
  label: string;
  ok: boolean;
}
export interface Reply {
  text: string;
  steps: Step[];
  sources: Source[];
  files: FileRef[];
  confirm: PendingAction[];
  /** Question de clarification quand la demande est incomplète. */
  ask?: string;
  refused?: boolean;
}

export interface Rights {
  /** L'utilisateur est titulaire du dossier (vérifié par l'hôte, côté serveur en service réel). */
  owner: boolean;
  /** L'offre inclut l'assistant. */
  assistant: boolean;
  /** L'offre inclut les automatisations récurrentes. */
  automations: boolean;
}
export interface Context {
  title: string;
  today: string; // AAAA-MM-JJ, date de référence unique
  analysis: AnalysisData | null;
  pieces: { id: string; file_name: string }[];
  attention: AttentionResult | null;
  /** Documents réellement disponibles au téléchargement (dernière révision). */
  available: DeliverableKey[];
  processing?: { done: number; total: number } | null;
  rights: Rights;
}

const DOC_LABEL: Record<DeliverableKey, string> = {
  resume: 'Résumé',
  dashboard: 'Tableau de bord',
  chronologie: 'Chronologie',
  dates: 'Dates modifiables',
  echeances: 'Échéances et calendrier',
  relances: 'Relances',
};
export const MAX_ACTIONS = 5;
export const MAX_MESSAGE = 2000;
const LEGAL = 'Élément généré à partir de vos pièces, à vérifier ; ne constitue pas un conseil juridique.';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
const words = (s: string) => norm(s).match(/[a-z0-9]{3,}/g) ?? [];
const srcOf = (ev: Evidence[], names: Map<string, string>): Source[] =>
  ev.map((e) => ({ label: `${names.get(e.document_id) ?? 'pièce'}${e.page ? ` p.${e.page}` : ''}`, document_id: e.document_id, page: e.page }));

type ToolResult = Partial<Pick<Reply, 'sources' | 'files' | 'confirm' | 'ask'>> & { text: string };
interface Tool {
  name: ToolName;
  level: AutonomyLevel;
  label: string;
  /** Droit exigé, revérifié à chaque appel. */
  allowed: (r: Rights) => boolean;
  run: (ctx: Context, arg: string, names: Map<string, string>) => ToolResult;
}

/** État honnête d'un dossier sans analyse : aucune promesse de traitement qui n'a pas lieu. */
const noAnalysisText = (ctx: Context): string => {
  const n = ctx.pieces.length;
  if (n === 0) return 'Ce dossier ne contient encore aucune pièce : déposez vos documents dans l’onglet Pièces.';
  return `${n} pièce${n > 1 ? 's' : ''} déposée${n > 1 ? 's' : ''}. L’analyse automatique n’est pas activée pour ce dossier : je ne peux pas encore en tirer de résumé ni d’échéances.`;
};

const needsAnalysis = (ctx: Context): ToolResult | null =>
  ctx.analysis
    ? null
    : { text: ctx.processing ? `L’analyse est en cours (${ctx.processing.done}/${ctx.processing.total} pièces). Je pourrai répondre dès qu’elle sera terminée.` : noAnalysisText(ctx) };

export const TOOLS: Tool[] = [
  {
    name: 'resumer',
    level: 1,
    label: 'Lecture de l’analyse du dossier',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx, _a, names) => {
      const miss = needsAnalysis(ctx);
      if (miss) return miss;
      const a = ctx.analysis!;
      const facts = a.facts.filter((f) => f.status === 'documented' && f.evidence.length > 0 && !f.unverified).slice(0, 4);
      const lines = [a.summary_short, ...(facts.length ? ['', 'Faits établis par vos pièces :', ...facts.map((f) => `• ${f.text}`)] : []), '', LEGAL];
      return { text: lines.join('\n'), sources: facts.flatMap((f) => srcOf(f.evidence, names)), files: ctx.available.includes('resume') ? [{ key: 'resume', label: DOC_LABEL.resume }] : [] };
    },
  },
  {
    name: 'prochaines_demarches',
    level: 1,
    label: 'Calcul des priorités',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx, _a, names) => {
      const miss = needsAnalysis(ctx);
      if (miss) return miss;
      const items = ctx.attention ? [...ctx.attention.items, ...ctx.attention.more].slice(0, 3) : [];
      if (!items.length) return { text: 'D’après vos pièces, rien ne demande de décision de votre part pour le moment.' };
      return {
        text: ['Vos priorités, dans l’ordre :', ...items.map((it, i) => `${i + 1}. ${it.title}\n   → ${it.action}`), '', LEGAL].join('\n'),
        sources: items.flatMap((it) => srcOf(it.evidence, names)),
      };
    },
  },
  {
    name: 'echeances',
    level: 1,
    label: 'Lecture des échéances',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx, _a, names) => {
      const miss = needsAnalysis(ctx);
      if (miss) return miss;
      const dated = ctx.analysis!.deadlines.filter((d) => d.date).sort((x, y) => x.date!.localeCompare(y.date!));
      const next = dated.filter((d) => d.date! >= ctx.today);
      const past = dated.filter((d) => d.date! < ctx.today);
      const kind = { mentioned: 'date mentionnée', computed: 'date calculée', hypothesis: 'à confirmer' } as const;
      if (!dated.length) return { text: 'Aucune échéance datée ne ressort de vos pièces.' };
      const lines = [
        next.length ? `À venir (au ${frDate(ctx.today)}) :` : `Aucune échéance à venir au ${frDate(ctx.today)}.`,
        ...next.map((d) => `• ${frDate(d.date)} — ${d.title} (${kind[d.kind]})`),
        ...(past.length ? ['', 'Dates passées :', ...past.map((d) => `• ${frDate(d.date)} — ${d.title}`)] : []),
      ];
      return { text: lines.join('\n'), sources: dated.flatMap((d) => srcOf(d.evidence, names)), files: ctx.available.includes('echeances') ? [{ key: 'echeances', label: DOC_LABEL.echeances }] : [] };
    },
  },
  {
    name: 'rechercher',
    level: 1,
    label: 'Recherche dans le dossier',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx, arg, names) => {
      const miss = needsAnalysis(ctx);
      if (miss) return miss;
      const q = words(arg).filter((w) => !STOP.has(w));
      if (!q.length) return { text: '', ask: 'Que voulez-vous retrouver dans ce dossier ? (un nom, un montant, une date, un mot)' };
      const a = ctx.analysis!;
      const pool: { text: string; ev: Evidence[] }[] = [
        ...a.facts.map((f) => ({ text: f.text, ev: f.evidence })),
        ...a.events.map((e) => ({ text: `${frDate(e.date)} — ${e.label}`, ev: e.evidence })),
        ...a.deadlines.map((d) => ({ text: `${d.date ? frDate(d.date) : 'sans date'} — ${d.title}`, ev: d.evidence })),
        ...a.parties.map((p) => ({ text: `${p.name} (${p.role})`, ev: p.evidence })),
        ...ctx.pieces.map((p) => ({ text: `Pièce : ${p.file_name}`, ev: [{ document_id: p.id, page: null } as Evidence] })),
      ];
      const hits = pool
        .map((x) => ({ x, n: q.filter((w) => norm(x.text).includes(w)).length }))
        .filter((h) => h.n > 0)
        .sort((u, v) => v.n - u.n)
        .slice(0, 6);
      if (!hits.length) return { text: `Je ne trouve rien sur « ${arg.trim()} » dans l’analyse de ce dossier. L’information peut figurer dans une pièce sans avoir été relevée : vérifiez la pièce concernée.` };
      return { text: [`Ce que disent vos pièces sur « ${arg.trim()} » :`, ...hits.map((h) => `• ${h.x.text}`)].join('\n'), sources: hits.flatMap((h) => srcOf(h.x.ev, names)) };
    },
  },
  {
    name: 'comparer',
    level: 1,
    label: 'Comparaison de pièces',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx, arg, names) => {
      const miss = needsAnalysis(ctx);
      if (miss) return miss;
      const q = norm(arg);
      const picked = ctx.pieces.filter((p) => words(p.file_name).some((w) => w.length > 3 && !STOP.has(w) && q.includes(w)));
      if (picked.length < 2) {
        const a = ctx.analysis!;
        if (!a.contradictions.length) return { text: '', ask: `Quelles pièces voulez-vous comparer ? Par exemple : ${ctx.pieces.slice(0, 2).map((p) => `« ${p.file_name} »`).join(' et ')}.` };
        return {
          text: ['Écarts relevés entre vos pièces (sans conclure à votre place) :', ...a.contradictions.map((c) => `• ${c.text}`), '', LEGAL].join('\n'),
          sources: a.contradictions.flatMap((c) => srcOf(c.evidence, names)),
        };
      }
      const [p1, p2] = picked;
      const about = (id: string) => [
        ...ctx.analysis!.facts.filter((f) => f.evidence.some((e) => e.document_id === id)).map((f) => f.text),
        ...ctx.analysis!.events.filter((e) => e.evidence.some((v) => v.document_id === id)).map((e) => `${frDate(e.date)} — ${e.label}`),
      ];
      const [f1, f2] = [about(p1.id), about(p2.id)];
      const shared = ctx.analysis!.contradictions.filter((c) => c.evidence.some((e) => e.document_id === p1.id) && c.evidence.some((e) => e.document_id === p2.id));
      return {
        text: [
          `« ${p1.file_name} » :`,
          ...(f1.length ? f1.map((t) => `• ${t}`) : ['• aucun élément relevé']),
          '',
          `« ${p2.file_name} » :`,
          ...(f2.length ? f2.map((t) => `• ${t}`) : ['• aucun élément relevé']),
          '',
          shared.length ? `Écart relevé entre les deux : ${shared.map((c) => c.text).join(' ')}` : 'Aucun écart n’a été relevé entre ces deux pièces ; deux documents différents ne sont pas pour autant contradictoires.',
        ].join('\n'),
        sources: [{ label: p1.file_name, document_id: p1.id }, { label: p2.file_name, document_id: p2.id }],
      };
    },
  },
  {
    name: 'preparer_relance',
    level: 1,
    label: 'Préparation d’un brouillon',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx) => {
      const miss = needsAnalysis(ctx);
      if (miss) return miss;
      const d = ctx.analysis!.reminder_drafts[0];
      if (!d) return { text: 'Vos pièces ne justifient pas de relance pour le moment.' };
      return {
        text: [`BROUILLON — rien n’est envoyé. Destinataire proposé : ${d.recipient_hint}`, `Objet : ${d.subject}`, '', d.body, '', 'Relisez et adaptez ce projet avant tout envoi.'].join('\n'),
        files: ctx.available.includes('relances') ? [{ key: 'relances', label: DOC_LABEL.relances }] : [],
      };
    },
  },
  {
    name: 'generer_document',
    level: 1,
    label: 'Préparation du document',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx, arg) => {
      const q = norm(arg);
      const wanted = (Object.keys(DOC_MATCH) as DeliverableKey[]).filter((k) => DOC_MATCH[k].test(q));
      const all = /\b(tout|tous|six|ensemble|complet|zip)\b/.test(q);
      const keys = (all || !wanted.length ? (wanted.length ? wanted : ctx.available) : wanted).filter((k) => ctx.available.includes(k));
      if (!ctx.available.length) return { text: 'Vos documents ne sont pas encore disponibles : ils seront prêts dès la fin de l’analyse.' };
      if (!keys.length) return { text: 'Ce document n’est pas encore disponible pour ce dossier.' };
      return { text: keys.length === 1 ? `Votre document est prêt : ${DOC_LABEL[keys[0]]}.` : `Vos ${keys.length} documents sont prêts.`, files: keys.map((k) => ({ key: k, label: DOC_LABEL[k] })) };
    },
  },
  {
    name: 'creer_rappel',
    level: 2,
    label: 'Préparation d’un rappel',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx, arg) => {
      const next = ctx.analysis?.deadlines.filter((d) => d.date && d.date >= ctx.today).sort((x, y) => x.date!.localeCompare(y.date!))[0];
      const when = parseDate(arg, ctx.today);
      if (!when && !next) return { text: '', ask: 'Pour quelle date voulez-vous ce rappel ?' };
      const date = when ?? next!.date!;
      const title = when ? arg.trim().replace(/^.*?rappel\w*\s*(-moi)?\s*(de|d')?\s*/i, '').slice(0, 120) || 'Rappel' : next!.title;
      return { text: `J’ai préparé un rappel pour le ${frDate(date)}. Confirmez pour l’enregistrer.`, confirm: [{ id: `rappel:${date}`, kind: 'rappel', title: `Rappel du ${frDate(date)}`, detail: title }] };
    },
  },
  {
    name: 'automatiser',
    level: 2,
    label: 'Préparation d’une automatisation',
    allowed: (r) => r.owner && r.assistant && r.automations,
    run: (_ctx, arg) => {
      const w = toWorkflow(arg);
      if (!w) return { text: '', ask: 'Que dois-je faire, et à quel rythme ? Par exemple : « Tous les lundis, prépare le bilan de mes dossiers. »' };
      return {
        text: ['Voici l’automatisation que j’ai comprise :', `• Quand : ${w.declencheur}`, ...(w.conditions.length ? [`• Si : ${w.conditions.join(' ; ')}`] : []), `• Alors : ${w.actions.join(' ; ')}`, `• Limite : ${w.budget} — ${w.arret}`, '', 'Rien n’est activé tant que vous n’avez pas confirmé.'].join('\n'),
        confirm: [{ id: `auto:${norm(arg).slice(0, 40)}`, kind: 'automatisation', title: w.actions[0], detail: w.declencheur, workflow: w }],
      };
    },
  },
  {
    name: 'etat',
    level: 1,
    label: 'Lecture de l’état du traitement',
    allowed: (r) => r.owner && r.assistant,
    run: (ctx) => {
      const p = ctx.processing;
      if (p && p.done < p.total) return { text: `Analyse en cours — ${p.done}/${p.total} pièces lues.` };
      if (!ctx.analysis) return { text: noAnalysisText(ctx) };
      return { text: `Analyse terminée : ${ctx.pieces.length} pièce${ctx.pieces.length > 1 ? 's' : ''}, ${ctx.available.length} document${ctx.available.length > 1 ? 's' : ''} disponible${ctx.available.length > 1 ? 's' : ''}.` };
    },
  },
];

const STOP = new Set(['les', 'des', 'une', 'que', 'qui', 'dans', 'pour', 'avec', 'sur', 'mon', 'mes', 'ces', 'cette', 'dossier', 'cherche', 'recherche', 'trouve', 'retrouve', 'moi', 'est', 'sont', 'quel', 'quelle', 'quels', 'ont', 'dit', 'disent', 'pieces', 'piece', 'document', 'documents', 'compare', 'comparer']);
const DOC_MATCH: Record<DeliverableKey, RegExp> = {
  resume: /\b(resume|synthese)\b/,
  dashboard: /\b(tableau de bord|dashboard)\b/,
  chronologie: /\bchronologie\b/,
  dates: /\bdates? modifiables?\b/,
  echeances: /\b(echeances?|calendrier|agenda|ics)\b/,
  relances: /\b(relances?|courriers?|e-?mails?)\b/,
};
/** Actions de niveau 3 : jamais exécutées par l'assistant. */
// « Envoie-moi le point » s'adresse au titulaire lui-même : ce n'est pas une transmission à un tiers.
const FORBIDDEN = /^(?!(?:envoie|envoyez|transmets|transmettez)[- ]moi\b)(envoie|envoyer|envoi|expedie|transmets?|supprime|supprimer|efface|effacer|detruis|paie|payer|regle la|regle le|effectue (un|le) (paiement|virement)|signe|signer|resilie|change (le|mon) mot de passe|donne (l')?acces|partage avec)\b/;
const POLITE = /^(peux-tu|pourrais-tu|tu peux|merci de|veuillez|stp|s'il te plait|s'il vous plait|maintenant|ensuite|alors)\s+/;
/** Un ordre sensible se reconnaît en TÊTE de proposition (« Supprime… »), pas à un mot croisé dans un nom de pièce (« devis signé.pdf »). */
function forbidden(t: string): boolean {
  return t.split(/[.;:!?]|,| et | puis /).some((c) => {
    let x = c.trim();
    while (POLITE.test(x)) x = x.replace(POLITE, '');
    return FORBIDDEN.test(x);
  });
}

function parseDate(text: string, today: string): string | null {
  const m = norm(text).match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (!m) return null;
  const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : today.slice(0, 4);
  const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** Langage naturel → workflow structuré (déclencheur, conditions, actions, limites). Null si incompréhensible. */
export function toWorkflow(text: string): Workflow | null {
  const t = norm(text);
  const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const day = days.find((d) => new RegExp(`\\b(tous les |chaque )?${d}s?\\b`).test(t));
  let declencheur = '';
  let frequence = '';
  if (day) [declencheur, frequence] = [`chaque ${day} à 8 h (heure de Paris)`, 'hebdomadaire'];
  else if (/\b(chaque jour|tous les jours|quotidien)/.test(t)) [declencheur, frequence] = ['chaque jour à 8 h (heure de Paris)', 'quotidienne'];
  else if (/\b(chaque mois|tous les mois|mensuel)/.test(t)) [declencheur, frequence] = ['le 1er de chaque mois à 8 h (heure de Paris)', 'mensuelle'];
  else if (/\b(chaque|a chaque|des qu'?|quand|lorsqu'?)\b.*\b(facture|piece|document|courrier|e-?mail|contrat)/.test(t)) [declencheur, frequence] = [`à chaque ${t.match(/\b(facture|piece|document|courrier|e-?mail|contrat)/)![1].replace('piece', 'pièce')} reçu(e)`, 'à l’événement'];
  else if (/\bavant\b.*\b(renouvellement|echeance|expiration|fin)s?\b/.test(t)) [declencheur, frequence] = ['30, 7 et 1 jour(s) avant la date concernée', 'à l’approche d’une date'];
  else if (/\bautomatise|suivi\b/.test(t)) [declencheur, frequence] = ['chaque lundi à 8 h (heure de Paris)', 'hebdomadaire'];
  if (!declencheur) return null;
  const actions: string[] = [];
  if (/\b(bilan|recapitulatif|resume|synthese|point|suivi)\b/.test(t)) actions.push('préparer le bilan de vos dossiers');
  if (/\banalyse\b/.test(t)) actions.push('analyser la pièce reçue');
  if (/\b(rappel\w*|previens|alerte|notifie)\b/.test(t)) actions.push('vous prévenir');
  if (/\brelance\b/.test(t)) actions.push('préparer un projet de relance (brouillon, jamais envoyé)');
  if (!actions.length) return null;
  const conditions = /\bfacture\b/.test(t) && /\becheance\b/.test(t) ? ['la pièce est une facture avec une échéance lisible'] : [];
  return { declencheur, conditions, actions, frequence, fuseau: 'Europe/Paris', budget: 'au plus 1 exécution par déclenchement, dans la limite de votre offre', arret: 'suspension ou annulation à tout moment' };
}

export interface Plan {
  calls: { tool: ToolName; arg: string }[];
  ask?: string;
  refuse?: string;
}
/** Port de planification : la règle déterministe ci-dessous, ou un modèle branché côté serveur. */
export type Planner = (message: string, ctx: Context) => Plan;

/** Planificateur déterministe : la DEMANDE seule choisit les outils (jamais le contenu des pièces). */
export const planDeterministic: Planner = (message) => {
  const t = norm(message);
  if (forbidden(t))
    return { calls: [], refuse: 'Je ne réalise pas cette action à votre place : les envois, suppressions, paiements, signatures et changements d’accès restent entre vos mains. Je peux en revanche préparer un brouillon ou vous indiquer la marche à suivre.' };
  const calls: Plan['calls'] = [];
  const add = (tool: ToolName) => !calls.some((c) => c.tool === tool) && calls.push({ tool, arg: message });
  if (/\b(automatise\w*|tous les|chaque (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|jour|mois|semaine|facture)|a chaque|previens-moi avant)\b/.test(t)) add('automatiser');
  else if (/\brappel\w*-?\s?moi\b|\b(cree|ajoute|programme)\b.*\brappel\b/.test(t)) add('creer_rappel');
  if (!calls.length) {
    if (/\b(compare\w*|difference\w*|ecarts?|contradiction\w*)\b/.test(t)) add('comparer');
    if (/\b(relance\w*|courrier\w*|mise en demeure|lettre)\b/.test(t) && /\b(prepare\w*|redige\w*|ecris|brouillon|projet)\b/.test(t)) add('preparer_relance');
    if (/\b(telecharg\w*|genere\w*|exporte\w*|pdf|word|excel|zip|donne-moi le|envoie-moi le)\b/.test(t) || (/\b(document|rapport)\b/.test(t) && /\b(prepare|cree|fais)\b/.test(t))) add('generer_document');
    if (/\b(resume\w*|synthe\w*|de quoi s'agit|en bref|situation|explique)\b/.test(t) && !calls.some((c) => c.tool === 'generer_document')) add('resumer');
    if (/\b(prochaine\w*|demarche\w*|que dois-je|quoi faire|a faire|priorit\w*|etapes?|action\w*)\b/.test(t)) add('prochaines_demarches');
    if (/\b(echeance\w*|delais?|dates? (limite|importante)|calendrier|quand)\b/.test(t) && !calls.some((c) => c.tool === 'generer_document')) add('echeances');
    if (/\b(ou en est|avancement|etat|termine\w*|en cours)\b/.test(t)) add('etat');
    if (!calls.length && /\b(cherche\w*|recherche\w*|trouve\w*|retrouve\w*|montant\w*|combien|qui est|que dit|mentionne\w*)\b/.test(t)) add('rechercher');
  }
  if (!calls.length) return words(message).length >= 2 ? { calls: [{ tool: 'rechercher', arg: message }] } : { calls: [], ask: 'Que puis-je faire pour ce dossier ? Par exemple : le résumer, préparer vos prochaines démarches, comparer deux pièces ou retrouver une information.' };
  return { calls: calls.slice(0, MAX_ACTIONS) };
};

/** Exécute une demande : plan → outils (droits revérifiés à chaque appel) → réponse sourcée. */
export function runAssistant(message: string, ctx: Context, planner: Planner = planDeterministic): Reply {
  const empty: Reply = { text: '', steps: [], sources: [], files: [], confirm: [] };
  const msg = message.trim().slice(0, MAX_MESSAGE);
  if (!msg) return { ...empty, ask: 'Que puis-je faire pour ce dossier ?', text: 'Que puis-je faire pour ce dossier ?' };
  if (!ctx.rights.owner) return { ...empty, refused: true, text: 'Ce dossier est introuvable.' };
  if (!ctx.rights.assistant) return { ...empty, refused: true, text: 'L’assistant n’est pas inclus dans votre offre actuelle.' };
  const plan = planner(msg, ctx);
  if (plan.refuse) return { ...empty, refused: true, text: plan.refuse };
  if (plan.ask) return { ...empty, ask: plan.ask, text: plan.ask };
  const names = new Map(ctx.pieces.map((p) => [p.id, p.file_name]));
  const out: Reply = { ...empty };
  const parts: string[] = [];
  for (const call of plan.calls.slice(0, MAX_ACTIONS)) {
    const tool = TOOLS.find((t) => t.name === call.tool);
    // Registre fermé : un nom inconnu (planificateur défaillant) n'exécute rien.
    if (!tool || tool.level === 3) continue;
    if (!tool.allowed(ctx.rights)) {
      out.steps.push({ tool: tool.name, label: tool.label, ok: false });
      parts.push(tool.name === 'automatiser' ? 'Les automatisations récurrentes ne sont pas incluses dans votre offre actuelle.' : 'Cette action n’est pas disponible avec vos droits actuels.');
      continue;
    }
    const r = tool.run(ctx, call.arg, names);
    out.steps.push({ tool: tool.name, label: tool.label, ok: !r.ask });
    if (r.ask) {
      out.ask = r.ask;
      parts.push(r.ask);
      continue;
    }
    parts.push(r.text);
    out.sources.push(...(r.sources ?? []));
    out.files.push(...(r.files ?? []));
    out.confirm.push(...(r.confirm ?? []));
  }
  const seen = new Set<string>();
  out.sources = out.sources.filter((s) => !seen.has(s.label) && seen.add(s.label)).slice(0, 8);
  out.files = out.files.filter((f, i, l) => l.findIndex((x) => x.key === f.key) === i);
  out.text = parts.filter(Boolean).join('\n\n');
  return out;
}

/** Description des outils pour un modèle (tool-use) : mêmes outils, même registre fermé. */
const TOOL_HELP: Record<ToolName, string> = {
  resumer: 'Résumé du dossier et faits établis par les pièces, avec leurs sources.',
  prochaines_demarches: 'Les priorités du dossier, dans l’ordre, avec l’action concrète attendue.',
  echeances: 'Échéances à venir et dates passées, à la date de référence du dossier.',
  rechercher: 'Recherche d’une information (nom, montant, date, mot) dans l’analyse du dossier. requete = ce qu’il faut retrouver.',
  comparer: 'Compare deux pièces nommées dans requete, ou liste les écarts relevés entre pièces.',
  preparer_relance: 'Brouillon de relance ou de courrier. Jamais envoyé.',
  generer_document: 'Met à disposition un ou plusieurs des six documents du dossier. requete = le(s) document(s) voulu(s).',
  creer_rappel: 'Prépare un rappel (à confirmer par le client). requete = la date et l’objet.',
  automatiser: 'Prépare une automatisation récurrente (à confirmer par le client). requete = la demande en langage naturel.',
  etat: 'État du traitement du dossier.',
};
export interface ToolSpec {
  name: ToolName;
  description: string;
  strict: true;
  input_schema: { type: 'object'; properties: { requete: { type: 'string'; description: string } }; required: ['requete']; additionalProperties: false };
}
export function toolSpecs(): ToolSpec[] {
  return TOOLS.map((t) => ({ name: t.name, description: TOOL_HELP[t.name], strict: true, input_schema: { type: 'object', properties: { requete: { type: 'string', description: 'Demande du client, reformulée si utile.' } }, required: ['requete'], additionalProperties: false } }));
}

/**
 * Exécution d'UN outil demandé par un planificateur (règles ou modèle) : registre
 * fermé, droits revérifiés, aucun outil de niveau 3. Le serveur exécute ; le
 * modèle ne fait que proposer. Rend null pour un nom inconnu.
 */
export function executeTool(ctx: Context, name: string, arg: string): { step: Step; result: (Partial<Pick<Reply, 'sources' | 'files' | 'confirm' | 'ask'>> & { text: string }) | null } | null {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool || tool.level === 3) return null;
  if (!ctx.rights.owner || !ctx.rights.assistant || !tool.allowed(ctx.rights)) return { step: { tool: tool.name, label: tool.label, ok: false }, result: null };
  const r = tool.run(ctx, String(arg ?? '').slice(0, MAX_MESSAGE), new Map(ctx.pieces.map((p) => [p.id, p.file_name])));
  return { step: { tool: tool.name, label: tool.label, ok: !r.ask }, result: r };
}

/** Une demande d'acte sensible (envoi, suppression, paiement, signature, accès) : refusée avant tout appel au modèle. */
export function isForbiddenRequest(message: string): boolean {
  return forbidden(norm(message));
}

/** Suggestions contextualisées (jamais de nom d'outil, de modèle ou d'agent). */
export function suggestions(ctx: Context): string[] {
  if (!ctx.analysis) return ['Où en est mon dossier ?'];
  return ['Résume ce dossier.', 'Prépare mes prochaines démarches.', ctx.analysis.contradictions.length ? 'Compare les pièces qui se contredisent.' : 'Quelles sont mes échéances ?', 'Automatise mon suivi.'];
}
