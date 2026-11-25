// Automatisations RÉELLES de la recette : ce que l'assistant « prépare » (core.ts,
// outil « automatiser ») devient ici une planification enregistrée, exécutée par la
// tâche planifiée du serveur (navigateur fermé), avec une preuve par exécution.
//
// Garanties (vérifiées par tests/recette-automatisations.test.ts) :
//  - droits côté serveur : abonnement actif exigé à la création, à la reprise ET à chaque exécution ;
//  - isolement : une automatisation n'est lue que sous la clé de son titulaire (404 identique sinon) ;
//  - exécution idempotente : écriture conditionnelle de la preuve AVANT l'action
//    (clé = automatisation + échéance planifiée) — deux passages concurrents n'exécutent qu'une fois ;
//  - équité : tourniquet entre comptes, au plus PAR_COMPTE exécutions par compte et par passage ;
//  - actions déterministes : aucun modèle appelé, aucun contenu de pièce lu ni recopié.
import { toWorkflow, type PendingAction, type Workflow } from '../../supabase/functions/_shared/intelligence/core.ts';
import type { RenduView } from '../../supabase/functions/_shared/rendus/view.ts';
import { update } from './kv.ts';
import { sha } from './security.ts';
import { RecetteStore, type Subscription } from './store.ts';

export type Schedule =
  | { kind: 'hebdo' | 'quotidien' | 'mensuel'; /** 0 = dimanche … 6 = samedi (hebdo seulement). */ weekday?: 0 | 1 | 2 | 3 | 4 | 5 | 6; hour: number; tz: 'Europe/Paris' }
  | { kind: 'evenement'; on: 'piece_recue' };
export type AutomationAction = 'bilan_dossiers' | 'prevenir_echeances';
export type AutomationStatus = 'active' | 'suspendue' | 'annulee' | 'arretee';

export interface Automation {
  id: string;
  user_id: string;
  title: string;
  workflow: Workflow;
  schedule: Schedule;
  action: AutomationAction;
  status: AutomationStatus;
  /** Motif lisible d'un arrêt ou d'une suspension automatique. */
  stop_reason?: string;
  created_at: string;
  /** Prochaine échéance (UTC) ; null : pas d'échéance (suspendue, arrêtée, annulée, ou en attente d'un événement). */
  next_run_at: string | null;
  last_run_at: string | null;
  runs: number;
  max_runs_per_month: number;
  /** Exécutions du mois civil en cours (heure de Paris). */
  month?: { mois: string; n: number };
  /** Échecs consécutifs. */
  failures?: number;
}

/** Preuve d'une exécution (journal `auto-runs/<id>/<clé>.json`) : texte et compteurs, jamais de contenu de pièce. */
export interface RunProof {
  at: string;
  due: string;
  status: 'faite' | 'rien_a_signaler' | 'echec';
  resume: string;
  duree_ms: number;
  /** Exécution tardive d'une échéance manquée (une seule, quel que soit le nombre de périodes manquées). */
  rattrapage?: boolean;
  compteurs?: Record<string, number>;
  texte?: string;
}
type RunDoc = Omit<RunProof, 'status'> & { status: RunProof['status'] | 'en_cours' };

export type Refus = { ok: false; status: number; error: string; redirect?: string };
export type Outcome = { ok: true; automation: Automation; created: boolean } | Refus;

