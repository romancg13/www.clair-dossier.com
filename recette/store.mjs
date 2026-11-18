import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { applyOverrides } from '../supabase/functions/_shared/analysis-model.ts';
import { buildDeliverables } from '../supabase/functions/_shared/deliverables.ts';
import {
  fixtures,
  selectable,
  volume,
  volumeDocuments,
  hash,
  extractFixture,
  analyze,
  categoryInputs,
} from './fixtures.mjs';

const DAY = 86_400_000;
const MiB = 1024 * 1024;
const DATABASE_LIMIT = 128 * MiB;
const RESERVED_SPACE = 2 * MiB;
const personalEntitlements = new Map([
  ['a', true],
  ['b', true],
  ['sans-abonnement', false],
  ['refuse', false],
  ['incomplet', false],
  ['renouvele', true],
  ['resilie-a-terme', true],
  ['expire', false],
  ['sensible', true],
]);
const iso = () => new Date().toISOString();
const nonce = () => randomBytes(32).toString('base64url');
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function openStore(path, { maxDemoBytes = 12 * MiB, maxQueued = 24 } = {}) {
  const db = new DatabaseSync(path);
  const pageSize = db.prepare('PRAGMA page_size').get().page_size;
  const maxPages = Math.floor(DATABASE_LIMIT / pageSize);
  if (db.prepare('PRAGMA page_count').get().page_count > maxPages) {
    db.close();
    throw Error('Le volume de recette dépasse son plafond.');
  }
  db.exec(
    `PRAGMA max_page_count=${maxPages}; PRAGMA wal_autocheckpoint=256; PRAGMA journal_size_limit=4194304;`,
  );
  db.exec(`
    PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS demos(id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, demo_id TEXT NOT NULL REFERENCES demos ON DELETE CASCADE, persona TEXT NOT NULL, eligible INTEGER NOT NULL, ends INTEGER NOT NULL, UNIQUE(demo_id,persona));
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts ON DELETE CASCADE, role TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mailboxes(demo_id TEXT PRIMARY KEY REFERENCES demos ON DELETE CASCADE, owner_hash TEXT UNIQUE NOT NULL, receipt_hash TEXT, account_id TEXT REFERENCES accounts ON DELETE CASCADE, expires INTEGER);
    CREATE TABLE IF NOT EXISTS dossiers(id TEXT PRIMARY KEY, account_id TEXT UNIQUE NOT NULL REFERENCES accounts ON DELETE CASCADE, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', closed INTEGER DEFAULT 0, revision INTEGER DEFAULT 0, job_status TEXT DEFAULT 'empty', published_at TEXT, analysis TEXT, sensitive INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY, dossier_id TEXT NOT NULL REFERENCES dossiers ON DELETE CASCADE, digest TEXT NOT NULL, fixture TEXT NOT NULL, added TEXT NOT NULL, extraction TEXT, name TEXT, mime TEXT, bytes BLOB, UNIQUE(dossier_id,digest));
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, dossier_id TEXT NOT NULL REFERENCES dossiers ON DELETE CASCADE, revision INTEGER NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER DEFAULT 0, next_at INTEGER DEFAULT 0, lease TEXT, first_result TEXT, created_at TEXT NOT NULL, finished_at TEXT, last_error TEXT, UNIQUE(dossier_id,revision));
    CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,next_at);
    CREATE TABLE IF NOT EXISTS overrides(id INTEGER PRIMARY KEY, dossier_id TEXT NOT NULL REFERENCES dossiers ON DELETE CASCADE, event_key TEXT, retained_date TEXT, reason TEXT, author TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS categories(dossier_id TEXT NOT NULL REFERENCES dossiers ON DELETE CASCADE, key TEXT NOT NULL, fingerprint TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(dossier_id,key));
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, dossier_id TEXT NOT NULL REFERENCES dossiers ON DELETE CASCADE, key TEXT NOT NULL, revision INTEGER NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, UNIQUE(dossier_id,name));
    CREATE TABLE IF NOT EXISTS notices(dossier_id TEXT NOT NULL REFERENCES dossiers ON DELETE CASCADE, revision INTEGER NOT NULL, createdAt TEXT NOT NULL, PRIMARY KEY(dossier_id,revision));
  `);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw e;
    }
  }
  if (!all('PRAGMA table_info(objects)').some((c) => c.name === 'bytes')) {
    transaction(() => {
      db.exec(
        'ALTER TABLE objects ADD COLUMN bytes BLOB; ALTER TABLE objects ADD COLUMN mime TEXT; ALTER TABLE objects ADD COLUMN name TEXT;',
      );
      for (const r of all('SELECT id,fixture,digest FROM objects')) {
        const fixture = fixtures.get(r.fixture);
        if (fixture?.digest !== r.digest) throw Error('Original fictif historique indisponible.');
        run(
          'UPDATE objects SET bytes=?,name=?,mime=? WHERE id=?',
          fixture.bytes,
          fixture.name,
          fixture.mime,
          r.id,
        );
      }
    });
  }
  function checkDatabaseSpace(additionalBytes = 0) {
    const pages = get('PRAGMA page_count').page_count - get('PRAGMA freelist_count').freelist_count;
    if (pages * pageSize + additionalBytes > DATABASE_LIMIT - RESERVED_SPACE) {
      throw new HttpError(429, 'Le stockage de recette a atteint sa capacité.');
    }
  }
  function checkDemoSpace(dossierId, additionalBytes = 0) {
    checkDatabaseSpace(additionalBytes);
    const usage = get(
      `WITH owned AS (
      SELECT d.id FROM dossiers d JOIN accounts a ON a.id=d.account_id WHERE a.demo_id=(
        SELECT a2.demo_id FROM dossiers d2 JOIN accounts a2 ON a2.id=d2.account_id WHERE d2.id=?))
      SELECT coalesce((SELECT sum(length(bytes)) FROM objects WHERE dossier_id IN owned),0) +
        coalesce((SELECT sum(length(bytes)) FROM files WHERE dossier_id IN owned),0) AS bytes`,
      dossierId,
    );
    if (usage.bytes + additionalBytes > maxDemoBytes)
      throw new HttpError(429, 'Quota de fichiers de ce bac de recette atteint.');
  }
  function account(demoId, persona) {
    const row = get('SELECT * FROM accounts WHERE demo_id=? AND persona=?', demoId, persona);
    if (row) return row;
    const id = randomUUID();
    run(
      'INSERT INTO accounts VALUES(?,?,?,?,?)',
      id,
      demoId,
      persona,
      +personalEntitlements.get(persona),
      Date.now() + DAY,
    );
    run(
      'INSERT INTO dossiers(id,account_id,title,sensitive) VALUES(?,?,?,?)',
      randomUUID(),
      id,
      'Réception des menuiseries · Atelier Témoin',
      +(persona === 'sensible'),
    );
    return get('SELECT * FROM accounts WHERE id=?', id);
  }
  function session(token) {
    if (!token) return null;
    const s = get(
      `SELECT a.id accountId,a.demo_id demoId,a.persona,d.id dossierId,s.role,
      (a.eligible AND a.ends>?) subscribed FROM sessions s JOIN accounts a ON a.id=s.account_id
      JOIN dossiers d ON d.account_id=a.id JOIN demos g ON g.id=a.demo_id
      WHERE token_hash=? AND s.expires>? AND g.expires>?`,
      Date.now(),
      hash(token),
      Date.now(),
      Date.now(),
    );
    return s ? { ...s, subscribed: Boolean(s.subscribed) } : null;
  }
  // Les droits de la boîte fictive ne permettent jamais de lire un dossier directement.
  function issueSession(a, role) {
    const token = nonce();
    const mailbox = nonce();
    run('INSERT INTO sessions VALUES(?,?,?,?)', hash(token), a.id, role, Date.now() + DAY);
    run(
      'INSERT INTO mailboxes(demo_id,owner_hash) VALUES(?,?) ON CONFLICT(demo_id) DO UPDATE SET owner_hash=excluded.owner_hash,receipt_hash=NULL,account_id=NULL,expires=NULL',
      a.demo_id,
      hash(mailbox),
    );
    return { token, mailbox, session: session(token) };
  }
  function requestRecovery(mailbox, persona) {
    if (!mailbox || !['a', 'b'].includes(persona))
      throw new HttpError(410, 'Boîte de recette indisponible ou expirée.');
    const receipt = nonce();
    const result = run(
      `UPDATE mailboxes SET receipt_hash=?,expires=?,account_id=(
      SELECT id FROM accounts WHERE accounts.demo_id=mailboxes.demo_id AND persona=?)
      WHERE owner_hash=? AND EXISTS(SELECT 1 FROM demos WHERE id=mailboxes.demo_id AND expires>?)
      AND EXISTS(SELECT 1 FROM accounts WHERE accounts.demo_id=mailboxes.demo_id AND persona=?)`,
      hash(receipt),
      Date.now() + 600000,
      persona,
      hash(mailbox),
      Date.now(),
      persona,
    );
    if (!result.changes) throw new HttpError(410, 'Boîte de recette indisponible ou expirée.');
    return receipt;
  }
  function confirmRecovery(mailbox, receipt, previous) {
    if (!mailbox || !receipt) throw new HttpError(410, 'Confirmation de recette indisponible ou expirée.');
    return transaction(() => {
      const a = get(
        `SELECT a.* FROM mailboxes m JOIN accounts a ON a.id=m.account_id
        JOIN demos d ON d.id=a.demo_id AND d.id=m.demo_id
        WHERE m.owner_hash=? AND m.receipt_hash=? AND m.expires>? AND d.expires>?`,
        hash(mailbox),
        hash(receipt),
        Date.now(),
        Date.now(),
      );
      if (!a) throw new HttpError(410, 'Confirmation de recette indisponible ou expirée.');
      run('DELETE FROM sessions WHERE account_id=?', a.id);
      if (previous) run('DELETE FROM sessions WHERE token_hash=?', hash(previous));
      return issueSession(a, 'client');
    });
  }
  function startSession(previous, persona, admin) {
    if (!personalEntitlements.has(persona) && !(persona === 'admin' && admin))
      throw new HttpError(403, 'Accès de recette refusé.');
    return transaction(() => {
      const old = session(previous);
      run('DELETE FROM demos WHERE expires<=?', Date.now());
      const demoId = old?.demoId ?? randomUUID();
      if (!old) {
        checkDatabaseSpace();
        if (get('SELECT count(*) n FROM demos').n >= 256)
          throw new HttpError(429, 'Capacité de recette atteinte.');
        run('INSERT INTO demos VALUES(?,?)', demoId, Date.now() + DAY);
      }
      if (previous) run('DELETE FROM sessions WHERE token_hash=?', hash(previous));
      const a = account(demoId, persona === 'admin' ? 'a' : persona);
      return issueSession(a, persona === 'admin' ? 'admin' : 'client');
    });
  }
  function authorized(dossierId) {
    return get(
      `SELECT d.* FROM dossiers d JOIN accounts a ON a.id=d.account_id JOIN demos g ON g.id=a.demo_id
      WHERE d.id=? AND a.eligible=1 AND a.ends>? AND g.expires>?`,
      dossierId,
      Date.now(),
      Date.now(),
    );
  }
  function writable(s) {
    const d = authorized(s.dossierId);
    if (!d || d.account_id !== s.accountId)
      throw new HttpError(402, 'Un abonnement de recette actif est requis.');
    if (d.closed) throw new HttpError(409, 'Ce dossier est clôturé.');
    if (d.revision >= 64) throw new HttpError(429, 'Quota de révisions de ce dossier atteint.');
    return d;
  }
  function enqueue(d, kind) {
    const waiting = get(
      "SELECT count(*) n FROM jobs WHERE dossier_id<>? AND status IN ('queued','processing')",
      d.id,
    ).n;
    if (waiting >= maxQueued)
      throw new HttpError(429, 'La file de recette est pleine. Réessayez après une livraison.');
    run(
      "UPDATE jobs SET status='obsolete', lease=NULL WHERE dossier_id=? AND status IN ('queued','processing','review')",
      d.id,
    );
    run("UPDATE dossiers SET revision=revision+1,job_status='queued' WHERE id=?", d.id);
    run(
      'INSERT INTO jobs(id,dossier_id,revision,kind,created_at) VALUES(?,?,?,?,?)',
      randomUUID(),
      d.id,
      d.revision + 1,
      kind,
      iso(),
    );
  }
  function addLot(s, body) {
    return transaction(() => {
      const d = writable(s);
      const ids = body.fixtures ?? [],
        uploads = body.uploads ?? [];
      if (
        !Array.isArray(ids) ||
        !Array.isArray(uploads) ||
        (!ids.length && !uploads.length) ||
        ids.length + uploads.length > 190
      )
        throw new HttpError(400, 'Choisissez de 1 à 190 pièces fictives.');
      if (body.objective !== undefined && (typeof body.objective !== 'string' || body.objective.length > 160))
        throw new HttpError(400, 'Objectif limité à 160 caractères.');
      const selected = ids.map((id) => (id === volume.id ? volume : fixtures.get(id)));
      for (const b64 of uploads) {
        if (typeof b64 !== 'string') throw new HttpError(400, 'Fichier fictif attendu.');
        const digest = hash(Buffer.from(b64, 'base64'));
        selected.push(selectable.find((f) => f.digest === digest));
      }
      if (selected.some((f) => !f))
        throw new HttpError(422, 'Seules les pièces fictives fournies sont admises.');
      const expanded = selected.flatMap((f) => (f === volume ? volumeDocuments : [f]));
      if (expanded.length > 190) throw new HttpError(400, 'Limite de 190 pièces par lot.');
      let added = 0;
      for (const f of expanded) {
        const count = run(
          'INSERT OR IGNORE INTO objects(id,dossier_id,digest,fixture,added,name,mime,bytes) VALUES(?,?,?,?,?,?,?,?)',
          randomUUID(),
          d.id,
          f.digest,
          f.id,
          iso(),
          f.name,
          f.mime,
          f.bytes,
        ).changes;
        added += count;
        if (count && f.id === 'manuel') {
          run(
            'INSERT INTO files VALUES(?,?,?,?,?,?,?)',
            randomUUID(),
            d.id,
            'autres',
            0,
            f.name,
            f.mime,
            f.bytes,
          );
          run('INSERT INTO categories VALUES(?,?,?,0)', d.id, 'autres', f.digest);
        }
      }
      if (added) {
        checkDemoSpace(d.id);
        if (body.objective?.trim() && !d.objective)
          run('UPDATE dossiers SET objective=? WHERE id=?', body.objective.trim(), d.id);
        enqueue(d, 'lot');
      }
      return { added, duplicates: expanded.length - added };
    });
  }
  const getOverrides = (id) =>
    all(
      'SELECT event_key,retained_date,reason,author,created_at,NULL label,0 hidden FROM overrides WHERE dossier_id=? ORDER BY id',
      id,
    );
  function correct(s, body) {
    transaction(() => {
      const d = writable(s);
      const event = d.analysis && JSON.parse(d.analysis).events.find((e) => e.key === body.key);
      if (
        !event ||
        typeof body.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
        !Number.isFinite(Date.parse(body.date)) ||
        new Date(body.date).toISOString().slice(0, 10) !== body.date ||
        typeof body.reason !== 'string' ||
        !body.reason.trim() ||
        body.reason.length > 240
      )
        throw new HttpError(400, 'Événement, date valide et motif court requis.');
      const latest = get(
        'SELECT * FROM overrides WHERE dossier_id=? AND event_key=? ORDER BY id DESC LIMIT 1',
        d.id,
        event.key,
      );
      if (latest?.retained_date === body.date && latest.reason === body.reason.trim()) return;
      run(
        'INSERT INTO overrides(dossier_id,event_key,retained_date,reason,author,created_at) VALUES(?,?,?,?,?,?)',
        d.id,
        event.key,
        body.date,
        body.reason.trim(),
        'Client fictif ' + s.persona.toUpperCase(),
        iso(),
      );
      enqueue(d, 'correction');
    });
  }
  function close(s, closed) {
    if (typeof closed !== 'boolean') throw new HttpError(400, 'État de clôture requis.');
    transaction(() => {
      const d = authorized(s.dossierId);
      if (!d || s.accountId !== d.account_id) throw new HttpError(402, 'Abonnement requis.');
      if (Boolean(d.closed) === closed) return;
      run('UPDATE dossiers SET closed=? WHERE id=?', +closed, d.id);
      if (closed) {
        run(
          "UPDATE jobs SET status='obsolete',lease=NULL WHERE dossier_id=? AND status IN ('queued','processing','review')",
          d.id,
        );
        run("UPDATE dossiers SET job_status='closed' WHERE id=?", d.id);
      } else if (d.revision > 0) {
        if (d.revision >= 64) throw new HttpError(429, 'Quota de révisions atteint.');
        enqueue(d, 'reopen');
      } else run("UPDATE dossiers SET job_status='empty' WHERE id=?", d.id);
    });
  }
  function state(s, link) {
    const d = get('SELECT * FROM dossiers WHERE id=? AND account_id=?', s.dossierId, s.accountId);
    const active = Boolean(authorized(d.id));
    const analysis = active && d.analysis ? JSON.parse(d.analysis) : null;
    const overrides = active ? getOverrides(d.id) : [];
    const objects = active
      ? all(
          'SELECT id,name,fixture,added,extraction FROM objects WHERE dossier_id=? ORDER BY rowid',
          d.id,
        ).map((r) => ({
          id: r.id,
          name: r.name,
          href: link('objects', r.id),
          createdAt: r.added,
          status: r.extraction ? JSON.parse(r.extraction).status : 'pending',
        }))
      : [];
    const rendered = active
      ? all(
          'SELECT f.id,f.key,f.name,f.revision,c.revision current FROM files f JOIN categories c ON f.dossier_id=c.dossier_id AND f.key=c.key WHERE f.dossier_id=? ORDER BY f.revision DESC,f.name',
          d.id,
        )
      : [];
    const expose = (f) => ({ name: f.name, key: f.key, revision: f.revision, href: link('files', f.id) });
    return {
      persona: s.role === 'admin' ? 'admin' : s.persona,
      subscribed: active,
      dossier: {
        id: d.id,
        title: d.title,
        objective: d.objective,
        closed: Boolean(d.closed),
        revision: d.revision,
        jobStatus: d.job_status,
        objects,
        analysis,
        events: applyOverrides(analysis?.events ?? [], overrides),
        overrides,
        files: rendered.filter((f) => f.revision === f.current).map(expose),
        historyFiles: rendered.filter((f) => f.revision !== f.current).map(expose),
        formattedAt: d.published_at,
        notifications: active
          ? all('SELECT revision,createdAt FROM notices WHERE dossier_id=? ORDER BY revision DESC', d.id)
          : [],
        jobs: active
          ? all(
              'SELECT revision,kind,status,attempts,created_at as createdAt,first_result as firstResult,finished_at as finishedAt FROM jobs WHERE dossier_id=? ORDER BY revision DESC LIMIT 10',
              d.id,
            )
          : [],
      },
      fixtures: selectable.map((f) => ({
        id: f.id,
        name: f.name,
        sha256: f.digest,
        href: '/api/recette/fixtures/' + f.id,
      })),
    };
  }

  function claim() {
    return transaction(() => {
      const now = Date.now();
      const due = get(
        "SELECT * FROM jobs WHERE status IN ('queued','processing') AND next_at<=? ORDER BY rowid LIMIT 1",
        now,
      );
      if (!due) return;
      const d = authorized(due.dossier_id);
      if (!d || d.closed || d.revision !== due.revision) {
        run("UPDATE jobs SET status='obsolete',lease=NULL WHERE id=?", due.id);
        return;
      }
      if (due.attempts >= 3) {
        run("UPDATE jobs SET status='failed',lease=NULL,last_error='ATTEMPTS_EXHAUSTED' WHERE id=?", due.id);
        run("UPDATE dossiers SET job_status='failed' WHERE id=?", d.id);
        return;
      }
      const lease = nonce();
      run(
        "UPDATE jobs SET status='processing',attempts=attempts+1,lease=?,next_at=? WHERE id=?",
        lease,
        now + 30000,
        due.id,
      );
      run("UPDATE dossiers SET job_status='processing' WHERE id=?", d.id);
      return { ...due, lease, d };
    });
  }
  async function tick(extract = extractFixture) {
    const job = claim();
    if (!job) return false;
    const { d } = job;
    const owns = () =>
      get("SELECT id FROM jobs WHERE id=? AND lease=? AND status='processing'", job.id, job.lease);
    try {
      const rows = all("SELECT * FROM objects WHERE dossier_id=? AND fixture<>'manuel' ORDER BY rowid", d.id);
      for (const row of rows) {
        if (!owns()) return true;
        if (row.extraction) continue;
        const result = await extract({ id: row.fixture, name: row.name, mime: row.mime, bytes: row.bytes });
        row.extraction = JSON.stringify(result);
        transaction(() => {
          if (!owns()) return;
          run('UPDATE objects SET extraction=? WHERE id=? AND dossier_id=?', row.extraction, row.id, d.id);
          run('UPDATE jobs SET next_at=? WHERE id=?', Date.now() + 30000, job.id);
        });
      }
      if (!owns()) return true;
      const { analysis, coverage } = analyze(rows);
      const pieces = rows.map((r) => ({ id: r.id, file_name: r.name, created_at: r.added }));
      const overrides = getOverrides(d.id);
      const fingerprints = Object.fromEntries(
        Object.entries(categoryInputs(analysis, coverage, pieces, overrides)).map(([k, v]) => [
          k,
          hash(JSON.stringify(v)),
        ]),
      );
      const current = all('SELECT key,fingerprint FROM categories WHERE dossier_id=?', d.id);
      const categories = Object.keys(fingerprints).filter(
        (k) =>
          (k !== 'relances' || analysis.reminder_drafts.length > 0) &&
          (!['chronologie', 'dates'].includes(k) || analysis.events.length > 0) &&
          !current.some((c) => c.key === k && c.fingerprint === fingerprints[k]),
      );

      const generatedAt = new Date();
      const output = categories.length
        ? await buildDeliverables({
            title: d.title,
            revision: job.revision,
            generatedAt,
            analysis,
            coverage,
            pieces,
            overrides,
            demo: true,
            categories,
          })
        : [];
      transaction(() => {
        if (!owns()) return;
        const currentDossier = authorized(d.id);
        if (!currentDossier || currentDossier.revision !== job.revision || currentDossier.closed) {
          run("UPDATE jobs SET status='obsolete',lease=NULL WHERE id=?", job.id);
          return;
        }
        if (currentDossier.sensitive && job.kind !== 'approved') {
          run("UPDATE jobs SET status='review',lease=NULL WHERE id=?", job.id);
          run("UPDATE dossiers SET job_status='review' WHERE id=?", d.id);
          return;
        }
        checkDemoSpace(
          d.id,
          output.reduce((sum, file) => sum + file.bytes.byteLength, 0),
        );
        const now = iso();
        for (const key of categories) {
          run(
            'INSERT INTO categories VALUES(?,?,?,?) ON CONFLICT(dossier_id,key) DO UPDATE SET fingerprint=excluded.fingerprint,revision=excluded.revision',
            d.id,
            key,
            fingerprints[key],
            job.revision,
          );
        }
        for (const f of output.filter((f) => categories.includes(f.key))) {
          run(
            'INSERT INTO files VALUES(?,?,?,?,?,?,?)',
            randomUUID(),
            d.id,
            f.key,
            job.revision,
            f.name,
            f.mime,
            f.bytes,
          );
        }
        run(
          'UPDATE dossiers SET analysis=?,published_at=?,job_status=? WHERE id=?',
          JSON.stringify(analysis),
          now,
          coverage.complete ? 'ready' : 'partial',
          d.id,
        );
        run(
          "UPDATE jobs SET status='done',lease=NULL,first_result=?,finished_at=?,last_error=NULL WHERE id=?",
          now,
          now,
          job.id,
        );
        run(
          "INSERT OR IGNORE INTO notices SELECT dossier_id,revision,? FROM jobs WHERE dossier_id=? AND kind='lot' AND revision<=?",
          now,
          d.id,
          job.revision,
        );
      });
    } catch (e) {
      transaction(() => {
        if (!owns()) return;
        const atCapacity = (e instanceof HttpError && e.status === 429) || e.errcode === 13;
        const exhausted = atCapacity || job.attempts + 1 >= 3;
        run(
          'UPDATE jobs SET status=?,last_error=?,lease=NULL,next_at=? WHERE id=?',
          exhausted ? 'failed' : 'queued',
          atCapacity ? 'STORAGE_LIMIT' : 'PROCESSING_FAILED',
          Date.now() + 300 * 2 ** job.attempts,
          job.id,
        );
        run('UPDATE dossiers SET job_status=? WHERE id=?', exhausted ? 'failed' : 'queued', d.id);
      });
    }
    return true;
  }
  function approval(s) {
    if (s.role !== 'admin') throw new HttpError(403, 'Validation réservée à l’administrateur.');
    transaction(() => {
      const d = get(
        "SELECT d.* FROM dossiers d JOIN accounts a ON a.id=d.account_id WHERE a.demo_id=? AND a.persona='sensible'",
        s.demoId,
      );
      if (!d || d.job_status !== 'review' || !authorized(d.id) || d.closed)
        throw new HttpError(409, 'Aucun dossier en validation.');
      enqueue(d, 'approved');
    });
  }
  function readConnectorStatus({ demoId, dossierId }) {
    const row = get(
      `SELECT d.job_status status,COALESCE((SELECT max(j.revision) FROM jobs j WHERE j.dossier_id=d.id AND j.status='done'),0) revision,d.published_at publishedAt FROM dossiers d JOIN accounts a ON a.id=d.account_id JOIN demos g ON g.id=a.demo_id WHERE d.id=? AND a.demo_id=? AND a.eligible AND a.ends>? AND g.expires>?`,
      dossierId,
      demoId,
      Date.now(),
      Date.now(),
    );
    if (!row) return null;
    const last =
      row.status === 'failed'
        ? get(
            "SELECT last_error FROM jobs WHERE dossier_id=? AND status='failed' ORDER BY revision DESC LIMIT 1",
            dossierId,
          )
        : null;
    return { ...row, anomalies: last ? [last.last_error || 'PROCESSING_FAILED'] : [] };
  }
  return {
    db,
    get,
    run,
    state,
    startSession,
    requestRecovery,
    confirmRecovery,
    session,
    addLot,
    correct,
    close,
    tick,
    approval,
    authorized,
    readConnectorStatus,
    logout: (token) => run('DELETE FROM sessions WHERE token_hash=?', hash(token)),
  };
}
