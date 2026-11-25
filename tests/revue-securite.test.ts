// Revue PR #68, lot « sécurité » : tests de non-régression de la recette
// (OAuth/MCP, comptes de démonstration, administration, comparaisons de secrets).
// Pile en mémoire (MemoryKv), aucun réseau.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto, { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { MemoryKv } from '../recette/server/kv.ts';
import { RecetteStore } from '../recette/server/store.ts';
import { engineDeps } from '../recette/server/engine-deps.ts';
import * as api from '../recette/server/api.ts';
import { ensureAdmin } from '../recette/server/seed.ts';
import { emailKey, hashPassword, sha } from '../recette/server/security.ts';
import { fixture } from './helpers/recette.ts';

const SITE = 'http://127.0.0.1:9';

function env(o: Partial<api.ApiEnv> = {}) {
  const store = new RecetteStore(new MemoryKv());
  const pending: Promise<unknown>[] = [];
  const e: api.ApiEnv = { store, deps: async () => engineDeps(store, { ai: null, config: { consolidateDelayMs: 0 } }), secret: 'secret-de-test-0123456789', workerToken: 'jeton-executeur-de-test', cronSecret: 'secret-tache-de-test', siteUrl: SITE, adminPassword: null, waitUntil: (p) => void pending.push(p), kickWorker: async () => undefined, aiLabel: 'règles', ...o };
  const settle = async () => {
    while (pending.length) await pending.shift();
  };
  const raw = (p: string, init: RequestInit = {}) => api.handle(e, new Request(`https://recette.test${p}`, init));
  return { e, store, settle, raw };
}

function client(e: api.ApiEnv, ip?: string) {
  let cookie = '';
  const call = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { 'x-clairdossier': '1', cookie, ...(ip ? { 'x-forwarded-for': ip } : {}), ...extra };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) (payload = JSON.stringify(body)), (headers['content-type'] = 'application/json');
    const r = await api.handle(e, new Request(`https://recette.test${path}`, { method, headers, body: payload }));
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return r;
  };
  return { call, get cookie() { return cookie; } };
}

/** Plafonds de la recette, abaissés le temps d'un test (sans effet si l'API n'en expose pas). */
async function avecLimites<T>(patch: Record<string, number>, fn: () => Promise<T>): Promise<T> {
  const lim = ((api as Record<string, unknown>).LIMITES ?? {}) as Record<string, number>;
  const before = { ...lim };
  Object.assign(lim, patch);
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(patch)) delete lim[k];
    Object.assign(lim, before);
  }
}

/* ── OAuth : outils ─────────────────────────────────────────────────────── */

const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Corps envoyé par un navigateur : champs du formulaire dans l'ordre du document, puis le seul bouton cliqué. */
function soumission(page: string, clique: 'autoriser' | 'refuser') {
  const form = page.slice(page.indexOf('<form'), page.indexOf('</form>'));
  const body = new URLSearchParams();
  for (const m of form.matchAll(/<(input|button)\b([^>]*)>/g)) {
    const name = decode(/name="([^"]*)"/.exec(m[2])![1]);
    const value = decode(/value="([^"]*)"/.exec(m[2])![1]);
    if (m[1] === 'button' && value !== clique) continue;
    body.append(name, value);
  }
  return body;
}

const VERIFIER = 'v'.repeat(50);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

