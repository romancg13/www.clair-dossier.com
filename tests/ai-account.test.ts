import test from 'node:test';
import assert from 'node:assert/strict';
import { aiAccountError, parseAiAccount, shouldAskAiConsent, type AiAccountStatus } from '../src/lib/ai-account-model.ts';

const base: AiAccountStatus = { enabled: false, termsVersion: null, acceptedAt: null, gateAllows: true, eligible: true };

test('acceptation : proposée seulement si ouverte, éligible, non acceptée et non reportée', () => {
  assert.equal(shouldAskAiConsent(base, false), true);
  assert.equal(shouldAskAiConsent({ ...base, gateAllows: false }, false), false, 'interrupteur fermé');
  assert.equal(shouldAskAiConsent({ ...base, eligible: false }, false), false, 'sans abonnement');
  assert.equal(shouldAskAiConsent({ ...base, enabled: true }, false), false, 'déjà acceptée');
  assert.equal(shouldAskAiConsent(base, true), false, '« Plus tard »');
  assert.equal(shouldAskAiConsent(null, false), false, 'migration absente');
});

test('lecture de my_ai_account : ligne, tableau, vide', () => {
  const row = { enabled: true, terms_version: 'ia-2026-11', accepted_at: '2026-11-28T18:00:00Z', gate_allows: true, eligible: true };
  assert.deepEqual(parseAiAccount([row]), { enabled: true, termsVersion: 'ia-2026-11', acceptedAt: '2026-11-28T18:00:00Z', gateAllows: true, eligible: true });
  assert.equal(parseAiAccount(row)?.enabled, true);
  assert.equal(parseAiAccount([]), null);
  assert.equal(parseAiAccount(null), null);
  assert.equal(parseAiAccount([{ enabled: null, terms_version: null, accepted_at: null, gate_allows: null, eligible: null }])?.gateAllows, false);
});

test('messages d’erreur : codes serveur traduits, reste générique', () => {
  assert.match(aiAccountError('ERROR: ANALYSE_FERMEE'), /pas encore ouverte/);
  assert.match(aiAccountError('AUTH_REQUIRED'), /Connectez-vous/);
  assert.match(aiAccountError('boom'), /n'a pas abouti/);
});
