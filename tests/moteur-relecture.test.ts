// REMISE §11, « lisibilité » : une pièce en échec définitif est relue d'elle-même lors de passages ultérieurs
// (essais plafonnés, attente croissante), sans nouveau dépôt ; elle reste annoncée « illisible » tant qu'elle l'est.
// Pile en mémoire (aucun réseau) ; panne simulée : fichier de la pièce absent du stockage, ou refus du fournisseur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, stack } from './helpers/recette.ts';
import { sha256 } from '../recette/server/engine-deps.ts';
import { drain, REREAD_DELAYS_MS, rulesProvider } from '../supabase/functions/_shared/engine/runner.ts';
import type { ModelProvider } from '../supabase/functions/_shared/engine/anthropic.ts';

type Pile = ReturnType<typeof stack>;
const LOT = '11111111-1111-4111-8111-111111111111';
const H = 60 * 60_000;

/** Pièce dont la fiche existe mais dont le fichier est absent du stockage : la lecture lève à chaque essai. */
async function pieceSansFichier(s: Pile, name: string, id: string) {
  const bytes = fixture(name);
  s.clock.advance(10);
  await s.kv.putJson(`pieceref/${id}.json`, { dossier_id: 'D1' }, { create: true });
  await s.kv.putJson(`pieces/D1/${id}.json`, { id, dossier_id: 'D1', user_id: 'A', lot_id: LOT, file_name: name, mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: s.clock.now().toISOString(), deleted_at: null }, { create: true });
  await s.store.enqueue({ key: `x:${id}`, kind: 'extract', user_id: 'A', dossier_id: 'D1', piece_id: id });
  return { id, restaurer: () => s.kv.putBytes(`files/A/D1/${id}`, bytes, 'application/octet-stream') };
}
/** Compte les lectures du fichier d'une pièce (une par essai de lecture). */
function essais(s: Pile, id: string) {
  const n = { lectures: 0 };
  const orig = s.kv.getBytes.bind(s.kv);
  s.kv.getBytes = async (k) => {
    if (k === `files/A/D1/${id}`) n.lectures++;
    return orig(k);
  };
  return n;
}
/** Fait tourner l'exécuteur pendant `ms` simulées, par pas de 30 s. */
async function pendant(s: Pile, ms: number) {
  let travaux = 0;
  for (let t = 0; t < ms; t += 30_000) {
    travaux += (await drain(s.deps, 60_000, 50)).length;
    s.clock.advance(30_000);
  }
  return travaux;
}
const relecture = async (s: Pile) => (await s.store.allOpenJobs()).find((j) => j.key.startsWith('xr:'));

test('relecture : pièce en échec définitif relue d’elle-même une heure plus tard, sans nouveau dépôt', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  const px = await pieceSansFichier(s, 'Courriel-2026-10-20.eml', 'px');
  await pendant(s, 30 * 60_000);
  // Échec définitif : la pièce est annoncée « illisible », le reste du dossier est livré, l'incident reste visible.
  const x = await s.store.getExtraction(px.id);
  assert.deepEqual([x?.status, x?.deferred, x?.rereads], ['error', false, 0]);
  const partiel = await s.store.lastAnalysis('D1');
  assert.deepEqual([partiel?.coverage.extracted, partiel?.coverage.failed, partiel?.coverage.complete], [2, 1, false]);
  assert.equal((await s.store.failedJobs()).length, 1);
  const prevue = await relecture(s);
  assert.equal(prevue?.key, 'xr:px');
  assert.equal(Date.parse(prevue!.run_after) - Date.parse(x!.created_at), REREAD_DELAYS_MS[0], 'relecture prévue une heure après l’échec');
  // Le stockage redevient lisible. AUCUN dépôt : la relecture programmée suffit.
  await px.restaurer();
  const piecesAvant = (await s.store.listPieces('D1')).length;
  assert.equal(await pendant(s, 20 * 60_000), 0, 'rien ne tourne avant l’heure prévue');
  assert.equal((await s.store.getExtraction(px.id))?.status, 'error', 'toujours annoncée illisible d’ici là');
  await pendant(s, 45 * 60_000);
  assert.equal((await s.store.getExtraction(px.id))?.status, 'ok', 'pièce lue par la relecture automatique');
  const complet = await s.store.lastAnalysis('D1');
  assert.deepEqual([complet?.coverage.extracted, complet?.coverage.failed, complet?.coverage.complete], [3, 0, true]);
  assert.equal(complet?.revision, (partiel?.revision ?? 0) + 1);
  assert.equal((await s.store.getView('D1'))?.revision, complet?.revision, 'résultat complété publié');
  assert.equal((await s.store.listPieces('D1')).length, piecesAvant, 'aucune pièce ajoutée');
  assert.deepEqual(await s.store.failedJobs(), [], 'l’incident est levé une fois la pièce lue');
  assert.deepEqual(await s.store.allOpenJobs(), []);
});

