/**
 * Porte MFA de la console /admin : messages d'erreur par cause réelle et
 * rendu du QR d'enrôlement. Un message générique masquant une cause précise
 * (TOTP désactivé côté Supabase, session expirée…) est une régression.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mfaErrorDetails, mfaErrorMessage, mfaQrSrc } from '../src/lib/mfa-errors';

test('TOTP désactivé côté Supabase : message actionnable (code GoTrue)', () => {
  const msg = mfaErrorMessage(
    { name: 'AuthApiError', code: 'mfa_totp_enroll_not_enabled', status: 422, message: 'MFA enroll is disabled for TOTP' },
    'bootstrap',
  );
  assert.match(msg, /Multi-Factor Authentication/);
  assert.match(msg, /dashboard Supabase/);
});

test('TOTP désactivé : repli sur le message quand GoTrue n’envoie pas de code', () => {
  const msg = mfaErrorMessage({ message: 'MFA enroll is disabled for TOTP' }, 'bootstrap');
  assert.match(msg, /Multi-Factor Authentication/);
});

test('session expirée ou absente : invite à se reconnecter', () => {
  for (const e of [
    { code: 'session_expired', message: 'Session expired' },
    { code: 'bad_jwt', message: 'invalid JWT' },
    { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
    { status: 401, message: 'no authorization' },
  ]) {
    assert.equal(mfaErrorMessage(e, 'bootstrap'), 'Votre session a expiré. Reconnectez-vous.');
  }
});

test('réseau indisponible : message réseau, pas de faux « code invalide »', () => {
  const attendu = /Impossible de contacter le service d'authentification/;
  assert.match(mfaErrorMessage({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }, 'verify'), attendu);
  assert.match(mfaErrorMessage(new TypeError('Failed to fetch'), 'bootstrap'), attendu);
});

test('trop de facteurs enregistrés : renvoi vers le nettoyage dashboard', () => {
  assert.match(mfaErrorMessage({ code: 'too_many_enrolled_mfa_factors' }, 'bootstrap'), /Factors/);
});

test('challenge/verify : code incorrect vs code expiré distingués', () => {
  assert.equal(
    mfaErrorMessage({ code: 'mfa_verification_failed', status: 422 }, 'verify'),
    "Code incorrect. Vérifiez votre application d'authentification.",
  );
  assert.match(mfaErrorMessage({ code: 'mfa_challenge_expired' }, 'verify'), /nouveau code/);
});

test('cause inconnue : messages génériques d’origine conservés', () => {
  assert.equal(mfaErrorMessage({}, 'bootstrap'), 'Vérification MFA impossible pour le moment. Réessayez.');
  assert.equal(mfaErrorMessage({}, 'verify'), 'Code invalide ou expiré. Réessayez.');
});

test('détails loggés : uniquement name/code/status/message, jamais d’autres champs', () => {
  const d = mfaErrorDetails({
    name: 'AuthApiError',
    code: 'mfa_verification_failed',
    status: 422,
    message: 'Invalid TOTP code entered',
    secret: 'NE-DOIT-JAMAIS-FUIR',
    stack: 'Error: …',
  });
  assert.deepEqual(d, {
    name: 'AuthApiError',
    code: 'mfa_verification_failed',
    status: 422,
    message: 'Invalid TOTP code entered',
  });
});

test('QR : le SVG brut préfixé par supabase-js ≥ 2 est ré-encodé (les # seraient un fragment d’URL)', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000"/></svg>';
  const out = mfaQrSrc(`data:image/svg+xml;utf-8,${svg}`);
  assert.ok(out.startsWith('data:image/svg+xml;utf8,%3Csvg'));
  assert.ok(!out.includes('#'));
  assert.equal(decodeURIComponent(out.replace('data:image/svg+xml;utf8,', '')), svg);
});

test('QR : SVG brut sans préfixe encodé aussi ; data-URI déjà encodé inchangé', () => {
  const svg = '<svg/>';
  assert.equal(mfaQrSrc(svg), `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  const encoded = 'data:image/svg+xml;utf8,%3Csvg%2F%3E';
  assert.equal(mfaQrSrc(encoded), encoded);
});