function oauth(raw: (p: string, init?: RequestInit) => Promise<Response>) {
  const enregistrer = async (redirect: string, nom = 'Claude Code') => (await (await raw('/oauth/register', { method: 'POST', body: JSON.stringify({ client_name: nom, redirect_uris: [redirect] }) })).json()) as { client_id: string };
  const page = (cookie: string, clientId: string, redirect: string, extra: Record<string, string> = {}) =>
    raw(`/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirect, code_challenge: CHALLENGE, code_challenge_method: 'S256', state: 'etat-1', ...extra })}`, { headers: { cookie } });
  const poster = (cookie: string, body: URLSearchParams) => raw('/oauth/authorize', { method: 'POST', body: body.toString(), headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' } });
  /** Consentement complet (« Autoriser » cliqué) puis échange du code. */
  const jetons = async (cookie: string, clientId: string, redirect: string) => {
    const p = await (await page(cookie, clientId, redirect)).text();
    const loc = new URL((await poster(cookie, soumission(p, 'autoriser'))).headers.get('location')!);
    const code = loc.searchParams.get('code');
    assert.ok(code, 'code émis après « Autoriser »');
    const r = await raw('/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: redirect, code_verifier: VERIFIER }).toString() });
    assert.equal(r.status, 200);
    return (await r.json()) as { access_token: string; refresh_token: string };
  };
  const mcp = (t: string) => raw('/mcp', { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'lister_dossiers', arguments: {} } }) });
  const rafraichir = (clientId: string, refresh: string) => raw('/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId }).toString() });
  return { enregistrer, page, poster, jetons, mcp, rafraichir };
}

/* ── C02 ────────────────────────────────────────────────────────────────── */

test('C02 consentement : « decision=autoriser » glissé dans l’adresse ne l’emporte pas sur « Refuser »', async () => {
  const { e, raw } = env();
  const victime = client(e);
  await victime.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const o = oauth(raw);
  const redirect = 'https://attaquant.example/cb';
  const { client_id } = await o.enregistrer(redirect, 'Claude');

  const page = await (await o.page(victime.cookie, client_id, redirect, { decision: 'autoriser' })).text();
  assert.doesNotMatch(page, /type="hidden" name="decision"/, 'aucun champ « decision » recopié depuis l’adresse');
  assert.equal((page.match(/name="csrf"/g) ?? []).length, 1, 'un seul jeton csrf dans le formulaire');

  // La victime clique « Refuser » : le navigateur envoie les champs dans l'ordre du document.
  const refus = await o.poster(victime.cookie, soumission(page, 'refuser'));
  assert.equal(refus.status, 302);
  const loc = new URL(refus.headers.get('location')!);
  assert.equal(loc.searchParams.get('code'), null, 'aucun code émis après un refus');
  assert.equal(loc.searchParams.get('error'), 'access_denied');
  assert.equal(loc.searchParams.get('state'), 'etat-1');

  // Corps forgé avec deux décisions : jamais de code.
  const forge = soumission(page, 'refuser');
  forge.delete('decision');
  forge.append('decision', 'autoriser');
  forge.append('decision', 'refuser');
  const r2 = await o.poster(victime.cookie, forge);
  assert.equal(new URL(r2.headers.get('location') ?? 'https://x.invalid/').searchParams.get('code'), null, 'deux décisions : aucun code');

  // Parcours normal inchangé : « Autoriser » donne un code échangeable, et l'accès fonctionne.
  const t = await o.jetons(victime.cookie, client_id, redirect);
  assert.equal((await o.mcp(t.access_token)).status, 200);
});

/* ── C14 ────────────────────────────────────────────────────────────────── */

test('C14 retrait durable : après une nouvelle autorisation du même client, les anciens jetons restent refusés', async () => {
  const { e, raw } = env();
  const a = client(e);
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const o = oauth(raw);
  const redirect = 'http://localhost:51000/callback';
  const { client_id } = await o.enregistrer('http://localhost:33418/callback');

  const ancien = await o.jetons(a.cookie, client_id, redirect);
  assert.equal((await o.mcp(ancien.access_token)).status, 200);
  const conns = (await (await a.call('GET', '/api/connexions')).json()).connexions;
  assert.equal(conns.length, 1);
  assert.equal((await a.call('DELETE', `/api/connexions/${client_id}`)).status, 200);
  assert.equal((await o.mcp(ancien.access_token)).status, 401, 'refusé juste après le retrait');

  // La cliente reconnecte plus tard le même connecteur (même client_id).
  const nouveau = await o.jetons(a.cookie, client_id, redirect);
  assert.equal((await o.mcp(nouveau.access_token)).status, 200, 'nouvel accès valide');
  assert.equal((await o.mcp(ancien.access_token)).status, 401, 'ancien jeton d’accès toujours refusé');
  assert.equal((await o.rafraichir(client_id, ancien.refresh_token)).status, 400, 'ancien jeton de rafraîchissement toujours refusé');
  // Rotation normale du nouveau jeton de rafraîchissement : inchangée.
  const r = await o.rafraichir(client_id, nouveau.refresh_token);
  assert.equal(r.status, 200);
  assert.equal((await o.mcp(((await r.json()) as { access_token: string }).access_token)).status, 200);
  assert.equal((await (await a.call('GET', '/api/connexions')).json()).connexions.length, 1);
});

/* ── B1 ────────────────────────────────────────────────────────────────── */

test('B1 resource (RFC 8707) : autorisation refusée pour un autre serveur, jeton d’un autre public refusé sur /mcp', async () => {
  const { e, store, raw } = env();
  const a = client(e);
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const o = oauth(raw);
  const redirect = 'http://localhost:51000/callback';
  const { client_id } = await o.enregistrer(redirect);

  const autre = await o.page(a.cookie, client_id, redirect, { resource: 'https://autre-serveur.example/mcp' });
  assert.equal(autre.status, 302, 'pas de page de consentement pour un autre serveur');
  const loc = new URL(autre.headers.get('location')!);
  assert.equal(loc.origin + loc.pathname, 'http://localhost:51000/callback');
  assert.equal(loc.searchParams.get('error'), 'invalid_target');
  assert.equal(loc.searchParams.get('code'), null);
  assert.equal(loc.searchParams.get('state'), 'etat-1');

  // La bonne ressource (avec ou sans barre finale) reste acceptée.
  for (const resource of [`${SITE}/mcp`, `${SITE}/mcp/`]) assert.equal((await o.page(a.cookie, client_id, redirect, { resource })).status, 200);

  // Jeton d'accès émis pour un autre public (par exemple avant ce correctif) : refusé par /mcp.
  const me = (await (await a.call('GET', '/api/moi')).json()).user;
  const t = 'jeton-de-test-autre-public';
  await store.kv.putJson(`oauth/grants/${sha(t)}.json`, { user_id: me.id, client_id, scope: 'dossiers:lecture', exp: Date.now() + 3_600_000, kind: 'access', resource: 'https://autre-serveur.example/mcp' });
  await store.kv.putJson(`oauth/links/${me.id}/${client_id}.json`, { client_id, since: new Date().toISOString() });
  assert.equal((await o.mcp(t)).status, 401);
  // Même jeton pour le bon public : accepté (le contrôle porte bien sur la ressource).
  const t2 = 'jeton-de-test-bon-public';
  await store.kv.putJson(`oauth/grants/${sha(t2)}.json`, { user_id: me.id, client_id, scope: 'dossiers:lecture', exp: Date.now() + 3_600_000, kind: 'access', resource: `${SITE}/mcp` });
  assert.equal((await o.mcp(t2)).status, 200);
});

/* ── B2 ────────────────────────────────────────────────────────────────── */

test('B2 jeton d’exécuteur et secret de tâche planifiée comparés à temps constant', async () => {
  const spy = mock.method(crypto, 'timingSafeEqual');
  syncBuiltinESMExports();
  try {
    const { raw, settle } = env();
    const compare = (secret: string) => spy.mock.calls.some((c) => (c.arguments as unknown[]).some((x) => Buffer.isBuffer(x) && x.toString() === secret));

    assert.equal((await raw('/api/worker', { method: 'POST', headers: { 'x-worker-token': 'jeton-executeur-de-test' } })).status, 202);
    assert.ok(compare('jeton-executeur-de-test'), 'jeton d’exécuteur comparé par timingSafeEqual');
    assert.equal((await raw('/api/worker', { method: 'POST', headers: { 'x-worker-token': 'jeton-executeur-de-tesX' } })).status, 401);
    assert.equal((await raw('/api/worker', { method: 'POST' })).status, 401);

    spy.mock.resetCalls();
    assert.equal((await raw('/api/cron', { headers: { authorization: 'Bearer secret-tache-de-test' } })).status, 200);
    assert.ok(compare('Bearer secret-tache-de-test'), 'secret de tâche comparé par timingSafeEqual');
    assert.equal((await raw('/api/cron', { headers: { authorization: 'Bearer secret-tache-de-tesX' } })).status, 401);
    await settle();

    // Secrets non configurés : refus explicite, même avec un en-tête vide.
    const vide = env({ workerToken: '', cronSecret: '' });
    assert.equal((await vide.raw('/api/worker', { method: 'POST', headers: { 'x-worker-token': '' } })).status, 401);
    assert.equal((await vide.raw('/api/cron', { headers: { authorization: 'Bearer ' } })).status, 401);
  } finally {
    spy.mock.restore();
    syncBuiltinESMExports();
  }
});

/* ── B0 ────────────────────────────────────────────────────────────────── */

test('B0 connexion : des tentatives parallèles ne dépassent pas le plafond par compte', async () => {
  const { e, store } = env();
  const c = client(e);
  assert.equal((await c.call('POST', '/api/auth/inscription', { email: 'cible@exemple.fr', password: 'bon-mot-de-passe', first_name: 'Cible', last_name: 'Test' })).status, 201);
  const connexion = (email: string, password: string, ip: string) => api.handle(e, new Request('https://recette.test/api/auth/connexion', { method: 'POST', headers: { 'x-clairdossier': '1', 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password }) }));

  let verifies = 0, refuses = 0;
  for (let tour = 0; tour < 4; tour++) {
    // Adresses IP toutes différentes : seul le plafond par compte s'applique ici.
    const rs = await Promise.all(Array.from({ length: 25 }, (_, i) => connexion('cible@exemple.fr', `faux-${tour}-${i}`, `198.51.100.${tour * 25 + i}`)));
    verifies += rs.filter((r) => r.status === 401).length;
    refuses += rs.filter((r) => r.status === 429).length;
    assert.ok(rs.every((r) => r.status === 401 || r.status === 429), 'ni erreur serveur ni connexion');
  }
  assert.ok(verifies <= 8, `au plus 8 mots de passe essayés en 15 min (essayés : ${verifies})`);
  assert.equal(verifies + refuses, 100);
  assert.equal((await connexion('cible@exemple.fr', 'bon-mot-de-passe', '198.51.100.200')).status, 429, 'compte verrouillé pendant la fenêtre');

  // Fonctionnement normal inchangé : quelques erreurs puis le bon mot de passe ; le compteur repart de zéro.
  await store.putUser({ id: 'u-normal', email: 'normal@exemple.fr', first_name: 'N', last_name: 'T', company: null, role: 'client', pwd: await hashPassword('mot-de-passe-normal'), notifications: true, created_at: new Date().toISOString() });
  await store.claimEmail(emailKey('normal@exemple.fr'), 'u-normal');
  for (let i = 0; i < 3; i++) assert.equal((await connexion('normal@exemple.fr', 'faux', '192.0.2.10')).status, 401);
  assert.equal((await connexion('normal@exemple.fr', 'mot-de-passe-normal', '192.0.2.10')).status, 200);
  for (let i = 0; i < 7; i++) assert.equal((await connexion('normal@exemple.fr', 'faux', '192.0.2.11')).status, 401);
});

