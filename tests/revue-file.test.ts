// Revue de la PR #68 — lot « file » : file de travaux de la recette (recette/server/store.ts).
//  C00 : un travail dont l'inscription dans queue.json a échoué ne doit pas rester invisible à vie ;
//  C19 : deux mises en file concurrentes d'une même clé ne créent qu'un seul travail ;
//  C03 : consulter un dossier ne parcourt plus les travaux des autres clients ; envoi borné en nombre de fichiers ;
//  B5  : un travail en échec reste visible (état « incident », écran d'exceptions) sans être repris par l'exécuteur.
// Stockage en mémoire instrumenté : aucun réseau, aucune persistance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKv, type Kv, type PutResult } from '../recette/server/kv.ts';
import { RecetteStore } from '../recette/server/store.ts';
import { engineDeps, sha256 } from '../recette/server/engine-deps.ts';
import { handle, type ApiEnv } from '../recette/server/api.ts';
import { sha, token } from '../recette/server/security.ts';
import { drain } from '../supabase/functions/_shared/engine/runner.ts';
import type { Job } from '../supabase/functions/_shared/engine/ports.ts';
import { fixture } from './helpers/recette.ts';

type Op = 'get' | 'put';

/** MemoryKv instrumenté : journal des lectures, pannes d'écriture, pauses et fichiers absents injectés. */
class SondeKv implements Kv {
  readonly durable = false;
  readonly inner = new MemoryKv();
  lectures: string[] = [];
  /** Appelé avant chaque lecture ou écriture JSON (pause, avance d'horloge). */
  avant: ((op: Op, key: string) => void | Promise<void>) | null = null;
  /** Appelé après chaque lecture ou écriture JSON réussie. */
  apres: ((op: Op, key: string) => void) | null = null;
  /** Vrai : l'écriture lève (panne ponctuelle du stockage). */
  panne: ((key: string) => boolean) | null = null;
  /** Vrai : le contenu binaire est introuvable. */
  octetsAbsents: ((key: string) => boolean) | null = null;
  async getJson<T>(key: string) {
    await this.avant?.('get', key);
    this.lectures.push(key);
    const r = await this.inner.getJson<T>(key);
    this.apres?.('get', key);
    return r;
  }
  async putJson(key: string, value: unknown, opts?: { ifMatch?: string; create?: boolean }): Promise<PutResult> {
    await this.avant?.('put', key);
    if (this.panne?.(key)) throw new Error('panne simulée du stockage');
    const r = await this.inner.putJson(key, value, opts);
    if (r.ok) this.apres?.('put', key);
    return r;
  }
  async getBytes(key: string) {
    return this.octetsAbsents?.(key) ? null : this.inner.getBytes(key);
  }
  putBytes(key: string, bytes: Uint8Array, contentType: string) {
    return this.inner.putBytes(key, bytes, contentType);
  }
  delete(key: string) {
    return this.inner.delete(key);
  }
  list(prefix: string) {
    return this.inner.list(prefix);
  }
}

function pile() {
  let t = Date.parse('2026-11-18T09:00:00Z');
  const clock = { now: () => new Date(t), advance: (ms: number) => (t += ms) };
  const kv = new SondeKv();
  const store = new RecetteStore(kv, clock.now);
  const deps = engineDeps(store, { ai: null, config: { consolidateDelayMs: 0 } });
  async function user(id: string) {
    await store.putUser({ id, email: `${id}@exemple.test`, first_name: id, last_name: 'Test', company: null, role: 'client', pwd: { salt: '', hash: '' }, notifications: true, created_at: clock.now().toISOString() });
    await store.updateSub(id, (s) => ({ ...s, status: 'active', plan_id: 'essentiel', current_period_end: '2026-12-18T00:00:00Z' }));
  }
  async function dossier(id: string, userId: string) {
    await store.createDossier({ id, user_id: userId, title: 'Régularisation de charges 2025', typology: 'facture-paiement', objective: null, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: clock.now().toISOString() });
  }
  let n = 0;
  async function depose(dossierId: string, userId: string, lot: string, files: string[]) {
    const ids: string[] = [];
    for (const f of files) {
      const bytes = fixture(f);
      const id = `p${++n}`;
      clock.advance(10);
      await store.addPiece({ id, dossier_id: dossierId, user_id: userId, lot_id: lot, file_name: f, mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: clock.now().toISOString(), deleted_at: null }, bytes);
      await store.enqueue({ key: `x:${id}`, kind: 'extract', user_id: userId, dossier_id: dossierId, piece_id: id });
      ids.push(id);
    }
    return ids;
  }
  /** Tours d'exécuteur à horloge avancée (reprises, délais de nouvel essai). */
  async function run(rounds = 30) {
    for (let i = 0; i < rounds; i++) {
      await drain(deps, 60_000, 50);
      clock.advance(5 * 60_000);
    }
  }
  return { kv, store, deps, clock, user, dossier, depose, run };
}

