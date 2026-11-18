// Vérifie la recette HTTPS dans un nouveau bac fictif et ne conserve aucun cookie.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { unzipSync, strFromU8 } from 'fflate';

const [preview, commit, persona = 'a'] = process.argv.slice(2);
const scenarios = {
  a: { files: ['devis.pdf', 'scan.png'], date: '20261208' },
  b: { files: ['devis-b.pdf', 'reception-b.png'] },
  c: { files: ['don.pdf', 'inventaire.pdf', 'tournee.pdf', 'quai.png'], date: '20261119' },
};
const portail = 'https://clairdossier-recette-atelier-20261118.j-gomes346249.chatgpt.site';
if (!Object.hasOwn(scenarios, persona) || !/^https:\/\/clairdossier-demo-[a-z0-9-]+\.vercel\.app$/.test(preview ?? '') || !/^[a-f0-9]{40}$/.test(commit ?? '')) {
  throw Error('Usage : node recette/verifier-public.mjs <origine de preview Vercel> <SHA complet> [a|b|c]');
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
const scenario = scenarios[persona];
const uploads = await Promise.all(scenario.files.map(async name =>
  (await readFile(new URL('./fixtures/' + name, import.meta.url))).toString('base64')));
assert.ok((await call('/api/session', { persona })).ok);
async function state() {
  const response = await call('/api/dossier');
  assert.equal(response.status, 200);
  return response.json();
}
const initial = await state();
assert.equal(initial.run, null);
const dossier = initial.dossierId;
assert.ok(dossier);
assert.equal((await call('/api/depot', { uploads, dossier })).status, 202);
// Aucune requête de ce client pendant le traitement.
await delay(20000);
const reopened = Date.now();
const { run } = await state();
assert.equal(run.status, 'published');
assert.ok(run.publishedAt < reopened, 'Le travail doit avoir fini avant cette lecture.');
assert.equal(run.notifications, 1);
assert.deepEqual(new Set(Object.keys(run.extraction)), new Set(scenario.files.map(f => f.split('.')[0])));
for (const file of scenario.files) {
  assert.equal(run.extraction[file.split('.')[0]].method, file.endsWith('.png') ? 'tesseract-wasm-eng' : 'pdf-text');
}
const zip = await call(run.packHref);
assert.equal(zip.status, 200);
const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
assert.equal(Object.keys(files).length, run.fileCount);
assert.ok(run.fileCount >= 6);
const calendar = Object.entries(files).find(([name]) => name.endsWith('.ics'));
assert.ok(calendar && strFromU8(calendar[1]).includes('BEGIN:VEVENT'));
if (scenario.date) assert.ok(strFromU8(calendar[1]).includes(scenario.date));
for (const item of run.deliverables) {
  const response = await call(item.href);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), files[item.name]);
}
assert.equal((await call('/api/depot', {uploads,dossier})).status, 409);
assert.ok((await call('/api/session', {persona: persona === 'b' ? 'a' : 'b'})).ok);
assert.equal((await state()).run, null);
assert.ok(!(await call(run.packHref)).ok);
assert.ok((await call('/api/session', {persona})).ok);
assert.equal((await state()).dossierId, dossier);
assert.ok((await call('/api/reset', {persona, dossier})).ok);
const empty = await state();
assert.equal(empty.run, null);
assert.notEqual(empty.dossierId, dossier);
assert.ok(!(await call(run.packHref)).ok);
console.log(JSON.stringify({
  commit, persona, pieces:uploads.length, fichiers:run.fileCount, notifications:run.notifications,
  traitementMs:run.publishedAt-run.submittedAt, publicationAvantReouvertureMs:reopened-run.publishedAt,
  extraction:Object.fromEntries(Object.entries(run.extraction).map(([id,entry])=>[id,entry.method])),
  doublon:'refusé', autreCompte:'vide', remiseAZero:'vérifiée', interventionsAdmin:0,
}, null, 2));