test('B0 connexion : plafond de tentatives par adresse IP, tous comptes confondus', async () => {
  const { e } = env();
  const connexion = (email: string, ip: string) => api.handle(e, new Request('https://recette.test/api/auth/connexion', { method: 'POST', headers: { 'x-clairdossier': '1', 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password: 'faux-mot-de-passe' }) }));
  await avecLimites({ connexionsParIp: 5 }, async () => {
    const statuts = [];
    for (let i = 0; i < 7; i++) statuts.push((await connexion(`cible-${i}@exemple.fr`, '203.0.113.50')).status);
    assert.deepEqual(statuts, [401, 401, 401, 401, 401, 429, 429]);
    assert.equal((await connexion('cible-0@exemple.fr', '203.0.113.51')).status, 401, 'une autre adresse IP n’est pas bloquée');
  });
});

/* ── C16 ────────────────────────────────────────────────────────────────── */

test('C16 administration : adresse réservée impossible à préempter, compte préempté jamais promu', async () => {
  const { e, store } = env();
  const c = client(e);
  for (const email of ['admin@recette.clair-dossier.example', 'Admin@Recette.Clair-Dossier.Example', 'demo-12345678@recette.clair-dossier.example']) {
    const r = await c.call('POST', '/api/auth/inscription', { email, password: 'motdepasse-du-tiers', first_name: 'A', last_name: 'B' });
    assert.equal(r.status, 400, `inscription refusée pour ${email}`);
    assert.equal(await store.userIdByEmailHash(emailKey(email)), null);
  }

  // Compte préempté avant ce correctif : ensureAdmin n'y pose pas le mot de passe d'administration.
  const tiers = 'u-tiers';
  await store.claimEmail(emailKey('admin@recette.clair-dossier.example'), tiers);
  await store.putUser({ id: tiers, email: 'admin@recette.clair-dossier.example', first_name: 'A', last_name: 'B', company: null, role: 'client', pwd: await hashPassword('motdepasse-du-tiers'), notifications: true, created_at: new Date().toISOString() });
  e.adminPassword = 'mot-de-passe-admin-de-test-0123';
  await ensureAdmin(e);
  const proprietaire = client(e);
  const r = await proprietaire.call('POST', '/api/auth/connexion', { email: 'admin@recette.clair-dossier.example', password: 'mot-de-passe-admin-de-test-0123' });
  assert.equal(r.status, 401, 'le mot de passe d’administration n’ouvre pas le compte du tiers');
  const u = await store.getUser(tiers);
  assert.equal(u?.role, 'client', 'compte du tiers jamais promu');

  // Adresse libre : le compte d'administration est créé normalement.
  const neuf = env({ adminPassword: 'mot-de-passe-admin-de-test-0123' });
  await ensureAdmin(neuf.e);
  const adm = client(neuf.e);
  const ok = await adm.call('POST', '/api/auth/connexion', { email: 'admin@recette.clair-dossier.example', password: 'mot-de-passe-admin-de-test-0123' });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).user.role, 'admin');
  assert.equal((await adm.call('GET', '/api/admin/exceptions')).status, 200);
});