const enc = (k: string) => encodeURIComponent(k).replace(/%/g, '~');
const consolidation = (dossier: string) => ({ key: `c:${dossier}`, kind: 'consolidate' as const, user_id: 'A', dossier_id: dossier, piece_id: null });
const ouverts = (jobs: Job[], key: string) => jobs.filter((j) => j.key === key && (j.status === 'queued' || j.status === 'running'));

/* ── C00 ─────────────────────────────────────────────────────────────── */

test('C00 : inscription dans queue.json en panne → le travail est réinscrit à la mise en file suivante', async () => {
  const kv = new SondeKv();
  const store = new RecetteStore(kv, () => new Date('2026-11-18T09:00:00Z'));
  let pannes = 1;
  kv.panne = (k) => k === 'queue.json' && pannes-- > 0;
  await assert.rejects(store.enqueue(consolidation('D1')), /panne simulée/);
  await store.enqueue(consolidation('D1'));
  await store.enqueue(consolidation('D1'));
  const pris = await store.claim('w1', 60_000);
  assert.equal(pris?.key, 'c:D1', 'le travail créé avant la panne est de nouveau visible de l’exécuteur');
  assert.equal(ouverts(await store.allOpenJobs(), 'c:D1').length, 1, 'toujours un seul travail pour la clé');
});

test('C00 : panne ponctuelle en mettant la consolidation en file → le dossier est quand même livré', async () => {
  const s = pile();
  await s.user('A');
  await s.dossier('D1', 'A');
  // Une seule panne, à l'inscription dans queue.json du PREMIER travail c:D1 (après création du travail et de sa clé).
  let arme = true, pannes = 0;
  s.kv.apres = (op, k) => {
    if (arme && op === 'put' && k === `jobkeys/${enc('c:D1')}.json`) (arme = false), (pannes = 1);
  };
  s.kv.panne = (k) => k === 'queue.json' && pannes-- > 0;
  await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  await s.run();
  assert.equal(arme, false, 'la panne a bien été injectée');
  assert.ok(await s.store.getView('D1'), 'consolidation exécutée malgré la panne : vue publiée');
  assert.deepEqual(Object.keys(await s.store.getPublished('D1')).sort(), ['chronologie', 'dashboard', 'dates', 'echeances', 'relances', 'resume']);
  assert.equal((await s.store.mailbox('A')).length, 1, 'une notification pour le lot');
  assert.equal((await s.store.allOpenJobs()).length, 0, 'file vide à la fin');
});

/* ── C19 ─────────────────────────────────────────────────────────────── */

/** Met en pause le premier accès qui suit `quand` ; renvoie la promesse « en pause » et la fonction de reprise. */
function pauseApres(kv: SondeKv, quand: (op: Op, key: string) => boolean) {
  let arme = false, fait = false;
  let reprendre!: () => void;
  const barriere = new Promise<void>((r) => (reprendre = r));
  let signaler!: () => void;
  const enPause = new Promise<void>((r) => (signaler = r));
  kv.apres = (op, k) => {
    if (!fait && quand(op, k)) (fait = true), (arme = true);
  };
  kv.avant = async () => {
    if (!arme) return;
    arme = false;
    signaler();
    await barriere;
  };
  return { enPause, reprendre };
}

