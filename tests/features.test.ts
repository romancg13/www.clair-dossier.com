import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_GROUPS, features } from '../src/data/features';

const SLUGS = [
  'creation-guidee', 'depot-de-pieces', 'chronologie', 'transmission-validee', 'suivi-statuts',
  'espace-securise', 'donnees-protegees', 'calendrier-relances', 'recapitulatif-transmission',
];

test('fonctionnalités : les neuf fiches et leurs URL sont préservées', () => {
  assert.deepEqual(features.map((f) => f.slug).sort(), [...SLUGS].sort());
});

test('fonctionnalités : 4 groupes, chaque fiche dans exactement un groupe', () => {
  assert.equal(FEATURE_GROUPS.length, 4);
  const ids = new Set(FEATURE_GROUPS.map((g) => g.id));
  for (const f of features) assert.ok(ids.has(f.group), f.slug);
});

test('fonctionnalités : aucune capacité inventée dans les textes publics', () => {
  const text = JSON.stringify(features).toLowerCase();
  for (const banned of ['signature électronique', 'relance automatique', "l'ia analyse", 'analyse ia', 'conseil automatisé']) {
    assert.ok(!text.includes(banned), banned);
  }
});
