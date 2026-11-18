import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mock } from 'node:test';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import handler from '../api/extraction.mjs';
import empreintes from './fixtures/empreintes.json' with {type:'json'};
import { FOOD_FIXTURES } from './sites/collecte.mjs';
import { B_FIXTURES } from './sites/chantier-b.mjs';

const revision = '1'.repeat(40);
const path = (fixture) => '/api/extraction?fixture=' + fixture + '&revision=' + revision;

async function invoke(url, method = 'GET') {
  const response = {
    headers: {}, code: null, payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    end() {},
    json(data) { this.payload = data; },
  };
  await handler({ method, url }, response);
  return response;
}

test('extraction du corpus A, B et collecte en lecture seule, sans réseau', async () => {
  const previousEnv = process.env.VERCEL_ENV;
  const previousRevision = process.env.VERCEL_GIT_COMMIT_SHA;
  const calls = [];
  const deny = () => { calls.push(true); throw new Error('Accès réseau interdit'); };
  mock.method(globalThis, 'fetch', deny);
  mock.method(http, 'request', deny);
  mock.method(https, 'request', deny);
  mock.method(net.Socket.prototype, 'connect', deny);
  try {
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_GIT_COMMIT_SHA = revision;
    assert.equal((await invoke(path('scan'))).code, 404);
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await invoke(path('scan'), 'POST')).code, 405);
    assert.equal((await invoke(path('autre'))).code, 400);
    assert.equal((await invoke(path('scan') + '&extra=1')).code, 400);
    assert.equal((await invoke(path('scan').replace(revision, '2'.repeat(40)))).code, 409);
    const [scan, pdf] = await Promise.all([invoke(path('scan')), invoke(path('devis'))]);
    for (const res of [scan, pdf]) {
      assert.equal(res.code, 200);
      assert.equal(res.payload.revision, revision);
      assert.equal(res.headers['Vercel-CDN-Cache-Control'], 'public, s-maxage=86400');
    }
    assert.equal(scan.payload.method, 'tesseract-wasm-eng');
    assert.equal(scan.payload.lines.length, 4);
    assert.ok(scan.payload.lines.includes('Le bon ne porte pas de signature.'));
    assert.equal(pdf.payload.method, 'pdf-text');
    assert.equal(pdf.payload.lines.length, 7);
    assert.ok(pdf.payload.lines.some(line => line.includes('08/12/2026')));
    assert.deepEqual((await invoke(path('scan'))).payload, scan.payload);
    for (const [id,spec] of Object.entries({...B_FIXTURES,...FOOD_FIXTURES})) {
      const response = await invoke(path(id));
      assert.equal(response.code,200,id);
      const {sha256,method,lines} = response.payload;
      assert.equal(sha256,empreintes[id],id);
      assert.equal(method,spec.name.endsWith('.png')?'tesseract-wasm-eng':'pdf-text',id);
      for (const line of spec.lines) assert.ok(lines.includes(line),id+' : '+line);
      assert.ok(lines.some(line=>line.toLowerCase().includes('ficti')),id);
    }
    assert.equal(new Set(Object.values(empreintes)).size,8);
    assert.deepEqual(calls, []);
  } finally {
    mock.restoreAll();
    if (previousEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnv;
    if (previousRevision === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previousRevision;
  }
});