test('C19 : clé libérée (travail terminé) mise en file deux fois en concurrence → un seul travail ouvert', async () => {
  const kv = new SondeKv();
  const store = new RecetteStore(kv, () => new Date('2026-11-18T09:00:00Z'));
  await store.enqueue(consolidation('D1'));
  const j = await store.claim('w0', 60_000);
  await store.complete(j!, { status: 'done', error: null });
  // A constate « travail terminé » puis s'arrête avant d'écrire ; B passe entièrement ; A reprend.
  const p = pauseApres(kv, (op, k) => op === 'get' && k === `jobs/${j!.id}.json`);
  const a = store.enqueue(consolidation('D1'));
  await p.enPause;
  const b = await store.enqueue(consolidation('D1'));
  p.reprendre();
  const ra = await a;
  assert.equal(ouverts(await store.allOpenJobs(), 'c:D1').length, 1, 'pas de seconde consolidation pour la même clé');
  assert.deepEqual([ra, b].sort(), ['created', 'rearmed']);
});

test('C19 : première mise en file concurrente (clé posée, travail pas encore écrit) → un seul travail ouvert', async () => {
  const kv = new SondeKv();
  const store = new RecetteStore(kv, () => new Date('2026-11-18T09:00:00Z'));
  // A s'arrête juste après avoir posé la clé ; B lit la clé pendant ce temps.
  const p = pauseApres(kv, (op, k) => op === 'put' && k === `jobkeys/${enc('c:D1')}.json`);
  const a = store.enqueue(consolidation('D1'));
  await p.enPause;
  const b = await store.enqueue(consolidation('D1'));
  p.reprendre();
  const ra = await a;
  assert.equal(ouverts(await store.allOpenJobs(), 'c:D1').length, 1, 'pas de seconde consolidation pour la même clé');
  assert.deepEqual([ra, b].sort(), ['created', 'rearmed']);
});

/* ── C03 ─────────────────────────────────────────────────────────────── */

test('C03 : consulter un dossier ne lit pas les travaux ouverts des autres clients', async () => {
  const kv = new SondeKv();
  const store = new RecetteStore(kv, () => new Date('2026-11-18T09:00:00Z'));
  for (let i = 0; i < 60; i++) await store.enqueue({ key: `x:a${i}`, kind: 'extract', user_id: 'A', dossier_id: 'DA', piece_id: `a${i}` });
  await store.enqueue({ key: 'x:b1', kind: 'extract', user_id: 'B', dossier_id: 'DB', piece_id: 'b1' });
  kv.lectures = [];
  const jobs = await store.openJobs('DB');
  assert.deepEqual(jobs.map((j) => j.key), ['x:b1']);
  assert.ok(kv.lectures.length <= 3, `lectures pour le dossier de B : ${kv.lectures.length} (aucune lecture des 60 travaux de A attendue)`);
  assert.equal((await store.openJobs('DA')).length, 60, 'le dossier de A voit toujours ses travaux');
  assert.equal((await store.allOpenJobs()).length, 61);
});

test('C03 : file au format antérieur (sans index par dossier) toujours lue correctement', async () => {
  const kv = new SondeKv();
  const store = new RecetteStore(kv, () => new Date('2026-11-18T09:00:00Z'));
  const ancien: Job = { id: 'j-ancien', key: 'x:b1', kind: 'extract', user_id: 'B', dossier_id: 'DB', piece_id: 'b1', status: 'queued', attempts: 0, max_attempts: 4, run_after: '2026-11-18T08:00:00.000Z', lease_until: null, locked_by: null, rerun: false, last_error: null, created_at: '2026-11-18T08:00:00.000Z', updated_at: '2026-11-18T08:00:00.000Z' };
  await kv.putJson('jobs/j-ancien.json', ancien);
  await kv.putJson(`jobkeys/${enc('x:b1')}.json`, { job_id: 'j-ancien' });
  await kv.putJson('queue.json', { open: ['j-ancien'] });
  assert.deepEqual((await store.openJobs('DB')).map((j) => j.id), ['j-ancien']);
  assert.deepEqual(await store.openJobs('DA'), []);
  await store.enqueue({ key: 'x:a1', kind: 'extract', user_id: 'A', dossier_id: 'DA', piece_id: 'a1' });
  assert.deepEqual((await store.openJobs('DB')).map((j) => j.id), ['j-ancien'], 'toujours visible après une nouvelle mise en file');
  const pris = await store.claim('w1', 60_000);
  assert.equal(pris?.id, 'j-ancien', 'le plus ancien est pris en premier');
  await store.complete(pris!, { status: 'done', error: null });
  assert.deepEqual(await store.openJobs('DB'), []);
});

