import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { features } from '../src/data/features';
import { plans } from '../src/data/pricing';

/**
 * public/llms.txt (écrit à la main) et les versions Markdown de l'accueil
 * (public/index.md, public/page.md, générées par scripts/gen-markdown.ts) sont
 * ce que lisent les moteurs d'IA. Ils ne doivent présenter comme disponible
 * aucune fonction exclue par les CGV (lecture ou analyse des pièces) ni classée
 * « prévue » dans src/data/product-status.ts, ni une conformité non revendiquée
 * (docs/ARBITRAGES_JURIDIQUES_2026-09-18.md, point 5).
 */
const read = (file: string) => readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf-8');
const llms = read('llms.txt');
const GEO_FILES = ['llms.txt', 'index.md', 'page.md'];

const NOT_DELIVERED: RegExp[] = [
  /résumé IA/i,
  /rédaction IA/i,
  /IA complète/i,
  /réponse automatisée/i,
  /projets? de réponse/i,
  /relances?( automatiques)? à échéance/i,
  /l['’]IA prépare/i,
  /préavis juridique/i,
  /avocat inscrit au barreau/i,
  /OVH/i,
  /conforme RGPD/i,
];

test('llms.txt et Markdown de l’accueil : aucune fonction non livrée présentée comme disponible', () => {
  for (const file of GEO_FILES) {
    const body = read(file);
    for (const claim of NOT_DELIVERED) {
      assert.doesNotMatch(body, claim, `${file} : ${claim}`);
    }
  }
});

test('llms.txt : engagement de non-lecture repris des CGV', () => {
  assert.match(llms, /aucune lecture, extraction ou analyse automatique/i);
});

test('llms.txt : la validation par un professionnel du droit est annoncée comme prévue, pas comme disponible', () => {
  const lines = llms.split('\n').filter((l) => /validation (juridique|[^.]*?par un (avocat|professionnel du droit))/i.test(l));
  assert.ok(lines.length > 0, 'mention de la validation introuvable');
  for (const line of lines) assert.match(line, /prévue/i, line);
});

test('llms.txt : fonctionnalités alignées sur src/data/features.ts', () => {
  const line = llms.split('\n').find((l) => l.startsWith('- /fonctionnalites/<slug>'));
  assert.ok(line, 'ligne /fonctionnalites/<slug> introuvable');
  const listed = (/\(([^)]+)\)/.exec(line)?.[1] ?? '').split(',').map((s) => s.trim());
  assert.deepEqual([...listed].sort(), features.map((f) => f.slug).sort());
});

test('llms.txt : formules, prix et plafonds alignés sur src/data/pricing.ts', () => {
  const lines = llms.split('\n');
  for (const p of plans) {
    const line = lines.find((l) => l.startsWith(`- ${p.name} :`));
    assert.ok(line, `formule absente : ${p.name}`);
    if (p.priceMonthly === null) {
      assert.match(line, /sur devis/i, p.name);
      continue;
    }
    assert.ok(line.includes(`${p.priceMonthly} €/mois`), `${p.name} : prix`);
    const lower = line.toLowerCase();
    assert.ok(lower.includes(p.specs.dossiers.toLowerCase()), `${p.name} : dossiers`);
    assert.ok(lower.includes(p.specs.users.toLowerCase()), `${p.name} : utilisateurs`);
  }
});