/** Automatisations actives par compte. */
export const MAX_ACTIVES = 10;
/** Automatisations conservées par compte (actives, suspendues, arrêtées). */
const MAX_CONSERVEES = 30;
/** Exécutions par passage du planificateur, tous comptes confondus. */
export const PAR_PASSAGE = 20;
/** Exécutions d'un même compte par passage. */
export const PAR_COMPTE = 2;
/** Comptes examinés par passage (les suivants le sont au passage d'après). */
const MAX_COMPTES = 200;
const MAX_ECHECS = 3;
/** Durée au-delà de laquelle une exécution interrompue (preuve restée « en cours ») est reprise. */
const REPRISE_MS = 10 * 60_000;
/** Réservation d'une place d'automatisation active sans fiche correspondante : libérée après ce délai. */
const RESERVATION_MS = 5 * 60_000;
const MAX_DOSSIERS = 50;
const MAX_ECHEANCES = 40;
const LOT = 16;
const PALIERS = [1, 7, 30] as const;
const PLAFOND_MENSUEL: Record<Schedule['kind'], number> = { hebdo: 6, quotidien: 35, mensuel: 2, evenement: 60 };
const TITRES: Record<AutomationAction, string> = { bilan_dossiers: 'Bilan de vos dossiers', prevenir_echeances: 'Alerte avant vos échéances' };
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const ID = /^au_[0-9a-f]{24}$/;
const INTROUVABLE: Refus = { ok: false, status: 404, error: 'Automatisation introuvable.' };
const SANS_ABONNEMENT: Refus = { ok: false, status: 402, error: 'Un abonnement actif est nécessaire pour utiliser les automatisations.', redirect: '/tarifs' };
const PLEIN: Refus = { ok: false, status: 409, error: `Vous avez déjà ${MAX_ACTIVES} automatisations actives. Suspendez-en ou annulez-en une pour en activer une autre.` };
const MOTIF_ABONNEMENT = 'Votre abonnement n’est plus actif : cette automatisation est arrêtée et ne s’exécute plus.';
const MOTIF_PLAFOND = 'Le nombre maximal d’exécutions de ce mois est atteint : cette automatisation est arrêtée. Vous pourrez la reprendre le mois prochain.';
const MOTIF_ECHECS = `${MAX_ECHECS} exécutions de suite n’ont pas abouti : cette automatisation est suspendue. Notre équipe est prévenue ; vous pouvez la reprendre à tout moment.`;
const MENTION = 'Message préparé automatiquement à partir de vos dossiers, à vérifier ; il ne constitue pas un conseil juridique.';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
const propre = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const fr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/* ── Heure de Paris (Intl seulement, changements d'heure compris) ───────── */
const PARIS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function paris(t: number) {
  const p: Record<string, number> = {};
  for (const x of PARIS.formatToParts(new Date(t))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second };
}
/** Décalage de Paris par rapport à UTC à l'instant t (ms). */
function decalage(t: number) {
  const p = paris(t);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000;
}
/** Instant UTC d'une heure pleine de Paris. Une heure qui n'existe pas (passage à l'heure d'été) est décalée d'une heure. */
export function parisToUtc(y: number, m: number, d: number, h: number): number {
  const naif = Date.UTC(y, m - 1, d, h);
  const t = naif - decalage(naif);
  const d2 = decalage(t);
  return naif - d2 === t ? t : naif - d2;
}
const jourParis = (now: Date) => {
  const p = paris(now.getTime());
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
};

/** Première échéance STRICTEMENT après `after` (UTC, ISO) ; null pour un déclencheur événementiel. */
export function nextRun(s: Schedule, after: Date): string | null {
  if (s.kind === 'evenement') return null;
  const p = paris(after.getTime());
  if (s.kind === 'mensuel') {
    for (let k = 0; k <= 2; k++) {
      const t = parisToUtc(p.y, p.m + k, 1, s.hour);
      if (t > after.getTime()) return new Date(t).toISOString();
    }
    return null;
  }
  for (let k = 0; k <= 8; k++) {
    if (s.kind === 'hebdo' && new Date(Date.UTC(p.y, p.m - 1, p.d + k)).getUTCDay() !== s.weekday) continue;
    const t = parisToUtc(p.y, p.m, p.d + k, s.hour);
    if (t > after.getTime()) return new Date(t).toISOString();
  }
  return null;
}

function parse(declencheur: string): Schedule | null {
  const t = norm(declencheur);
  const h = Number(/\ba (\d{1,2}) ?h\b/.exec(t)?.[1] ?? 8);
  const hour = Number.isInteger(h) && h >= 0 && h <= 23 ? h : 8;
  const day = JOURS.findIndex((d) => new RegExp(`\\b${d}s?\\b`).test(t));
  if (day >= 0) return { kind: 'hebdo', weekday: day as 0 | 1 | 2 | 3 | 4 | 5 | 6, hour, tz: 'Europe/Paris' };
  if (/\b(chaque jour|tous les jours|quotidien)/.test(t)) return { kind: 'quotidien', hour, tz: 'Europe/Paris' };
  if (/\b(chaque mois|tous les mois|mensuel)/.test(t)) return { kind: 'mensuel', hour, tz: 'Europe/Paris' };
  if (/\ba chaque\b.*\b(facture|piece|document|courrier|e-?mail|contrat)/.test(t)) return { kind: 'evenement', on: 'piece_recue' };
  // « 30, 7 et 1 jour(s) avant la date concernée » : contrôle chaque matin.
  if (/\bavant\b/.test(t)) return { kind: 'quotidien', hour, tz: 'Europe/Paris' };
  return null;
}

/**
 * Demande (texte libre, ou workflow préparé par l'assistant) → planification structurée et première échéance.
 * Null si la demande n'est pas comprise.
 */
export function scheduleFrom(input: string | Workflow, now: Date): { schedule: Schedule; next_run_at: string | null } | null {
  const w = typeof input === 'string' ? toWorkflow(input) : input;
  if (!w || typeof w.declencheur !== 'string') return null;
  const schedule = parse(w.declencheur);
  return schedule ? { schedule, next_run_at: nextRun(schedule, now) } : null;
}

/** Action réellement exécutable pour ce workflow ; null si aucune (ex. projet de relance seul). */
function actionFrom(w: Workflow): AutomationAction | null {
  const a = norm(w.actions.join(' | '));
  if (/\bbilan\b/.test(a)) return 'bilan_dossiers';
  if (/\bprevenir\b/.test(a) || /\bavant\b/.test(norm(w.declencheur))) return 'prevenir_echeances';
  if (/\banalyser\b/.test(a)) return 'bilan_dossiers';
  return null;
}