test('relecture : pièce définitivement illisible : trois relectures au plus, de plus en plus espacées, puis plus rien', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  const px = await pieceSansFichier(s, 'Courriel-2026-10-20.eml', 'px');
  const n = essais(s, px.id);
  await pendant(s, 30 * 60_000);
  const premier = (await s.store.getExtraction(px.id))!;
  const rev = (await s.store.lastAnalysis('D1'))!.revision;
  assert.equal(n.lectures, 4, 'premier travail : quatre essais');
  const attentes: number[] = [];
  let dernierEchec = Date.parse(premier.created_at);
  for (let k = 0; k < REREAD_DELAYS_MS.length; k++) {
    const prevue = await relecture(s);
    assert.ok(prevue, `relecture n° ${k + 1} programmée`);
    attentes.push(Date.parse(prevue.run_after) - dernierEchec);
    await pendant(s, Date.parse(prevue.run_after) - s.clock.now().getTime() + 30 * 60_000);
    const x = (await s.store.getExtraction(px.id))!;
    assert.deepEqual([x.status, x.deferred, x.rereads], ['error', false, k + 1], 'toujours annoncée illisible');
    assert.match(x.reason ?? '', /merci de la redéposer/);
    dernierEchec = Date.parse(x.created_at);
  }
  assert.deepEqual(attentes, [1 * H, 6 * H, 24 * H], 'attente croissante');
  assert.equal(n.lectures, 4 * (1 + REREAD_DELAYS_MS.length), 'essais plafonnés');
  // Plafond atteint : plus aucun travail, même un mois plus tard ; aucune révision produite par les relectures vaines.
  assert.deepEqual(await s.store.allOpenJobs(), []);
  assert.equal(await pendant(s, 30 * 24 * H), 0);
  assert.equal(n.lectures, 16);
  const fin = await s.store.lastAnalysis('D1');
  assert.equal(fin?.revision, rev, 'aucune révision pour une relecture sans effet');
  assert.deepEqual([fin?.coverage.extracted, fin?.coverage.failed], [1, 1]);
  assert.ok((await s.store.failedJobs()).length >= 1, 'incident toujours signalé');
});

test('relecture : refus définitif du fournisseur sur un scan : relu plus tard par le même mécanisme, appels bornés', async () => {
  let refuse = true;
  const appels: string[] = [];
  const ia: ModelProvider = {
    name: 'anthropic',
    canReadImages: true,
    async extract(p, f, b) {
      appels.push(f);
      if (refuse && p.needsVision) return { ok: false, kind: 'refusal', message: 'refus du modèle', retryable: false };
      return rulesProvider.extract(p, f, b);
    },
    consolidate: (i, b) => rulesProvider.consolidate(i, b),
  };
  const s = stack({ ai: ia });
  await s.user('A');
  await s.dossier('D1', 'A');
  const [scan] = await s.depose('D1', 'A', LOT, ['Avis-echeance-T4-2026.pdf', 'Courrier-bailleur-2026-10-12.pdf']);
  await pendant(s, 10 * 60_000);
  const x = await s.store.getExtraction(scan);
  assert.deepEqual([x?.status, x?.deferred, x?.rereads], ['error', false, 0]);
  assert.match(x?.reason ?? '', /merci de la redéposer/);
  assert.equal((await s.store.lastAnalysis('D1'))?.coverage.failed, 1);
  assert.deepEqual((await s.store.allOpenJobs()).map((j) => j.key), [`xr:${scan}`]);
  // Deux relectures refusées (1 h, puis 6 h), puis le fournisseur accepte à la troisième (24 h).
  await pendant(s, 8 * H);
  assert.equal((await s.store.getExtraction(scan))?.rereads, 2);
  assert.equal(appels.filter((f) => f.startsWith('Avis')).length, 3, 'un appel par passage, pas davantage');
  refuse = false;
  await pendant(s, 25 * H);
  assert.equal((await s.store.getExtraction(scan))?.status, 'ok');
  assert.equal(appels.filter((f) => f.startsWith('Avis')).length, 4);
  assert.deepEqual([(await s.store.lastAnalysis('D1'))?.coverage.failed, (await s.store.lastAnalysis('D1'))?.coverage.extracted], [0, 2]);
  assert.deepEqual(await s.store.allOpenJobs(), []);
});

test('relecture : une relecture programmée ne retient ni la consolidation d’un nouveau dépôt, ni le statut « prêt »', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  await pieceSansFichier(s, 'Courriel-2026-10-20.eml', 'px');
  await pendant(s, 30 * 60_000);
  const prevue = (await relecture(s))!;
  // Cinq minutes avant la relecture : un nouveau dépôt est consolidé tout de suite.
  s.clock.advance(Date.parse(prevue.run_after) - s.clock.now().getTime() - 5 * 60_000);
  const rev = (await s.store.lastAnalysis('D1'))!.revision;
  await s.depose('D1', 'A', '22222222-2222-4222-8222-222222222222', ['Releve-charges-2025.xlsx']);
  await pendant(s, 60_000);
  assert.equal((await s.store.lastAnalysis('D1'))?.revision, rev + 1, 'nouvelle pièce publiée sans attendre la relecture');
  const { jobEnCours } = await import('../recette/server/store.ts');
  assert.ok(!(await s.store.openJobs('D1')).some((j) => jobEnCours(j, s.clock.now())), 'dossier non affiché « en cours » pour une relecture de fond');
});
