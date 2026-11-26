// Formules du calculateur privé de rentabilité (aucun tarif n'est modifié par ce script).
import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error module JavaScript sans déclarations
import { marge, prixMinimal, seuilRentabilite } from '../scripts/rentabilite.mjs';

test('marge directe, prix minimal pour 70 %, seuil de rentabilité', () => {
  assert.equal(marge(100, 30), 0.7);
  assert.ok(marge(19, 25) < 0, 'un coût supérieur au prix donne une marge négative');
  assert.equal(Math.round(prixMinimal(6) * 100) / 100, 20, 'coûts / 0,30');
  assert.equal(Math.round(marge(prixMinimal(6), 6) * 100), 70);
  assert.equal(seuilRentabilite(250, 50), 5);
  assert.equal(seuilRentabilite(251, 50), 6, 'arrondi au client supérieur');
  assert.equal(seuilRentabilite(250, 0), Infinity, 'contribution nulle : jamais rentable');
});
