// Revue de la PR de recette, lot « exécuteur » : non-régression des constats C05, C06, C07, C18 et C20.
// Pile en mémoire (aucun réseau) ; pannes de stockage simulées sur des clés précises.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, stack } from './helpers/recette.ts';
import { sha256, engineDeps } from '../recette/server/engine-deps.ts';
import { MemoryKv } from '../recette/server/kv.ts';
import { RecetteStore } from '../recette/server/store.ts';
import { handle, type ApiEnv } from '../recette/server/api.ts';
import { drain, rulesProvider } from '../supabase/functions/_shared/engine/runner.ts';
import type { ModelProvider } from '../supabase/functions/_shared/engine/anthropic.ts';
import type { EngineConfig } from '../supabase/functions/_shared/engine/ports.ts';

type Pile = ReturnType<typeof stack>;
const LOT = '11111111-1111-4111-8111-111111111111';
const LOT2 = '22222222-2222-4222-8222-222222222222';

/** Fait échouer (exception, comme une erreur réseau Blob) les `n` prochaines écritures JSON d'une clé. */
function failPutJson(kv: MemoryKv, key: string, n = 1) {
  const orig = kv.putJson.bind(kv);
  kv.putJson = async (k, v, o) => {
    if (k === key && n > 0) {
      n--;
      throw new Error(`erreur transitoire du stockage (${k})`);
    }
    return orig(k, v, o);
  };
}

/** Pièce dont la fiche existe mais dont le fichier n'a jamais été écrit (dépôt partiellement abouti). */
async function pieceSansFichier(s: Pile, dossierId: string, userId: string, lot: string, name: string, id: string) {
  const bytes = fixture(name);
  s.clock.advance(10);
  await s.kv.putJson(`pieceref/${id}.json`, { dossier_id: dossierId }, { create: true });
  await s.kv.putJson(`pieces/${dossierId}/${id}.json`, { id, dossier_id: dossierId, user_id: userId, lot_id: lot, file_name: name, mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: s.clock.now().toISOString(), deleted_at: null }, { create: true });
  await s.store.enqueue({ key: `x:${id}`, kind: 'extract', user_id: userId, dossier_id: dossierId, piece_id: id });
  return id;
}

/** Fournisseur « IA » déterministe (règles) qui déclare une consommation de jetons. */
function iaFacturee(tokens: { in: number; out: number }, onExtract?: (fileName: string) => ReturnType<ModelProvider['extract']> | null): ModelProvider {
  return {
    name: 'anthropic',
    canReadImages: true,
    async extract(p, f, b) {
      const forced = onExtract?.(f);
      if (forced) return forced;
      const r = await rulesProvider.extract(p, f, b);
      return r.ok ? { ...r, model: 'claude-sonnet-5-5', input_tokens: tokens.in, output_tokens: tokens.out } : r;
    },
    async consolidate(i, b) {
      const r = await rulesProvider.consolidate(i, b);
      return r.ok ? { ...r, model: 'claude-sonnet-5-5', input_tokens: 1000, output_tokens: 100 } : r;
    },
  };
}

/* ── C05 : révision créée, pointeur last.json non mis à jour ────────────── */

test('C05 : échec d’écriture de last.json après la création de la révision : le lot est publié et le dossier n’est pas figé', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  failPutJson(s.kv, 'analyses/D1/last.json');
  await s.run();
  assert.equal((await s.store.lastAnalysis('D1'))?.revision, 1, 'pointeur réparé');
  assert.equal((await s.store.getView('D1'))?.revision, 1, 'lot 1 publié');
  assert.equal((await s.store.mailbox('A')).length, 1);
  // Lot suivant, un jour plus tard : nouvelle révision, nouvelle notification.
  s.clock.advance(86_400_000);
  await s.depose('D1', 'A', 'L2', ['Bail-commercial-2021.pdf']);
  await s.run();
  assert.equal((await s.store.getView('D1'))?.revision, 2);
  assert.deepEqual(await s.kv.list('analyses/D1/'), ['analyses/D1/last.json', 'analyses/D1/r00001.json', 'analyses/D1/r00002.json']);
  assert.equal((await s.store.mailbox('A')).length, 2);
});

test('C05 : révision refusée par le stockage sans relecture possible : le travail échoue avec une alerte, jamais « terminé » en silence', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf']);
  s.store.insertAnalysis = async () => false; // stockage qui refuse sans rien écrire
  await s.run();
  assert.equal(await s.store.getView('D1'), null);
  assert.ok((await s.store.alerts()).some((a) => a.code === 'TRAVAIL_ECHEC' && a.meta.kind === 'consolidate'), 'incident signalé');
});

