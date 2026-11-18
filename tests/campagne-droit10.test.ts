/**
 * Campagne partenaire DROIT10_2026 (src/data/campagnes.ts) :
 *  - bornes exactes, en heure de Paris, intervalle [début, fin) — lancement anticipé le 06/11/2026, fin fixe ;
 *  - destination du CTA : formulaire ClairNova, HTTPS, sans donnée personnelle ;
 *  - fin de campagne : garde avant premier rendu (index.html + src/index.css), cron de reconstruction
 *    (deploy.yml) et filet de sécurité quotidien (surveillance.yml) — toutes les copies de la date de fin
 *    doivent être identiques à DROIT10.endsAt.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { DROIT10, campagneActive } from '../src/data/campagnes.ts';

const START = Date.parse(DROIT10.startsAt);
const END = Date.parse(DROIT10.endsAt);
const paris = (t: number) => new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

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

test('fin de campagne : garde avant premier rendu, indépendante de tout cron', () => {
  const html = read('../index.html');
  assert.ok(html.includes(`<script>if(Date.now()>=Date.parse("${DROIT10.endsAt}"))document.documentElement.setAttribute("data-droit10","fini")</script>`));
  assert.match(read('../src/index.css'), /html\[data-droit10="fini"\] \[data-campagne="DROIT10_2026"\] \{\n\s+display: none !important;/);
  assert.match(read('../src/components/landing/OffreClairNova.tsx'), /data-campagne=\{DROIT10\.id\}/);
});

test('deploy.yml reconstruit le site le 9 novembre à 12:05 UTC (fin : 2027)', () => {
  assert.match(read('../.github/workflows/deploy.yml'), /schedule:\n\s+- cron: '5 12 9 11 \*'/);
});

test('surveillance.yml relance deploy.yml après la fin, même si un contrôle précédent échoue', () => {
  const workflow = read('../.github/workflows/surveillance.yml');
  assert.match(workflow, /actions: write/);
  assert.ok(workflow.includes(`date -u -d ${DROIT10.endsAt} +%s`));
  assert.match(workflow, /Expiration DROIT10_2026[^\n]*\n\s+if: always\(\)/);
  assert.match(workflow, /grep -q 'offre-clairnova-titre'/);
  assert.match(workflow, /gh workflow run deploy\.yml --ref main/);
});

test('le bandeau est rendu une seule fois, sous la navigation et avant la Hero (pas de doublon en bas)', () => {
  const home = read('../src/components/landing/HomeCinematic.tsx');
  assert.ok(home.indexOf('<OffreClairNova />') < home.indexOf('<HeroCinematic />'), 'bandeau avant la Hero');
  assert.equal(home.match(/<OffreClairNova \/>/g)?.length, 1);
  assert.doesNotMatch(read('../src/components/landing/FinalCinematic.tsx'), /OffreClairNova/);
  const bandeau = read('../src/components/landing/OffreClairNova.tsx');
  assert.match(bandeau, /En profiter/);
  assert.doesNotMatch(bandeau, /fixed|sticky/);
});
