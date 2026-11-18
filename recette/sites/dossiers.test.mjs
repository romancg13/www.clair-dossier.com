import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';

const root = fileURLToPath(new URL('.', import.meta.url));
const origin = 'https://clairdossier-recette-atelier-20261118.j-gomes346249.chatgpt.site';

function d1(sql) {
  return {
    prepare(source) {
      const stmt = sql.prepare(source);
      return {
        bind(...args) {
          const execute = () => ({ results: stmt.all(...args) });
          return { first: () => stmt.get(...args) ?? null, run: execute, all: execute };
        },
      };
    },
    batch(statements) {
      sql.exec('BEGIN');
      try {
        const results = statements.map((statement) => statement.all());
        sql.exec('COMMIT');
        return results;
      } catch (err) {
        sql.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

test('profils, pièces et liens par révision, reset et rejeu sans service externe', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dossiers-clairdossier-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  execFileSync(process.execPath, [join(root, 'build.mjs'), dir]);
  const { default: worker } = await import(pathToFileURL(join(dir, 'index.js')));
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  const db = d1(sql),
    env = { DB: db };
  for (const file of (await readdir(join(root, 'drizzle'))).filter((f) => f.endsWith('.sql')).sort())
    sql.exec(await readFile(join(root, 'drizzle', file), 'utf8'));
  const background = [];
  const ctx = { waitUntil: (p) => background.push(p) };
  async function settle() {
    await Promise.all(background.splice(0));
  }
  t.after(async () => {
    await settle();
    sql.close();
  });
  function browser() {
    let cookie = '';
    const request = async (path, data, headers = {}, kind = 'application/json') => {
      const req = new Request(origin + path, {
        method: data === undefined ? 'GET' : 'POST',
        headers: { Origin: origin, 'Content-Type': kind, Cookie: cookie, ...headers },
        body: data === undefined ? null : kind === 'application/json' ? JSON.stringify(data) : data,
      });
      const result = await worker.fetch(req, env, ctx);
      if (result.headers.get('set-cookie')) cookie = result.headers.get('set-cookie').split(';')[0];
      return result;
    };
    const state = async () => {
      const response = await request('/api/dossier');
      assert.equal(response.status, 200);
      return response.json();
    };
    return {
      request,
      state,
      choose: async (persona) => {
        const response = await request('/api/session', { persona });
        assert.ok(response.ok);
        return state();
      },
    };
  }
  const client = browser(),
    stranger = browser();
  assert.equal((await client.request('/api/reset', { persona: 'a', dossier: 'inconnu' })).status, 401);
  const a = await client.choose('a');
  const upload = async (viewer, fixture) =>
    Buffer.from(await (await viewer.request(fixture.url)).arrayBuffer()).toString('base64');
  const deposit = async (dossier, uploads) => client.request('/api/depot', { dossier, uploads });
  const aFiles = await Promise.all(a.fixtures.map((f) => upload(client, f)));
  assert.equal((await deposit(a.dossierId, aFiles)).status, 202);
  await settle();
  const aDone = (await client.state()).run;
  assert.equal(aDone.publishedRevision, 1);
  const b = await client.choose('b');
  assert.deepEqual(b.fixtures.map((f) => f.id).sort(), ['devis-b', 'reception-b']);
  assert.equal((await deposit(b.dossierId, [aFiles[0]])).status, 422);
  assert.equal(
    (await deposit(b.dossierId, await Promise.all(b.fixtures.map((f) => upload(client, f))))).status,
    202,
  );
  await settle();
  const bDone = (await client.state()).run;
  assert.equal(bDone.publishedRevision, 1);
  assert.equal(bDone.extractedDate, '2026-12-15');
  const c = await client.choose('c');
  assert.deepEqual(c.fixtures.map((f) => f.id).sort(), ['don', 'inventaire', 'quai', 'tournee']);
  const source = Object.fromEntries(
    await Promise.all(c.fixtures.map(async (f) => [f.id, await upload(client, f)])),
  );
  assert.equal((await deposit(c.dossierId, [source.don, source.don])).status, 202);
  await settle();
  const first = (await client.state()).run;
  assert.equal(first.publishedRevision, 1);
  assert.deepEqual(first.inputs, ['don']);
  assert.equal(first.extractedDate, null);
  assert.equal((await deposit(c.dossierId, [source.don])).status, 409);
  assert.equal((await deposit(c.dossierId, [source.inventaire, source.tournee, source.quai])).status, 202);
  await settle();
  const full = (await client.state()).run;
  assert.equal(full.id, c.dossierId);
  assert.equal(full.publishedRevision, 2);
  assert.equal(full.notifications, 2);
  assert.equal(full.extractedDate, '2026-11-19');
  assert.equal(full.hasInitialPack, false);
  assert.match(full.summary, /144/);
  const pack = unzipSync(new Uint8Array(await (await client.request(full.packHref)).arrayBuffer()));
  assert.deepEqual(full.files.map((f) => f.name).sort(), Object.keys(pack).sort());
  for (const f of full.files) {
    const reply = await client.request(f.href);
    assert.equal(reply.status, 200, f.name);
    assert.equal(reply.headers.get('content-type'), f.mime);
    assert.deepEqual(Buffer.from(await reply.arrayBuffer()), Buffer.from(pack[f.name]));
  }
  const listing = '/api/fichiers?dossier=' + c.dossierId + '&revision=1';
  assert.deepEqual((await (await client.request(listing)).json()).files, first.files);
  assert.equal(
    (await client.request('/api/fichier?dossier=' + c.dossierId + '&name=absent.docx&revision=1')).status,
    404,
  );
  await stranger.choose('c');
  assert.equal((await stranger.request(full.packHref)).status, 404);
  const account = { 'oai-authenticated-user-id': 'test-local-sans-jeton' };
  const consentPath = '/recette/connexion-chatgpt';
  const consent = () =>
    client.request(
      consentPath,
      'action=allow&dossier=' + c.dossierId,
      account,
      'application/x-www-form-urlencoded',
    );
  assert.equal((await consent()).status, 200);
  const mcp = async () =>
    (
      await (
        await client.request(
          '/mcp',
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'lire_etat_dossier', arguments: {} },
          },
          account,
        )
      ).json()
    ).result;
  assert.equal((await mcp()).structuredContent.revision_livree, 2);
  const correction = await client.request('/api/correction', {
    dossier: c.dossierId,
    revision: 2,
    date: '2026-11-20',
    reason: 'Décalage de la réception fictive',
  });
  assert.equal(correction.status, 202);
  await settle();
  const corrected = (await client.state()).run;
  assert.equal(corrected.date, '2026-11-20');
  assert.equal(corrected.extractedDate, '2026-11-19');
  assert.equal(corrected.corrections[0].revision, 3);
  const service = await client.request('/api/services', { dossier: c.dossierId, kind: 'justificatifs' });
  assert.equal(service.status, 200);
  assert.ok((await service.json()).services.some(s => s.kind === 'justificatifs'));
  const resetData = { dossier: c.dossierId, persona: 'c' };
  const resets = await Promise.all([
    client.request('/api/reset', resetData),
    client.request('/api/reset', resetData),
  ]);
  assert.deepEqual((await Promise.all(resets.map((x) => x.json()))).map((x) => x.reset).sort(), [
    false,
    true,
  ]);
  let clean = await client.state();
  assert.equal(clean.run, null);
  assert.notEqual(clean.dossierId, c.dossierId);
  assert.equal((await mcp()).isError, true);
  assert.equal((await consent()).status, 403);
  for (const table of ['run_inputs', 'deliveries', 'lot_events', 'service_drafts', 'connector_grants'])
    assert.equal(sql.prepare('SELECT count(*) n FROM ' + table + ' WHERE run_id=?').get(c.dossierId).n, 0);
  assert.equal((await deposit(c.dossierId, [source.don])).status, 409);
  assert.equal((await client.request('/api/depot', { uploads: [source.don] })).status, 409);
  // A late claim already running at reset time must not publish, even after the replacement reaches the same revision.
  const discarded = clean.dossierId;
  assert.equal((await deposit(discarded, [source.quai])).status, 202);
  sql.prepare('UPDATE runs SET due=0 WHERE id=?').run(discarded);
  const workerTasks = [];
  await worker.scheduled({}, env, { waitUntil: (p) => workerTasks.push(p) });
  assert.equal(sql.prepare('SELECT status FROM runs WHERE id=?').get(discarded).status, 'processing');
  assert.equal((await client.request('/api/reset', { dossier: discarded, persona: 'c' })).status, 200);
  clean = await client.state();
  assert.equal((await deposit(clean.dossierId, [source.don])).status, 202);
  await Promise.all(workerTasks);
  await settle();
  const replay = (await client.state()).run;
  assert.equal(replay.publishedRevision, 1);
  assert.equal(replay.id, clean.dossierId);
  assert.equal((await client.request(full.packHref)).status, 404);
  assert.equal((await client.request(first.files[0].href)).status, 404);
  assert.equal((await client.request(first.pdfHref)).status, 404);
  assert.equal((await client.request('/api/livraison.pdf?revision=1')).status, 404);
  assert.equal((await client.request(listing)).status, 404);
  assert.equal((await client.request(replay.files[0].href)).status, 200);
  assert.equal((await (await client.request('/api/reset', resetData)).json()).reset, false);
  assert.equal((await client.state()).run.id, replay.id);
  assert.equal(sql.prepare('SELECT count(*) n FROM deliveries WHERE run_id=?').get(discarded).n, 0);
  assert.equal((await client.choose('a')).run.id, aDone.id);
  assert.equal((await client.request(aDone.initialPackHref)).status, 200);
  assert.equal((await client.choose('b')).run.id, bDone.id);
  const veteran = browser();
  const oldA = await veteran.choose('a');
  const owner = sql
    .prepare('SELECT sandbox FROM dossier_slots WHERE dossier_id=?')
    .get(oldA.dossierId).sandbox;
  const oldId = crypto.randomUUID();
  sql
    .prepare(
      "INSERT INTO runs(id,sandbox,persona,status,submitted,due,input_pdf,input_scan) VALUES(?,?,'b','queued',0,0,?,zeroblob(0))",
    )
    .run(oldId, owner, Buffer.from(aFiles[0], 'base64'));
  const oldB = await veteran.choose('b');
  assert.equal(oldB.dossierId, oldId);
  assert.equal(oldB.scenario.id, 'atelier');
  assert.deepEqual(
    oldB.fixtures.map((f) => f.id),
    ['devis', 'scan'],
  );
  await settle();
  assert.equal((await veteran.state()).run.publishedRevision, 1);
  assert.equal((await veteran.request('/api/depot', { uploads: [aFiles[1]], dossier: oldId })).status, 202);
  await settle();
  const historical = (await veteran.state()).run;
  assert.ok(historical.hasInitialPack);
  assert.equal(historical.publishedRevision, 2);
  const originalLink = '/api/livraison.pdf?revision=1';
  assert.equal((await veteran.request(originalLink)).status, 200);
  assert.equal((await veteran.request('/api/reset', { dossier: oldId, persona: 'b' })).status, 200);
  const migrated = await veteran.state();
  assert.equal(migrated.scenario.id, 'b');
  assert.equal((await veteran.request(originalLink)).status, 404);
  await client.choose('sans');
  assert.equal((await client.request('/api/reset', resetData)).status, 402);
});