/* ── C06 : extraction en échec définitif ───────────────────────────────── */

test('C06 : pièce illisible après tous les essais : résultat partiel publié, plus de boucle de consolidation', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  const cassee = await pieceSansFichier(s, 'D1', 'A', LOT, 'Courriel-2026-10-20.eml', 'px');
  const reports = await s.run(60);
  // Seule reste la relecture automatique de la pièce en échec, programmée une heure plus tard (aucun travail prêt).
  const restants = await s.store.allOpenJobs();
  assert.deepEqual(restants.map((j) => [j.key, j.status]), [['xr:px', 'queued']], 'plus aucun travail en attente, hors relecture programmée');
  assert.ok(Date.parse(restants[0].run_after) - s.clock.now().getTime() > 30 * 60_000, 'relecture différée, pas une boucle');
  assert.ok(reports.filter((r) => r.kind === 'consolidate' && r.outcome === 'requeued').length < 20, 'pas de replanification sans fin');
  const x = await s.store.getExtraction(cassee);
  assert.equal(x?.status, 'error');
  assert.equal(x?.deferred, false);
  assert.match(x?.reason ?? '', /merci de la redéposer/);
  const last = await s.store.lastAnalysis('D1');
  assert.equal(last?.coverage.extracted, 2);
  assert.equal(last?.coverage.failed, 1);
  assert.equal((await s.store.getView('D1'))?.revision, last?.revision, 'les deux pièces lisibles sont livrées');
  assert.equal((await s.store.mailbox('A')).length, 1);
  assert.ok((await s.store.alerts()).some((a) => a.code === 'TRAVAIL_ECHEC' && a.meta.kind === 'extract'));
});

test('C06 : la copie redéposée d’une pièce en échec est lue et la remplace (pas « doublon » de la pièce cassée)', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  const cassee = await pieceSansFichier(s, 'D1', 'A', LOT, 'Releve-charges-2025.xlsx', 'px');
  await s.run(60);
  assert.equal((await s.store.getExtraction(cassee))?.status, 'error');
  const rev = (await s.store.lastAnalysis('D1'))!.revision;
  const [copie] = await s.depose('D1', 'A', LOT2, ['Releve-charges-2025.xlsx']);
  await s.run();
  const pieces = await s.store.listPieces('D1');
  assert.equal(pieces.find((p) => p.id === copie)?.duplicate_of, null, 'la copie n’est pas écartée comme doublon');
  assert.equal((await s.store.getExtraction(copie))?.status, 'ok', 'la copie est lue');
  assert.equal(pieces.find((p) => p.id === cassee)?.duplicate_of, copie, 'la pièce cassée est remplacée par sa copie');
  const last = await s.store.lastAnalysis('D1');
  assert.ok(last!.revision > rev);
  assert.equal(last!.coverage.failed, 0, 'plus aucune pièce à redéposer');
  assert.equal(last!.coverage.extracted, 2);
});

test('C06 : copie déposée pendant les essais de la pièce en échec : elle devient l’original et est lue, sans troisième dépôt', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  const cassee = await pieceSansFichier(s, 'D1', 'A', LOT, 'Releve-charges-2025.xlsx', 'px');
  const [copie1] = await s.depose('D1', 'A', LOT2, ['Releve-charges-2025.xlsx']); // redéposée avant l'épuisement des essais
  await s.run(60);
  const pieces = await s.store.listPieces('D1');
  assert.equal((await s.store.getExtraction(cassee))?.status, 'error');
  assert.equal(pieces.find((p) => p.id === copie1)?.duplicate_of, null, 'la copie n’est plus doublon de la pièce cassée');
  assert.equal(pieces.find((p) => p.id === cassee)?.duplicate_of, copie1, 'la pièce cassée est rattachée à sa copie');
  assert.equal((await s.store.getExtraction(copie1))?.status, 'ok', 'la copie est lue');
  const last = await s.store.lastAnalysis('D1');
  assert.equal(last?.coverage.failed, 0, 'aucune demande « redéposer »');
  assert.equal(last?.coverage.extracted, 2);
  assert.equal((await s.store.getView('D1'))?.revision, last?.revision);
  assert.deepEqual(await s.store.allOpenJobs(), []);
  // Dépôt suivant du même fichier : doublon de la copie lue, aucune nouvelle lecture.
  const [copie2] = await s.depose('D1', 'A', LOT2, ['Releve-charges-2025.xlsx']);
  await s.run();
  assert.equal((await s.store.listPieces('D1')).find((p) => p.id === copie2)?.duplicate_of, copie1);
});

