/**
 * Cohérence du manifeste de routes (src/data/routes.ts) et de la carte des
 * redirections legacy — garde-fous du Lot 1.2 / 4.2.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { publicRoutes } from '../src/data/routes.ts';
import { LEGACY_FEATURE_SLUGS, features, getFeatureBySlug } from '../src/data/features.ts';

test('chemins uniques, absolus, sans barre oblique finale', () => {
  const paths = publicRoutes().map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length, 'doublon de route');
  for (const p of paths) {
    assert.ok(p.startsWith('/'), `${p} doit commencer par /`);
    if (p !== '/') assert.ok(!p.endsWith('/'), `${p} ne doit pas finir par /`);
  }
});

test('aucun slug legacy dans le manifeste (ils sont redirigés en 301)', () => {
  const paths = publicRoutes().map((r) => r.path);
  for (const legacy of Object.keys(LEGACY_FEATURE_SLUGS)) {
    assert.ok(
      !paths.includes(`/fonctionnalites/${legacy}`),
      `slug legacy ${legacy} présent dans le manifeste`
    );
  }
});

test('chaque redirection legacy cible un slug qui existe', () => {
  for (const [legacy, target] of Object.entries(LEGACY_FEATURE_SLUGS)) {
    assert.ok(getFeatureBySlug(target), `cible manquante pour ${legacy} → ${target}`);
    assert.ok(!getFeatureBySlug(legacy), `le slug legacy ${legacy} existe encore dans features`);
  }
});

test('les 9 fonctionnalités sont toutes dans le manifeste', () => {
  const paths = new Set(publicRoutes().map((r) => r.path));
  assert.equal(features.length, 9);
  for (const f of features) {
    assert.ok(paths.has(`/fonctionnalites/${f.slug}`), `route manquante pour ${f.slug}`);
  }
});

test('les routes privées ne sont jamais dans le manifeste public', () => {
  const paths = publicRoutes().map((r) => r.path);
  for (const prive of ['/compte', '/connexion', '/inscription', '/dossier/nouveau']) {
    assert.ok(!paths.includes(prive), `${prive} ne doit pas être pré-rendu ni listé au sitemap`);
  }
});
