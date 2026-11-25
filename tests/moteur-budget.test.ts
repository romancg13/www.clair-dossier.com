// REMISE §11, « budget IA épuisé » : repli automatique sur les règles déterministes, résultat explicitement
// PARTIEL avec un motif lisible, jamais d'échec silencieux ; reprise IA au cycle suivant sans double décompte.
// Le plafond par compte est couvert par tests/revue-runner.test.ts (C07) ; ici : plafond global, synthèse seule
// en repli, budget du dépôt. Pile en mémoire, fournisseur « IA » simulé qui compte ses appels (aucun réseau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stack } from './helpers/recette.ts';
import { drain, rulesProvider } from '../supabase/functions/_shared/engine/runner.ts';
import { costCents } from '../supabase/functions/_shared/engine/cost.ts';
import type { ModelProvider } from '../supabase/functions/_shared/engine/anthropic.ts';

const LOT = '11111111-1111-4111-8111-111111111111';

/** Coût d'un appel de l'« IA » simulée (2 000 / 300 jetons), en centimes. */
const UNIT = costCents('claude-sonnet-5-5', 2_000, 300);

/** « IA » déterministe facturée (UNIT par appel) qui journalise ses appels. */
function ia(tokens = { in: 2_000, out: 300 }) {
  const appels = { extract: [] as string[], consolidate: 0 };
  const provider: ModelProvider = {
    name: 'anthropic',
    canReadImages: true,
    async extract(p, f, b) {
      appels.extract.push(f);
      const r = await rulesProvider.extract(p, f, b);
      return r.ok ? { ...r, model: 'claude-sonnet-5-5', input_tokens: tokens.in, output_tokens: tokens.out } : r;
    },
    async consolidate(i, b) {
      appels.consolidate++;
      const r = await rulesProvider.consolidate(i, b);
      return r.ok ? { ...r, model: 'claude-sonnet-5-5', input_tokens: tokens.in, output_tokens: tokens.out } : r;
    },
  };
  return { provider, appels };
}
const tourner = async (s: ReturnType<typeof stack>, tours = 200) => {
  for (let i = 0; i < tours; i++) {
    await drain(s.deps, 60_000, 50);
    s.clock.advance(3_000);
  }
};

