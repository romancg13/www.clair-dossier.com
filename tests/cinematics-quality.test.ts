/**
 * Tiers de qualité 3D (Phase 4b) — règles testées sans navigateur.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { classify, dprFor, type DeviceSignals } from '../src/components/landing/cinematics/quality/DeviceTier.ts';
import { budgetFor } from '../src/components/landing/cinematics/quality/QualityManager.ts';
import { damp, expoOut, power4Out, segment } from '../src/components/landing/cinematics/hooks/useProgressRef.ts';

const base: DeviceSignals = {
  reducedMotion: false,
  saveData: false,
  webgl2: true,
  cores: 8,
  memoryGb: 8,
  coarsePointer: false,
  width: 1440,
  dpr: 2,
  ios: false,
  renderer: 'Apple M2',
};

test('motion réduite, économie de données ou absence de WebGL2 → fallback, quel que soit le matériel', () => {
  assert.equal(classify({ ...base, reducedMotion: true }), 'fallback');
  assert.equal(classify({ ...base, saveData: true }), 'fallback');
  assert.equal(classify({ ...base, webgl2: false }), 'fallback');
  assert.equal(classify({ ...base, renderer: 'Google SwiftShader' }), 'fallback');
});

test('desktop puissant → high ; desktop moyen → medium ; mobile récent → medium ; mobile contraint → low ou fallback', () => {
  assert.equal(classify(base), 'high');
  assert.equal(classify({ ...base, cores: 4, memoryGb: 4 }), 'medium');
  // iPhone récent (Safari : 4 cœurs déclarés, mémoire inconnue) : composition allégée, pas d'exclusion.
  assert.equal(classify({ ...base, cores: 4, memoryGb: null, coarsePointer: true, width: 390, ios: true }), 'low');
  assert.equal(classify({ ...base, cores: 6, memoryGb: 4, coarsePointer: true, width: 390, ios: true }), 'medium');
  // Android ancien, 2 cœurs, mémoire inconnue : minimal.
  assert.equal(classify({ ...base, cores: 2, memoryGb: null, coarsePointer: true, width: 412 }), 'low');
  // Réellement contraint : repli.
  assert.equal(classify({ ...base, cores: 2, memoryGb: 1, coarsePointer: true, width: 360 }), 'fallback');
  assert.equal(classify({ ...base, cores: 2, memoryGb: null, coarsePointer: true, width: 360 }), 'fallback');
});

test('un pointeur grossier (mobile/tablette) ne peut jamais donner high', () => {
  assert.notEqual(classify({ ...base, coarsePointer: true }), 'high');
});

test('DPR plafonné par tier et jamais en dessous de 0,75', () => {
  assert.equal(dprFor('high', 3), 1.5);
  assert.equal(dprFor('medium', 2), 1.25);
  assert.equal(dprFor('low', 2), 1);
  assert.equal(dprFor('high', 0.5), 0.75);
});

test('budgets monotones et fallback à zéro', () => {
  const h = budgetFor('high');
  const m = budgetFor('medium');
  const l = budgetFor('low');
  const f = budgetFor('fallback');
  assert.ok(h.sheets >= m.sheets && m.sheets >= l.sheets && l.sheets >= f.sheets);
  assert.equal(f.sheets, 0);
  assert.equal(f.points, 0);
});

test('utilitaires de progression : bornes et easings', () => {
  assert.equal(segment(0.5, 0.25, 0.75), 0.5);
  assert.equal(segment(0.1, 0.25, 0.75), 0);
  assert.equal(segment(0.9, 0.25, 0.75), 1);
  assert.equal(expoOut(1), 1);
  assert.ok(expoOut(0.5) > 0.9);
  assert.equal(power4Out(1), 1);
  const d = damp(0, 10, 4, 0.5);
  assert.ok(d > 8 && d < 10, `damp devrait approcher la cible sans la dépasser (${d})`);
});