/* ── C15 ────────────────────────────────────────────────────────────────── */

test('C15 comptes de démonstration : création plafonnée par adresse IP (démonstration et inscription)', async () => {
  const { e } = env();
  for (let i = 0; i < 10; i++) assert.equal((await client(e, '203.0.113.9').call('POST', '/api/demo/demarrer', { scenario: 'a' })).status, 200);
  const trop = await client(e, '203.0.113.9').call('POST', '/api/demo/demarrer', { scenario: 'a' });
  assert.equal(trop.status, 429);
  assert.equal(trop.headers.get('set-cookie'), null, 'aucune session ouverte');
  assert.match((await trop.json()).error, /Réessayez/);
  const insc = await client(e, '203.0.113.9').call('POST', '/api/auth/inscription', { email: 'nouvelle@exemple.fr', password: 'motdepasse-assez-long', first_name: 'N', last_name: 'C' });
  assert.equal(insc.status, 429, 'l’inscription partage le plafond de création de comptes');
  assert.equal((await client(e, '203.0.113.10').call('POST', '/api/demo/demarrer', { scenario: 'a' })).status, 200, 'une autre adresse IP n’est pas bloquée');
});

test('C15 comptes de démonstration : plafond global horaire, toutes adresses confondues', async () => {
  const { e, store } = env();
  await avecLimites({ comptesParHeure: 3 }, async () => {
    for (let i = 0; i < 3; i++) assert.equal((await client(e, `203.0.113.${20 + i}`).call('POST', '/api/demo/demarrer', { scenario: 'b' })).status, 200);
    const avant = (await store.kv.list('users/')).length;
    assert.equal((await client(e, '203.0.113.30').call('POST', '/api/demo/demarrer', { scenario: 'b' })).status, 429);
    assert.equal((await store.kv.list('users/')).length, avant, 'aucun compte créé au-delà du plafond');
  });
});

