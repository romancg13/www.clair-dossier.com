import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './store.mjs';
import { startServer } from './server.mjs';
import { extractFixture } from './fixtures.mjs';

const link = (kind, id) => kind + '/' + id;
function dbPath(t) {
  const directory = mkdtempSync(join(tmpdir(), 'cd-worker-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, 'recette.sqlite');
}
function client(store, persona = 'a', previous) {
  return store.startSession(previous, persona, false);
}
const delivered = (store, s) => store.state(s, link).dossier;
const status = (store, s) => delivered(store, s).jobStatus;
const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

test('Un lot survit au redémarrage, le serveur extrait le texte et le scan et publie sans session cliente', async (t) => {
  const path = dbPath(t);
  const original = openStore(path);
  const { session, token } = client(original);
  original.addLot(session, { fixtures: ['devis', 'scan'], objective: 'Préparer la réception' });
  original.db.close();
  const resumed = openStore(path);
  t.after(() => resumed.db.close());
  await resumed.tick();
  const d = delivered(resumed, resumed.session(token));
  assert.equal(d.jobStatus, 'ready');
  assert.equal(d.revision, 1);
  assert.equal(d.objective, 'Préparer la réception');
  assert.equal(d.objects.length, 2);
  assert.equal(d.analysis.deadlines[0].date, '2026-12-08');
  assert.equal(d.analysis.reminder_drafts.length, 1);
  assert.equal(d.events.length, 2);
  assert.equal(d.notifications.length, 1);
  assert.equal(d.jobs[0].attempts, 1);
  assert.ok(d.files.some((f) => f.key === 'resume' && f.name.endsWith('.pdf')));
  assert.ok(d.analysis.facts.some((f) => f.evidence[0].quote.includes('pas de signature')));
});

test('Déduplication, correction conservée, anciennes versions et notifications par lot', async (t) => {
  const store = openStore(dbPath(t));
  t.after(() => store.db.close());
  const { session } = client(store);
  store.addLot(session, { fixtures: ['devis', 'scan'] });
  await store.tick();
  const first = delivered(store, session);
  const event = first.events[0];
  store.correct(session, { key: event.key, date: '2026-11-11', reason: 'Vérifié sur le devis corrigé.' });
  await store.tick();
  let d = delivered(store, session);
  assert.equal(d.events.find((e) => e.key === event.key).retained_date, '2026-11-11');
  assert.deepEqual(
    new Set(d.files.filter((f) => f.revision === 2).map((f) => f.key)),
    new Set(['dates', 'chronologie']),
  );
  assert.equal(d.notifications.length, 1);
  assert.equal(d.overrides.length, 1);
  assert.ok(d.historyFiles.length > 0);
  assert.deepEqual(store.addLot(session, { fixtures: ['avenant', 'avenant', 'devis'] }), {
    added: 1,
    duplicates: 2,
  });
  await store.tick();
  d = delivered(store, session);
  assert.equal(d.analysis.deadlines[0].date, '2026-12-15');
  assert.equal(d.overrides.length, 1);
  assert.equal(d.events.find((e) => e.key === event.key).retained_date, '2026-11-11');
  assert.equal(d.notifications.length, 2);
  assert.deepEqual(store.addLot(session, { fixtures: ['avenant'] }), { added: 0, duplicates: 1 });
  assert.equal(delivered(store, session).revision, 3);
});

test('Traitement partiel, dates contradictoires, manuel hors catalogue', async (t) => {
  const store = openStore(dbPath(t));
  t.after(() => store.db.close());
  const { session } = client(store);
  store.addLot(session, { fixtures: ['devis', 'contradiction', 'illisible', 'incompatible', 'manuel'] });
  await store.tick();
  const d = delivered(store, session);
  assert.equal(d.jobStatus, 'partial');
  assert.ok(d.files.some((f) => f.key === 'autres'));
  assert.equal(d.analysis.contradictions[0].evidence.length, 2);
  assert.ok(d.analysis.missing_items.some((m) => m.why.includes('illisible')));
  assert.ok(d.analysis.missing_items.some((m) => m.why.includes('non pris en charge')));
  const ics = store.get(
    "SELECT bytes FROM files WHERE dossier_id=? AND name LIKE '%.ics'",
    session.dossierId,
  );
  assert.doesNotMatch(Buffer.from(ics?.bytes ?? []).toString('utf8'), /BEGIN:VEVENT/);
});

test('Lot de 179 pièces distinctes, même empreinte rejouée et révision unique', async (t) => {
  const store = openStore(dbPath(t));
  t.after(() => store.db.close());
  const { session } = client(store);
  assert.deepEqual(store.addLot(session, { fixtures: ['volume', 'devis', 'scan'] }), {
    added: 181,
    duplicates: 0,
  });
  assert.deepEqual(store.addLot(session, { fixtures: ['volume'] }), { added: 0, duplicates: 179 });
  await store.tick();
  const d = delivered(store, session);
  assert.equal(d.events.length, 181);
  assert.equal(d.jobStatus, 'ready');
  assert.equal(d.notifications.length, 1);
});

test('Reprise bornée et concurrence pendant clôture ou extinction du droit', async (t) => {
  const store = openStore(dbPath(t));
  t.after(() => store.db.close());
  const { session } = client(store);
  store.addLot(session, { fixtures: ['scan'] });
  await store.tick(async () => {
    throw Error('arrêt de lecture simulé');
  });
  assert.equal(status(store, session), 'queued');
  store.run('UPDATE jobs SET next_at=0');
  await store.tick();
  assert.equal(delivered(store, session).jobs[0].attempts, 2);
  const published = delivered(store, session).formattedAt;
  store.addLot(session, { fixtures: ['devis'] });
  let entered, release;
  const barrier = new Promise((ok) => {
    entered = ok;
  });
  const blocked = new Promise((ok) => {
    release = ok;
  });
  const work = store.tick(async (f) => {
    entered();
    await blocked;
    return extractFixture(f);
  });
  await barrier;
  assert.equal(await store.tick(), false);
  store.close(session, true);
  release();
  await work;
  assert.equal(status(store, session), 'closed');
  assert.equal(delivered(store, session).formattedAt, published);
  store.close(session, false);
  await store.tick(async (f) => {
    const r = await extractFixture(f);
    store.run('UPDATE accounts SET ends=0 WHERE id=?', session.accountId);
    return r;
  });
  assert.equal(
    store.get('SELECT published_at FROM dossiers WHERE id=?', session.dossierId).published_at,
    published,
  );
  assert.equal(delivered(store, session).files.length, 0);
});

test('Dossiers sensibles et erreurs répétées restent hors publication automatique', async (t) => {
  const store = openStore(dbPath(t));
  t.after(() => store.db.close());
  const sensitive = client(store, 'sensible');
  store.addLot(sensitive.session, { fixtures: ['devis'] });
  await store.tick();
  assert.equal(status(store, sensitive.session), 'review');
  assert.equal(delivered(store, sensitive.session).files.length, 0);
  assert.throws(() => store.approval(sensitive.session), { status: 403 });
  const admin = store.startSession(sensitive.token, 'admin', true);
  store.approval(admin.session);
  await store.tick();
  assert.equal(status(store, sensitive.session), 'ready');
  const b = client(store, 'b', admin.token);
  store.addLot(b.session, { fixtures: ['devis'] });
  for (let i = 0; i < 3; i++) {
    store.run('UPDATE jobs SET next_at=0');
    await store.tick(async () => {
      throw Error('indisponible');
    });
  }
  assert.equal(status(store, b.session), 'failed');
  assert.equal(await store.tick(), false);
  assert.equal(delivered(store, b.session).notifications.length, 0);
});

test('API de recette : authentification, offres fictives, originaux autorisés, A/B, expiration des liens et déconnexion', async (t) => {
  const server = await startServer({ dbPath: dbPath(t), port: 0, intervalMs: 30 });
  t.after(() => server.shutdown());
  const base = 'http://127.0.0.1:' + server.address.port;
  let cookie = '';
  const api = async (path, body, headers = {}) => {
    const r = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get('Set-Cookie')) cookie = r.headers.get('Set-Cookie').split(';')[0];
    return r;
  };
  const path = '/api/recette';
  assert.equal((await api(path + '/lots', { fixtures: ['devis'] })).status, 401);
  assert.equal((await api(path + '/session', { persona: 'admin' })).status, 403);
  for (const persona of ['sans-abonnement', 'refuse', 'incomplet', 'expire']) {
    const s = await (await api(path + '/session', { persona })).json();
    assert.equal(s.subscribed, false);
    assert.equal((await api(path + '/lots', { fixtures: ['devis'] })).status, 402);
    assert.equal(server.store.get('SELECT COUNT(*) n FROM objects').n, 0);
  }
  for (const persona of ['renouvele', 'resilie-a-terme', 'a']) {
    assert.equal((await (await api(path + '/session', { persona })).json()).subscribed, true);
  }
  assert.equal(
    (await api(path + '/lots', { uploads: [Buffer.from('fichier hors corpus').toString('base64')] })).status,
    422,
  );
  assert.equal(
    (await api(path + '/lots', { fixtures: ['devis'] }, { Origin: 'https://exemple.invalid' })).status,
    403,
  );
  const bytes = await (await api(path + '/fixtures/devis')).arrayBuffer();
  const answer = await (
    await api(path + '/lots', { uploads: [Buffer.from(bytes).toString('base64')], fixtures: ['scan'] })
  ).json();
  assert.equal(answer.dossier.objects.length, 2);
  let d = answer.dossier;
  for (let i = 0; i < 200 && ['queued', 'processing'].includes(d.jobStatus); i++) {
    await wait(40);
    d = (await (await api(path + '/state')).json()).dossier;
  }
  assert.equal(d.jobStatus, 'ready');
  const signed = d.files.find((f) => f.name.endsWith('.pdf')).href;
  assert.equal((await api(signed)).status, 200);
  assert.match((await api(signed + '&inline=1')).headers.get('Content-Disposition'), /^inline/);
  const expired = new URL(signed, base);
  expired.searchParams.set('expires', String(Date.now() - 1));
  assert.equal((await api(expired.pathname + expired.search)).status, 403);
  // Advance only the validation clock. The original signed URL and cookie stay intact.
  const wallClock = Date.now;
  try {
    Date.now = () => wallClock() + 6 * 60 * 1000;
    assert.equal((await api(signed)).status, 403);
  } finally {
    Date.now = wallClock;
  }
  const oldCookie = cookie;
  const other = (await (await api(path + '/session', { persona: 'b' })).json()).dossier;
  assert.equal(other.objects.length, 0);
  assert.equal((await api(signed)).status, 403);
  assert.equal((await api(signed, undefined, { cookie: oldCookie })).status, 401);
  await api(path + '/logout', {});
  assert.equal((await api(path + '/state')).status, 401);
});

test('La boîte fictive de récupération restitue le bon dossier avec une confirmation à usage unique', async (t) => {
  const store = openStore(dbPath(t));
  t.after(() => store.db.close());
  const a = client(store);
  const b = client(store);
  const receipt = store.requestRecovery(a.mailbox, 'a');
  assert.throws(() => store.confirmRecovery(b.mailbox, receipt), { status: 410 });
  store.logout(a.token);
  assert.equal(store.session(a.token), null);
  const recovered = store.confirmRecovery(a.mailbox, receipt);
  assert.equal(recovered.session.dossierId, a.session.dossierId);
  assert.equal(recovered.session.role, 'client');
  assert.throws(() => store.confirmRecovery(a.mailbox, receipt), { status: 410 });
  assert.throws(() => store.requestRecovery(recovered.mailbox, 'admin'), { status: 410 });
  const expired = store.requestRecovery(recovered.mailbox, 'a');
  store.run('UPDATE mailboxes SET expires=0 WHERE demo_id=?', a.session.demoId);
  assert.throws(() => store.confirmRecovery(recovered.mailbox, expired), { status: 410 });
});

test('Capacité publique : la file et les BLOB sont bornés, un lot refusé ne laisse aucune pièce', async (t) => {
  const store = openStore(dbPath(t), { maxQueued: 1, maxDemoBytes: 20 * 1024 });
  t.after(() => store.db.close());
  const a = client(store),
    b = client(store);
  store.addLot(a.session, { fixtures: ['devis', 'scan'] });
  assert.throws(() => store.addLot(b.session, { fixtures: ['devis'] }), { status: 429 });
  assert.equal(delivered(store, b.session).objects.length, 0);
  assert.equal(delivered(store, b.session).revision, 0);
  const pages = store.get('PRAGMA max_page_count').max_page_count,
    size = store.get('PRAGMA page_size').page_size;
  assert.equal(pages * size, 128 * 1024 * 1024);
  await store.tick();
  assert.equal(status(store, a.session), 'failed');
  assert.equal(delivered(store, a.session).files.length, 0);
  assert.equal(delivered(store, a.session).notifications.length, 0);
  assert.deepEqual(store.readConnectorStatus(a.session).anomalies, ['STORAGE_LIMIT']);
  assert.equal(delivered(store, a.session).jobs[0].attempts, 1);
  const a2 = client(store, 'b', a.token);
  assert.throws(() => store.addLot(a2.session, { fixtures: ['scan'] }), { status: 429 });
  assert.equal(delivered(store, a2.session).objects.length, 0);
  assert.deepEqual(store.addLot(b.session, { fixtures: ['devis'] }), { added: 1, duplicates: 0 });
});
