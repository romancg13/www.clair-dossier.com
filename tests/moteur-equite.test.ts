// REMISE §11, « équité de la file entre clients » : tourniquet par compte, concurrence bornée par compte.
// Magasin en mémoire instrumenté (aucun réseau). Chaque test échoue sur l'ancien parcours « toute la file,
// dans l'ordre d'arrivée ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RUNNING_PER_ACCOUNT, RecetteStore, type DossierRec } from '../recette/server/store.ts';
import { engineDeps } from '../recette/server/engine-deps.ts';
import { runOnce } from '../supabase/functions/_shared/engine/runner.ts';
import type { Job } from '../supabase/functions/_shared/engine/ports.ts';
import { CompteurKv } from './helpers/compteur-kv.ts';

function pile() {
  let t = Date.parse('2026-11-18T09:00:00Z');
  const clock = { now: () => new Date(t), advance: (ms: number) => (t += ms) };
  const kv = new CompteurKv();
  const store = new RecetteStore(kv, clock.now);
  /** Exécuteur neuf (nouvelle invocation) sur le même stockage : aucune mémoire partagée avec les précédents. */
  const executeur = () => {
    const s = new RecetteStore(kv, clock.now);
    return { store: s, deps: engineDeps(s, { ai: null, config: { consolidateDelayMs: 0 } }) };
  };
  async function compte(id: string) {
    await store.putUser({ id, email: `${id}@exemple.test`, first_name: id, last_name: 'Test', company: null, role: 'client', pwd: { salt: '', hash: '' }, notifications: true, created_at: clock.now().toISOString() });
    await store.updateSub(id, (s) => ({ ...s, status: 'active', plan_id: 'essentiel', current_period_end: '2026-12-18T00:00:00Z' }));
    const d: DossierRec = { id: `D${id}`, user_id: id, title: `Dossier ${id}`, typology: null, objective: null, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: clock.now().toISOString() };
    await store.createDossier(d);
  }
  /** `n` travaux réels (rendus sans analyse : terminés aussitôt exécutés) pour un compte, dans l'ordre d'arrivée. */
  async function travaux(id: string, n: number, prefix = 't') {
    for (let i = 0; i < n; i++) {
      clock.advance(5);
      await store.enqueue({ key: `${prefix}:${id}:${i}`, kind: 'render', user_id: id, dossier_id: `D${id}`, piece_id: null });
    }
  }
  const compteDe = async (jobId: string | null) => (jobId ? ((await kv.inner.getJson<Job>(`jobs/${jobId}.json`))?.value.user_id ?? null) : null);
  return { kv, store, clock, executeur, compte, travaux, compteDe };
}

test('équité : un compte avec 200 travaux ne retarde pas le premier travail d’un autre compte de plus d’un tour', async () => {
  const p = pile();
  await p.compte('A');
  await p.compte('B');
  await p.travaux('A', 200);
  p.clock.advance(60_000);
  await p.travaux('B', 1); // arrivé bien après les 200 travaux de A
  const { deps } = p.executeur();
  p.kv.raz();
  const servis: (string | null)[] = [];
  for (let i = 0; i < 4; i++) servis.push(await p.compteDe((await runOnce(deps)).job));
  assert.ok(servis.indexOf('B') >= 0 && servis.indexOf('B') <= 1, `B servi au plus tard au 2e travail (ordre : ${servis.join(',')})`);
  assert.deepEqual(servis, ['A', 'B', 'A', 'A'], 'B servi dans le premier tour, puis A reprend seul');
  // Et le reste de A s'écoule normalement : rien n'est perdu.
  let restants = 0;
  for (;;) {
    const r = await runOnce(deps);
    if (r.outcome === 'idle') break;
    assert.equal(r.outcome, 'done');
    restants++;
    assert.ok(restants <= 200, 'boucle bornée');
  }
  assert.equal(restants, 197);
  assert.deepEqual(await p.store.allOpenJobs(), []);
});

test('équité : la file d’un gros compte n’est pas lue en entier pour servir un autre compte', async () => {
  const p = pile();
  await p.compte('A');
  await p.compte('B');
  await p.travaux('A', 200);
  await p.travaux('B', 1);
  const { deps } = p.executeur();
  p.kv.raz();
  await runOnce(deps);
  await runOnce(deps);
  const lus = p.kv.cles.filter((k) => k.startsWith('jobs/')).length;
  // Avant : 201 travaux lus à CHAQUE prise (402 pour deux travaux). Désormais : un paquet de A, puis le travail de B.
  assert.ok(lus <= 20, `${lus} lectures de travaux pour servir A puis B`);
});

