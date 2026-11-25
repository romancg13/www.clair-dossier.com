// Pilotage de la recette : centre d'actions multidossiers, « depuis votre dernière visite », preuve de passage
// du planificateur, coupe-circuit, alertes de budget, mémoire professionnelle. Magasin en mémoire, horloge injectée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import { alerteBudget, centreActions, coupeCircuit, noterPassage, passages, prioriteDossier, reglerCoupeCircuit } from '../recette/server/pilotage.ts';
import { DEFAULT_MODELS, Finops, MAX_PREFERENCES, addPreference, answer, preferences, removePreference } from '../recette/server/assistant.ts';
import type { RenduView } from '../supabase/functions/_shared/rendus/view.ts';
import type { Context } from '../supabase/functions/_shared/intelligence/core.ts';
import { stack } from './helpers/recette.ts';

const NOW = '2026-11-25T10:00:00Z';
function vue(o: { echeances?: { date: string; title: string }[]; aConfirmer?: number; manque?: string; action?: string; owner?: string } = {}): RenduView {
  const dl = (e: { date: string; title: string }, i: number) => ({ key: `e${i}`, time: null, owner: 'client', nature: 'mentioned', source: null, reliability: 'haute', ...e });
  return {
    version: 1,
    tableau: { situation: 'Situation.', action: { label: o.action ?? '', owner: o.owner ?? 'client', owner_label: 'Vous', rationale: 'Pour avancer.', due_date: null, target: null }, next_date: null, cabinet: null, alerts: [] },
    resume: { facts: [], missing: o.manque ? [{ label: o.manque, why: 'Elle est citée dans un courrier.', kind: 'piece', source: null }] : [], amounts: [], contradictions: [], parties: [], details: '' },
    echeances: { confirmed: (o.echeances ?? []).map(dl), to_confirm: Array.from({ length: o.aConfirmer ?? 0 }, (_, i) => dl({ date: '2027-01-10', title: `À confirmer ${i}` }, i)), past: [], none_confirmed: false },
  } as unknown as RenduView;
}

test('priorité d’un dossier : une seule, la plus urgente ; rien à décider → null', () => {
  const now = new Date(NOW);
  const d = { id: 'd1', title: 'Bail' };
  assert.equal(prioriteDossier(d, null, now), null);
  assert.equal(prioriteDossier(d, vue(), now), null);
  const p = prioriteDossier(d, vue({ echeances: [{ date: '2026-12-20', title: 'Loin' }, { date: '2026-11-27', title: 'Réponse au bailleur' }], aConfirmer: 2, manque: 'Bail signé' }), now)!;
  assert.match(p.quoi, /Réponse au bailleur — 27\/11\/2026/);
  assert.equal(p.consequence, 'Échéance dans 2 jours.');
  assert.equal(p.rang, 2);
  assert.match(prioriteDossier(d, vue({ aConfirmer: 2, manque: 'Bail signé' }), now)!.quoi, /2 dates à confirmer/);
  assert.match(prioriteDossier(d, vue({ manque: 'Bail signé' }), now)!.quoi, /Bail signé/);
  assert.equal(prioriteDossier(d, vue({ action: 'Attendre la réponse', owner: 'tiers' }), now), null, 'une action qui n’est pas la vôtre n’est pas une priorité');
  // Une échéance déjà passée n'est pas présentée comme à venir.
  assert.equal(prioriteDossier(d, vue({ echeances: [{ date: '2026-11-20', title: 'Passée' }] }), now), null);
});

test('centre d’actions : trois priorités au plus, triées, isolées par compte ; dossiers clos exclus', async () => {
  const s = stack({ start: NOW });
  await s.user('a');
  await s.user('b');
  const jours = ['2026-11-30', '2026-11-26', '2026-11-28', '2026-11-27'];
  for (const [i, date] of jours.entries()) {
    await s.dossier(`a${i}`, 'a', { title: `Dossier ${i}` });
    await s.store.putView(`a${i}`, 1, vue({ echeances: [{ date, title: `Échéance ${i}` }] }), 'approved');
  }
  await s.dossier('clos', 'a', { title: 'Clos', closed: true });
  await s.store.putView('clos', 1, vue({ echeances: [{ date: '2026-11-25', title: 'Ne doit pas sortir' }] }), 'approved');
  await s.dossier('b0', 'b', { title: 'Dossier de B' });
  await s.store.putView('b0', 1, vue({ echeances: [{ date: '2026-11-25', title: 'Secret de B' }] }), 'approved');
  const c = await centreActions(s.store, 'a');
  assert.deepEqual(c.priorites.map((p) => p.dossier), ['a1', 'a3', 'a2']);
  assert.equal(c.autres, 1);
  assert.doesNotMatch(JSON.stringify(c), /Secret de B|Ne doit pas sortir/);
  assert.equal(c.depuis, null, 'première visite : pas de « depuis votre dernière visite »');
  assert.deepEqual(c.changements, []);
});

