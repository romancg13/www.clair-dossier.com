/**
 * Identité visuelle — l'application mobile doit reprendre EXACTEMENT les
 * couleurs de marque du site. Ce test lit `src/index.css` (bloc @theme, source
 * de vérité du web) et le compare aux jetons de `mobile/src/theme/tokens.ts`.
 * Toute dérive de charte est détectée avant la publication.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { palette } from '../src/theme/tokens';

const css = readFileSync(resolve(import.meta.dirname, '../../src/index.css'), 'utf8');

function cssVar(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  assert.ok(match, `variable CSS introuvable : --color-${name}`);
  return (match?.[1] ?? '').trim().toLowerCase();
}

test('couleurs de marque : mobile identique au site', () => {
  const pairs: [string, string][] = [
    ['navy-900', palette.navy900],
    ['navy-800', palette.navy800],
    ['navy-700', palette.navy700],
    ['navy-600', palette.navy600],
    ['gold-500', palette.gold500],
    ['gold-400', palette.gold400],
    ['gold-300', palette.gold300],
    ['gold-700', palette.gold700],
    ['cream-50', palette.cream50],
    ['cream-100', palette.cream100],
    ['cream-200', palette.cream200],
    ['ink', palette.ink],
    ['slate-500', palette.slate500],
    ['slate-400', palette.slate400],
    ['slate-300', palette.slate300],
  ];
  for (const [name, mobile] of pairs) {
    assert.equal(mobile.toLowerCase(), cssVar(name), `couleur divergente : ${name}`);
  }
});

test('typographie : mêmes familles de marque des deux côtés', () => {
  assert.match(css, /--font-display:\s*"Cormorant Garamond"/);
  assert.match(css, /--font-sans:\s*"Inter"/);
});
