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
import { demandeJustificatifs, ficheRendezVous, postsLinkedIn, type BriefLinkedIn } from '../../supabase/functions/_shared/prestations/index.ts';
import { checkPassword, emailKey, hashPassword, sha, signEvent, signLink, token, verifyEvent, verifyLink } from './security.ts';
import { RecetteStore, jobEnCours, type DossierRec, type Subscription, type UserRec } from './store.ts';
import { sha256 } from './engine-deps.ts';
import { handleMcp, handleOAuth, listConnections } from './mcp.ts';
import { seedDemo } from './seed.ts';

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
}

const MAX_UPLOAD = 4 * 1024 * 1024;
/** Fichiers par envoi : borne le travail d'une requête (l'interface envoie un fichier par requête). */
const MAX_FILES = 20;
const SESSION_DAYS = 30;
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
    if (req.headers.get('x-worker-token') !== env.workerToken || !env.workerToken) return err(401, 'non autorisé');
    // Réponse immédiate ; le traitement continue en arrière-plan (et se relance si la file n'est pas vide).
    env.waitUntil(runNow(env));
    return json({ accepte: true }, 202);
  }
  if (path === '/api/cron') {
    if (req.headers.get('authorization') !== `Bearer ${env.cronSecret}` || !env.cronSecret) return err(401, 'non autorisé');
    await reconcile(env);
    env.waitUntil(runNow(env));
    return json({ ok: true });
  }

  if (path === '/api/diag/ia' && m === 'GET' && process.env.VERCEL_ENV === 'preview') {
    const { diagnosticIa } = await import('./runtime.ts');
    return json(await diagnosticIa());
  }

  /* ── Démonstration : compte fictif isolé par visiteur ───────────────── */
  if (path === '/api/demo/demarrer' && m === 'POST') {
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
    const id = uuid();
    if (!(await store.claimEmail(emailKey(email), id))) return err(409, 'Un compte existe déjà avec cet e-mail. Connectez-vous.');
    await store.putUser({ id, email, first_name: b.first_name.trim().slice(0, 60), last_name: b.last_name.trim().slice(0, 60), company: b.company?.trim().slice(0, 120) || null, role: 'client', pwd: await hashPassword(b.password!), notifications: true, created_at: now.toISOString() });
    return json({ ok: true }, 201, { 'set-cookie': await openSession(env, id) });
  }
  if (path === '/api/auth/connexion' && m === 'POST') {
    const b = await body<{ email?: string; password?: string }>(req);
    const key = emailKey(b.email ?? '');
    const lim = await store.kv.getJson<{ n: number; since: string }>(`limites/connexion/${key}.json`);
    if (lim && lim.value.n >= 8 && Date.parse(lim.value.since) > now.getTime() - 15 * 60_000) return err(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
    const id = await store.userIdByEmailHash(key);
    const u = id ? await store.getUser(id) : null;
    if (!u || !(await checkPassword(b.password ?? '', u.pwd))) {
      await store.kv.putJson(`limites/connexion/${key}.json`, { n: (lim && Date.parse(lim.value.since) > now.getTime() - 15 * 60_000 ? lim.value.n : 0) + 1, since: lim && Date.parse(lim.value.since) > now.getTime() - 15 * 60_000 ? lim.value.since : now.toISOString() });
      return err(401, 'E-mail ou mot de passe incorrect.');
    }
    await store.kv.delete(`limites/connexion/${key}.json`);
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
  if (path === '/api/dossiers' && m === 'GET') {
    const list = await store.listUserDossiers(user.id);
    return json({ dossiers: await Promise.all(list.map(async (d) => ({ id: d.id, titre: d.title, objectif: d.objective, cree_le: d.created_at, ...(await dossierStatus(env, d)), action: ((await store.getView(d.id))?.view as RenduView | undefined)?.tableau.action.label ?? null }))) });
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
      env.waitUntil(runNow(env));
      return json({ lot, pieces: added }, 201);
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
      if (kind === 'linkedin') {
        const b = await body<Partial<BriefLinkedIn>>(req);
        if (!b.cible?.trim() || !b.offre?.trim() || !b.zone?.trim()) return err(400, 'Cible, offre et zone requises.');
        const posts = postsLinkedIn({ cible: b.cible.trim().slice(0, 80), offre: b.offre.trim().slice(0, 120), zone: b.zone.trim().slice(0, 60), ton: b.ton ?? 'sobre', objectif: b.objectif ?? 'demandes', audience: b.audience, fuseau: 'Europe/Paris' }, view?.dossier.as_of ?? now.toISOString().slice(0, 10));
        return json({ brouillons: posts, note: 'Brouillons : rien n’est publié automatiquement ; aucune portée n’est garantie.' });
      }
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

  if (path === '/api/boite' && m === 'GET') return json({ messages: await store.mailbox(user.id) });
  if (path === '/api/connexions' && m === 'GET') return json({ connexions: await listConnections(store, user.id) });
  const cx = /^\/api\/connexions\/(cd_[A-Za-z0-9_-]+)$/.exec(path);
  if (cx && m === 'DELETE') {
    await store.kv.delete(`oauth/links/${user.id}/${cx[1]}.json`);
    return json({ ok: true });
  }

  /* ── Exceptions (administration de la recette : métadonnées uniquement) ── */
  if (path === '/api/admin/exceptions' && m === 'GET') {
    if (user.role !== 'admin') return err(404, 'introuvable');
    const [ouverts, echecs] = await Promise.all([store.allOpenJobs(), store.failedJobs()]);
    return json({ alertes: await store.alerts(), travaux_en_echec: echecs.map((j) => ({ id: j.id, kind: j.kind, dossier: j.dossier_id, tentatives: j.attempts, erreur: j.last_error })), file: ouverts.length });
  }
  return err(404, 'introuvable');
}

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