test('budget global épuisé : pièces texte lues par les règles, résultat partiel motivé, scan reporté ; reprise IA le mois suivant, un appel par pièce', async () => {
  const { provider, appels } = ia();
  const s = stack({ ai: provider, config: { budgetCentsGlobalMonth: 5 } });
  await s.user('A');
  await s.user('Z');
  await s.dossier('D1', 'A');
  await s.store.addCost('Z', null, 6); // le plafond du service est consommé par d'AUTRES comptes
  const [courrier, releve, scan] = await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx', 'Avis-echeance-T4-2026.pdf']);
  await tourner(s);
  assert.deepEqual(appels, { extract: [], consolidate: 0 }, 'aucun appel au modèle une fois le plafond atteint');
  for (const id of [courrier, releve]) {
    const x = await s.store.getExtraction(id);
    assert.equal(x?.status, 'ok');
    assert.equal(x?.provider, 'regles');
    assert.equal(x?.fallback, 'global');
    assert.match(x?.reason ?? '', /règles automatiques seulement : plafond mensuel de lecture approfondie du service atteint\. .*mois prochain/);
    assert.ok((x?.data?.verification.found ?? 0) > 0, 'extraction par règles réelle, extraits retrouvés');
  }
  // Le scan ne peut pas être lu par les règles : il reste reporté (annoncé « en attente », jamais « illisible »).
  const xs = await s.store.getExtraction(scan);
  assert.equal(xs?.status, 'error');
  assert.equal(xs?.deferred, true);
  const partiel = await s.store.lastAnalysis('D1');
  assert.ok(partiel, 'un résultat est livré');
  assert.equal(partiel.provider, 'regles');
  assert.deepEqual([partiel.coverage.extracted, partiel.coverage.fallback, partiel.coverage.deferred, partiel.coverage.complete], [2, 2, 1, false]);
  assert.match(partiel.coverage.partial_reason ?? '', /^2 pièces lues par les règles automatiques seulement — plafond mensuel de lecture approfondie du service atteint\. La lecture approfondie reprendra automatiquement au début du mois prochain\.$/);
  assert.equal(partiel.data.attention_points[0], `Résultat partiel : ${partiel.coverage.partial_reason}`, 'motif en tête des points d’attention des rendus');
  assert.equal((await s.store.getView('D1'))?.revision, partiel.revision);
  // Jamais silencieux : alerte technique, journal du dossier, notification.
  assert.ok((await s.store.alerts()).some((a) => a.code === 'BUDGET' && a.meta.scope === 'global'));
  const journal = await s.store.listEvents('D1');
  assert.equal(journal.filter((e) => e.type === 'lecture_partielle').length, 2);
  assert.match(journal.find((e) => e.type === 'resultats_disponibles')?.label ?? '', /analyse partielle \(2 pièces lues par les règles/);
  assert.equal((await s.store.mailbox('A')).length, 1);
  assert.equal((await s.store.costs('A', [])).userMonth, 0, 'aucun coût imputé au compte');
  // Les trois lectures IA attendent le cycle suivant ; rien d'autre ne tourne (pas de boucle).
  const open = await s.store.allOpenJobs();
  assert.deepEqual(open.map((j) => j.key).sort(), [courrier, releve, scan].map((id) => `x:${id}`).sort());
  assert.ok(open.every((j) => j.status === 'queued' && j.run_after.startsWith('2026-12-01T06:00')));
  // Cycle suivant (plafond d'un mois ordinaire) : chaque pièce est lue par l'IA une seule fois, la synthèse aussi.
  s.deps.config.budgetCentsGlobalMonth = 1500;
  s.clock.advance(Date.parse('2026-12-01T06:00:01Z') - s.clock.now().getTime());
  await s.run();
  assert.deepEqual([...appels.extract].sort(), ['Avis-echeance-T4-2026.pdf', 'Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx'], 'un appel par pièce');
  for (const id of [courrier, releve, scan]) {
    const x = await s.store.getExtraction(id);
    assert.equal(x?.provider, 'anthropic');
    assert.equal(x?.fallback, undefined);
  }
  const complet = await s.store.lastAnalysis('D1');
  assert.equal(complet?.provider, 'anthropic');
  assert.deepEqual([complet?.coverage.total, complet?.coverage.extracted, complet?.coverage.fallback, complet?.coverage.complete], [3, 3, undefined, true]);
  assert.ok(!complet?.data.attention_points.some((p) => /Résultat partiel/.test(p)));
  // Coût du nouveau mois = exactement les appels faits (3 lectures + les synthèses), rien de compté deux fois.
  const cout = (await s.store.costs('A', [])).userMonth;
  assert.ok(appels.consolidate >= 1 && appels.consolidate <= 3, `${appels.consolidate} synthèse(s) IA`);
  assert.equal(Math.round(cout * 100), Math.round(UNIT * (3 + appels.consolidate) * 100));
  assert.equal((await s.store.mailbox('A')).length, 1, 'pas de seconde notification pour le même lot');
  assert.deepEqual(await s.store.allOpenJobs(), []);
});

test('budget atteint après les lectures : synthèse rendue par les règles, annoncée partielle, recalculée par l’IA au cycle suivant', async () => {
  const { provider, appels } = ia();
  assert.ok(UNIT > 0);
  const s = stack({ ai: provider, config: { budgetCentsPerUserMonth: UNIT * 1.5 } });
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  await tourner(s);
  assert.equal(appels.extract.length, 2, 'les deux pièces sont lues par l’IA (plafond franchi par la seconde)');
  assert.equal(appels.consolidate, 0, 'synthèse : plafond atteint, aucun appel');
  const partiel = await s.store.lastAnalysis('D1');
  assert.equal(partiel?.provider, 'regles');
  assert.equal(partiel?.budget_fallback, 'user');
  assert.deepEqual([partiel?.coverage.extracted, partiel?.coverage.fallback, partiel?.coverage.complete], [2, 0, false]);
  assert.match(partiel?.coverage.partial_reason ?? '', /^synthèse établie par les règles automatiques seulement — plafond mensuel de lecture approfondie de votre compte atteint/);
  assert.match(partiel?.data.attention_points[0] ?? '', /^Résultat partiel : synthèse établie par les règles/);
  assert.equal((await s.store.getView('D1'))?.revision, partiel?.revision);
  assert.deepEqual((await s.store.allOpenJobs()).map((j) => [j.key, j.status, j.run_after.slice(0, 16)]), [['cr:D1', 'queued', '2026-12-01T06:00']]);
  // Une relance dans le même mois (même contenu) ne rappelle pas le modèle, ne crée pas de révision, ne boucle pas.
  await s.store.enqueue({ key: 'c:D1', kind: 'consolidate', user_id: 'A', dossier_id: 'D1', piece_id: null });
  const rapports = [];
  for (let i = 0; i < 50; i++) {
    rapports.push(...(await drain(s.deps, 60_000, 50)));
    s.clock.advance(3_000);
  }
  assert.equal(rapports.length, 1, 'un seul travail exécuté');
  assert.equal(appels.consolidate, 0);
  assert.equal((await s.store.lastAnalysis('D1'))?.revision, partiel?.revision);
  assert.deepEqual((await s.store.allOpenJobs()).map((j) => j.key), ['cr:D1']);
  // Cycle suivant : la synthèse est recalculée par l'IA, une fois.
  s.clock.advance(Date.parse('2026-12-01T06:00:01Z') - s.clock.now().getTime());
  await s.run();
  assert.equal(appels.consolidate, 1);
  assert.equal(appels.extract.length, 2, 'pièces déjà lues : aucun nouvel appel de lecture');
  const complet = await s.store.lastAnalysis('D1');
  assert.equal(complet?.revision, (partiel?.revision ?? 0) + 1);
  assert.equal(complet?.provider, 'anthropic');
  assert.equal(complet?.budget_fallback, undefined);
  assert.equal(complet?.coverage.complete, true);
  assert.equal((await s.store.mailbox('A')).length, 1);
  assert.deepEqual(await s.store.allOpenJobs(), []);
});

test('plafond toujours atteint au cycle suivant : la reprise se reporte d’un cycle, sans appel ni boucle', async () => {
  const { provider, appels } = ia();
  const s = stack({ ai: provider, config: { budgetCentsGlobalMonth: 5 } });
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.store.addCost('A', null, 6);
  const [p1] = await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf']);
  await tourner(s, 50);
  const rev = (await s.store.lastAnalysis('D1'))?.revision;
  // Décembre : le plafond du service est de nouveau atteint avant la reprise.
  s.clock.advance(Date.parse('2026-12-01T05:00:00Z') - s.clock.now().getTime());
  await s.store.addCost('A', null, 6);
  s.clock.advance(3_700_000);
  const rapports = [];
  for (let i = 0; i < 50; i++) {
    rapports.push(...(await drain(s.deps, 60_000, 50)));
    s.clock.advance(3_000);
  }
  assert.equal(rapports.length, 1, 'un seul passage : la reprise constate le plafond et se reporte');
  assert.deepEqual(appels, { extract: [], consolidate: 0 });
  assert.equal((await s.store.getExtraction(p1))?.fallback, 'global');
  assert.equal((await s.store.lastAnalysis('D1'))?.revision, rev, 'aucune révision inutile');
  assert.deepEqual((await s.store.allOpenJobs()).map((j) => [j.key, j.run_after.slice(0, 16)]), [[`x:${p1}`, '2027-01-01T06:00']]);
});

test('budget du dépôt atteint : pièce suivante lue par les règles (partiel motivé), sans travail laissé en attente', async () => {
  const { provider, appels } = ia();
  const s = stack({ ai: provider, config: { budgetCentsPerLot: UNIT / 2 } });
  await s.user('A');
  await s.dossier('D1', 'A');
  const [p1, p2] = await s.depose('D1', 'A', LOT, ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  await s.run();
  assert.deepEqual(appels.extract, ['Courrier-bailleur-2026-10-12.pdf']);
  assert.equal((await s.store.getExtraction(p1))?.provider, 'anthropic');
  const x2 = await s.store.getExtraction(p2);
  assert.deepEqual([x2?.status, x2?.provider, x2?.fallback], ['ok', 'regles', 'lot']);
  assert.match(x2?.reason ?? '', /budget de traitement de ce dépôt atteint/);
  const a = await s.store.lastAnalysis('D1');
  assert.deepEqual([a?.coverage.extracted, a?.coverage.fallback, a?.coverage.complete], [2, 1, false]);
  assert.match(a?.coverage.partial_reason ?? '', /budget de traitement de ce dépôt atteint/);
  assert.ok((await s.store.alerts()).some((x) => x.code === 'BUDGET' && x.meta.scope === 'lot'));
  assert.deepEqual(await s.store.allOpenJobs(), []);
});