/** Workflow reçu du navigateur (action à confirmer) : seuls des textes bornés sont conservés. */
function cleanWorkflow(p: PendingAction): Workflow | null {
  const w = p && typeof p === 'object' && p.kind === 'automatisation' ? (p.workflow as Partial<Workflow> | undefined) : undefined;
  if (!w || typeof w !== 'object' || !Array.isArray(w.actions)) return null;
  const actions = w.actions.map((x) => propre(x, 200)).filter(Boolean).slice(0, 5);
  const declencheur = propre(w.declencheur, 200);
  if (!declencheur || !actions.length) return null;
  return { declencheur, conditions: (Array.isArray(w.conditions) ? w.conditions : []).map((x) => propre(x, 200)).filter(Boolean).slice(0, 5), actions, frequence: propre(w.frequence, 60), fuseau: 'Europe/Paris', budget: propre(w.budget, 200), arret: propre(w.arret, 200) };
}

/** Planification en clair, pour l'affichage. */
export function quand(s: Schedule): string {
  if (s.kind === 'evenement') return 'à chaque pièce reçue';
  const h = `à ${s.hour} h (heure de Paris)`;
  return s.kind === 'hebdo' ? `chaque ${JOURS[s.weekday ?? 1]} ${h}` : s.kind === 'quotidien' ? `chaque jour ${h}` : `le 1er de chaque mois ${h}`;
}

/* ── Stockage : fiche par automatisation + index par compte ─────────────── */
interface IndexDoc {
  /** Automatisations visibles du compte (toutes sauf les annulées). */
  ids: string[];
  /** Places d'automatisation active réservées (identifiant → date de réservation) : le plafond se décide ici, atomiquement. */
  actives: Record<string, string>;
}
const cleIndex = (userId: string) => `auto-index/${userId}.json`;
const cleFiche = (userId: string, id: string) => `auto/${userId}/${id}.json`;
const clePreuve = (id: string, due: string) => `auto-runs/${id}/${due.replace(/[^0-9TZ]/g, '')}.json`;

async function fiches(store: RecetteStore, userId: string, ids: string[]): Promise<Automation[]> {
  const out: Automation[] = [];
  for (let i = 0; i < ids.length; i += LOT) for (const e of await Promise.all(ids.slice(i, i + LOT).map((id) => store.kv.getJson<Automation>(cleFiche(userId, id))))) if (e && e.value.user_id === userId) out.push(e.value);
  return out;
}

/** Réserve une place d'automatisation active (écriture conditionnelle : deux demandes simultanées ne dépassent pas le plafond). */
async function reserver(store: RecetteStore, userId: string, id: string): Promise<'ok' | 'plein' | 'trop'> {
  const at = store.now().toISOString();
  for (let essai = 0; essai < 2; essai++) {
    let res: 'ok' | 'plein' | 'trop' = 'ok';
    await update<IndexDoc>(store.kv, cleIndex(userId), (cur) => {
      const ids = cur?.ids ?? [];
      const actives = cur?.actives ?? {};
      res = 'ok';
      if (!actives[id] && Object.keys(actives).length >= MAX_ACTIVES) return (res = 'plein'), null;
      if (!ids.includes(id) && ids.length >= MAX_CONSERVEES) return (res = 'trop'), null;
      return { ids: ids.includes(id) ? ids : [...ids, id], actives: { ...actives, [id]: at } };
    });
    // (assignation faite dans la fonction de mise à jour : le compilateur ne la suit pas)
    if ((res as string) !== 'plein' || essai > 0) return res;
    // Plafond atteint : libère d'abord les places restées réservées sans automatisation active (arrêt interrompu).
    const idx = (await store.kv.getJson<IndexDoc>(cleIndex(userId), { fresh: true }))?.value;
    const vivantes = new Set((await fiches(store, userId, Object.keys(idx?.actives ?? {}))).filter((a) => a.status === 'active').map((a) => a.id));
    const perdues = Object.entries(idx?.actives ?? {}).filter(([k, depuis]) => !vivantes.has(k) && store.now().getTime() - Date.parse(depuis) > RESERVATION_MS).map(([k]) => k);
    if (!perdues.length) return res;
    await update<IndexDoc>(store.kv, cleIndex(userId), (cur) => (cur ? { ids: cur.ids, actives: Object.fromEntries(Object.entries(cur.actives).filter(([k]) => !perdues.includes(k))) } : null));
  }
  return 'plein';
}
async function liberer(store: RecetteStore, userId: string, id: string, oublier = false) {
  await update<IndexDoc>(store.kv, cleIndex(userId), (cur) => {
    if (!cur || (!(id in cur.actives) && !(oublier && cur.ids.includes(id)))) return null;
    const actives = { ...cur.actives };
    delete actives[id];
    return { ids: oublier ? cur.ids.filter((x) => x !== id) : cur.ids, actives };
  });
}