test('C03 : le bail d’un travail pris après un long parcours de la file court à partir de la prise', async () => {
  const kv = new SondeKv();
  let t = Date.parse('2026-11-18T09:00:00Z');
  const store = new RecetteStore(kv, () => new Date(t));
  for (let i = 0; i < 40; i++) await store.enqueue({ key: `x:a${i}`, kind: 'extract', user_id: 'A', dossier_id: 'DA', piece_id: `a${i}` });
  t += 1_000;
  kv.avant = (op, k) => {
    if (op === 'get' && k.startsWith('jobs/')) t += 1_000; // stockage lent : 1 s par lecture de travail
  };
  const j = await store.claim('w1', 60_000);
  kv.avant = null;
  assert.ok(j);
  assert.ok(Date.parse(j.lease_until!) - t >= 60_000, `bail restant : ${Date.parse(j.lease_until!) - t} ms`);
});

function apiEnv(store = new RecetteStore(new MemoryKv())) {
  const pending: Promise<unknown>[] = [];
  const e: ApiEnv = { store, deps: async () => engineDeps(store, { ai: null, config: { consolidateDelayMs: 0 } }), secret: 'secret-de-test-0123456789', workerToken: 'w', cronSecret: 'c', siteUrl: 'http://127.0.0.1:9', adminPassword: null, waitUntil: (p) => void pending.push(p), kickWorker: async () => undefined, aiLabel: 'règles' };
  const settle = async () => {
    while (pending.length) await pending.shift();
  };
  return { e, store, settle };
}

function client(e: ApiEnv, cookie = '') {
  const call = async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { 'x-clairdossier': '1', cookie };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) (payload = JSON.stringify(body)), (headers['content-type'] = 'application/json');
    const r = await handle(e, new Request(`https://recette.test${path}`, { method, headers, body: payload }));
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return r;
  };
  return { call };
}

