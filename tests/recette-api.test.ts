// API de recette : droits côté serveur, isolement, liens signés, paiement simulé, formulaire de dates, MCP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { MemoryKv } from '../recette/server/kv.ts';
import { RecetteStore } from '../recette/server/store.ts';
import { engineDeps } from '../recette/server/engine-deps.ts';
import { handle, type ApiEnv } from '../recette/server/api.ts';
import { signEvent } from '../recette/server/security.ts';
import { fixture } from './helpers/recette.ts';
import { offsetAt, postsLinkedIn } from '../supabase/functions/_shared/prestations/index.ts';

function env() {
  const store = new RecetteStore(new MemoryKv());
  const pending: Promise<unknown>[] = [];
  const e: ApiEnv = { store, deps: async () => engineDeps(store, { ai: null, config: { consolidateDelayMs: 0 } }), secret: 'secret-de-test-0123456789', workerToken: 'w', cronSecret: 'c', siteUrl: 'http://127.0.0.1:9', adminPassword: null, waitUntil: (p) => void pending.push(p), kickWorker: async () => undefined, aiLabel: 'règles' };
  const settle = async () => {
    while (pending.length) await pending.shift();
  };
  return { e, store, settle };
}

function client(e: ApiEnv) {
  let cookie = '';
  const call = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { 'x-clairdossier': '1', cookie, ...extra };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) (payload = JSON.stringify(body)), (headers['content-type'] = 'application/json');
    const r = await handle(e, new Request(`https://recette.test${path}`, { method, headers, body: payload }));
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return r;
  };
  return { call, get cookie() { return cookie; }, set cookie(c: string) { cookie = c; } };
}

const upload = (files: string[], lot?: string) => {
  const f = new FormData();
  for (const n of files) f.append('fichiers', new File([fixture(n)], n));
  if (lot) f.append('lot', lot);
  return f;
};

test('sans abonnement : création et dépôt refusés côté serveur, rien n’est stocké', async () => {
  const { e, store } = env();
  const c = client(e);
  assert.equal((await c.call('POST', '/api/demo/demarrer', { scenario: 'sans-abonnement' })).status, 200);
  const r = await c.call('POST', '/api/dossiers', { titre: 'Essai' });
  assert.equal(r.status, 402);
  assert.equal((await r.json()).redirect, '/tarifs');
  // Dossier préexistant (abonnement expiré entre-temps) : dépôt refusé avant tout stockage.
  const me = (await (await c.call('GET', '/api/moi')).json()).user;
  await store.createDossier({ id: '00000000-0000-4000-8000-000000000001', user_id: me.id, title: 'Ancien', typology: null, objective: null, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: new Date().toISOString() });
  const up = await c.call('POST', '/api/dossiers/00000000-0000-4000-8000-000000000001/pieces', upload(['Courrier-bailleur-2026-10-12.pdf']));
  assert.equal(up.status, 402);
  assert.equal((await store.kv.list('files/')).length, 0);
  assert.equal((await store.kv.list('pieces/')).length, 0);
  assert.equal((await c.call('POST', '/api/dossiers', { titre: 'x' }, { 'x-clairdossier': '' })).status, 403, 'en-tête anti-CSRF exigé');
});

