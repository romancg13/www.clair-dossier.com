// API de la recette (Request → Response standard). Toute décision de droit est
// prise ICI, côté serveur : un dépôt sans abonnement actif est refusé AVANT tout
// stockage, lecture ou traitement. Les fichiers ne sortent que par des liens
// signés temporaires liés à la session du titulaire.
import { zipSync } from 'fflate';
import { plans } from '../../src/data/pricing.ts';
import { DELIVERABLE_CATALOG, type DeliverableKey } from '../../supabase/functions/_shared/analysis-model.ts';
import { drain } from '../../supabase/functions/_shared/engine/runner.ts';
import type { EngineDeps } from '../../supabase/functions/_shared/engine/runner.ts';
import { isCalendarDate, readDatesForm, type RenduView } from '../../supabase/functions/_shared/rendus/index.ts';
import { demandeJustificatifs, ficheRendezVous } from '../../supabase/functions/_shared/prestations/index.ts';
import { checkPassword, emailKey, hashPassword, safeEqual, sha, signEvent, signLink, token, verifyEvent, verifyLink } from './security.ts';
import { update } from './kv.ts';
import { RecetteStore, jobEnCours, type DossierRec, type Subscription, type UserRec } from './store.ts';
import { sha256 } from './engine-deps.ts';
import { handleMcp, handleOAuth, listConnections } from './mcp.ts';
import { handleAutomations, onPieceRecue, tickAutomations } from './automations.ts';
import { addPreference, answer, forget, history, preferences, remember, removePreference, viewToContext, type AssistantDeps } from './assistant.ts';
import { alerteBudget, centreActions, coupeCircuit, noterPassage, passages, reglerCoupeCircuit } from './pilotage.ts';
import { DOMAINE_RECETTE, seedDemo } from './seed.ts';

export interface ApiEnv {
  store: RecetteStore;
  deps: () => Promise<EngineDeps>;
  /** Secret serveur des liens signés, des sessions OAuth et du webhook de paiement de recette. */
  secret: string;
  workerToken: string;
  cronSecret: string;
  siteUrl: string;
  adminPassword: string | null;
  waitUntil: (p: Promise<unknown>) => void;
  /** Relance une invocation de l'exécuteur (chaînage au-delà de la durée d'une fonction). */
  kickWorker: () => Promise<void>;
  aiLabel: string;
  /** ClairDossier Intelligence : modèle (ou null = règles), carte des modèles, registre des coûts. Absent : assistant non servi. */
  assistant?: AssistantDeps;
  /** Contrôle privé du fournisseur IA (authentification, modèles accessibles) : aucun jeton consommé. */
  aiHealth?: () => Promise<unknown>;
}

const MAX_UPLOAD = 4 * 1024 * 1024;
// Dépôt direct vers le stockage privé (sans transit par la fonction) : limite alignée sur l'espace client.
const MAX_DIRECT = 25 * 1024 * 1024;
const DIRECT_VALID_MS = 10 * 60 * 1000;
/** Fichiers par envoi : borne le travail d'une requête (l'interface envoie un fichier par requête). */
const MAX_FILES = 20;
const SESSION_DAYS = 30;
const MINUTE = 60_000;

