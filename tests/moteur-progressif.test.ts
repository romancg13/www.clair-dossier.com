// Analyse progressive : avec l'IA, les règles déterministes publient d'abord des « premiers résultats » (annoncés
// comme tels, jamais comme l'analyse complète), puis la lecture et la synthèse IA les remplacent — un seul appel
// payant par pièce, une seule synthèse payante. Pile en mémoire, « IA » simulée qui compte ses appels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stack } from './helpers/recette.ts';
import { drain, rulesProvider } from '../supabase/functions/_shared/engine/runner.ts';
import type { ModelProvider } from '../supabase/functions/_shared/engine/anthropic.ts';

const LOT = '11111111-1111-4111-8111-111111111111';
function ia() {
  const appels = { extract: [] as string[], consolidate: 0 };
  const provider: ModelProvider = {
    name: 'anthropic',
    canReadImages: true,
    async extract(p, f, b) {
      appels.extract.push(f);
      const r = await rulesProvider.extract(p, f, b);
      return r.ok ? { ...r, model: 'claude-sonnet-5-5', input_tokens: 2000, output_tokens: 300 } : r;
    },
    async consolidate(i, b) {
      appels.consolidate++;
      const r = await rulesProvider.consolidate(i, b);
      return r.ok ? { ...r, model: 'claude-sonnet-5-5', input_tokens: 2000, output_tokens: 300 } : r;
    },
  };
  return { provider, appels };
}
const FICHIERS = ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml'];

test('premiers résultats publiés sans aucun appel IA, puis remplacés par l’analyse IA (un appel par pièce, une synthèse)', async () => {
  const { provider, appels } = ia();
  const s = stack({ ai: provider });
  await s.user('a');
  await s.dossier('d', 'a');
  await s.depose('d', 'a', LOT, FICHIERS);

  // Premier passage, horloge figée : seules les règles ont tourné.
  await drain(s.deps, 60_000, 50);
  assert.deepEqual(appels, { extract: [], consolidate: 0 }, 'aucun appel payant avant les premiers résultats');
  const premier = (await s.store.lastAnalysis('d'))!;
  assert.equal(premier.revision, 1);
  assert.equal(premier.provider, 'regles');
  assert.equal(premier.coverage.provisional, true);
  assert.equal(premier.coverage.complete, false);
  assert.match(premier.data.attention_points[0], /^Premiers résultats — analyse en cours/);
  assert.equal(premier.status, 'published');
  assert.equal(premier.cost_cents, 0);
  assert.equal((await s.store.mailbox('a')).length, 0, 'aucune notification pour des premiers résultats');

  // La suite : lectures IA puis synthèse IA.
  for (let i = 0; i < 20; i++) {
    s.clock.advance(3_000);
    await drain(s.deps, 60_000, 50);
  }
  assert.equal(appels.extract.length, FICHIERS.length, 'un seul appel de lecture par pièce');
  assert.equal(appels.consolidate, 1, 'une seule synthèse payante');
  const final = (await s.store.lastAnalysis('d'))!;
  assert.equal(final.revision, 2);
  assert.equal(final.provider, 'anthropic');
  assert.ok(!final.coverage.provisional);
  assert.equal(final.coverage.complete, true);
  assert.ok(!final.data.attention_points.some((x) => /Premiers résultats/.test(x)));
  assert.equal((await s.store.allOpenJobs()).length, 0);
  assert.equal((await s.store.mailbox('a')).length, 1, 'une seule notification, avec l’analyse complète');
});

test('une synthèse IA déjà publiée n’est jamais remplacée par des premiers résultats', async () => {
  const { provider, appels } = ia();
  const s = stack({ ai: provider });
  await s.user('a');
  await s.dossier('d', 'a');
  await s.depose('d', 'a', LOT, FICHIERS.slice(0, 2));
  for (let i = 0; i < 20; i++) {
    await drain(s.deps, 60_000, 50);
    s.clock.advance(3_000);
  }
  assert.equal((await s.store.lastAnalysis('d'))!.provider, 'anthropic');
  const rev = (await s.store.lastAnalysis('d'))!.revision;
  await s.depose('d', 'a', LOT, FICHIERS.slice(2));
  await drain(s.deps, 60_000, 50); // horloge figée : la nouvelle pièce n'a que sa lecture par règles
  const cur = (await s.store.lastAnalysis('d'))!;
  assert.equal(cur.revision, rev, 'aucune révision provisoire par-dessus une analyse IA');
  for (let i = 0; i < 20; i++) {
    s.clock.advance(3_000);
    await drain(s.deps, 60_000, 50);
  }
  const fin = (await s.store.lastAnalysis('d'))!;
  assert.equal(fin.revision, rev + 1);
  assert.equal(fin.provider, 'anthropic');
  assert.equal(appels.extract.length, 3);
  assert.equal(appels.consolidate, 2);
});

test('sans IA : aucun passage provisoire', async () => {
  const s = stack();
  await s.user('a');
  await s.dossier('d', 'a');
  await s.depose('d', 'a', LOT, FICHIERS);
  await s.run();
  const a = (await s.store.lastAnalysis('d'))!;
  assert.equal(a.revision, 1);
  assert.ok(!a.coverage.provisional);
});

test('lectures IA menées de front (concurrence 3) : toujours un seul appel par pièce et une seule synthèse', async () => {
  const { provider, appels } = ia();
  const lent: ModelProvider = { ...provider, extract: async (p, f, b) => { await new Promise((r) => setTimeout(r, 20)); return provider.extract(p, f, b); } };
  const s = stack({ ai: lent });
  await s.user('a');
  await s.dossier('d', 'a');
  await s.depose('d', 'a', LOT, FICHIERS);
  for (let i = 0; i < 25; i++) {
    await drain(s.deps, 60_000, 50, 3);
    s.clock.advance(2_000);
  }
  assert.deepEqual([...appels.extract].sort(), [...FICHIERS].sort());
  assert.equal(appels.consolidate, 1);
  const fin = (await s.store.lastAnalysis('d'))!;
  assert.equal(fin.provider, 'anthropic');
  assert.equal(fin.coverage.complete, true);
  assert.equal((await s.store.mailbox('a')).length, 1);
});