test('équité : trois comptes chargés sont servis à tour de rôle, y compris par des exécuteurs successifs', async () => {
  const p = pile();
  for (const id of ['A', 'B', 'C']) await p.compte(id);
  await p.travaux('A', 6);
  await p.travaux('B', 3);
  await p.travaux('C', 3);
  // Même exécuteur : tour de rôle strict.
  const { deps } = p.executeur();
  const memes: (string | null)[] = [];
  for (let i = 0; i < 6; i++) memes.push(await p.compteDe((await runOnce(deps)).job));
  assert.deepEqual(memes, ['A', 'B', 'C', 'A', 'B', 'C']);
  // Un exécuteur NEUF par travail (invocations qui ne font qu'un travail chacune) : le tour continue là où il
  // s'était arrêté, au lieu de repartir du premier compte (sinon C ne serait jamais servi).
  const neufs: (string | null)[] = [];
  for (let i = 0; i < 6; i++) neufs.push(await p.compteDe((await runOnce(p.executeur().deps)).job));
  assert.deepEqual(neufs, ['A', 'B', 'C', 'A', 'A', 'A']);
  assert.deepEqual(await p.store.allOpenJobs(), []);
});

test('équité : au plus deux travaux d’un même compte en cours à la fois, sans bloquer les autres comptes', async () => {
  const p = pile();
  await p.compte('A');
  await p.compte('B');
  await p.travaux('A', 5);
  await p.travaux('B', 1);
  assert.equal(MAX_RUNNING_PER_ACCOUNT, 2);
  // Quatre exécuteurs distincts prennent chacun un travail sans le terminer.
  const pris: Job[] = [];
  for (let i = 0; i < 6; i++) {
    const j = await p.executeur().store.claim(`w${i}`, 60_000);
    if (j) pris.push(j);
  }
  assert.deepEqual(pris.map((j) => j.user_id).sort(), ['A', 'A', 'B'], 'deux travaux de A, celui de B, puis plus rien tant que A est à sa borne');
  // Un travail de A se termine : un autre peut partir.
  const s = p.executeur().store;
  const fini = pris.find((j) => j.user_id === 'A')!;
  await s.complete(fini, { status: 'done', error: null });
  assert.equal((await p.executeur().store.claim('w7', 60_000))?.user_id, 'A');
  assert.equal(await p.executeur().store.claim('w8', 60_000), null);
  // Exécuteurs disparus : à l'expiration des baux, les travaux sont repris (la borne ne bloque jamais définitivement).
  p.clock.advance(61_000);
  const repris: Job[] = [];
  for (let i = 0; i < 6; i++) {
    const j = await p.executeur().store.claim(`r${i}`, 60_000);
    if (j) repris.push(j);
  }
  assert.deepEqual(repris.map((j) => j.user_id).sort(), ['A', 'A', 'B'], 'baux expirés repris, toujours dans la borne par compte');
  assert.ok(repris.some((j) => j.attempts === 2), 'au moins une reprise d’un travail abandonné');
});

test('équité : dans un compte, les lectures passent toujours avant la consolidation', async () => {
  const p = pile();
  await p.compte('A');
  await p.store.enqueue({ key: 'c:DA', kind: 'consolidate', user_id: 'A', dossier_id: 'DA', piece_id: null });
  p.clock.advance(5);
  await p.store.enqueue({ key: 'x:absente', kind: 'extract', user_id: 'A', dossier_id: 'DA', piece_id: 'absente' });
  assert.equal((await p.executeur().store.claim('w', 60_000))?.kind, 'extract');
});

test('mémoire de l’exécuteur : un travail modifié par un autre exécuteur est relu, jamais ignoré', async () => {
  const p = pile();
  await p.compte('A');
  // Travail différé de 30 s, vu (et gardé en mémoire) par un exécuteur qui n'a rien à faire pour l'instant.
  await p.store.enqueue({ key: 'c:DA', kind: 'consolidate', user_id: 'A', dossier_id: 'DA', piece_id: null, delayMs: 30_000 });
  const x = p.executeur().store;
  assert.equal(await x.claim('w1', 60_000), null);
  // Un autre exécuteur (API : nouveau dépôt) réarme le même travail : son ETag change.
  assert.equal(await p.executeur().store.enqueue({ key: 'c:DA', kind: 'consolidate', user_id: 'A', dossier_id: 'DA', piece_id: null, delayMs: 30_000 }), 'rearmed');
  p.clock.advance(31_000);
  p.kv.raz();
  const j = await x.claim('w1', 60_000);
  assert.equal(j?.key, 'c:DA', 'le travail est relu puis pris, pas abandonné sur un ETag périmé');
  // La fin du travail s'écrit avec l'ETag de la prise : aucune relecture du travail.
  p.kv.raz();
  await x.complete(j!, { status: 'done', error: null });
  assert.equal(p.kv.cles.filter((k) => k.startsWith('jobs/')).length, 0);
  assert.equal((await p.kv.inner.getJson<Job>(`jobs/${j!.id}.json`))?.value.status, 'done');
  assert.deepEqual(await p.store.allOpenJobs(), []);
});