test('depuis la dernière visite : ce qui a changé sans vous, stable pendant la visite', async () => {
  const s = stack({ start: NOW });
  await s.user('a');
  await s.dossier('d', 'a', { title: 'Bail' });
  await centreActions(s.store, 'a'); // visite 1
  s.clock.advance(3_600_000);
  await s.store.addEvent('d', 'a', 'pieces_deposees', '2 pièces déposées'); // fait par le titulaire : pas une nouvelle
  await s.store.addEvent('d', 'a', 'resultats_disponibles', 'Résultats mis à jour (révision 2) : 3 documents');
  await s.store.notify('a', { subject: 'Bilan de vos dossiers', text: '…', link: '/compte' });
  s.clock.advance(3_600_000);
  const v2 = await centreActions(s.store, 'a');
  assert.equal(v2.depuis, new Date(NOW).toISOString());
  assert.deepEqual(v2.changements.map((x) => x.quoi), ['Résultats mis à jour (révision 2) : 3 documents']);
  assert.deepEqual(v2.accompli.map((x) => x.quoi), ['Bilan de vos dossiers']);
  s.clock.advance(60_000);
  assert.equal((await centreActions(s.store, 'a')).changements.length, 1, 'rechargement dans la même visite : même liste');
  s.clock.advance(2 * 3_600_000);
  assert.deepEqual((await centreActions(s.store, 'a')).changements, [], 'visite suivante : plus rien de nouveau');
});

test('planificateur : chaque passage laisse une preuve datée, les 30 dernières sont gardées', async () => {
  const s = stack({ start: NOW });
  assert.deepEqual(await passages(s.store), []);
  for (let i = 0; i < 32; i++) {
    await noterPassage(s.store, { executees: i, source: i % 2 ? 'planificateur' : 'manuel' });
    s.clock.advance(60_000);
  }
  const p = await passages(s.store);
  assert.equal(p.length, 30);
  assert.equal(p[0].executees, 31);
  assert.equal(p[0].source, 'planificateur');
});

test('coupe-circuit : ouvert par défaut, réglage journalisé, valeurs strictement booléennes', async () => {
  const s = stack({ start: NOW });
  assert.deepEqual(await coupeCircuit(s.store), { ia: false, automatisations: false, motif: null, at: null });
  const c = await reglerCoupeCircuit(s.store, { ia: true, automatisations: 'oui', motif: 'Coût anormal\u0007' });
  assert.equal(c.ia, true);
  assert.equal(c.automatisations, false);
  assert.equal(c.motif, 'Coût anormal');
  assert.equal((await coupeCircuit(s.store)).ia, true);
  assert.equal((await s.store.alerts())[0].code, 'COUPE_CIRCUIT');
});

test('budget IA : une alerte par palier et par mois, jamais en dessous de 70 %', async () => {
  const s = stack({ start: NOW });
  const f = new Finops(s.kv, s.clock.now, { globalUsd: 1, perUserUsd: 1 });
  assert.equal((await f.palier()).seuil, 'ok');
  assert.equal(await alerteBudget(s.store, await f.palier()), false);
  assert.ok(await f.reserve('a', 750_000));
  const p = await f.palier();
  assert.equal(p.seuil, '70');
  assert.equal(await alerteBudget(s.store, p), true);
  assert.equal(await alerteBudget(s.store, p), false, 'pas de doublon');
  await f.settle('a', 750_000, 950_000);
  assert.equal((await f.palier()).seuil, '90');
  assert.equal(await alerteBudget(s.store, await f.palier()), true);
  assert.deepEqual((await s.store.alerts()).map((a) => a.code), ['BUDGET_IA_90', 'BUDGET_IA_70']);
});

test('mémoire professionnelle : privée, bornée, supprimable, transmise au modèle comme préférence du titulaire', async () => {
  const s = stack({ start: NOW });
  const now = s.clock.now();
  assert.equal(await addPreference(s.kv, 'a', '   ', now), null);
  const p = (await addPreference(s.kv, 'a', 'Toujours vouvoyer\n mes interlocuteurs', now))!;
  assert.equal(p.text, 'Toujours vouvoyer mes interlocuteurs');
  assert.equal((await addPreference(s.kv, 'a', 'toujours vouvoyer mes interlocuteurs', now))!.id, p.id, 'pas de doublon');
  assert.deepEqual(await preferences(s.kv, 'b'), [], 'un autre compte ne voit rien');
  for (let i = 0; i < MAX_PREFERENCES + 3; i++) await addPreference(s.kv, 'a', `Règle ${i}`, now);
  assert.equal((await preferences(s.kv, 'a')).length, MAX_PREFERENCES);
  await removePreference(s.kv, 'a', p.id);
  assert.ok(!(await preferences(s.kv, 'a')).some((x) => x.id === p.id));

  let vu = '';
  const client = { messages: { create: async (req: { messages: Anthropic.MessageParam[] }) => {
    vu = JSON.stringify(req.messages);
    return { model: DEFAULT_MODELS.simple, stop_reason: 'end_turn', content: [{ type: 'text', text: 'Bien noté.' }], usage: { input_tokens: 10, output_tokens: 5 } };
  } } } as unknown as Anthropic;
  const ctx = { title: 'Bail', today: '2026-11-25', analysis: null, pieces: [], attention: null, available: [], processing: null, rights: { owner: true, assistant: true, automations: true } } as unknown as Context;
  const deps = { client, models: DEFAULT_MODELS, finops: new Finops(s.kv, s.clock.now, { globalUsd: 1, perUserUsd: 1 }), now: s.clock.now };
  const r = await answer(deps, 'a', 'Bonjour', ctx, [], { preferences: ['Signer « C. Roche »'] });
  assert.equal(r.mode, 'modele');
  assert.match(vu, /Mes préférences de travail : « Signer « C\. Roche » »/);
  await answer(deps, 'a', 'Bonjour', ctx, []);
  assert.doesNotMatch(vu, /préférences de travail/);
});
