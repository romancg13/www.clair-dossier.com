import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blogPosts } from '../src/data/blog';
import { features } from '../src/data/features';
import { plans } from '../src/data/pricing';
import { PRODUCT_STATUS_UPDATED } from '../src/data/product-status';
import { TRUST_UPDATED } from '../src/data/trust';

/**
 * public/llms.txt est écrit à la main : il n'est PAS régénéré par
 * scripts/gen-markdown.ts. Il a déjà dérivé une fois du produit réel
 * (hébergeur, certifications et fonctions d'IA jamais prouvés, oubliés lors
 * de la purge de securite.md). Ces tests le raccrochent aux sources de vérité.
 */
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const llms = readFileSync(join(PUBLIC_DIR, 'llms.txt'), 'utf-8');

/** Affirmations retirées faute de preuve dans le dépôt — ne doivent pas revenir sans justification. */
const UNPROVEN_CLAIMS: RegExp[] = [
  /OVH/i,
  /AES-?256/i,
  /\bHDS\b/,
  /ISO[ -]?27001/i,
  /pentest/i,
  /\bRPO\b/,
  /\bRTO\b/,
  /GPT-\d/i,
  /TLS 1\.3/i,
  /HSTS preload/i,
];

/** Fichiers texte décrivant le produit, servis tels quels (le Journal, éditorial, est exclu). */
function productTextFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'blog' ? [] : productTextFiles(full);
    return /\.(md|txt)$/.test(entry.name) ? [full] : [];
  });
}

test('llms.txt et .md publics : aucune affirmation de sécurité ou d’IA non prouvée', () => {
  const files = productTextFiles(PUBLIC_DIR);
  assert.ok(files.length > 10, 'fichiers publics introuvables');
  for (const file of files) {
    const body = readFileSync(file, 'utf-8');
    for (const claim of UNPROVEN_CLAIMS) {
      assert.doesNotMatch(body, claim, `${relative(PUBLIC_DIR, file)} : affirmation non prouvée ${claim}`);
    }
  }
});

test('llms.txt : engagement « aucune lecture automatique » repris des CGV', () => {
  assert.match(llms, /aucune lecture, extraction ou analyse automatique/i);
});

test('llms.txt : fonctionnalités alignées sur src/data/features.ts', () => {
  const line = llms.split('\n').find((l) => l.startsWith('- /fonctionnalites/<slug>'));
  assert.ok(line, 'ligne /fonctionnalites/<slug> introuvable');
  const listed = (/\(([^)]+)\)/.exec(line)?.[1] ?? '').split(',').map((s) => s.trim());
  assert.deepEqual([...listed].sort(), features.map((f) => f.slug).sort());
  assert.ok(llms.includes(`Index des ${features.length} fonctionnalités`));
  assert.ok(llms.includes(`(${features.length} fonctionnalités)`));
});

test('llms.txt : articles alignés sur le Journal publié', () => {
  const listed = [...llms.matchAll(/https:\/\/www\.clair-dossier\.com\/blog\/([a-z0-9-]+)/g)]
    .map((m) => m[1])
    .filter((slug) => slug !== 'index');
  assert.deepEqual([...new Set(listed)].sort(), blogPosts.map((p) => p.slug).sort());
  assert.ok(llms.includes(`${blogPosts.length} articles disponibles`));
  assert.ok(llms.includes(`(${blogPosts.length} articles)`));
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

test('llms.txt : sections datées relues à chaque évolution des sources de vérité', () => {
  assert.ok(
    llms.includes(`## État du produit (mis à jour le ${PRODUCT_STATUS_UPDATED})`),
    'src/data/product-status.ts a évolué : relire la section « État du produit » de public/llms.txt, puis y reporter la date'
  );
  assert.ok(
    llms.includes(`## Sécurité et conformité (mis à jour le ${TRUST_UPDATED})`),
    'src/data/trust.ts a évolué : relire la section « Sécurité et conformité » de public/llms.txt, puis y reporter la date'
  );
});
