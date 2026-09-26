/**
 * Formats d'affichage — français, sans dépendance native (exécutables par
 * node:test). Les fonctions qui touchent au natif (fichiers, caméra,
 * notifications) sont vérifiées par le bundle de production et sur appareil.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDueDate, formatRelative, formatShortDate, initials } from '../src/lib/format';

test('dates : format français, heure optionnelle', () => {
  assert.equal(formatDate('2026-09-16T08:30:00Z').includes('septembre'), true);
  assert.match(formatDate('2026-09-16T08:30:00Z', true), /à \d{2}:\d{2}/);
  assert.equal(formatDate('pas-une-date'), 'pas-une-date');
  assert.match(formatShortDate('2026-09-16T08:30:00Z'), /16/);
});

test('échéance : date en toutes lettres, entrée invalide renvoyée telle quelle', () => {
  assert.match(formatDueDate('2026-09-16'), /septembre/);
  assert.equal(formatDueDate('16/09/2026'), '16/09/2026');
});

test('temps relatif : paliers minute / heure / jour', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  assert.equal(formatRelative('2026-09-16T11:59:40Z', now), "à l'instant");
  assert.equal(formatRelative('2026-09-16T11:30:00Z', now), 'il y a 30 min');
  assert.equal(formatRelative('2026-09-16T09:00:00Z', now), 'il y a 3 h');
  assert.equal(formatRelative('2026-09-14T12:00:00Z', now), 'il y a 2 j');
});

test('initiales : deux lettres maximum, repli sur la marque', () => {
  assert.equal(initials('Camille Martin'), 'CM');
  assert.equal(initials('SARL Dupont et Fils'), 'SD');
  assert.equal(initials(null), 'CD');
  assert.equal(initials('   '), 'CD');
});