test('parcours abonné : dépôt → résultats sans geste admin ; isolement A/B ; liens signés', async () => {
  const { e, store, settle } = env();
  const a = client(e), b = client(e);
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  await b.call('POST', '/api/demo/demarrer', { scenario: 'b' });
  const dA = (await (await a.call('GET', '/api/dossiers')).json()).dossiers[0].id;
  const r = await a.call('POST', `/api/dossiers/${dA}/pieces`, upload(['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml']));
  assert.equal(r.status, 201);
  await settle();
  const d = await (await a.call('GET', `/api/dossiers/${dA}`)).json();
  assert.equal(d.statut.etat, 'pret');
  assert.equal(d.vue.tableau.action.label, 'Joindre le bail');
  assert.equal(d.rendus.filter((x: { fichiers: unknown[] }) => x.fichiers.length).length, 6);
  // B ne voit rien de A.
  assert.equal((await b.call('GET', `/api/dossiers/${dA}`)).status, 404);
  assert.equal((await b.call('POST', `/api/dossiers/${dA}/pieces`, upload(['Courrier-bailleur-2026-10-12.pdf']))).status, 404);
  assert.equal((await b.call('POST', `/api/dossiers/${dA}/lien`, { categorie: 'dashboard', nom: 'Dashboard-r1.pdf' })).status, 404);
  const link = (await (await a.call('POST', `/api/dossiers/${dA}/lien`, { categorie: 'dashboard', nom: 'Dashboard-r1.pdf' })).json()).url as string;
  const got = await a.call('GET', link);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'application/pdf');
  assert.equal((await b.call('GET', link)).status, 403, 'lien réservé au titulaire');
  const tampered = link.replace(/\.[^.]+$/, '.AAAA');
  assert.equal((await a.call('GET', tampered)).status, 403);
  await a.call('POST', '/api/auth/deconnexion');
  assert.equal((await a.call('GET', link)).status, 401, 'déconnecté : le lien ne sert plus');
  assert.equal((await store.mailbox(d.dossier ? (await store.listUserDossiers((await store.getDossierRec(dA))!.user_id))[0].user_id : '')).length, 1, 'une notification');
});

test('paiement de recette : refus, 3-D Secure incomplet, retour sans droit, webhook signé idempotent et ordonné', async () => {
  const { e, store, settle } = env();
  const c = client(e);
  await c.call('POST', '/api/demo/demarrer', { scenario: 'sans-abonnement' });
  const uid = (await (await c.call('GET', '/api/moi')).json()).user.id;
  assert.equal((await c.call('POST', '/api/abonnement/paiement-recette', { plan_id: 'essentiel', carte: '4000000000000002' })).status, 402);
  assert.equal((await c.call('POST', '/api/abonnement/paiement-recette', { plan_id: 'essentiel', carte: '4000002500003155' })).status, 402);
  assert.equal((await store.getSub(uid)).status, 'incomplete');
  assert.equal(await store.entitlementActive(uid), false);
  const ok = await c.call('POST', '/api/abonnement/paiement-recette', { plan_id: 'essentiel', carte: '4242424242424242' });
  assert.equal((await ok.json()).statut, 'en_attente_confirmation');
  assert.equal(await store.entitlementActive(uid), false, 'le seul retour du paiement n’accorde aucun droit');
  await settle();
  assert.equal(await store.entitlementActive(uid), true, 'droit accordé par l’événement signé');
  const now = Math.floor(Date.now() / 1000);
  const send = (ev: object, sig?: string) => {
    const raw = JSON.stringify(ev);
    return handle(e, new Request('https://recette.test/api/abonnement/webhook', { method: 'POST', body: raw, headers: { 'x-signature': sig ?? signEvent(e.secret, raw, now) } }));
  };
  assert.equal((await send({ id: 'evt_x', type: 'customer.subscription.deleted', created: now, user_id: uid, plan_id: 'essentiel', period_end: null }, 't=1,v1=00')).status, 400, 'signature invalide refusée');
  const old = { id: 'evt_old', type: 'invoice.payment_failed', created: now - 86_400 * 10, user_id: uid, plan_id: 'essentiel', period_end: null };
  await send(old);
  assert.equal((await store.getSub(uid)).status, 'active', 'événement plus ancien ignoré');
  const del = { id: 'evt_del', type: 'customer.subscription.deleted', created: now + 5, user_id: uid, plan_id: 'essentiel', period_end: new Date(Date.now() + 86_400_000).toISOString() };
  await send(del);
  await send(del);
  const s = await store.getSub(uid);
  assert.equal(s.status, 'canceled');
  assert.equal(s.history.filter((h) => h.event === 'customer.subscription.deleted').length, 1, 'doublon sans effet');
  assert.equal(await store.entitlementActive(uid), true, 'résilié à terme : droits jusqu’à la fin de période');
});