test('C06 : un fichier non écrit au dépôt ne laisse aucune fiche de pièce orpheline', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  const bytes = fixture('Courrier-bailleur-2026-10-12.pdf');
  s.kv.putBytes = async () => {
    throw new Error('BlobServiceNotAvailable');
  };
  await assert.rejects(s.store.addPiece({ id: 'p1', dossier_id: 'D1', user_id: 'A', lot_id: LOT, file_name: 'Courrier.pdf', mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: s.clock.now().toISOString(), deleted_at: null }, bytes));
  assert.deepEqual(await s.kv.list('pieces/D1/'), [], 'le dépôt échoue sans pièce fantôme');
});

test('C06 : sortie IA non conforme à répétition : nombre d’appels borné, repli sur les règles à la dernière tentative', async () => {
  let calls = 0;
  const ai = iaFacturee({ in: 1000, out: 100 }, (f) => {
    if (!f.startsWith('Releve')) return null;
    calls++;
    return Promise.resolve({ ok: false, kind: 'invalid', message: 'sortie non conforme', retryable: true, model: 'claude-sonnet-5-5', input_tokens: 20_000, output_tokens: 4_000 });
  });
  const s = stack({ ai });
  await s.user('A');
  await s.dossier('D1', 'A');
  const [, releve] = await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  await s.run(60);
  assert.equal(calls, 4, 'max_attempts appels, pas davantage');
  const x = await s.store.getExtraction(releve);
  assert.equal(x?.status, 'ok');
  assert.equal(x?.provider, 'regles');
  assert.match(x?.reason ?? '', /repli règles \(invalid\)/);
  assert.ok(await s.store.getView('D1'), 'résultat publié');
  assert.deepEqual(await s.store.allOpenJobs(), []);
});

/* ── C07 : budget mensuel atteint en cours de lot ──────────────────────── */

