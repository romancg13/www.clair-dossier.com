import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPARISON_FEATURES, plans } from '../src/data/pricing';

/**
 * La grille de /tarifs décrit ce que chaque formule donne réellement. Le code ne
 * restreint qu'une chose par formule : le nombre de dossiers
 * (packages/core/src/entitlements.ts, checkDossierQuota). Chaque fonction de la
 * grille est opérationnelle pour tout compte (src/data/product-status.ts) : la
 * marquer « limité » ou « ✗ » sur une formule contredit le produit livré.
 */
test('grille /tarifs : aucune fonction opérationnelle affichée absente ou limitée', () => {
  for (const plan of plans) {
    for (const feat of COMPARISON_FEATURES) {
      assert.equal(plan.features[feat.id], 'yes', `${plan.name} : « ${feat.label} »`);
    }
  }
});

test('grille /tarifs : public/tarifs.md régénéré depuis la grille', () => {
  const md = readFileSync(new URL('../public/tarifs.md', import.meta.url), 'utf-8');
  for (const feat of COMPARISON_FEATURES) {
    for (const status of ['✗', 'limité']) {
      assert.ok(!md.includes(`${feat.label} : ${status}`), `${feat.label} : ${status}`);
    }
  }
});