test('dates : formulaire PDF rempli, réouvert et réimporté → date corrigée et historisée', async () => {
  const { e, settle } = env();
  const c = client(e);
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const id = (await (await c.call('GET', '/api/dossiers')).json()).dossiers[0].id;
  await c.call('POST', `/api/dossiers/${id}/pieces`, upload(['Courrier-bailleur-2026-10-12.pdf', 'Bail-commercial-2021.pdf']));
  await settle();
  const d0 = await (await c.call('GET', `/api/dossiers/${id}`)).json();
  const name = d0.rendus.find((x: { cle: string }) => x.cle === 'dates').fichiers.find((f: { nom: string }) => f.nom.endsWith('.pdf')).nom;
  const url = (await (await c.call('POST', `/api/dossiers/${id}/lien`, { categorie: 'dates', nom: name })).json()).url;
  const pdf = await PDFDocument.load(new Uint8Array(await (await c.call('GET', url)).arrayBuffer()));
  const keys = JSON.parse(pdf.getForm().getTextField('cles').getText()!) as string[];
  const i = keys.findIndex((k) => k.startsWith('2021-03-03'));
  pdf.getForm().getTextField(`date_retenue_${i}`).setText('05/03/2021');
  pdf.getForm().getTextField(`raison_${i}`).setText('Date du bail signé');
  const saved = await pdf.save();
  const reopened = await PDFDocument.load(saved);
  assert.equal(reopened.getForm().getTextField(`date_retenue_${i}`).getText(), '05/03/2021', 'saisie conservée après réouverture');
  const f = new FormData();
  f.append('fichier', new File([new Uint8Array(saved)], 'dates.pdf'));
  assert.equal((await (await c.call('POST', `/api/dossiers/${id}/dates/formulaire`, f)).json()).corrigees, 1);
  await settle();
  const d1 = await (await c.call('GET', `/api/dossiers/${id}`)).json();
  const row = d1.vue.dates.rows.find((r: { key: string }) => r.key === keys[i]);
  assert.equal(row.retained, '2021-03-05');
  assert.equal(row.reason, 'Date du bail signé');
  assert.ok(d1.rendus.find((x: { cle: string }) => x.cle === 'dates').revision >= 1);
});

