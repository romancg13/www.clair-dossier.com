// Garde anti-régression du moteur : le corpus fictif de référence doit rester lu au moins aussi bien.
// Lecture par règles uniquement (aucun appel de modèle) ; l'évaluation par modèle se lance à la main (npm run ia:evaluation).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluer } from '../scripts/ia-evaluation.ts';

test('corpus de référence : exactitude, citations, aucun faux positif, consigne piégée neutralisée, coût nul', async () => {
  const r = await evaluer();
  assert.deepEqual(r.manquants, [], 'tous les éléments de référence sont retrouvés');
  assert.equal(r.exactitude, 1);
  assert.equal(r.citations, 1, 'chaque fait, montant et jalon renvoie à une pièce');
  assert.deepEqual(r.faux_positifs, [], 'aucune partie inventée');
  assert.equal(r.injection_neutralisee, true);
  assert.equal(r.cout_centimes, 0, 'aucun appel payant en lecture par règles');
});
