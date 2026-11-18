// Vérifie la recette HTTPS dans un nouveau bac fictif et ne conserve aucun cookie.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { unzipSync, strFromU8 } from 'fflate';

const [preview, commit] = process.argv.slice(2);
const portail = 'https://clairdossier-recette-atelier-20261118.j-gomes346249.chatgpt.site';
if (!/^https:\/\/clairdossier-demo-[a-z0-9-]+\.vercel\.app$/.test(preview ?? '') || !/^[a-f0-9]{40}$/.test(commit ?? '')) {
  throw Error('Usage : node recette/verifier-public.mjs <origine de preview Vercel> <SHA complet>');
}
let session;
async function call(path, payload) {
  const headers = { Accept: 'application/json' };
  if (session) headers.Cookie = session;
  if (payload) Object.assign(headers, { Origin: portail, 'Content-Type': 'application/json' });
  const response = await fetch(portail + path, {
    method: payload ? 'POST' : 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(20000),
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const cookie = response.headers.getSetCookie().find(c => c.startsWith('__Host-cd_essai='));
  if (cookie) session = cookie.split(';')[0];
  return response;
}

for (const origin of [preview, portail]) {
  const version = await fetch(origin + '/version.json', { redirect: 'error' });
  assert.equal(version.status, 200);
  assert.equal((await version.json()).commit, commit);
}
const uploads = await Promise.all(['devis.pdf','scan.png'].map(async name =>
  (await readFile(new URL('./fixtures/' + name, import.meta.url))).toString('base64')));
assert.equal((await call('/api/session', {persona:'a'})).status, 201);
assert.equal((await call('/api/depot', {uploads})).status, 202);
// Aucun rafraîchissement pendant le traitement, même si le résultat arrive plus tôt.
await delay(15000);
const reopened = Date.now();
const response = await call('/api/dossier');
assert.equal(response.status, 200);
const {run} = await response.json();
assert.equal(run.status, 'published');
assert.ok(run.publishedAt < reopened, 'Le travail doit avoir fini avant cette lecture.');
assert.equal(run.notifications, 1);
assert.equal(run.extraction.scan.method, 'tesseract-wasm-eng');
assert.equal(run.extraction.devis.method, 'pdf-text');
assert.equal(run.fileCount, 13);
const zip = await call('/api/livraison.zip');
assert.equal(zip.status, 200);
const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
assert.equal(Object.keys(files).length, 13);
const calendar = Object.keys(files).find(name => name.endsWith('.ics'));
assert.ok(calendar && strFromU8(files[calendar]).includes('20261208'));
assert.equal((await call('/api/depot', {uploads})).status, 409);
assert.ok((await call('/api/session', {persona:'b'})).ok);
assert.equal((await call('/api/dossier').then(r => r.json())).run, null);
console.log(JSON.stringify({
  commit, pieces:2, fichiers:13, notifications:1, traitementMs:run.publishedAt-run.submittedAt,
  publicationAvantReouvertureMs:reopened-run.publishedAt, pdf:'pdf-text', scan:'tesseract-wasm-eng',
  doublon:'refusé', secondCompte:'vide', interventionsAdmin:0,
}, null, 2));
