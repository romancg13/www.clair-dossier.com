import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { NEW_DOSSIER_PATH, newDossierHref } from '../src/lib/cta.ts';

test('« Créer un dossier » : connecté → tunnel, visiteur → inscription puis tunnel', () => {
  assert.equal(newDossierHref(true), NEW_DOSSIER_PATH);
  const href = newDossierHref(false);
  const url = new URL(href, 'https://www.clair-dossier.com');
  assert.equal(url.pathname, '/inscription');
  // Signup.tsx lit `next` puis navigate(next) : il doit retomber exactement sur le tunnel.
  assert.equal(url.searchParams.get('next'), NEW_DOSSIER_PATH);
});
