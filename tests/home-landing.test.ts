/**
 * Garde-fous de la home cinématique (Phase 4) :
 *  - le flag de repli se lit sans ambiguïté ;
 *  - les données de démonstration restent fictives, étiquetées, et ne mettent
 *    en scène que des libellés RÉELS du produit (X.5 « No fake functionality »).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { readFlag } from '../src/lib/flag-parse.ts';
import {
  BUSINESS_STEPS,
  DEMO,
  DEMO_LABEL,
  DEMO_TIMELINE,
  SCATTERED_DOCS,
  TUNNEL_STEPS,
} from '../src/components/landing/demo-dossier.ts';
import { statuses } from '../src/data/statuses.ts';
import { TIMELINE_STEPS } from '../packages/core/src/dossiers.ts';

test('readFlag : défaut, désactivation explicite, activation', () => {
  assert.equal(readFlag(undefined, true), true);
  assert.equal(readFlag(undefined, false), false);
  assert.equal(readFlag('', true), true);
  for (const off of ['0', 'false', 'FALSE', 'off', 'no', ' no ']) {
    assert.equal(readFlag(off, true), false, `« ${off} » doit désactiver`);
  }
  for (const on of ['1', 'true', 'on', 'yes', 'anything']) {
    assert.equal(readFlag(on, false), true, `« ${on} » doit activer`);
  }
});

test('la démonstration est étiquetée comme telle', () => {
  assert.equal(DEMO.label, DEMO_LABEL);
  assert.match(DEMO_LABEL, /démonstration/i);
});

test('les étapes mises en scène sont celles du produit (packages/core / DossierFlow)', () => {
  assert.equal(BUSINESS_STEPS, TIMELINE_STEPS, 'même référence : aucune dérive possible');
  assert.deepEqual([...BUSINESS_STEPS], ['Dossier créé', 'Traitement en cours', 'Documents disponibles', 'Dossier clôturé']);
  assert.deepEqual([...TUNNEL_STEPS], ['Profil', 'Nature', 'Informations', 'Pièces', 'Récapitulatif']);
  assert.ok(DEMO.step >= 1 && DEMO.step <= BUSINESS_STEPS.length);
});

test('la frise couvre exactement les quatre étapes du suivi, dans l’ordre', () => {
  assert.equal(DEMO_TIMELINE.length, BUSINESS_STEPS.length);
  DEMO_TIMELINE.forEach((e, i) => assert.equal(e.step, i + 1));
  assert.ok(statuses.some((s) => s.label === DEMO.status), 'le statut de démo doit exister');
});

test('aucune capacité non opérationnelle n’est mise en scène', () => {
  const text = JSON.stringify({ DEMO, SCATTERED_DOCS, DEMO_TIMELINE }).toLowerCase();
  for (const forbidden of ['rappel envoyé', 'analyse ia', 'extrait automatiquement', 'ocr', 'détecté par l']) {
    assert.ok(!text.includes(forbidden), `mention interdite : « ${forbidden} »`);
  }
  assert.ok(DEMO.fields.length === 5, 'cinq champs réels du tunnel');
});

test('calendrier de démonstration cohérent (octobre 2026 commence un jeudi)', () => {
  const d = new Date(`${DEMO.deadline.iso}T00:00:00Z`);
  assert.equal(d.getUTCDate(), DEMO.deadline.day);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  // getUTCDay : 0 = dimanche → décalage lundi = 0
  assert.equal((first.getUTCDay() + 6) % 7, DEMO.deadline.firstWeekday);
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  assert.equal(days, DEMO.deadline.daysInMonth);
});