/* ── Création, liste, changement d'état ─────────────────────────────────── */

/**
 * Enregistre l'automatisation confirmée par le client (texte libre, ou action préparée par l'assistant).
 * Abonnement actif exigé (402 sinon) ; même demande confirmée deux fois = une seule automatisation.
 */
export async function createAutomation(store: RecetteStore, user: { id: string }, sub: Subscription, input: PendingAction | string): Promise<Outcome> {
  const now = store.now();
  if (!RecetteStore.active(sub, now)) return SANS_ABONNEMENT;
  const w = typeof input === 'string' ? toWorkflow(input.slice(0, 2000)) : cleanWorkflow(input);
  const plan = w ? scheduleFrom(w, now) : null;
  if (!w || !plan) return { ok: false, status: 400, error: 'Je n’ai pas compris quoi faire, ni à quel rythme. Par exemple : « Chaque vendredi, prépare le bilan de mes dossiers. »' };
  const action = actionFrom(w);
  if (!action) return { ok: false, status: 400, error: 'Cette automatisation n’est pas encore disponible. Vous pouvez demander un bilan régulier de vos dossiers, ou une alerte avant vos échéances.' };
  const id = `au_${sha(`${user.id}|${JSON.stringify(plan.schedule)}|${action}`).slice(0, 24)}`;
  const key = cleFiche(user.id, id);
  const deja = (await store.kv.getJson<Automation>(key))?.value;
  if (deja && (deja.status === 'active' || deja.status === 'suspendue')) return { ok: true, automation: deja, created: false };
  const place = await reserver(store, user.id, id);
  if (place === 'plein') return PLEIN;
  if (place === 'trop') return { ok: false, status: 409, error: 'Vous avez trop d’automatisations enregistrées. Annulez celles qui ne servent plus avant d’en créer une autre.' };
  const neuve: Automation = { id, user_id: user.id, title: TITRES[action], workflow: w, schedule: plan.schedule, action, status: 'active', created_at: now.toISOString(), next_run_at: plan.next_run_at, last_run_at: null, runs: 0, max_runs_per_month: PLAFOND_MENSUEL[plan.schedule.kind], failures: 0 };
  if (deja) {
    // Même demande après une annulation ou un arrêt : la même automatisation repart (historique conservé).
    const a = await update<Automation>(store.kv, key, (cur) => (cur ? { ...cur, workflow: w, status: 'active', stop_reason: undefined, next_run_at: plan.next_run_at, failures: 0 } : neuve));
    return { ok: true, automation: a!, created: true };
  }
  if ((await store.kv.putJson(key, neuve, { create: true })).ok) return { ok: true, automation: neuve, created: true };
  // Deux confirmations simultanées de la même demande : la première a créé la fiche.
  const autre = (await store.kv.getJson<Automation>(key, { fresh: true }))?.value;
  return autre ? { ok: true, automation: autre, created: false } : { ok: false, status: 503, error: 'Enregistrement impossible pour le moment. Réessayez dans un instant.' };
}