test('C07 : budget mensuel atteint en cours de lot : pièce restante lue par les règles, résultat annoncé partiel, lecture IA reprise le 1er du mois', async () => {
  // Depuis la levée du point « budget » (REMISE §11) : la pièce au-delà du plafond n'est plus reportée sans être lue ;
  // elle est lue par les règles déterministes, le résultat est annoncé partiel, et la lecture IA reprend au cycle suivant.
  const appels: string[] = [];
  const s = stack({ ai: iaFacturee({ in: 20_000, out: 3_000 }, (f) => (appels.push(f), null)), config: { budgetCentsPerUserMonth: 5 } });
  await s.user('A');
  await s.dossier('D1', 'A');
  const [p1, p2] = await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  // 20 minutes simulées par pas de 3 s (rythme des relances de la recette).
  let replanifiees = 0;
  for (let i = 0; i < 400; i++) {
    replanifiees += (await drain(s.deps, 60_000, 50)).filter((r) => r.kind === 'consolidate' && r.outcome === 'requeued').length;
    s.clock.advance(3_000);
  }
  assert.ok(replanifiees <= 2, `consolidation replanifiée ${replanifiees} fois`);
  assert.equal((await s.store.getExtraction(p1))?.provider, 'anthropic');
  const x2 = await s.store.getExtraction(p2);
  assert.equal(x2?.status, 'ok', 'pièce lue par les règles, pas laissée de côté');
  assert.equal(x2?.provider, 'regles');
  assert.equal(x2?.fallback, 'user');
  assert.match(x2?.reason ?? '', /plafond mensuel.*mois prochain/);
  assert.deepEqual(appels, ['Courrier-bailleur-2026-10-12.pdf'], 'aucun appel au modèle au-delà du plafond');
  const partiel = await s.store.lastAnalysis('D1');
  assert.equal((await s.store.getView('D1'))?.revision, partiel?.revision, 'résultat livré sans attendre le mois suivant');
  assert.equal(partiel?.coverage.extracted, 2);
  assert.equal(partiel?.coverage.fallback, 1);
  assert.equal(partiel?.coverage.complete, false, 'résultat explicitement partiel');
  assert.match(partiel?.coverage.partial_reason ?? '', /1 pièce lue par les règles automatiques seulement — plafond mensuel/);
  assert.match(partiel?.data.attention_points[0] ?? '', /^Résultat partiel : /);
  assert.equal((await s.store.mailbox('A')).length, 1);
  const open = await s.store.allOpenJobs();
  assert.deepEqual(open.map((j) => j.key).sort(), ['cr:D1', `x:${p2}`], 'reprises IA planifiées : la pièce et la synthèse');
  assert.ok(open.every((j) => j.status === 'queued' && j.run_after.startsWith('2026-12-01T06:00')), 'reprise au début du mois suivant');
  assert.ok((await s.store.alerts()).some((a) => a.code === 'BUDGET'));
  // Début du mois suivant (plafond d'un mois ordinaire) : la pièce est lue par l'IA, une seule fois.
  s.deps.config.budgetCentsPerUserMonth = 300;
  s.clock.advance(Date.parse('2026-12-01T06:00:01Z') - s.clock.now().getTime());
  await s.run();
  const relue = await s.store.getExtraction(p2);
  assert.equal(relue?.provider, 'anthropic');
  assert.equal(relue?.fallback, undefined);
  assert.deepEqual(appels, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx'], 'un seul appel par pièce : aucun double décompte');
  const complet = await s.store.lastAnalysis('D1');
  assert.equal(complet?.revision, (partiel?.revision ?? 0) + 1);
  assert.equal(complet?.provider, 'anthropic');
  assert.equal(complet?.coverage.complete, true);
  assert.equal(complet?.coverage.total, 2, 'pièce comptée une seule fois');
  assert.equal(complet?.coverage.partial_reason, undefined);
  assert.equal((await s.store.getView('D1'))?.revision, complet?.revision);
  assert.equal((await s.store.mailbox('A')).length, 1, 'pas de seconde notification pour le même lot');
  assert.deepEqual(await s.store.allOpenJobs(), []);
});

/* ── C18 : une seule clé de travail d'extraction par pièce ─────────────── */

test('C18 : dépôt et consolidation partagent la clé d’extraction : un seul travail, un seul appel au modèle', async () => {
  const calls: Record<string, number> = {};
  const ai = iaFacturee({ in: 20_000, out: 3_000 }, (f) => {
    calls[f] = (calls[f] ?? 0) + 1;
    return null;
  });
  const s = stack({ ai, config: { progressive: false } });
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  await drain(s.deps, 60_000, 1); // extraction de p1, consolidation mise en file
  // Requête suivante du même lot : pièce écrite, pas encore mise en file, quand la consolidation passe.
  const bytes = fixture('Releve-charges-2025.xlsx');
  s.clock.advance(10);
  await s.store.addPiece({ id: 'p2', dossier_id: 'D1', user_id: 'A', lot_id: LOT, file_name: 'Releve-charges-2025.xlsx', mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: s.clock.now().toISOString(), deleted_at: null }, bytes);
  assert.deepEqual((await drain(s.deps, 60_000, 1)).map((r) => `${r.kind}:${r.outcome}`), ['consolidate:requeued']);
  await s.store.enqueue({ key: 'x:p2', kind: 'extract', user_id: 'A', dossier_id: 'D1', piece_id: 'p2' }); // fin de la requête
  const open = (await s.store.allOpenJobs()).filter((j) => j.piece_id === 'p2');
  assert.equal(open.length, 1, 'un seul travail d’extraction pour la pièce');
  await Promise.all([drain(s.deps, 60_000, 1), drain({ ...s.deps, config: { ...s.deps.config, workerId: 'w2' } }, 60_000, 1)]);
  assert.equal(calls['Releve-charges-2025.xlsx'], 1, 'un seul appel payant');
});

/* ── C20 : une notification par lot, quand le lot est complet ──────────── */

function apiEnv(o: { ai?: ModelProvider | null; config?: Partial<EngineConfig> } = {}) {
  const store = new RecetteStore(new MemoryKv());
  const pending: Promise<unknown>[] = [];
  const e: ApiEnv = { store, deps: async () => engineDeps(store, { ai: o.ai ?? null, config: { consolidateDelayMs: 0, ...o.config } }), secret: 'secret-de-test-0123456789', workerToken: 'w', cronSecret: 'c', siteUrl: 'http://127.0.0.1:9', adminPassword: null, waitUntil: (p) => void pending.push(p), kickWorker: async () => undefined, aiLabel: 'règles' };
  const settle = async () => {
    while (pending.length) await pending.shift();
  };
  let cookie = '';
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
  return { store, settle, call };
}

/** Envoi d'un lot fichier par fichier, comme l'espace dossier ; l'exécuteur termine avant l'envoi suivant. */
async function deposerUnParUn(a: ReturnType<typeof apiEnv>, dossierId: string, files: string[], apres: (i: number) => Promise<void>) {
  const lot = crypto.randomUUID();
  for (const [i, n] of files.entries()) {
    const f = new FormData();
    f.append('lot', lot);
    f.append('total', String(files.length));
    f.append('fichiers', new File([fixture(n)], n));
    assert.equal((await a.call('POST', `/api/dossiers/${dossierId}/pieces`, f)).status, 201);
    await a.settle();
    await apres(i);
  }
}

test('C20 : lot envoyé fichier par fichier : une seule notification, après la dernière pièce, sur le lot complet', async () => {
  const a = apiEnv();
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const d = (await (await a.call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
  const boite = async () => (await (await a.call('GET', '/api/boite')).json()).messages as { text: string }[];
  const files = ['Courriel-2026-10-20.eml', 'Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx', 'Photo-floue.jpg'];
  const avant = (await boite()).length;
  const vues: (number | null)[] = [];
  await deposerUnParUn(a, d, files, async (i) => {
    vues.push((await a.store.getView(d))?.revision ?? null);
    if (i < files.length - 1) assert.equal((await boite()).length, avant, `aucune notification après le fichier ${i + 1}/${files.length}`);
  });
  assert.ok(vues.every((v) => v !== null), 'résultats intermédiaires publiés dans l’espace');
  const mails = await boite();
  assert.equal(mails.length, avant + 1, 'une notification pour le lot');
  assert.match(mails[0].text, /Certaines pièces n'ont pas pu être exploitées/, 'la notification reflète le lot complet (photo floue)');
});

test('C20 : dernier fichier du lot identique à un précédent : la notification part quand même, une seule fois', async () => {
  const a = apiEnv();
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const d = (await (await a.call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
  const boite = async () => (await (await a.call('GET', '/api/boite')).json()).messages as unknown[];
  const avant = (await boite()).length;
  await deposerUnParUn(a, d, ['Bail-commercial-2021.pdf', 'Bail signé (copie).pdf'], async (i) => {
    if (i === 0) assert.equal((await boite()).length, avant, 'lot incomplet : pas encore de notification');
  });
  assert.equal((await boite()).length, avant + 1);
  // Nouveau dépôt du même fichier (autre lot) : rien de nouveau, aucune notification.
  await deposerUnParUn(a, d, ['Bail-commercial-2021.pdf'], async () => undefined);
  assert.equal((await boite()).length, avant + 1);
});

/* ── Contre-revue : lot interrompu, course de complétude, lot entièrement reporté, statut ── */

test('C20 : lot interrompu par un fichier refusé (413) : le navigateur clôt le lot et une notification part', async () => {
  const a = apiEnv();
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const d = (await (await a.call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
  const boite = async () => (await (await a.call('GET', '/api/boite')).json()).messages as unknown[];
  const avant = (await boite()).length;
  const lot = crypto.randomUUID();
  const sel: [string, Uint8Array][] = [['Courrier-bailleur-2026-10-12.pdf', fixture('Courrier-bailleur-2026-10-12.pdf')], ['gros-scan.pdf', new Uint8Array(5 * 1024 * 1024)], ['Releve-charges-2025.xlsx', fixture('Releve-charges-2025.xlsx')]];
  let recus = 0;
  for (const [n, b] of sel) {
    const f = new FormData();
    f.append('lot', lot);
    f.append('total', String(sel.length));
    f.append('fichiers', new File([b as Uint8Array<ArrayBuffer>], n));
    const r = await a.call('POST', `/api/dossiers/${d}/pieces`, f);
    await a.settle();
    if (r.status !== 201) break; // comme l'espace dossier : l'erreur arrête la boucle
    recus++;
  }
  assert.equal(recus, 1);
  assert.equal((await boite()).length, avant, 'lot incomplet : pas encore de notification');
  // Bloc finally de l'espace dossier : fin du lot sur les pièces reçues.
  assert.equal((await a.call('POST', `/api/dossiers/${d}/lots/${lot}/fin`, {})).status, 200);
  await a.settle();
  assert.equal((await boite()).length, avant + 1, 'une notification pour le lot interrompu');
  assert.equal((await (await a.call('GET', `/api/dossiers/${d}`)).json()).statut.etat, 'pret');
});

test('C20 : lot abandonné sans clôture (onglet fermé) : tenu pour complet 10 min après la dernière pièce, notifié une fois', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.store.declareLot('D1', LOT, 3);
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  const t0 = s.clock.now().getTime();
  await drain(s.deps, 60_000, 50);
  assert.ok(await s.store.getView('D1'), 'résultat publié');
  assert.equal((await s.store.mailbox('A')).length, 0, 'pas de notification avant le délai');
  await s.run();
  assert.equal((await s.store.mailbox('A')).length, 1, 'notification après le délai');
  assert.ok(s.clock.now().getTime() - t0 >= 10 * 60_000);
  assert.deepEqual(await s.store.allOpenJobs(), []);
});

test('C20 : pièce du lot lue pendant le calcul de la révision précédente : la notification porte sur la révision qui la couvre', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.store.declareLot('D1', LOT, 2);
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  await drain(s.deps, 60_000, 1); // lecture de la 1re pièce
  const prep = s.deps.renderer.prepare.bind(s.deps.renderer);
  let once = true;
  s.deps.renderer.prepare = async (input) => {
    if (once) {
      once = false;
      await s.depose('D1', 'A', LOT, ['Photo-floue.jpg']); // 2e fichier reçu et lu pendant le rendu de la révision 1
      await drain({ ...s.deps, config: { ...s.deps.config, workerId: 'w2' } }, 60_000, 5);
    }
    return prep(input);
  };
  await drain(s.deps, 60_000, 1); // consolidation et rendu de la révision 1
  await s.run();
  const mails = await s.store.mailbox('A');
  assert.equal((await s.store.getView('D1'))?.revision, 2);
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /Certaines pièces n'ont pas pu être exploitées/, 'la notification reflète la pièce reportée');
});

test('C07 : plafond mensuel déjà atteint au dépôt : lot lu par les règles et notifié une fois (partiel), pas de seconde notification à la reprise IA', async () => {
  const s = stack({ ai: iaFacturee({ in: 20_000, out: 3_000 }), config: { budgetCentsPerUserMonth: 5 } });
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.store.addCost('A', null, 6);
  const [p1] = await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  for (let i = 0; i < 200; i++) {
    await drain(s.deps, 60_000, 50);
    s.clock.advance(3_000);
  }
  const x = await s.store.getExtraction(p1);
  assert.equal(x?.status, 'ok');
  assert.equal(x?.fallback, 'user');
  const mails = await s.store.mailbox('A');
  assert.equal(mails.length, 1, 'le lot est lu (règles) : il est annoncé');
  assert.match(mails[0].text, /Résultat partiel : 1 pièce lue par les règles automatiques seulement/);
  assert.equal((await s.store.costs('A', [])).userMonth, 6, 'aucun coût ajouté par le repli');
  s.clock.advance(Date.parse('2026-12-01T06:00:01Z') - s.clock.now().getTime());
  await s.run();
  assert.equal((await s.store.getExtraction(p1))?.provider, 'anthropic');
  assert.equal((await s.store.mailbox('A')).length, 1, 'une seule notification pour le lot');
});

test('C07 : lecture IA reportée au mois suivant : le dossier n’est plus affiché « en cours » une fois les résultats publiés', async () => {
  const a = apiEnv({ ai: iaFacturee({ in: 20_000, out: 3_000 }), config: { budgetCentsPerUserMonth: 5, extractionWaitMs: 0 } });
  await a.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const d = (await (await a.call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
  await deposerUnParUn(a, d, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx'], async () => undefined);
  for (let i = 0; i < 6; i++) {
    await a.call('GET', `/api/dossiers/${d}`);
    await a.settle();
  }
  const det = await (await a.call('GET', `/api/dossiers/${d}`)).json();
  assert.ok(det.vue, 'résultats publiés');
  assert.ok(det.pieces.some((p: { lecture: { statut: string; moteur: string; motif: string | null } | null }) => p.lecture?.statut === 'ok' && p.lecture.moteur === 'regles' && /plafond mensuel/.test(p.lecture.motif ?? '')), 'une pièce lue par les règles, motif lisible');
  assert.ok((await a.store.allOpenJobs()).some((j) => j.kind === 'extract' && j.status === 'queued'), 'reprise IA planifiée');
  assert.equal(det.statut.etat, 'pret');
  assert.equal(det.statut.travaux, 0);
});