test('MCP : enregistrement, consentement, PKCE, lecture seule, révocation, isolement', async () => {
  const { e, settle } = env();
  const a = client(e), b = client(e);
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  await b.call('POST', '/api/demo/demarrer', { scenario: 'b' });
  const dA = (await (await a.call('GET', '/api/dossiers')).json()).dossiers[0].id;
  await a.call('POST', `/api/dossiers/${dA}/pieces`, upload(['Courrier-bailleur-2026-10-12.pdf']));
  await settle();
  const raw = (p: string, init: RequestInit = {}) => handle(e, new Request(`https://recette.test${p}`, init));
  assert.equal((await raw('/mcp', { method: 'POST', body: '{}' })).status, 401);
  assert.match((await raw('/mcp', { method: 'POST', body: '{}' })).headers.get('www-authenticate')!, /resource_metadata=/);
  const reg = await (await raw('/oauth/register', { method: 'POST', body: JSON.stringify({ client_name: 'Claude Code', redirect_uris: ['http://localhost:33418/callback'] }) })).json();
  const verifier = 'v'.repeat(50);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'http://localhost:51000/callback', code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', resource: 'http://127.0.0.1:9/mcp' });
  const page = await raw(`/oauth/authorize?${params}`, { headers: { cookie: a.cookie } });
  const csrf = /name="csrf" value="([a-f0-9]+)"/.exec(await page.text())![1];
  params.set('csrf', csrf);
  params.set('decision', 'autoriser');
  const redir = await raw('/oauth/authorize', { method: 'POST', body: params.toString(), headers: { cookie: a.cookie, 'content-type': 'application/x-www-form-urlencoded' } });
  const code = new URL(redir.headers.get('location')!).searchParams.get('code')!;
  const bad = await raw('/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: 'http://localhost:51000/callback', code_verifier: 'x'.repeat(50) }).toString() });
  assert.equal(bad.status, 400, 'vérificateur PKCE faux refusé (et code consommé)');
  // Nouveau code, bon vérificateur.
  const page2 = await raw(`/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'http://localhost:51000/callback', code_challenge: challenge, code_challenge_method: 'S256' })}`, { headers: { cookie: a.cookie } });
  const csrf2 = /name="csrf" value="([a-f0-9]+)"/.exec(await page2.text())![1];
  const r2 = await raw('/oauth/authorize', { method: 'POST', body: new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'http://localhost:51000/callback', code_challenge: challenge, code_challenge_method: 'S256', csrf: csrf2, decision: 'autoriser' }).toString(), headers: { cookie: a.cookie } });
  const code2 = new URL(r2.headers.get('location')!).searchParams.get('code')!;
  const tok = await (await raw('/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code: code2, client_id: reg.client_id, redirect_uri: 'http://localhost:51000/callback', code_verifier: verifier }).toString() })).json();
  const rpc = async (method: string, params2: object = {}) => (await raw('/mcp', { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params2 }) })).json();
  assert.ok((await rpc('initialize', { protocolVersion: '2025-06-18' })).result.serverInfo);
  const tools = (await rpc('tools/list')).result.tools;
  assert.ok(tools.every((t: { annotations: { readOnlyHint: boolean } }) => t.annotations.readOnlyHint));
  const st = (await rpc('tools/call', { name: 'etat_dossier', arguments: { dossier_id: dA } })).result.structuredContent;
  assert.equal(st.prochaine_action.label, 'Joindre le bail');
  assert.ok(!JSON.stringify(st).includes('%PDF'), 'aucun contenu de pièce');
  const dB = (await (await b.call('GET', '/api/dossiers')).json()).dossiers[0].id;
  assert.equal((await rpc('tools/call', { name: 'etat_dossier', arguments: { dossier_id: dB } })).result.structuredContent.erreur, 'Dossier introuvable.');
  // Retrait de l'accès depuis le compte : le jeton ne fonctionne plus.
  const conns = (await (await a.call('GET', '/api/connexions')).json()).connexions;
  assert.equal(conns.length, 1);
  await a.call('DELETE', `/api/connexions/${conns[0].client_id}`);
  assert.equal((await raw('/mcp', { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) })).status, 401);
});

test('LinkedIn : 3 publications à des dates futures exactes, jour et heure d’été vérifiés', () => {
  const posts = postsLinkedIn({ cible: 'Avocats', offre: 'ClairDossier', zone: 'Marseille', ton: 'sobre', objectif: 'demandes' }, '2027-03-24');
  assert.equal(posts.length, 3);
  assert.equal(new Set(posts.map((p) => p.date)).size, 3);
  for (const p of posts) {
    assert.ok(p.date > '2027-03-25', 'au moins J+2');
    const wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' }).format(new Date(p.utc));
    assert.equal(wd, p.jour, 'jour cohérent avec la date');
    assert.equal(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(p.utc)).replace(' h ', ':').replace('h', ':'), p.heure);
  }
  assert.equal(posts[0].decalage, '+02:00', 'heure d’été (après le 28 mars 2027)');
  assert.equal(offsetAt('2026-12-01', '08:30', 'Europe/Paris'), '+01:00');
  assert.ok(posts.every((p) => p.hashtags.length >= 2 && p.hashtags.length <= 4));
  assert.ok(posts.every((p) => /test/i.test(p.raison)), 'sans données d’audience : créneaux qualifiés de tests');
});