/** Automatisations du compte (actives, suspendues, arrêtées), les plus récentes d'abord. */
export async function listAutomations(store: RecetteStore, userId: string): Promise<Automation[]> {
  const idx = (await store.kv.getJson<IndexDoc>(cleIndex(userId)))?.value;
  return (await fiches(store, userId, idx?.ids ?? [])).filter((a) => a.status !== 'annulee').sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

async function fiche(store: RecetteStore, userId: string, id: string) {
  // La clé porte le compte : l'automatisation d'un autre titulaire est introuvable, comme un identifiant inexistant.
  return ID.test(id) ? ((await store.kv.getJson<Automation>(cleFiche(userId, id)))?.value ?? null) : null;
}

/** Suspendre, reprendre ou annuler — titulaire uniquement. */
export async function setStatus(store: RecetteStore, user: { id: string }, sub: Subscription, id: string, op: 'suspendre' | 'reprendre' | 'annuler'): Promise<Outcome> {
  const cur = await fiche(store, user.id, id);
  if (!cur || cur.user_id !== user.id) return INTROUVABLE;
  const key = cleFiche(user.id, id);
  const now = store.now();
  const ecrire = async (fn: (a: Automation) => Automation): Promise<Outcome> => ({ ok: true, automation: (await update<Automation>(store.kv, key, (a) => (a ? fn(a) : null)))!, created: false });
  if (op === 'annuler') {
    const r = await ecrire((a) => ({ ...a, status: 'annulee', next_run_at: null, stop_reason: undefined }));
    await liberer(store, user.id, id, true);
    return r;
  }
  if (cur.status === 'annulee') return { ok: false, status: 409, error: 'Cette automatisation est annulée. Vous pouvez en créer une nouvelle.' };
  if (op === 'suspendre') {
    if (cur.status === 'arretee') return { ok: false, status: 409, error: 'Cette automatisation est déjà arrêtée.' };
    const r = await ecrire((a) => (a.status === 'active' ? { ...a, status: 'suspendue', next_run_at: null, stop_reason: undefined } : a));
    await liberer(store, user.id, id);
    return r;
  }
  if (cur.status === 'active') return { ok: true, automation: cur, created: false };
  if (!RecetteStore.active(sub, now)) return SANS_ABONNEMENT;
  if ((await reserver(store, user.id, id)) !== 'ok') return PLEIN;
  return ecrire((a) => (a.status === 'annulee' ? a : { ...a, status: 'active', stop_reason: undefined, failures: 0, next_run_at: nextRun(a.schedule, now) }));
}

/** Preuves d'exécution d'une automatisation du compte (les 50 dernières, la plus récente d'abord) ; null si introuvable. */
export async function runsOf(store: RecetteStore, userId: string, id: string): Promise<RunProof[] | null> {
  if (!(await fiche(store, userId, id))) return null;
  const keys = (await store.kv.list(`auto-runs/${id}/`)).slice(-50).reverse();
  const out: RunProof[] = [];
  for (const e of await Promise.all(keys.map((k) => store.kv.getJson<RunDoc>(k)))) if (e && e.value.status !== 'en_cours') out.push(e.value as RunProof);
  return out;
}

/**
 * Déclencheur événementiel : à appeler après l'enregistrement d'une pièce du compte. Les automatisations
 * « à chaque pièce reçue » deviennent dues ; le planificateur les exécute (une exécution pour un lot de pièces).
 */
export async function onPieceRecue(store: RecetteStore, userId: string): Promise<number> {
  const at = store.now().toISOString();
  let n = 0;
  for (const a of await listAutomations(store, userId)) {
    if (a.status !== 'active' || a.schedule.kind !== 'evenement' || a.next_run_at) continue;
    await update<Automation>(store.kv, cleFiche(userId, a.id), (cur) => (cur && cur.status === 'active' && !cur.next_run_at ? { ...cur, next_run_at: at } : null));
    n++;
  }
  return n;
}

/* ── Actions réelles (déterministes, sans modèle, sans contenu de pièce) ─── */
interface Resultat {
  status: RunProof['status'];
  resume: string;
  compteurs: Record<string, number>;
  texte?: string;
}

/** Une seule remise par exécution, même si l'exécution est reprise après une interruption. */
async function remettre(store: RecetteStore, a: Automation, due: string, subject: string, text: string) {
  if (!(await store.kv.putJson(`auto-notif/${a.id}/${due.replace(/[^0-9TZ]/g, '')}.json`, { at: store.now().toISOString() }, { create: true })).ok) return;
  await store.notify(a.user_id, { subject, text, link: '/compte' });
}

async function vueApprouvee(store: RecetteStore, dossierId: string) {
  const v = await store.getView(dossierId);
  return { etat: v ? v.status : null, vue: v?.status === 'approved' ? (v.view as RenduView) : null };
}

async function bilanDossiers(store: RecetteStore, a: Automation, now: Date, due: string): Promise<Resultat> {
  const tous = (await store.listUserDossiers(a.user_id)).filter((d) => !d.closed);
  const dossiers = tous.slice(0, MAX_DOSSIERS);
  const depuis = a.last_run_at ?? a.created_at;
  const c = { dossiers: dossiers.length, nouvelles_pieces: 0, actions: 0, dates: 0 };
  const lignes: string[] = [];
  for (const d of dossiers) {
    // Seuls le nombre et la date de dépôt des pièces sont lus : ni leur nom, ni leur contenu.
    const nouvelles = (await store.listPieces(d.id)).filter((p) => !p.deleted_at && p.created_at > depuis).length;
    const { etat, vue } = await vueApprouvee(store, d.id);
    c.nouvelles_pieces += nouvelles;
    lignes.push(`• ${d.title} — ${nouvelles ? pluriel(nouvelles, 'nouvelle pièce reçue', 'nouvelles pièces reçues') : 'aucune nouvelle pièce'} depuis le ${fr(jourParis(new Date(depuis)))}.`);
    if (!vue) {
      lignes.push(etat === 'pending' ? '  Les résultats sont en cours de vérification par notre équipe.' : '  Les résultats ne sont pas encore disponibles.');
      continue;
    }
    const t = vue.tableau;
    lignes.push(`  Situation : ${t.situation}`);
    if (t.action?.label) {
      if (t.action.owner !== 'personne') c.actions++;
      lignes.push(`  Prochaine action : ${t.action.label}${t.action.due_date ? ` (avant le ${fr(t.action.due_date)})` : ''}`);
    }
    if (t.next_date) {
      c.dates++;
      lignes.push(`  Prochaine date : ${fr(t.next_date.date)} — ${t.next_date.title}${t.next_date.status === 'a_confirmer' ? ' (à confirmer)' : ''}`);
    }
  }
  const jour = fr(jourParis(now));
  if (!dossiers.length) return { status: 'rien_a_signaler', resume: 'Aucun dossier en cours.', compteurs: c };
  const texte = [`Bilan de vos dossiers au ${jour}`, '', ...lignes, ...(tous.length > dossiers.length ? ['', `Seuls vos ${MAX_DOSSIERS} dossiers les plus récents figurent dans ce bilan.`] : []), '', MENTION].join('\n');
  const resume = `${pluriel(c.dossiers, 'dossier suivi', 'dossiers suivis')}, ${pluriel(c.nouvelles_pieces, 'nouvelle pièce', 'nouvelles pièces')}, ${pluriel(c.actions, 'action à faire', 'actions à faire')}.`;
  if (!c.nouvelles_pieces && !c.actions && !c.dates) return { status: 'rien_a_signaler', resume, compteurs: c, texte };
  await remettre(store, a, due, `Votre bilan du ${jour}`, texte);
  return { status: 'faite', resume, compteurs: c, texte };
}

async function prevenirEcheances(store: RecetteStore, a: Automation, now: Date, due: string): Promise<Resultat> {
  const dossiers = (await store.listUserDossiers(a.user_id)).filter((d) => !d.closed).slice(0, MAX_DOSSIERS);
  const auj = Date.parse(`${jourParis(now)}T00:00:00Z`);
  const c = { dossiers: dossiers.length, echeances: 0, alertes: 0 };
  const lignes: string[] = [];
  const marques: string[] = [];
  for (const d of dossiers) {
    const { vue } = await vueApprouvee(store, d.id);
    for (const e of (vue?.echeances.confirmed ?? []).slice(0, MAX_ECHEANCES)) {
      if (e.done || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
      const jours = Math.round((Date.parse(`${e.date}T00:00:00Z`) - auj) / 86_400_000);
      const palier = PALIERS.find((p) => jours <= p);
      if (jours < 0 || palier === undefined) continue;
      c.echeances++;
      // Une seule alerte par échéance et par palier, pour tout le compte (mémoire durable).
      const marque = `auto-ech/${a.user_id}/${sha(`${d.id}|${e.key}|${e.date}|${palier}`).slice(0, 32)}.json`;
      if (await store.kv.getJson(marque)) continue;
      marques.push(marque);
      lignes.push(`• ${fr(e.date)} (${jours === 0 ? 'aujourd’hui' : jours === 1 ? 'demain' : `dans ${jours} jours`}) — ${e.title} — dossier « ${d.title} »`);
    }
  }
  c.alertes = lignes.length;
  if (!lignes.length) return { status: 'rien_a_signaler', resume: c.echeances ? 'Échéances proches déjà signalées : rien de nouveau.' : 'Aucune échéance confirmée dans les 30 jours.', compteurs: c };
  const texte = [lignes.length > 1 ? 'Ces échéances approchent :' : 'Cette échéance approche :', '', ...lignes, '', MENTION].join('\n');
  await remettre(store, a, due, lignes.length > 1 ? `${lignes.length} échéances approchent` : 'Une échéance approche', texte);
  for (const m of marques) await store.kv.putJson(m, { at: now.toISOString() }, { create: true });
  return { status: 'faite', resume: `${pluriel(c.alertes, 'échéance signalée', 'échéances signalées')}.`, compteurs: c, texte };
}

const ACTIONS: Record<AutomationAction, (store: RecetteStore, a: Automation, now: Date, due: string) => Promise<Resultat>> = { bilan_dossiers: bilanDossiers, prevenir_echeances: prevenirEcheances };

/* ── Planificateur ──────────────────────────────────────────────────────── */
export interface TickReport {
  comptes: number;
  dues: number;
  executees: number;
  echecs: number;
  arretees: number;
  /** Déjà exécutées ou en cours ailleurs (passage concurrent). */
  ignorees: number;
}

async function arreter(store: RecetteStore, a: Automation, due: string, motif: string) {
  let fait = false;
  await update<Automation>(store.kv, cleFiche(a.user_id, a.id), (cur) => ((fait = Boolean(cur && cur.status === 'active' && cur.next_run_at === due)) ? { ...cur!, status: 'arretee', stop_reason: motif, next_run_at: null } : null));
  if (!fait) return;
  await liberer(store, a.user_id, a.id);
  await store.notify(a.user_id, { subject: `Automatisation arrêtée : ${a.title}`, text: motif, link: '/compte' });
}

/** Après l'exécution de l'échéance `due` : compteurs et prochaine échéance calculée depuis MAINTENANT (un seul rattrapage). */
async function avancer(store: RecetteStore, a: Automation, due: string, echec: boolean) {
  const now = store.now();
  const mois = jourParis(now).slice(0, 7);
  let suspendue = false;
  await update<Automation>(store.kv, cleFiche(a.user_id, a.id), (cur) => {
    suspendue = false;
    if (!cur || cur.next_run_at !== due) return null; // déjà avancée (passage concurrent) ou état changé par le titulaire
    const failures = echec ? (cur.failures ?? 0) + 1 : 0;
    const next: Automation = { ...cur, runs: cur.runs + 1, last_run_at: echec ? cur.last_run_at : now.toISOString(), month: { mois, n: (cur.month?.mois === mois ? cur.month.n : 0) + 1 }, failures, next_run_at: cur.status === 'active' ? nextRun(cur.schedule, now) : null };
    if (failures >= MAX_ECHECS && cur.status === 'active') (suspendue = true), Object.assign(next, { status: 'suspendue', stop_reason: MOTIF_ECHECS, next_run_at: null });
    return next;
  });
  if (suspendue) {
    await liberer(store, a.user_id, a.id);
    await store.alert('AUTOMATISATION_SUSPENDUE', { automatisation: a.id, action: a.action, echecs: MAX_ECHECS });
  }
}

async function executer(store: RecetteStore, lue: Automation): Promise<'faite' | 'echec' | 'arretee' | 'ignoree'> {
  const now = store.now();
  const due = lue.next_run_at!;
  // Fiche RELUE juste avant d'agir : une suspension ou une annulation faite pendant le passage est respectée.
  const a = (await store.kv.getJson<Automation>(cleFiche(lue.user_id, lue.id), { fresh: true }))?.value;
  if (!a || a.status !== 'active' || a.next_run_at !== due) return 'ignoree';
  // Droits revérifiés à CHAQUE exécution, avant toute lecture de dossier.
  if (!RecetteStore.active(await store.getSub(a.user_id), now)) return await arreter(store, a, due, MOTIF_ABONNEMENT), 'arretee';
  const mois = jourParis(now).slice(0, 7);
  if ((a.month?.mois === mois ? a.month.n : 0) >= a.max_runs_per_month) return await arreter(store, a, due, MOTIF_PLAFOND), 'arretee';
  // Prise de l'échéance AVANT l'action : la preuve n'est créée qu'une fois.
  const key = clePreuve(a.id, due);
  const prise: RunDoc = { at: now.toISOString(), due, status: 'en_cours', resume: '', duree_ms: 0 };
  if (!(await store.kv.putJson(key, prise, { create: true })).ok) {
    const ex = await store.kv.getJson<RunDoc>(key, { fresh: true });
    if (!ex) return 'ignoree';
    if (ex.value.status !== 'en_cours') return await avancer(store, a, due, ex.value.status === 'echec'), 'ignoree';
    // Exécution interrompue (arrêt du serveur) : reprise après REPRISE_MS, sous condition (un seul repreneur).
    if (now.getTime() - Date.parse(ex.value.at) < REPRISE_MS || !ex.etag || !(await store.kv.putJson(key, prise, { ifMatch: ex.etag })).ok) return 'ignoree';
  }
  let r: Resultat;
  try {
    r = await ACTIONS[a.action](store, a, now, due);
  } catch (e) {
    console.error(JSON.stringify({ evt: 'automatisation', action: a.action, erreur: String(e instanceof Error ? e.message : e).slice(0, 300) }));
    r = { status: 'echec', resume: 'L’exécution n’a pas abouti. Elle sera retentée à la prochaine échéance.', compteurs: {} };
  }
  const preuve: RunProof = { at: now.toISOString(), due, status: r.status, resume: r.resume, duree_ms: Math.max(0, store.now().getTime() - now.getTime()), rattrapage: now.getTime() - Date.parse(due) > 60 * 60_000, compteurs: r.compteurs, ...(r.texte ? { texte: r.texte } : {}) };
  await store.kv.putJson(key, preuve);
  await avancer(store, a, due, r.status === 'echec');
  return r.status === 'echec' ? 'echec' : 'faite';
}

/**
 * Passage du planificateur (tâche planifiée du serveur) : exécute les automatisations dues, au plus `max`
 * par passage et `perAccount` par compte, à tour de rôle entre les comptes. Toutes les boucles sont bornées.
 */
export async function tickAutomations(store: RecetteStore, opts: { max?: number; perAccount?: number; maxAccounts?: number; budgetMs?: number } = {}): Promise<TickReport> {
  const max = Math.max(1, opts.max ?? PAR_PASSAGE);
  const parCompte = Math.max(1, opts.perAccount ?? PAR_COMPTE);
  const debut = Date.now();
  const iso = store.now().toISOString();
  const rapport: TickReport = { comptes: 0, dues: 0, executees: 0, echecs: 0, arretees: 0, ignorees: 0 };
  const comptes = (await store.kv.list('auto-index/')).map((k) => k.slice('auto-index/'.length, -'.json'.length)).sort();
  if (!comptes.length) return rapport;
  // Tourniquet : on repart du compte qui suit le dernier servi.
  const dernier = (await store.kv.getJson<{ user: string }>('auto-tour.json'))?.value.user ?? null;
  const i = dernier === null ? 0 : comptes.findIndex((c) => c > dernier);
  const ordre = (i <= 0 ? comptes : [...comptes.slice(i), ...comptes.slice(0, i)]).slice(0, Math.max(1, opts.maxAccounts ?? MAX_COMPTES));
  rapport.comptes = ordre.length;
  const dues = new Map<string, Automation[]>();
  for (let k = 0; k < ordre.length; k += LOT) {
    await Promise.all(
      ordre.slice(k, k + LOT).map(async (u) => {
        const ids = (await store.kv.getJson<IndexDoc>(cleIndex(u)))?.value.ids ?? [];
        const l = (await fiches(store, u, ids.slice(0, MAX_CONSERVEES))).filter((a) => a.status === 'active' && a.next_run_at !== null && a.next_run_at <= iso).sort((x, y) => x.next_run_at!.localeCompare(y.next_run_at!));
        if (l.length) dues.set(u, l);
        rapport.dues += l.length;
      }),
    );
  }
  const choisies: Automation[] = [];
  for (let tour = 0; tour < parCompte && choisies.length < max; tour++) {
    for (const u of ordre) {
      const a = dues.get(u)?.[tour];
      if (a) choisies.push(a);
      if (choisies.length >= max) break;
    }
  }
  let servi: string | null = null;
  for (const a of choisies) {
    if (Date.now() - debut > (opts.budgetMs ?? 40_000)) break; // le reste attend le passage suivant
    const r = await executer(store, a).catch((e) => (console.error(JSON.stringify({ evt: 'automatisation', erreur: String(e instanceof Error ? e.message : e).slice(0, 300) })), 'ignoree' as const));
    servi = a.user_id;
    if (r === 'faite') rapport.executees++;
    else if (r === 'echec') rapport.echecs++, rapport.executees++;
    else if (r === 'arretee') rapport.arretees++;
    else rapport.ignorees++;
  }
  const repere = servi ?? (ordre.length < comptes.length ? ordre[ordre.length - 1] : null);
  if (repere !== null && comptes.length > 1) await store.kv.putJson('auto-tour.json', { user: repere }).catch(() => undefined);
  return rapport;
}

/* ── Routes ─────────────────────────────────────────────────────────────── */
export function vueAutomation(a: Automation) {
  return { id: a.id, titre: a.title, quand: quand(a.schedule), planification: a.schedule, action: a.action, statut: a.status, motif: a.stop_reason ?? null, creee_le: a.created_at, prochaine_execution: a.next_run_at, derniere_execution: a.last_run_at, executions: a.runs, plafond_mensuel: a.max_runs_per_month };
}

export interface AutomationsCtx {
  store: RecetteStore;
  /** Compte de la SESSION (jamais lu dans le corps de la requête). */
  user: { id: string };
  sub: Subscription;
  method: string;
  path: string;
  body: unknown;
}

/** Routeur des automatisations. Null : chemin étranger à /api/automatisations (l'appelant continue). */
export async function handleAutomations(ctx: AutomationsCtx): Promise<{ status: number; body: unknown } | null> {
  const path = ctx.path.replace(/\/+$/, '');
  if (path !== '/api/automatisations' && !path.startsWith('/api/automatisations/')) return null;
  const { store, user, sub, method } = ctx;
  const refus = (r: Refus) => ({ status: r.status, body: { error: r.error, ...(r.redirect ? { redirect: r.redirect } : {}) } });
  if (path === '/api/automatisations' && method === 'GET') return { status: 200, body: { automatisations: (await listAutomations(store, user.id)).map(vueAutomation), plafond: MAX_ACTIVES } };
  if (path === '/api/automatisations' && method === 'POST') {
    const b = (ctx.body && typeof ctx.body === 'object' ? ctx.body : {}) as { texte?: unknown; action?: unknown };
    const input = typeof b.texte === 'string' && b.texte.trim() ? b.texte : b.action && typeof b.action === 'object' ? (b.action as PendingAction) : null;
    if (input === null) return { status: 400, body: { error: 'Indiquez ce que vous voulez automatiser.' } };
    const r = await createAutomation(store, user, sub, input);
    return r.ok ? { status: r.created ? 201 : 200, body: { automatisation: vueAutomation(r.automation), deja_existante: !r.created } } : refus(r);
  }
  const m = /^\/api\/automatisations\/([a-z0-9_]{1,40})\/(suspendre|reprendre|annuler|executions)$/.exec(path);
  if (m && m[2] === 'executions' && method === 'GET') {
    const runs = await runsOf(store, user.id, m[1]);
    return runs ? { status: 200, body: { executions: runs } } : refus(INTROUVABLE);
  }
  if (m && m[2] !== 'executions' && method === 'POST') {
    const r = await setStatus(store, user, sub, m[1], m[2] as 'suspendre' | 'reprendre' | 'annuler');
    return r.ok ? { status: 200, body: { automatisation: vueAutomation(r.automation) } } : refus(r);
  }
  return { status: 404, body: { error: 'introuvable' } };
}