test('C03 : un envoi de plus de 20 fichiers est refusé avant tout stockage ; 20 fichiers passent', async () => {
  const { e, store, settle } = apiEnv();
  const c = client(e);
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const dA = (await (await c.call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
  const trop = new FormData();
  for (let i = 0; i < 21; i++) trop.append('fichiers', new File([`note ${i}`], `note-${i}.txt`));
  const r = await c.call('POST', `/api/dossiers/${dA}/pieces`, trop);
  assert.equal(r.status, 413);
  assert.match((await r.json()).error, /20 fichiers/);
  assert.equal((await store.kv.list('pieces/')).length, 0, 'aucune pièce stockée');
  assert.equal((await store.allOpenJobs()).length, 0, 'aucun travail mis en file');
  const ok = new FormData();
  for (let i = 0; i < 20; i++) ok.append('fichiers', new File([`note ${i}`], `note-${i}.txt`));
  assert.equal((await c.call('POST', `/api/dossiers/${dA}/pieces`, ok)).status, 201);
  await settle();
  assert.equal((await store.kv.list(`pieces/${dA}/`)).length, 20);
});

/* ── B5 ──────────────────────────────────────────────────────────────── */

test('B5 : travail en échec visible (état « incident », écran d’exceptions) et jamais repris par l’exécuteur', async () => {
  // Horloge pilotée et fichier de la pièce introuvable : l'extraction lève à chaque tentative.
  let t = Date.parse('2026-11-18T09:00:00Z');
  const kv = new SondeKv();
  kv.octetsAbsents = (k) => k.startsWith('files/');
  const { e, store: s, settle } = apiEnv(new RecetteStore(kv, () => new Date(t)));
  const deps = engineDeps(s, { ai: null, config: { consolidateDelayMs: 0 } });
  const c = client(e);
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const me = (await (await c.call('GET', '/api/moi')).json()).user.id as string;
  const dA = (await (await c.call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
  const bytes = fixture('Courrier-bailleur-2026-10-12.pdf');
  await s.addPiece({ id: 'p1', dossier_id: dA, user_id: me, lot_id: 'L1', file_name: 'Courrier-bailleur-2026-10-12.pdf', mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: new Date(t).toISOString(), deleted_at: null }, bytes);
  await s.enqueue({ key: 'x:p1', kind: 'extract', user_id: me, dossier_id: dA, piece_id: 'p1' });
  for (let i = 0; i < 8; i++) {
    await drain(deps, 60_000, 50);
    t += 10 * 60_000;
  }
  assert.ok((await s.alerts()).some((a) => a.code === 'TRAVAIL_ECHEC'), 'le travail a bien échoué après ses tentatives');
  const failed = (await s.openJobs(dA)).filter((j) => j.status === 'failed');
  assert.equal(failed.length, 1, 'le travail en échec reste rattaché au dossier');
  assert.equal(await s.claim('w9', 60_000), null, 'un travail en échec n’est jamais repris');
  const d = await (await c.call('GET', `/api/dossiers/${dA}`)).json();
  assert.equal(d.statut.etat, 'incident');
  assert.equal(d.statut.travaux, 0);
  // Écran d'exceptions (administration de la recette).
  const tk = token();
  await s.putUser({ id: 'adm', email: 'admin@recette.test', first_name: 'Admin', last_name: 'Recette', company: null, role: 'admin', pwd: { salt: '', hash: '' }, notifications: false, created_at: new Date(t).toISOString() });
  await s.kv.putJson(`sessions/${sha(tk)}.json`, { user_id: 'adm', created_at: new Date(t).toISOString(), expires_at: new Date(t + 86_400_000).toISOString() });
  const x = await (await client(e, `cd_session=${tk}`).call('GET', '/api/admin/exceptions')).json();
  assert.deepEqual(x.travaux_en_echec.map((j: { dossier: string; kind: string }) => [j.dossier, j.kind]), [[dA, 'extract']]);
  // Texte affiché au client dans cet état : « un nouveau dépôt relance la lecture ».
  kv.octetsAbsents = null;
  const b2 = fixture('Releve-charges-2025.xlsx');
  await s.addPiece({ id: 'p2', dossier_id: dA, user_id: me, lot_id: 'L2', file_name: 'Releve-charges-2025.xlsx', mime: null, size_bytes: b2.byteLength, sha256: await sha256(b2), duplicate_of: null, created_at: new Date(t).toISOString(), deleted_at: null }, b2);
  await s.enqueue({ key: 'x:p2', kind: 'extract', user_id: me, dossier_id: dA, piece_id: 'p2' });
  for (let i = 0; i < 8; i++) {
    await drain(deps, 60_000, 50);
    t += 10 * 60_000;
  }
  assert.equal((await s.getExtraction('p1'))?.status, 'ok', 'la pièce en échec est relue après le nouveau dépôt');
  const d2 = await (await c.call('GET', `/api/dossiers/${dA}`)).json();
  assert.equal(d2.statut.etat, 'pret');
  await settle();
});

test('B5 : une nouvelle mise en file de la même clé remplace l’échec (aucune accumulation)', async () => {
  const store = new RecetteStore(new SondeKv(), () => new Date('2026-11-18T09:00:00Z'));
  const x1 = { key: 'x:p1', kind: 'extract' as const, user_id: 'A', dossier_id: 'D1', piece_id: 'p1' };
  await store.enqueue(x1);
  await store.complete((await store.claim('w1', 60_000))!, { status: 'failed', error: 'essai' });
  assert.deepEqual((await store.openJobs('D1')).map((j) => [j.key, j.status]), [['x:p1', 'failed']]);
  assert.equal(await store.enqueue(x1), 'created');
  assert.deepEqual((await store.allOpenJobs()).map((j) => [j.key, j.status]), [['x:p1', 'queued']]);
  await store.complete((await store.claim('w1', 60_000))!, { status: 'done', error: null });
  assert.deepEqual(await store.allOpenJobs(), [], 'file vide une fois le travail terminé');
});
