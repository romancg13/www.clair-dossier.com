import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { appShellRoutes } from '../scripts/prerender.ts';
import { publicRoutes } from '../src/data/routes.ts';
import { isPrivatePath } from '../src/lib/seo.tsx';

test('coquilles d’application : routes privées uniquement, jamais une page publique', () => {
  const shells = appShellRoutes({});
  const publics = new Set(publicRoutes().map((r) => r.path));
  assert.deepEqual(shells, ['/inscription', '/connexion', '/compte', '/dossier/nouveau', '/admin']);
  for (const path of shells) {
    assert.ok(isPrivatePath(path), `${path} doit rester privée (noindex à l'exécution)`);
    assert.ok(!publics.has(path), `${path} ne doit pas être une route publique prérendue`);
  }
});

test('/demo n’existe que dans un build VITE_DEMO=1', () => {
  assert.ok(!appShellRoutes({}).includes('/demo'));
  assert.ok(appShellRoutes({ VITE_DEMO: '1' }).includes('/demo'));
});
