// Pilotage de la recette : centre d'actions multidossiers (trois priorités, ce qui a changé depuis la
// dernière visite, ce qui a été fait), battement du planificateur, coupe-circuit, alertes de budget.
// Tout est calculé à partir de données déjà produites : aucun appel de modèle, aucun contenu de pièce.
import type { RenduView } from '../../supabase/functions/_shared/rendus/view.ts';
import { update } from './kv.ts';
import type { RecetteStore } from './store.ts';

const JOUR = 86_400_000;
const frJour = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const jours = (iso: string, now: Date) => Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`)) / JOUR);

export interface Priorite {
  dossier: string;
  dossier_titre: string;
  /** Ce qui demande votre attention. */
  quoi: string;
  /** Pourquoi cela compte. */
  consequence: string;
  /** Ce qu'il faut faire (libellé du bouton). */
  action: string;
  lien: string;
  /** Plus petit = plus urgent. */
  rang: number;
}
export interface Centre {
  priorites: Priorite[];
  /** Dossiers qui ont aussi un point ouvert, non affichés (au-delà de trois). */
  autres: number;
  /** Début de la période « depuis votre dernière visite » ; null à la première visite. */
  depuis: string | null;
  changements: { dossier: string; dossier_titre: string; quand: string; quoi: string }[];
  /** Travail fait pour vous depuis la dernière visite (messages déposés dans votre boîte). */
  accompli: { quand: string; quoi: string; lien: string }[];
}

/** Priorité d'un dossier : UNE seule, la plus urgente. null = rien à décider. */
export function prioriteDossier(d: { id: string; title: string }, view: RenduView | null, now: Date): Priorite | null {
  if (!view) return null;
  const lien = `/compte/dossier/${d.id}`;
  const base = { dossier: d.id, dossier_titre: d.title, lien };
  const proche = [...view.echeances.confirmed].map((e) => ({ e, j: jours(e.date, now) })).filter((x) => x.j >= 0 && x.j <= 7).sort((a, b) => a.j - b.j)[0];
  if (proche) {
    const dans = proche.j === 0 ? 'aujourd’hui' : proche.j === 1 ? 'demain' : `dans ${proche.j} jours`;
    return { ...base, quoi: `${proche.e.title} — ${frJour(proche.e.date)}`, consequence: `Échéance ${dans}.`, action: 'Voir l’échéance', rang: proche.j };
  }
  const n = view.echeances.to_confirm.length;
  if (n) return { ...base, quoi: n > 1 ? `${n} dates à confirmer` : 'Une date à confirmer', consequence: 'Sans confirmation, aucun rappel n’est programmé.', action: 'Confirmer les dates', rang: 20 };
  const manque = view.resume.missing[0];
  if (manque) return { ...base, quoi: `Pièce attendue : ${manque.label}`, consequence: manque.why, action: 'Ajouter la pièce', rang: 30 };
  const a = view.tableau.action;
  if (a?.label && a.owner === 'client') return { ...base, quoi: a.label, consequence: a.rationale, action: 'Ouvrir le dossier', rang: 40 };
  return null;
}

const ROTATION_MS = 30 * 60_000;
/** Événements propres au titulaire : il vient de les faire, ce ne sont pas des nouvelles. */
const SIENS = new Set(['dossier_cree', 'pieces_deposees', 'rappel_cree', 'date_corrigee']);

/**
 * Centre d'actions du compte. « Depuis votre dernière visite » : la période démarre à la consultation
 * précédente dès que 30 minutes se sont écoulées sans consultation ; elle reste stable pendant une visite.
 */
export async function centreActions(store: RecetteStore, userId: string): Promise<Centre> {
  const now = store.now();
  let depuis: string | null = null;
  await update<{ dernier: string; depuis: string | null }>(store.kv, `visites/${userId}.json`, (cur) => {
    depuis = cur ? (now.getTime() - Date.parse(cur.dernier) > ROTATION_MS ? cur.dernier : cur.depuis) : null;
    return { dernier: now.toISOString(), depuis };
  }).catch(() => undefined);
  const dossiers = (await store.listUserDossiers(userId)).filter((d) => !d.deleted && !d.closed);
  const lus = await Promise.all(
    dossiers.map(async (d) => ({ d, view: ((await store.getView(d.id))?.view as RenduView | undefined) ?? null, events: depuis ? await store.listEvents(d.id) : [] })),
  );
  const toutes = lus.map((x) => prioriteDossier(x.d, x.view, now)).filter((p): p is Priorite => p !== null).sort((a, b) => a.rang - b.rang);
  const since = depuis as string | null;
  const changements = since
    ? lus
        .flatMap((x) => x.events.filter((e) => e.created_at > since && !SIENS.has(e.type)).map((e) => ({ dossier: x.d.id, dossier_titre: x.d.title, quand: e.created_at, quoi: e.label })))
        .sort((a, b) => (a.quand < b.quand ? 1 : -1))
        .slice(0, 8)
    : [];
  const accompli = since ? (await store.mailbox(userId)).filter((m) => m.at > since).slice(0, 5).map((m) => ({ quand: m.at, quoi: m.subject, lien: m.link })) : [];
  return { priorites: toutes.slice(0, 3), autres: Math.max(0, toutes.length - 3), depuis: since, changements, accompli };
}

/* ── Battement du planificateur : preuve que les automatisations tournent navigateur fermé ── */

export interface Passage {
  at: string;
  /** Automatisations exécutées pendant ce passage ; null = passage interrompu. */
  executees: number | null;
  source: 'planificateur' | 'manuel';
}
export async function noterPassage(store: RecetteStore, p: Omit<Passage, 'at'>): Promise<void> {
  await update<{ passages: Passage[] }>(store.kv, 'ops/planificateur.json', (cur) => ({ passages: [{ ...p, at: store.now().toISOString() }, ...(cur?.passages ?? [])].slice(0, 30) })).catch(() => undefined);
}
export async function passages(store: RecetteStore): Promise<Passage[]> {
  return (await store.kv.getJson<{ passages: Passage[] }>('ops/planificateur.json'))?.value.passages ?? [];
}

/* ── Coupe-circuit : arrêt immédiat des appels de modèle et/ou des automatisations, sans perte de données ── */

export interface CoupeCircuit {
  ia: boolean;
  automatisations: boolean;
  motif: string | null;
  at: string | null;
}
const OUVERT: CoupeCircuit = { ia: false, automatisations: false, motif: null, at: null };
export async function coupeCircuit(store: RecetteStore): Promise<CoupeCircuit> {
  return (await store.kv.getJson<CoupeCircuit>('ops/coupe-circuit.json').catch(() => null))?.value ?? OUVERT;
}
export async function reglerCoupeCircuit(store: RecetteStore, c: { ia?: unknown; automatisations?: unknown; motif?: unknown }): Promise<CoupeCircuit> {
  const next: CoupeCircuit = { ia: c.ia === true, automatisations: c.automatisations === true, motif: typeof c.motif === 'string' ? c.motif.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200) || null : null, at: store.now().toISOString() };
  await store.kv.putJson('ops/coupe-circuit.json', next);
  await store.alert('COUPE_CIRCUIT', { ia: next.ia, automatisations: next.automatisations });
  return next;
}

/* ── Alertes de budget IA : une seule par palier (70 %, 90 %, 100 %) et par mois ── */

export async function alerteBudget(store: RecetteStore, palier: { mois: string; seuil: 'ok' | '70' | '90' | '100'; ratio: number }): Promise<boolean> {
  if (palier.seuil === 'ok') return false;
  let premiere = false;
  await update<{ at: string }>(store.kv, `ops/budget-ia/${palier.mois}-${palier.seuil}.json`, (cur) => {
    premiere = !cur;
    return cur ? null : { at: store.now().toISOString() };
  }).catch(() => undefined);
  if (premiere) await store.alert(`BUDGET_IA_${palier.seuil}`, { mois: palier.mois, part: Math.round(palier.ratio * 100) });
  return premiere;
}
