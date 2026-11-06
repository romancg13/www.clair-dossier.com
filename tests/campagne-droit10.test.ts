/**
 * Campagne partenaire DROIT10_2026 (src/data/campagnes.ts) :
 *  - bornes exactes, en heure de Paris, intervalle [début, fin) ;
 *  - destination du CTA : formulaire ClairNova, HTTPS, sans donnée personnelle ;
 *  - reconstruction planifiée du HTML prérendu aux deux bornes (deploy.yml).
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { DROIT10, campagneActive } from '../src/data/campagnes.ts';

const START = Date.parse(DROIT10.startsAt);
const END = Date.parse(DROIT10.endsAt);
const paris = (t: number) => new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });

test('lancement anticipé le 06/11/2026 13 h (Paris), déjà passé ; fin FIXE au 09/11/2027 13 h', () => {
  assert.equal(DROIT10.startsAt, '2026-11-06T12:00:00Z');
  assert.equal(paris(START), '06/11/2026 13:00');
  assert.ok(START <= Date.now(), 'la date de lancement ne doit pas être dans le futur');
  assert.equal(DROIT10.endsAt, '2027-11-09T12:00:00Z', 'la date de fin ne change jamais');
  assert.equal(paris(END), '09/11/2027 13:00');
  // L'ancien début (09/11/2026 13 h) est désormais dans la période.
  assert.equal(campagneActive(DROIT10, Date.parse('2026-11-09T12:00:00Z')), true);
});

test('affichage : masqué avant, visible pendant, masqué dès la fin', () => {
  assert.equal(campagneActive(DROIT10, START - 1), false);
  assert.equal(campagneActive(DROIT10, START), true);
  assert.equal(campagneActive(DROIT10, new Date('2027-05-01T00:00:00Z')), true);
  assert.equal(campagneActive(DROIT10, END - 1), true);
  assert.equal(campagneActive(DROIT10, END), false);
});

test('le CTA renvoie directement au formulaire ClairNova, sans donnée personnelle', () => {
  const url = new URL(DROIT10.url);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.host, 'clairnova.fr');
  assert.equal(url.pathname, '/contact');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['projet', 'utm_campaign', 'utm_source']);
  assert.equal(url.searchParams.get('projet'), 'site');
  assert.equal(url.searchParams.get('utm_campaign'), DROIT10.id);
  assert.equal(url.searchParams.get('utm_source'), 'clairdossier');
});

test('deploy.yml reconstruit le site aux deux bornes (9 novembre, 12:05 UTC)', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /schedule:\n\s+- cron: '5 12 9 11 \*'/);
});
