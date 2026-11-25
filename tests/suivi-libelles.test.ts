// Garde de production : sans lecture automatique (aucune progression fournie), le suivi ne parle jamais d'« analyse ».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('suivi : « Analyse en cours » exige une progression réelle ; DossierDetail n’annonce les six documents que moteur actif', () => {
  const tracker = readFileSync(new URL('../src/components/dossier/DossierTracker.tsx', import.meta.url), 'utf8');
  assert.match(tracker, /step === 2 && progress\s*\?/);
  assert.match(tracker, /step === 3 && progress/);
  const detail = readFileSync(new URL('../src/pages/DossierDetail.tsx', import.meta.url), 'utf8');
  assert.match(detail, /catalogHint=\{AI_ENGINE\}/);
  // L'espace client réel ne passe pas de progression au suivi tant que le moteur n'est pas en service.
  const usage = detail.slice(detail.indexOf('<DossierTracker'), detail.indexOf('/>', detail.indexOf('<DossierTracker')));
  assert.ok(!/progress=/.test(usage), usage);
});