test('C15 stockage : volume total de pièces plafonné par compte, refus avant tout stockage', async () => {
  const { e, store, settle } = env();
  const a = client(e);
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const dA = (await (await a.call('GET', '/api/dossiers')).json()).dossiers[0].id;
  const piece = fixture('Courriel-2026-10-20.eml');
  const envoi = (nom: string) => {
    const f = new FormData();
    f.append('fichiers', new File([piece], nom));
    return f;
  };
  await avecLimites({ octetsParCompte: piece.byteLength * 2 + 10 }, async () => {
    assert.equal((await a.call('POST', `/api/dossiers/${dA}/pieces`, envoi('a.eml'))).status, 201);
    assert.equal((await a.call('POST', `/api/dossiers/${dA}/pieces`, envoi('b.eml'))).status, 201);
    const avant = (await store.kv.list('files/')).length;
    const r = await a.call('POST', `/api/dossiers/${dA}/pieces`, envoi('c.eml'));
    assert.equal(r.status, 413);
    assert.match((await r.json()).error, /Mo/);
    assert.equal((await store.kv.list('files/')).length, avant, 'rien de stocké au-delà du plafond');
  });
  await settle();
});

test('C15 diagnostic IA : réservé à l’administration, jamais anonyme', async () => {
  const saved = { VERCEL_ENV: process.env.VERCEL_ENV, RECETTE_AI: process.env.RECETTE_AI };
  process.env.VERCEL_ENV = 'preview';
  delete process.env.RECETTE_AI; // aucun appel au modèle possible pendant le test
  try {
    const { e, raw } = env({ adminPassword: 'mot-de-passe-admin-de-test-0123' });
    assert.notEqual((await raw('/api/diag/ia')).status, 200, 'visiteur anonyme refusé');
    const visiteur = client(e);
    await visiteur.call('POST', '/api/demo/demarrer', { scenario: 'a' });
    assert.equal((await visiteur.call('GET', '/api/diag/ia')).status, 404, 'compte client : introuvable');
    await ensureAdmin(e);
    const adm = client(e);
    assert.equal((await adm.call('POST', '/api/auth/connexion', { email: 'admin@recette.clair-dossier.example', password: 'mot-de-passe-admin-de-test-0123' })).status, 200);
    const r = await adm.call('GET', '/api/diag/ia');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { disponible: false });
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