/** Plafonds de la recette (comptes fictifs) ; modifiables par les tests. */
export const LIMITES = {
  /** Comptes créés (démonstration ou inscription) par adresse IP, par heure. */
  comptesParIp: 10,
  /** Comptes créés par heure, toutes adresses confondues. */
  comptesParHeure: 60,
  /** Tentatives de connexion par compte sur 15 min (remises à zéro par une connexion réussie). */
  connexionsParCompte: 8,
  /** Tentatives de connexion par adresse IP sur 15 min, tous comptes confondus. */
  connexionsParIp: 30,
  /** Volume total de pièces conservé par compte. */
  octetsParCompte: 50 * 1024 * 1024,
};
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', ...headers } });
const err = (status: number, message: string, extra: Record<string, unknown> = {}) => json({ error: message, ...extra }, status);

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function readCookie(req: Request, name: string) {
  return (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

interface SessionRec {
  user_id: string;
  created_at: string;
  expires_at: string;
}

export async function currentUser(env: ApiEnv, req: Request): Promise<UserRec | null> {
  const t = readCookie(req, 'cd_session');
  if (!t) return null;
  const s = await env.store.kv.getJson<SessionRec>(`sessions/${sha(t)}.json`);
  if (!s || s.value.expires_at < env.store.now().toISOString()) return null;
  return env.store.getUser(s.value.user_id);
}

async function openSession(env: ApiEnv, userId: string) {
  const t = token();
  const now = env.store.now();
  await env.store.kv.putJson(`sessions/${sha(t)}.json`, { user_id: userId, created_at: now.toISOString(), expires_at: new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString() });
  return cookie('cd_session', t, SESSION_DAYS * 86_400);
}

function entitlementView(s: Subscription, now: Date) {
  const active = RecetteStore.active(s, now);
  const plan = plans.find((p) => p.id === s.plan_id);
  return { active, status: s.status, plan_id: s.plan_id, plan_name: plan?.name ?? null, period_end: s.current_period_end, cancel_at_period_end: s.cancel_at_period_end, dossier_limit: plan ? (/illimit/i.test(plan.specs.dossiers) ? null : Number(plan.specs.dossiers.match(/\d+/)?.[0] ?? 0)) : 0 };
}

/** Statut affiché d'un dossier : réel, dérivé des travaux et de la dernière publication. */
async function dossierStatus(env: ApiEnv, d: DossierRec) {
  const jobs = await env.store.openJobs(d.id);
  const view = await env.store.getView(d.id);
  const pieces = (await env.store.listPieces(d.id)).filter((p) => !p.deleted_at);
  const failed = jobs.filter((j) => j.status === 'failed');
  // Lecture reportée au mois suivant (plafond) ou contrôle de fin de lot : rien n'est en cours pour le client.
  const running = jobs.filter((j) => jobEnCours(j, env.store.now()));
  let etat: 'vide' | 'en_cours' | 'pret' | 'en_verification' | 'cloture' | 'incident';
  if (d.closed) etat = 'cloture';
  else if (!pieces.length) etat = 'vide';
  else if (running.length) etat = 'en_cours';
  else if (failed.length && !view) etat = 'incident';
  else if (view?.status === 'pending') etat = 'en_verification';
  else if (view) etat = 'pret';
  else etat = 'en_cours';
  return { etat, travaux: running.length, pieces: pieces.length, revision: view?.revision ?? null };
}

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

const validEmail = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(e);
const uuid = () => crypto.randomUUID();

/** Adresse IP du client (posée par l'hébergeur), utilisée seulement sous forme d'empreinte. */
const clientIp = (req: Request) => sha((req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || 'inconnue');

/**
 * Compteur borné à fenêtre fixe, incrémenté par écriture conditionnelle (ETag) AVANT l'action
 * protégée : des requêtes parallèles ne peuvent pas lire la même valeur et passer toutes.
 * Conflit d'écriture persistant : refus (choix sûr).
 */
async function consume(store: RecetteStore, key: string, max: number, windowMs: number, amount = 1): Promise<boolean> {
  const now = store.now().getTime();
  let ok = false;
  try {
    await update<{ n: number; since: string }>(store.kv, key, (cur) => {
      const live = cur !== null && now - Date.parse(cur.since) < windowMs;
      const n = live && cur ? cur.n : 0;
      ok = n + amount <= max;
      return ok ? { n: n + amount, since: live && cur ? cur.since : new Date(now).toISOString() } : null;
    });
  } catch {
    return false;
  }
  return ok;
}

/** Création de compte (démonstration ou inscription) : plafond par adresse IP, puis plafond global, par heure. */
async function accountAllowed(store: RecetteStore, req: Request) {
  return (await consume(store, `limites/comptes/ip-${clientIp(req)}.json`, LIMITES.comptesParIp, 60 * MINUTE)) && (await consume(store, 'limites/comptes/global.json', LIMITES.comptesParHeure, 60 * MINUTE));
}
const TROP_DE_COMPTES = 'Trop de comptes créés récemment. Réessayez dans une heure.';

export async function handle(env: ApiEnv, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;
  const store = env.store;
  const now = store.now();

  // Protection CSRF : toute écriture de l'interface exige un en-tête que seul le site peut poser (contrôle d'origine du navigateur).
  if (m !== 'GET' && path.startsWith('/api/') && !path.startsWith('/api/worker') && !path.startsWith('/api/cron') && !path.startsWith('/api/abonnement/webhook') && req.headers.get('x-clairdossier') !== '1') return err(403, 'Requête refusée.');

  if (path.startsWith('/.well-known/') || path.startsWith('/oauth/')) return handleOAuth(env, req, url);
  if (path === '/mcp') return handleMcp(env, req);

  /* ── Exécuteur ─────────────────────────────────────────────────────── */
  if (path === '/api/worker' && m === 'POST') {
    if (!env.workerToken || !safeEqual(req.headers.get('x-worker-token') ?? '', env.workerToken)) return err(401, 'non autorisé');
    // Réponse immédiate ; le traitement continue en arrière-plan (et se relance si la file n'est pas vide).
    env.waitUntil(runNow(env));
    return json({ accepte: true }, 202);
  }
  if (path === '/api/cron') {
    // Planificateur : secret CRON_SECRET (en-tête), ou clé dérivée du jeton d'exécuteur généré côté serveur
    // (inscrite dans la configuration de déploiement au build, jamais dans le dépôt ni dans un journal).
    const parSecret = Boolean(env.cronSecret) && safeEqual(req.headers.get('authorization') ?? '', `Bearer ${env.cronSecret}`);
    const parCle = Boolean(env.workerToken) && safeEqual(url.searchParams.get('k') ?? '', sha(`${env.workerToken}:cron`));
    if (!parSecret && !parCle) return err(401, 'non autorisé');
    await reconcile(env);
    // Automatisations dues (navigateur fermé) : exécution bornée, idempotente, équitable entre comptes.
    const coupe = await coupeCircuit(store);
    const automatisations = coupe.automatisations ? null : await tickAutomations(store).catch(async (e) => {
      await store.alert('AUTOMATISATIONS_INTERROMPUES', { erreur: String(e instanceof Error ? e.message : e).slice(0, 200) });
      return null;
    });
    // Preuve de passage (navigateur fermé) : « planificateur » = appel de l'hébergeur, « manuel » = tout autre appel autorisé.
    await noterPassage(store, { executees: automatisations ? automatisations.executees : null, source: (req.headers.get('user-agent') ?? '').startsWith('vercel-cron') ? 'planificateur' : 'manuel' });
    env.waitUntil(runNow(env));
    return json({ ok: true, automatisations });
  }

  /* ── Démonstration : compte fictif isolé par visiteur ───────────────── */
  if (path === '/api/demo/demarrer' && m === 'POST') {
    if (!(await accountAllowed(store, req))) return err(429, TROP_DE_COMPTES);
    const b = await body<{ scenario?: string }>(req);
    const u = await seedDemo(env, b.scenario === 'sans-abonnement' ? 'sans-abonnement' : b.scenario === 'b' ? 'b' : 'a');
    return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': await openSession(env, u.id) });
  }

  /* ── Comptes ─────────────────────────────────────────────────────────── */
  if (path === '/api/auth/inscription' && m === 'POST') {
    const b = await body<{ email?: string; password?: string; first_name?: string; last_name?: string; company?: string }>(req);
    const email = (b.email ?? '').trim().toLowerCase();
    if (!validEmail(email)) return err(400, 'Adresse e-mail invalide.');
    if ((b.password ?? '').length < 10) return err(400, 'Mot de passe trop court (10 caractères minimum).');
    if (!b.first_name?.trim() || !b.last_name?.trim()) return err(400, 'Prénom et nom requis.');
    // Domaine des comptes créés par le serveur (démonstration, administration) : personne ne peut s'y inscrire.
    if (email.endsWith(`@${DOMAINE_RECETTE}`)) return err(400, 'Cette adresse est réservée à la recette : utilisez votre propre adresse e-mail.');
    if (!(await accountAllowed(store, req))) return err(429, TROP_DE_COMPTES);
    const id = uuid();
    if (!(await store.claimEmail(emailKey(email), id))) return err(409, 'Un compte existe déjà avec cet e-mail. Connectez-vous.');
    await store.putUser({ id, email, first_name: b.first_name.trim().slice(0, 60), last_name: b.last_name.trim().slice(0, 60), company: b.company?.trim().slice(0, 120) || null, role: 'client', pwd: await hashPassword(b.password!), notifications: true, created_at: now.toISOString() });
    return json({ ok: true }, 201, { 'set-cookie': await openSession(env, id) });
  }
  if (path === '/api/auth/connexion' && m === 'POST') {
    const b = await body<{ email?: string; password?: string }>(req);
    const key = emailKey(b.email ?? '');
    const lim = `limites/connexion/${key}.json`;
    // Tentative comptée AVANT la vérification du mot de passe (écriture conditionnelle) : des requêtes parallèles ne dépassent pas le plafond.
    if (!(await consume(store, `limites/connexion-ip/${clientIp(req)}.json`, LIMITES.connexionsParIp, 15 * MINUTE)) || !(await consume(store, lim, LIMITES.connexionsParCompte, 15 * MINUTE))) return err(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
    const id = await store.userIdByEmailHash(key);
    const u = id ? await store.getUser(id) : null;
    if (!u || !(await checkPassword(b.password ?? '', u.pwd))) return err(401, 'E-mail ou mot de passe incorrect.');
    await store.kv.delete(lim);
    return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': await openSession(env, u.id) });
  }
  if (path === '/api/auth/deconnexion' && m === 'POST') {
    const t = readCookie(req, 'cd_session');
    if (t) await store.kv.delete(`sessions/${sha(t)}.json`);
    return json({ ok: true }, 200, { 'set-cookie': cookie('cd_session', '', 0) });
  }
  if (path === '/api/auth/reinitialisation' && m === 'POST') {
    const b = await body<{ email?: string }>(req);
    const id = await store.userIdByEmailHash(emailKey(b.email ?? ''));
    if (id) {
      const t = token();
      await store.kv.putJson(`reinit/${sha(t)}.json`, { user_id: id, exp: now.getTime() + 30 * 60_000 });
      await store.notify(id, { subject: 'Réinitialisation de votre mot de passe', text: 'Ce lien est valable 30 minutes et ne sert qu’une fois.', link: `/connexion?reinitialisation=${t}` });
    }
    return json({ ok: true, message: 'Si un compte existe, un lien a été déposé dans la boîte de recette.' });
  }
  if (path === '/api/auth/reinitialisation/confirmer' && m === 'POST') {
    const b = await body<{ token?: string; password?: string }>(req);
    const r = await store.kv.getJson<{ user_id: string; exp: number }>(`reinit/${sha(b.token ?? '')}.json`);
    if (!r || r.value.exp < now.getTime()) return err(400, 'Lien expiré ou déjà utilisé.');
    if ((b.password ?? '').length < 10) return err(400, 'Mot de passe trop court (10 caractères minimum).');
    await store.kv.delete(`reinit/${sha(b.token!)}.json`);
    const u = await store.getUser(r.value.user_id);
    if (!u) return err(400, 'Compte introuvable.');
    await store.putUser({ ...u, pwd: await hashPassword(b.password!) });
    return json({ ok: true }, 200, { 'set-cookie': await openSession(env, u.id) });
  }

  const user = await currentUser(env, req);
  // Diagnostic de la passerelle IA (aperçu seulement) : réservé à l'administration, car chaque appel interroge le modèle hors budget.
  if (path === '/api/diag/ia' && m === 'GET' && process.env.VERCEL_ENV === 'preview' && user?.role === 'admin') {
    const { diagnosticIa } = await import('./runtime.ts');
    return json(await diagnosticIa());
  }
  if (path === '/api/moi' && m === 'GET') {
    if (!user) return json({ user: null });
    return json({ user: publicUser(user), abonnement: entitlementView(await store.getSub(user.id), now), ia: env.aiLabel });
  }
  if (path === '/api/offres' && m === 'GET') return json({ offres: plans.map((p) => ({ id: p.id, nom: p.name, public: p.audience, prix: p.priceMonthly, dossiers: p.specs.dossiers, utilisateurs: p.specs.users, service: p.specs.support, description: p.description, badge: p.badge?.label ?? null })) });

  /* ── Abonnement : paiement de recette (simulé) + webhook signé ───────── */
  if (path === '/api/abonnement/webhook' && m === 'POST') {
    const raw = await req.text();
    if (!verifyEvent(env.secret, raw, req.headers.get('x-signature'), Math.floor(now.getTime() / 1000))) return err(400, 'signature invalide');
    const ev = JSON.parse(raw) as { id: string; type: string; created: number; user_id: string; plan_id: string; period_end: string | null };
    await applyEvent(store, ev);
    return json({ received: true });
  }
  if (!user && path.startsWith('/api/')) return err(401, 'Connectez-vous pour continuer.', { redirect: `/connexion?next=${encodeURIComponent(url.searchParams.get('next') ?? '/compte')}` });
  if (!user) return err(404, 'introuvable');

  if (path === '/api/abonnement/paiement-recette' && m === 'POST') {
    const b = await body<{ plan_id?: string; carte?: string }>(req);
    const plan = plans.find((p) => p.id === b.plan_id && p.priceMonthly !== null);
    if (!plan) return err(400, 'Formule inconnue ou sur devis.');
    const sessionId = `cs_recette_${uuid().slice(0, 12)}`;
    if (b.carte === '4000000000000002') return json({ statut: 'refuse', message: 'Paiement refusé par la banque (carte de test « refusée »). Aucun droit accordé.' }, 402);
    if (b.carte === '4000002500003155') {
      await store.updateSub(user.id, (s) => ({ ...s, status: s.status === 'none' ? 'incomplete' : s.status, plan_id: plan.id }));
      return json({ statut: 'incomplet', message: 'Authentification bancaire non terminée (carte de test 3-D Secure). Aucun droit accordé.' }, 402);
    }
    // Le retour du paiement N'ACCORDE RIEN : seul l'événement signé (webhook) active l'abonnement.
    const ev = { id: `evt_${uuid().slice(0, 16)}`, type: 'checkout.session.completed', created: Math.floor(now.getTime() / 1000), user_id: user.id, plan_id: plan.id, period_end: new Date(now.getTime() + 30 * 86_400_000).toISOString() };
    const raw = JSON.stringify(ev);
    env.waitUntil(
      (async () => {
        await new Promise((r) => setTimeout(r, 800));
        await fetch(`${env.siteUrl}/api/abonnement/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': signEvent(env.secret, raw, Math.floor(Date.now() / 1000)) }, body: raw }).catch(() => applyEvent(store, ev));
      })(),
    );
    return json({ statut: 'en_attente_confirmation', session: sessionId, retour: `/compte?paiement=${sessionId}` });
  }

  /* ── Dossiers ───────────────────────────────────────────────────────── */
  const ent = entitlementView(await store.getSub(user.id), now);

  /* ── Automatisations du compte (création après confirmation, suspension, annulation, preuves d'exécution) ── */
  if (path.startsWith('/api/automatisations')) {
    const payload = m === 'POST' ? await body<Record<string, unknown>>(req) : null;
    // Rappel préparé par l'assistant : devient, après confirmation, une vraie échéance du dossier (preuve : la ligne créée).
    const act = payload?.action as { kind?: string; id?: string; detail?: string } | undefined;
    if (path === '/api/automatisations' && m === 'POST' && act?.kind === 'rappel') {
      if (!ent.active) return err(402, 'Un abonnement actif est nécessaire.', { redirect: '/tarifs' });
      const dos = typeof payload?.dossier === 'string' ? await store.getDossierRec(payload.dossier) : null;
      if (!dos || dos.deleted || dos.user_id !== user.id) return err(404, 'Dossier introuvable.');
      if (dos.closed) return err(409, 'Ce dossier est clôturé.');
      const date = /^rappel:(\d{4}-\d{2}-\d{2})$/.exec(String(act.id ?? ''))?.[1];
      if (!date || !isCalendarDate(date) || date < now.toISOString().slice(0, 10)) return err(400, 'Date de rappel invalide ou passée.');
      const title = String(act.detail ?? 'Rappel').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) || 'Rappel';
      let cree = false;
      await store.updateDeadlines(dos.id, (rows) => {
        if (rows.some((r) => !r.ai_key && r.due_date === date && r.title === title)) return rows; // rejeu : pas de doublon
        cree = true;
        return [...rows, { ai_key: null, title, due_date: date, due_time: null, priority: 'normale', done: false, user_edited: true, description: 'Rappel créé depuis l’assistant, après votre confirmation.' }];
      });
      if (cree) await store.addEvent(dos.id, user.id, 'rappel_cree', `Rappel ajouté pour le ${frJour(date)}`);
      return json({ message: `Enregistré : rappel du ${frJour(date)} ajouté aux échéances de ce dossier.`, deja_existant: !cree }, cree ? 201 : 200);
    }
    const r = await handleAutomations({ store, user, sub: await store.getSub(user.id), method: m, path, body: payload });
    if (r) {
      const b = r.body as { automatisation?: { titre?: string; quand?: string } };
      // Message lisible pour la confirmation dans l'assistant (preuve : la fiche enregistrée).
      return json(r.status < 300 && b?.automatisation ? { ...b, message: `Enregistré : ${b.automatisation.titre ?? 'automatisation'}${b.automatisation.quand ? ` — ${b.automatisation.quand}` : ''}. Vous pouvez la suspendre ou l’annuler à tout moment.` } : r.body, r.status);
    }
  }
  if (path === '/api/dossiers' && m === 'POST') {
    if (!ent.active) return err(402, 'Un abonnement actif est nécessaire pour créer un dossier.', { redirect: '/tarifs' });
    const b = await body<{ titre?: string; objectif?: string; typologie?: string }>(req);
    const titre = (b.titre ?? '').trim().slice(0, 120);
    if (!titre) return err(400, 'Donnez un nom à votre dossier.');
    const count = (await store.listUserDossiers(user.id)).length;
    if (ent.dossier_limit !== null && count >= ent.dossier_limit) return err(402, `Votre formule couvre ${ent.dossier_limit} dossiers.`, { redirect: '/tarifs' });
    const d: DossierRec = { id: uuid(), user_id: user.id, title: titre, typology: b.typologie ?? null, objective: (b.objectif ?? '').trim().slice(0, 500) || null, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: now.toISOString() };
    await store.createDossier(d);
    await store.addEvent(d.id, user.id, 'dossier_cree', 'Dossier créé');
    return json({ id: d.id }, 201);
  }

  if (path === '/api/dossiers' && m === 'GET') {
    const list = await store.listUserDossiers(user.id);
    return json({ dossiers: await Promise.all(list.map(async (d) => ({ id: d.id, titre: d.title, objectif: d.objective, cree_le: d.created_at, ...(await dossierStatus(env, d)), action: ((await store.getView(d.id))?.view as RenduView | undefined)?.tableau.action.label ?? null }))) });
  }

  const dm = /^\/api\/dossiers\/([0-9a-f-]{36})(\/.*)?$/.exec(path);
  if (dm) {
    const d = await store.getDossierRec(dm[1]);
    // Isolement : un dossier d'un autre titulaire est INTROUVABLE (même réponse qu'un identifiant inexistant).
    if (!d || d.deleted || (d.user_id !== user.id && user.role !== 'admin')) return err(404, 'Dossier introuvable.');
    const sub = dm[2] ?? '';
    if (sub === '' && m === 'GET') {
      const open = await store.openJobs(d.id);
      if (open.some((j) => (j.status === 'queued' && j.run_after <= now.toISOString()) || (j.status === 'running' && (j.lease_until ?? '') < now.toISOString()))) env.waitUntil(runNow(env));
      const v = await store.getView(d.id);
      const pieces = (await store.listPieces(d.id)).filter((p) => !p.deleted_at);
      const extractions = await Promise.all(pieces.map((p) => store.getExtraction(p.id)));
      const published = await store.getPublished(d.id);
      return json({
        dossier: { id: d.id, titre: d.title, objectif: d.objective, cree_le: d.created_at, cloture: d.closed },
        statut: await dossierStatus(env, d),
        abonnement: ent,
        vue: v && v.status === 'approved' ? v.view : null,
        en_verification: v?.status === 'pending',
        pieces: pieces.map((p, i) => ({ id: p.id, nom: p.file_name, taille: p.size_bytes, deposee_le: p.created_at, doublon_de: p.duplicate_of, lecture: extractions[i] ? { statut: extractions[i]!.status, motif: extractions[i]!.reason, report: Boolean(extractions[i]!.deferred), moteur: extractions[i]!.provider } : null })),
        rendus: DELIVERABLE_CATALOG.map((c) => ({ cle: c.key, libelle: c.key === 'dashboard' ? 'Tableau de bord' : c.key === 'resume' ? 'Résumé' : c.label, revision: published[c.key]?.revision ?? null, statut: published[c.key]?.status ?? null, fichiers: published[c.key]?.status === 'approved' ? published[c.key]!.files.map((f) => ({ nom: f.name, taille: f.size_bytes })) : [], versions: published[c.key]?.previous.length ?? 0 })),
        echeances: await store.listDeadlines(d.id),
        historique: (await store.listEvents(d.id)).slice(0, 60),
      });
    }
    if (sub === '/pieces' && m === 'POST') {
      // Droits vérifiés AVANT toute lecture du contenu, tout stockage et tout traitement.
      if (!ent.active) return err(402, 'Un abonnement actif est nécessaire pour déposer des pièces.', { redirect: '/tarifs' });
      if (d.closed) return err(409, 'Ce dossier est clôturé : rouvrez-le pour ajouter des pièces.');
      const len = Number(req.headers.get('content-length') ?? 0);
      if (len > MAX_UPLOAD + 64 * 1024) return err(413, 'Fichier trop volumineux pour la recette (4 Mo maximum par fichier).');
      const form = await req.formData();
      const lot = String(form.get('lot') ?? '') || uuid();
      if (!/^[0-9a-f-]{36}$/.test(lot)) return err(400, 'Lot invalide.');
      const files = form.getAll('fichiers').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f);
      if (!files.length) return err(400, 'Aucun fichier reçu.');
      if (files.length > MAX_FILES) return err(413, `Au plus ${MAX_FILES} fichiers par envoi : répartissez vos pièces en plusieurs dépôts.`);
      const big = files.find((f) => f.size > MAX_UPLOAD);
      if (big) return err(413, `« ${big.name} » dépasse 4 Mo.`);
      // Volume total par compte : réservé avant tout stockage (écriture conditionnelle).
      if (!(await consume(store, `limites/stockage/${d.user_id}.json`, LIMITES.octetsParCompte, Infinity, files.reduce((n, f) => n + f.size, 0)))) return err(413, `Espace de stockage plein : un compte de recette conserve au plus ${Math.round(LIMITES.octetsParCompte / 1048576)} Mo de pièces.`);
      // Lot envoyé fichier par fichier : nombre annoncé, pour notifier une seule fois, sur le lot complet.
      await store.declareLot(d.id, lot, Math.min(200, Math.max(files.length, Math.floor(Number(form.get('total')) || 0))));
      // Stockage des pièces en parallèle, puis mise en file (durable avant la réponse).
      const added = await Promise.all(
        files.map(async (f) => {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const id = uuid();
          const name = f.name.replace(/[\u0000-\u001f\\/]/g, '_').slice(0, 160) || 'piece';
          await store.addPiece({ id, dossier_id: d.id, user_id: d.user_id, lot_id: lot, file_name: name, mime: f.type || null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: store.now().toISOString(), deleted_at: null }, bytes);
          return { id, nom: name };
        }),
      );
      for (const a of added) await store.enqueue({ key: `x:${a.id}`, kind: 'extract', user_id: d.user_id, dossier_id: d.id, piece_id: a.id });
      env.waitUntil(store.addEvent(d.id, user.id, 'pieces_deposees', `${added.length} pièce${added.length > 1 ? 's' : ''} déposée${added.length > 1 ? 's' : ''}`));
      env.waitUntil(onPieceRecue(store, d.user_id));
      env.waitUntil(runNow(env));
      return json({ lot, pieces: added }, 201);
    }
    // ── ClairDossier Intelligence : conversation privée du titulaire sur SON dossier ──
    if (sub.startsWith('/assistant')) {
      // Titulaire uniquement (même un administrateur ne converse pas à sa place) ; assistant servi seulement si configuré.
      if (d.user_id !== user.id || !env.assistant) return err(404, 'Dossier introuvable.');
      if (sub === '/assistant' && m === 'GET') return json({ historique: await history(store.kv, user.id, d.id), actif: ent.active, mode: env.assistant.client ? 'modele' : 'regles' });
      if (sub === '/assistant/effacer' && m === 'POST') {
        await forget(store.kv, user.id, d.id);
        return json({ ok: true });
      }
      if (sub === '/assistant' && m === 'POST') {
        if (!ent.active) return err(402, 'Un abonnement actif est nécessaire pour utiliser l’assistant.', { redirect: '/tarifs' });
        const b = await body<{ message?: string }>(req);
        const message = typeof b.message === 'string' ? b.message.trim().slice(0, 2000) : '';
        if (!message) return err(400, 'Message vide.');
        if (!(await consume(store, `limites/ia-msg/${user.id}.json`, 40, 60 * MINUTE))) return err(429, 'Trop de demandes en peu de temps : réessayez dans quelques minutes.');
        // Une demande à la fois par compte (verrou court) : pas de dépenses simultanées.
        if (!(await consume(store, `limites/ia-verrou/${user.id}.json`, 1, 50_000))) return err(429, 'Une demande est déjà en cours : patientez un instant.');
        try {
          const v = await store.getView(d.id);
          const published = await store.getPublished(d.id);
          const available = DELIVERABLE_CATALOG.filter((c) => published[c.key]?.status === 'approved' && published[c.key]!.files.length).map((c) => c.key);
          const pieces = (await store.listPieces(d.id)).filter((p) => !p.deleted_at);
          const rights = { owner: true, assistant: true, automations: true };
          const ctx = v && v.status === 'approved'
            ? viewToContext(v.view as RenduView, { rights, available })
            : { title: d.title, today: now.toISOString().slice(0, 10), analysis: null, pieces: pieces.map((x) => ({ id: x.id, file_name: x.file_name })), attention: null, available, processing: null, rights };
          const past = await history(store.kv, user.id, d.id);
          // Coupe-circuit de l'exploitant : réponse par les règles, sans appel de modèle.
          const deps = env.assistant.client && (await coupeCircuit(store)).ia ? { ...env.assistant, client: null } : env.assistant;
          const r = await answer(deps, user.id, message, ctx, past, { preferences: (await preferences(store.kv, user.id)).map((x) => x.text) });
          if (r.mode === 'modele') env.waitUntil(env.assistant.finops.palier().then((p) => alerteBudget(store, p)).then(() => undefined, () => undefined));
          await remember(store.kv, user.id, d.id, [{ from: 'vous', text: message, at: now.toISOString() }, { from: 'ia', text: r.text.slice(0, 4000), at: store.now().toISOString() }]);
          return json({ reponse: r });
        } finally {
          await store.kv.delete(`limites/ia-verrou/${user.id}.json`);
        }
      }
      return err(404, 'introuvable');
    }
    // ── Dépôt direct (gros fichiers) : autorisation courte, puis confirmation idempotente ──
    if (sub === '/pieces/autoriser' && m === 'POST') {
      // Droits vérifiés AVANT toute autorisation : rien n'est stocké en cas de refus.
      if (!ent.active) return err(402, 'Un abonnement actif est nécessaire pour déposer des pièces.', { redirect: '/tarifs' });
      if (d.closed) return err(409, 'Ce dossier est clôturé : rouvrez-le pour ajouter des pièces.');
      const b = await body<{ nom?: string; taille?: number; type?: string; lot?: string; total?: number }>(req);
      const taille = Math.floor(Number(b.taille));
      if (!b.nom || !Number.isFinite(taille) || taille <= 0) return err(400, 'Nom et taille du fichier requis.');
      if (taille > MAX_DIRECT) return err(413, `« ${String(b.nom).slice(0, 80)} » dépasse ${MAX_DIRECT / 1024 / 1024} Mo.`);
      const lot = b.lot && /^[0-9a-f-]{36}$/.test(b.lot) ? b.lot : uuid();
      // Le stockage ne sait pas recevoir en direct (tests) : le client utilise le dépôt classique.
      if (!store.kv.directUpload) return json({ mode: 'serveur', lot });
      if (!(await consume(store, `limites/stockage/${d.user_id}.json`, LIMITES.octetsParCompte, Infinity, taille))) return err(413, `Espace de stockage plein : un compte de recette conserve au plus ${LIMITES.octetsParCompte / 1024 / 1024} Mo.`);
      const id = uuid();
      const nom = String(b.nom).replace(/[\u0000-\u001f\\/]/g, '_').slice(0, 160) || 'piece';
      // Chemin imposé par le serveur, dans l'espace du compte : le client ne choisit rien.
      const cle = `depots/${d.user_id}/${d.id}/${id}`;
      await store.kv.putJson(`depots-attente/${id}.json`, { id, cle, dossier_id: d.id, user_id: d.user_id, lot, nom, mime: typeof b.type === 'string' ? b.type.slice(0, 120) : null, taille, cree: store.now().toISOString() }, { create: true });
      await store.declareLot(d.id, lot, Math.min(200, Math.max(1, Math.floor(Number(b.total)) || 1)));
      const acces = await store.kv.directUpload(cle, { maxBytes: taille, validMs: DIRECT_VALID_MS });
      return json({ mode: 'direct', id, lot, ...acces }, 201);
    }
    if (sub === '/pieces/confirmer' && m === 'POST') {
      const b = await body<{ id?: string }>(req);
      if (!b.id || !/^[0-9a-f-]{36}$/.test(b.id)) return err(400, 'Dépôt invalide.');
      type Attente = { id: string; cle: string; dossier_id: string; user_id: string; lot: string; nom: string; mime: string | null; taille: number };
      const att = (await store.kv.getJson<Attente>(`depots-attente/${b.id}.json`))?.value;
      if (!att) {
        // Rejeu d'une confirmation déjà traitée : même réponse, aucun double enregistrement.
        const deja = await store.getPiece(b.id);
        return deja && deja.dossier_id === d.id ? json({ lot: deja.lot_id, pieces: [{ id: deja.id, nom: deja.file_name }] }) : err(404, 'Dépôt introuvable.');
      }
      // Même réponse qu'un dépôt inexistant pour le dossier d'un autre compte.
      if (att.dossier_id !== d.id || att.user_id !== d.user_id) return err(404, 'Dépôt introuvable.');
      if (d.closed) return err(409, 'Ce dossier est clôturé : rouvrez-le pour ajouter des pièces.');
      const bytes = await store.kv.getBytes(att.cle);
      if (!bytes) return err(409, 'Le fichier n’est pas encore arrivé : réessayez dans un instant.');
      if (bytes.byteLength > att.taille || bytes.byteLength > MAX_DIRECT) {
        await store.kv.delete(att.cle);
        await store.kv.delete(`depots-attente/${att.id}.json`);
        return err(413, 'Le fichier reçu dépasse la taille annoncée : il a été écarté.');
      }
      if (!(await store.getPiece(att.id)))
        await store.addPiece({ id: att.id, dossier_id: d.id, user_id: d.user_id, lot_id: att.lot, file_name: att.nom, mime: att.mime, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: store.now().toISOString(), deleted_at: null }, bytes);
      await store.enqueue({ key: `x:${att.id}`, kind: 'extract', user_id: d.user_id, dossier_id: d.id, piece_id: att.id });
      await store.kv.delete(att.cle);
      await store.kv.delete(`depots-attente/${att.id}.json`);
      env.waitUntil(store.addEvent(d.id, user.id, 'pieces_deposees', '1 pièce déposée'));
      env.waitUntil(onPieceRecue(store, d.user_id));
      env.waitUntil(runNow(env));
      return json({ lot: att.lot, pieces: [{ id: att.id, nom: att.nom }] }, 201);
    }
    const fin = /^\/lots\/([0-9a-f-]{36})\/fin$/.exec(sub);
    if (fin && m === 'POST') {
      // Envoi du lot arrêté avant le dernier fichier annoncé : le lot est clos sur les pièces reçues, puis notifié.
      if (await store.closeLot(d.id, fin[1])) {
        await store.enqueue({ key: `r:${d.id}`, kind: 'render', user_id: d.user_id, dossier_id: d.id, piece_id: null });
        env.waitUntil(runNow(env));
      }
      return json({ ok: true });
    }
    if (sub === '/lien' && m === 'POST') {
      const b = await body<{ categorie?: DeliverableKey; nom?: string; piece?: string }>(req);
      let path2: string | null = null, nom = '';
      if (b.piece) {
        const p = await store.getPiece(b.piece);
        if (p && p.dossier_id === d.id) (path2 = `files/${p.user_id}/${p.dossier_id}/${p.id}`), (nom = p.file_name);
      } else if (b.categorie && b.nom) {
        const c = (await store.getPublished(d.id))[b.categorie];
        const f = c?.status === 'approved' ? c.files.find((x) => x.name === b.nom) : undefined;
        if (f) (path2 = f.path), (nom = f.name);
      }
      if (!path2) return err(404, 'Fichier introuvable.');
      return json({ url: `/api/fichier/${signLink(env.secret, { path: path2, user: user.id, exp: now.getTime() + 5 * 60_000, name: nom })}` });
    }
    if (sub === '/archive' && m === 'GET') {
      const pub = await store.getPublished(d.id);
      const entries: Record<string, Uint8Array> = {};
      for (const c of Object.values(pub)) if (c?.status === 'approved') for (const f of c.files) entries[f.name] = (await store.kv.getBytes(f.path)) ?? new Uint8Array();
      if (!Object.keys(entries).length) return err(404, 'Aucun résultat disponible.');
      const zip = zipSync(entries, { level: 6 });
      return new Response(new Uint8Array(zip), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="resultats-${d.id.slice(0, 8)}.zip"`, 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
    }
    if (sub === '/dates' && m === 'POST') {
      const b = await body<{ cle?: string; date?: string; raison?: string }>(req);
      if (b.cle && /^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '') && !isCalendarDate(b.date!)) return err(400, `Date inexistante : ${b.date!.split('-').reverse().join('/')}.`);
      if (!b.cle || !isCalendarDate(b.date ?? '') || !(b.raison ?? '').trim()) return err(400, 'Date (AAAA-MM-JJ) et raison requises.');
      await store.addOverride(d.id, { event_key: b.cle, retained_date: b.date!, label: null, hidden: false, reason: b.raison!.trim().slice(0, 300), author: user.role === 'admin' ? 'Équipe ClairDossier' : 'Titulaire du dossier', created_at: now.toISOString() });
      await store.addEvent(d.id, user.id, 'date_corrigee', `Date corrigée : ${b.date!.split('-').reverse().join('/')}`);
      await store.enqueue({ key: `r:${d.id}`, kind: 'render', user_id: d.user_id, dossier_id: d.id, piece_id: null });
      env.waitUntil(runNow(env));
      return json({ ok: true });
    }
    if (sub === '/dates/formulaire' && m === 'POST') {
      const form = await req.formData();
      const f = form.get('fichier');
      if (!f || typeof f !== 'object' || !('arrayBuffer' in f)) return err(400, 'Formulaire PDF attendu.');
      let read;
      try {
        read = await readDatesForm(new Uint8Array(await (f as File).arrayBuffer()));
      } catch (e) {
        return err(400, e instanceof Error ? e.message : 'Formulaire illisible.');
      }
      const view = (await store.getView(d.id))?.view as RenduView | undefined;
      const labelOf = (key: string) => view?.dates.rows.find((x) => x.key === key)?.label ?? key;
      // Saisies illisibles ou dates inexistantes (« 31/02/2021 ») : signalées, jamais enregistrées.
      const ignorees = read.invalid.map(labelOf);
      const conflits: string[] = [];
      const introuvables: string[] = [];
      // Date retenue actuelle : dernière correction enregistrée (même si la vue n'est pas encore régénérée).
      const latest = new Map<string, string | null>();
      for (const o of [...(await store.listOverrides(d.id))].sort((x, y) => x.created_at.localeCompare(y.created_at))) latest.set(o.event_key, o.retained_date);
      let n = 0;
      for (const r of read.rows) {
        const cur = view?.dates.rows.find((x) => x.key === r.key);
        if (!cur) {
          // Ligne d'un formulaire plus ancien que le dossier : signalée si elle a été modifiée, jamais appliquée.
          // (Formulaire émis avant « dates_imprimees » : impossible de savoir si elle a été modifiée ; rien n'est signalé.)
          if (r.printed !== null && r.retained !== r.printed) introuvables.push(r.key.replace(/^(\d{4})-(\d{2})-(\d{2}):.*$/, 'ligne du $3/$2/$1'));
          continue;
        }
        const current = latest.get(r.key) ?? cur.retained;
        if (r.printed !== null && r.retained === r.printed) continue; // ligne laissée telle qu'imprimée
        if (current === r.retained) continue; // déjà la date retenue
        // Date changée (en ligne ou par l'équipe) depuis l'impression : la correction récente n'est pas écrasée.
        if (r.printed !== null && current !== r.printed) {
          conflits.push(cur.label);
          continue;
        }
        await store.addOverride(d.id, { event_key: r.key, retained_date: r.retained, label: null, hidden: false, reason: r.reason || 'Corrigée dans le formulaire PDF', author: 'Titulaire du dossier', created_at: now.toISOString() });
        n++;
      }
      if (n) {
        await store.addEvent(d.id, user.id, 'date_corrigee', `${n} date${n > 1 ? 's' : ''} corrigée${n > 1 ? 's' : ''} depuis le formulaire`);
        await store.enqueue({ key: `r:${d.id}`, kind: 'render', user_id: d.user_id, dossier_id: d.id, piece_id: null });
        env.waitUntil(runNow(env));
      }
      return json({ corrigees: n, conflits, ignorees, introuvables });
    }
    if (sub === '/cloture' && m === 'POST') {
      const b = await body<{ cloture?: boolean }>(req);
      await store.updateDossier(d.id, (x) => ({ ...x, closed: Boolean(b.cloture) }));
      await store.addEvent(d.id, user.id, b.cloture ? 'dossier_cloture' : 'dossier_rouvert', b.cloture ? 'Dossier clôturé' : 'Dossier rouvert');
      if (!b.cloture) {
        await store.enqueue({ key: `c:${d.id}`, kind: 'consolidate', user_id: d.user_id, dossier_id: d.id, piece_id: null });
        env.waitUntil(runNow(env));
      }
      return json({ ok: true });
    }
    if (sub.startsWith('/prestations/') && m === 'POST') {
      const view = (await store.getView(d.id))?.view as RenduView | undefined;
      const kind = sub.slice('/prestations/'.length);
      // Rédaction LinkedIn retirée des options (décision du 25/11/2026) ; la fonction reste dans prestations/ pour l'historique.
      if (!view) return err(409, 'Les résultats du dossier ne sont pas encore disponibles.');
      if (kind === 'justificatifs') return json({ brouillon: demandeJustificatifs(view, '') });
      if (kind === 'rendez-vous') return json({ fiche: ficheRendezVous(view) });
      return err(404, 'Prestation inconnue.');
    }
  }

  const fm = /^\/api\/fichier\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(path);
  if (fm && m === 'GET') {
    const p = verifyLink(env.secret, fm[1], now.getTime());
    if (!p || p.user !== user.id) return err(403, 'Lien expiré ou réservé au titulaire du dossier.');
    const bytes = await store.kv.getBytes(p.path);
    if (!bytes) return err(404, 'Fichier introuvable.');
    const ext = p.name.split('.').pop()?.toLowerCase() ?? '';
    const type = { pdf: 'application/pdf', ics: 'text/calendar', csv: 'text/csv', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }[ext] ?? 'application/octet-stream';
    const inline = url.searchParams.get('affichage') === '1' && ext === 'pdf';
    return new Response(new Uint8Array(bytes), { headers: { "content-type": type, 'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(p.name)}`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex' } });
  }

  /* ── Centre d'actions : trois priorités, ce qui a changé, ce qui a été fait ; preuve de passage du planificateur ── */
  if (path === '/api/actions' && m === 'GET') return json(await centreActions(store, user.id));
  if (path === '/api/planificateur' && m === 'GET') {
    const p = await passages(store);
    return json({ dernier_passage: p[0] ?? null, dernier_passage_planifie: p.find((x) => x.source === 'planificateur') ?? null, suspendu: (await coupeCircuit(store)).automatisations });
  }
  /* ── Mémoire professionnelle : préférences du titulaire, consultables et supprimables ── */
  if (path === '/api/memoire' && m === 'GET') return json({ preferences: await preferences(store.kv, user.id) });
  if (path === '/api/memoire' && m === 'POST') {
    const b = await body<{ texte?: string }>(req);
    const p = await addPreference(store.kv, user.id, typeof b.texte === 'string' ? b.texte : '', now);
    return p ? json({ preference: p }, 201) : err(400, 'Préférence vide, ou mémoire pleine (12 au plus) : supprimez-en une.');
  }
  const mp = /^\/api\/memoire\/([0-9a-f]{8})$/.exec(path);
  if (mp && m === 'DELETE') {
    await removePreference(store.kv, user.id, mp[1]);
    return json({ ok: true });
  }
  if (path === '/api/boite' && m === 'GET') return json({ messages: await store.mailbox(user.id) });
  if (path === '/api/connexions' && m === 'GET') return json({ connexions: await listConnections(store, user.id) });
  const cx = /^\/api\/connexions\/(cd_[A-Za-z0-9_-]+)$/.exec(path);
  if (cx && m === 'DELETE') {
    await store.kv.delete(`oauth/links/${user.id}/${cx[1]}.json`);
    return json({ ok: true });
  }

  /* ── Supervision des coûts IA et santé du fournisseur (administration : aucun contenu client) ── */
  if (path === '/api/admin/ia' && m === 'GET') {
    if (user.role !== 'admin') return err(404, 'introuvable');
    return json({ couts: env.assistant ? await env.assistant.finops.overview() : null, sante: env.aiHealth ? await env.aiHealth() : { configure: false }, modeles: env.assistant?.models ?? null });
  }
  if (path === '/api/admin/coupe-circuit') {
    if (user.role !== 'admin') return err(404, 'introuvable');
    if (m === 'GET') return json(await coupeCircuit(store));
    if (m === 'POST') return json(await reglerCoupeCircuit(store, await body<Record<string, unknown>>(req)));
  }
  /* ── Exceptions (administration de la recette : métadonnées uniquement) ── */
  if (path === '/api/admin/exceptions' && m === 'GET') {
    if (user.role !== 'admin') return err(404, 'introuvable');
    const [ouverts, echecs] = await Promise.all([store.allOpenJobs(), store.failedJobs()]);
    return json({ alertes: await store.alerts(), travaux_en_echec: echecs.map((j) => ({ id: j.id, kind: j.kind, dossier: j.dossier_id, tentatives: j.attempts, erreur: j.last_error })), file: ouverts.length });
  }
  return err(404, 'introuvable');
}

const frJour = (iso: string) => iso.split('-').reverse().join('/');

function publicUser(u: UserRec) {
  return { id: u.id, email: u.email, prenom: u.first_name, nom: u.last_name, societe: u.company, role: u.role, demo: Boolean(u.fixture) };
}

/** Événement d'abonnement : idempotent (identifiant déjà vu) et ordonné (événement plus ancien ignoré). */
export async function applyEvent(store: RecetteStore, ev: { id: string; type: string; created: number; user_id: string; plan_id: string; period_end: string | null }) {
  await store.updateSub(ev.user_id, (s) => {
    if (s.seen.includes(ev.id)) return null;
    const at = new Date(ev.created * 1000).toISOString();
    if (s.last_event_at && at < s.last_event_at) return { ...s, seen: [...s.seen, ev.id].slice(-200) };
    const status: Subscription['status'] =
      ev.type === 'checkout.session.completed' || ev.type === 'invoice.paid' ? 'active' : ev.type === 'invoice.payment_failed' ? 'past_due' : ev.type === 'customer.subscription.deleted' ? 'canceled' : s.status;
    return { ...s, status, plan_id: ev.plan_id ?? s.plan_id, current_period_end: ev.period_end ?? s.current_period_end, cancel_at_period_end: ev.type === 'customer.subscription.updated:cancel' ? true : s.cancel_at_period_end, seen: [...s.seen, ev.id].slice(-200), last_event_at: at, history: [...s.history, { at, event: ev.type, status }].slice(-50) };
  });
}

async function runNow(env: ApiEnv) {
  try {
    const deps = await env.deps();
    const reports = await drain(deps, 200_000, 120);
    // Journal technique (sans contenu de pièce) : type de travail, issue, motif d'erreur.
    for (const r of reports) {
      if (r.outcome !== 'requeued' && r.outcome !== 'failed') continue;
      const j = await env.store.kv.getJson<{ last_error: string | null; attempts: number }>(`jobs/${r.job}.json`);
      console.error(JSON.stringify({ evt: 'travail', kind: r.kind, outcome: r.outcome, tentatives: j?.value.attempts, erreur: j?.value.last_error?.slice(0, 300) }));
    }
    // Travaux encore prêts (lot volumineux) : nouvelle invocation ; travaux différés : repris par la consultation ou la tâche planifiée.
    // Relance unique, à l'échéance du prochain travail (≤ 30 s) : pas de rafale d'invocations à vide.
    const now = env.store.now().getTime();
    const next = (await env.store.allOpenJobs()).filter((j) => j.status === 'queued').map((j) => Date.parse(j.run_after)).sort((x, y) => x - y)[0];
    if (next !== undefined && next <= now + 30_000) {
      if (next > now) await new Promise((res) => setTimeout(res, next - now + 50));
      await env.kickWorker();
    }
  } catch (e) {
    console.error(JSON.stringify({ evt: 'executeur', erreur: String(e instanceof Error ? e.stack ?? e.message : e).slice(0, 600) }));
    await env.store.alert('EXECUTEUR_INTERROMPU', { at: env.store.now().toISOString() });
  }
}

/** Réconciliation planifiée : relit les pièces en attente si la lecture visuelle est disponible. */
export async function reconcile(env: ApiEnv) {
  const deps = await env.deps();
  const keys = await env.store.kv.list('extractions/');
  for (const k of keys) {
    const x = (await env.store.kv.getJson<{ piece_id: string; dossier_id: string; user_id: string; deferred?: boolean; status: string }>(k))?.value;
    if (x?.deferred && x.status === 'error' && deps.ai?.canReadImages) await env.store.enqueue({ key: `x:${x.piece_id}`, kind: 'extract', user_id: x.user_id, dossier_id: x.dossier_id, piece_id: x.piece_id });
  }
}
