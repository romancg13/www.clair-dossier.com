import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INBOUND_ACCEPTED_EXTENSIONS,
  INBOUND_MAX_BYTES,
  acceptAttachment,
  inboundLocalParts,
  sanitizeInboundName,
  verifySvixSignature,
} from '../supabase/functions/_shared/inbound-email.ts';
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, sanitizeFileName } from '../packages/core/src/index';

test('réception e-mail : règles d’acceptation identiques au dépôt manuel (packages/core)', () => {
  assert.deepEqual(INBOUND_ACCEPTED_EXTENSIONS, ACCEPTED_EXTENSIONS);
  assert.equal(INBOUND_MAX_BYTES, MAX_FILE_BYTES);
  for (const n of ['Facture mars 2026 (copie).pdf', 'été@travaux.PNG', 'a'.repeat(200) + '.pdf']) {
    assert.equal(sanitizeInboundName(n), sanitizeFileName(n), n);
  }
});

test('réception e-mail : pièces jointes acceptées ou refusées avec un motif lisible', () => {
  assert.equal(acceptAttachment({ filename: 'Facture.pdf', size: 1024 }), null);
  assert.equal(acceptAttachment({ filename: 'photo.JPG', size: 1024 }), null);
  assert.equal(acceptAttachment({ filename: 'Relevé.pdf' }), null, 'taille inconnue : contrôlée après téléchargement');
  assert.match(acceptAttachment({ filename: 'script.exe', size: 10 })!, /format non accepté/);
  assert.match(acceptAttachment({ filename: 'gros.pdf', size: INBOUND_MAX_BYTES + 1 })!, /volumineux/);
  assert.match(acceptAttachment({ filename: 'vide.pdf', size: 0 })!, /vide/);
  assert.match(acceptAttachment({ filename: '' })!, /sans nom/);
  assert.match(acceptAttachment({ filename: 'sans-extension' })!, /format non accepté/);
});

test('réception e-mail : routage par destinataire enregistré, jamais par expéditeur', () => {
  const dom = 'recoit.clair-dossier.com';
  const local = 'd-' + 'ab12'.repeat(8);
  assert.deepEqual(inboundLocalParts([`${local}@${dom}`], dom), [local]);
  assert.deepEqual(
    inboundLocalParts([`Mon Dossier <${local.toUpperCase()}@${dom.toUpperCase()}>`], dom),
    [local],
    'casse et nom d’affichage ignorés',
  );
  assert.deepEqual(inboundLocalParts([`${local}@autre-domaine.fr`], dom), [], 'autre domaine : ignoré');
  assert.deepEqual(inboundLocalParts([`contact@${dom}`], dom), [], 'partie locale hors format : ignorée');
  assert.deepEqual(inboundLocalParts([null, undefined, '', 'sans-arobase'], dom), []);
  assert.deepEqual(
    inboundLocalParts([`${local}@${dom}`, `a <${local}@${dom}>`], dom),
    [local],
    'dédoublonné',
  );
  assert.deepEqual(inboundLocalParts([`${local}@${dom}`], ''), [], 'domaine non configuré : rien');
});

async function sign(secretB64: string, id: string, ts: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  let bin = '';
  for (const b of mac) bin += String.fromCharCode(b);
  return btoa(bin);
}

test('réception e-mail : signature Svix vérifiée, anti-rejeu par horodatage', async () => {
  const secretB64 = btoa('secret-de-test-32-octets-exactement!!');
  const secret = `whsec_${secretB64}`;
  const body = '{"type":"email.received","data":{"email_id":"re_1"}}';
  const id = 'msg_123';
  const nowMs = 1_760_000_000_000;
  const ts = String(Math.floor(nowMs / 1000));
  const good = await sign(secretB64, id, ts, body);

  assert.equal(
    await verifySvixSignature({ secret, id, timestamp: ts, signature: `v1,${good}`, body, nowMs }),
    true,
  );
  assert.equal(
    await verifySvixSignature({ secret, id, timestamp: ts, signature: `v1a,autre v1,${good}`, body, nowMs }),
    true,
    'plusieurs signatures : la bonne suffit',
  );
  assert.equal(
    await verifySvixSignature({ secret, id, timestamp: ts, signature: `v1,${good}`, body: body + ' ', nowMs }),
    false,
    'corps modifié : refusé',
  );
  assert.equal(
    await verifySvixSignature({ secret: `whsec_${btoa('autre-secret')}`, id, timestamp: ts, signature: `v1,${good}`, body, nowMs }),
    false,
    'mauvais secret : refusé',
  );
  const staleTs = String(Math.floor(nowMs / 1000) - 600);
  const staleSig = await sign(secretB64, id, staleTs, body);
  assert.equal(
    await verifySvixSignature({ secret, id, timestamp: staleTs, signature: `v1,${staleSig}`, body, nowMs }),
    false,
    'horodatage de plus de 5 minutes : rejeu refusé',
  );
  assert.equal(
    await verifySvixSignature({ secret, id: null, timestamp: ts, signature: `v1,${good}`, body, nowMs }),
    false,
    'en-tête manquant : refusé',
  );
  assert.equal(
    await verifySvixSignature({ secret: '', id, timestamp: ts, signature: `v1,${good}`, body, nowMs }),
    false,
    'secret absent : refusé',
  );
});
