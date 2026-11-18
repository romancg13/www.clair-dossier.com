// Bundle build.mjs supplies only synthetic inputs, their verified hashes, the sample report and the page.
import {
  page,
  assets,
  fixtureHashes,
  fixtureList,
  bFixtureList,
  foodFixtureList,
  processor,
} from './assets.mjs';
import { handleDossierServices } from './services.mjs';
import { FOOD_FIXTURES, FOOD_TITLE, foodEvidenceValid, foodReport } from './collecte.mjs';
import {
  fixtures as B_FIXTURES,
  title as B_TITLE,
  evidenceValid as bEvidenceValid,
  report as bReport,
} from './chantier-b.mjs';
import { unzipSync } from 'fflate';
import {
  MIME,
  DELIVERABLE_CATALOG,
  deliverableKeyOf,
} from '../../supabase/functions/_shared/deliverables.ts';
import { renderReport } from './report.mjs';
import { handlesConnector, handleConnector } from './connector.mjs';

const DAY = 86_400_000;
const cookieName = '__Host-cd_essai';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const unpack = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (a) => Array.from(new Uint8Array(a), (b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes));
const query = (db, sql, ...args) => db.prepare(sql).bind(...args);
const originalDate = '2026-12-08';
const dataReplay = {
  devis: [
    'DEVIS CD-041',
    'Devis émis le 10/11/2026.',
    'Objet : remplacement de trois fenêtres.',
    'Prix TTC : 18400 EUR.',
    'Retour du procès-verbal demandé au plus tard le 08/12/2026.',
  ],
  scan: [
    'Atelier Temoin | Devis CD-041',
    'Reception des trois fenetres le 15/11/2026.',
    'Le bon ne porte pas de signature.',
  ],
};
const scenarios = {
  atelier: { title: 'Atelier Témoin · Réception des trois fenêtres', fixtures: fixtureList },
  b: { title: B_TITLE, fixtures: bFixtureList },
  c: { title: FOOD_TITLE, fixtures: foodFixtureList },
};
const defaultScenario = (persona) => (persona === 'a' ? 'atelier' : persona);
const evidenceFixtures = { ...FOOD_FIXTURES, ...B_FIXTURES };

const frenchDate = (iso) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(iso + 'T12:00:00Z'),
  );
const realDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

function respond(data, status = 200, headers = {}) {
  let body = data;
  if (typeof data === 'object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
    body = JSON.stringify(data);
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  return new Response(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...headers,
    },
  });
}
const error = (message, status) => respond({ error: message }, status);
async function readBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json' || !request.body) return null;
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 512_000) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

async function digestCookie(request) {
  const raw = request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-cd_essai=([a-f0-9]{64})(?:;|$)/)?.[1];
  return raw ? sha(new TextEncoder().encode(raw)) : null;
}

async function extractPublicFixture(id, bytes) {
  const digest = await sha(bytes);
  if (digest !== fixtureHashes[id]) throw new Error('fixture');
  if (processor) {
    const expectedMethod = assets[id]?.type === 'image/png' ? 'tesseract-wasm-eng' : 'pdf-text';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const target = new URL('/api/extraction', processor.origin);
      target.searchParams.set('revision', processor.revision);
      target.searchParams.set('fixture', id);
      // The public immutable specimen is identified by name. No upload, cookie or private status crosses origins.
      const response = await fetch(target, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { Accept: 'application/json' },
      });
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        if (
          result?.fixture === id &&
          result.revision === processor.revision &&
          result.sha256 === digest &&
          result.method === expectedMethod &&
          Array.isArray(result.lines) &&
          result.lines.length <= 48 &&
          result.lines.every((line) => typeof line === 'string' && line.length <= 320)
        ) {
          const text = result.lines
            .join(' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
          const reliable = FOOD_FIXTURES[id]
            ? foodEvidenceValid(id, result.lines)
            : B_FIXTURES[id]
              ? bEvidenceValid(id, result.lines)
              : id === 'scan'
                ? /15\/11\/2026/.test(text) && /pas de signature/.test(text)
                : /18\s?400/.test(text) && /08\/12\/2026/.test(text) && /trois fenetres/.test(text);
          if (reliable)
            return {
              method: expectedMethod,
              sha256: digest,
              processorRevision: processor.revision,
              lines: result.lines,
            };
        }
      }
    } catch {
      /* Une lecture distante indisponible conserve la méthode réellement utilisée. */
    } finally {
      clearTimeout(timer);
    }
  }
  return { method: 'fixture-replay', sha256: digest, lines: dataReplay[id] ?? evidenceFixtures[id].lines };
}

function valueFrom(lines, regex) {
  const text = lines
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return text.match(regex)?.[1] ?? null;
}
function toIsoDate(fr) {
  return fr.split('/').reverse().join('-');
}
function resultFor(extraction, retainedDate, corrections) {
  const hasDevis = Boolean(extraction.devis),
    hasScan = Boolean(extraction.scan);
  const extractedDate = hasDevis
    ? toIsoDate(valueFrom(extraction.devis.lines, /au plus tard le (\d{2}\/\d{2}\/\d{4})/i))
    : null;
  const amount = hasDevis
    ? Number(valueFrom(extraction.devis.lines, /Prix TTC\s*:\s*([0-9 ]+)\s*EUR/i)?.replaceAll(' ', ''))
    : null;
  const receptionDate = hasScan
    ? toIsoDate(valueFrom(extraction.scan.lines, /fenetres le (\d{2}\/\d{2}\/\d{4})/i))
    : null;
  if ((hasDevis && (!realDate(extractedDate) || !amount)) || (hasScan && !realDate(receptionDate)))
    throw new Error('incomplete evidence');
  const date = hasDevis ? retainedDate || extractedDate : null;
  const original = hasDevis
    ? 'Le devis CD-041 porte sur trois fenêtres pour ' +
      new Intl.NumberFormat('fr-FR').format(amount) +
      ' € TTC (devis, page 1).'
    : 'Le devis ne figure pas dans ce lot.';
  const observation = hasScan
    ? 'Le bon du ' + frenchDate(receptionDate) + ' ne porte pas de signature (bon numérisé, page 1).'
    : 'Le bon de réception ne figure pas dans ce lot.';
  const action = hasScan ? 'Demander le bon de réception signé.' : 'Joindre le bon de réception.';
  const last = corrections.at(-1);
  const dateSource = !hasDevis
    ? 'Aucune échéance documentée dans ce lot.'
    : last
      ? 'Date retenue par ' +
        last.author +
        ' : ' +
        last.reason +
        ' (valeur extraite du devis, p. 1 : 8 décembre 2026).'
      : 'Devis CD-041, page 1.';
  const draft = hasScan
    ? 'Objet : bon de réception à signer — Chantier Atelier Témoin\nBonjour, pourriez-vous me transmettre une copie signée du bon de réception des trois fenêtres ? Merci.\nÀ vérifier avant tout envoi.'
    : '';
  return {
    summary: original + ' ' + observation,
    draft,
    date,
    dateSource,
    action,
    originalDate: extractedDate,
    extractedDateSource: hasDevis ? 'Devis CD-041, page 1.' : null,
    hasDevis,
    hasScan,
  };
}

// Publication des anciens dossiers à deux pièces, lors de leur première relecture après la migration.
async function restoreLegacy(db, sandbox) {
  const legacy = await query(
    db,
    `SELECT id FROM runs WHERE sandbox=? AND persona=? AND lot_command IS NULL AND
    ((published_revision=0 AND published_at IS NOT NULL AND output_pdf IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM lot_events e WHERE e.run_id=runs.id))`,
    sandbox.id,
    sandbox.persona,
  ).first();
  if (!legacy) return;
  const provenance = JSON.stringify({
    devis: { method: 'fixture-replay' },
    scan: { method: 'fixture-replay' },
  });
  await db.batch([
    query(
      db,
      `INSERT OR IGNORE INTO deliveries(run_id,revision,published_at,summary,draft,deadline,date_source,action,extraction,pdf)
      SELECT id,1,published_at,summary,draft,?,'Devis CD-041, page 1.','Demander le bon de réception signé.',?,output_pdf FROM runs
      WHERE id=? AND published_revision=0 AND published_at IS NOT NULL AND output_pdf IS NOT NULL`,
      originalDate,
      provenance,
      legacy.id,
    ),
    query(
      db,
      `INSERT OR IGNORE INTO lot_events(run_id,revision,submitted,published_at,published_revision)
      SELECT id,1,submitted,published_at,CASE WHEN published_at IS NULL THEN NULL ELSE 1 END FROM runs
      WHERE id=? AND lot_command IS NULL AND revision=1`,
      legacy.id,
    ),
    query(
      db,
      'UPDATE runs SET published_revision=1 WHERE id=? AND published_revision=0 AND EXISTS (SELECT 1 FROM deliveries WHERE run_id=runs.id AND revision=1)',
      legacy.id,
    ),
  ]);
}

async function drainOne(db) {
  const now = Date.now(),
    lease = crypto.randomUUID();
  const job = await query(
    db,
    `UPDATE runs SET status='processing',lease=?,lease_end=?,attempts=attempts+1
    WHERE id=(SELECT r.id FROM runs r JOIN sandboxes s ON s.id=r.sandbox WHERE s.expires>? AND r.closed=0 AND r.attempts<3
    AND ((r.status='queued' AND r.due<=?) OR (r.status='processing' AND r.lease_end<=?)) ORDER BY r.due LIMIT 1)
    RETURNING id,persona,revision,input_pdf,input_scan,retained_date,corrections,attempts,
      (SELECT extraction FROM deliveries d WHERE d.run_id=runs.id AND d.revision=runs.published_revision) cached`,
    lease,
    now + 20000,
    now,
    now,
    now,
  ).first();
  if (!job) return false;
  try {
    const cached = job.cached ? JSON.parse(job.cached) : {};
    const stored = (
      await query(db, 'SELECT fixture,bytes FROM run_inputs WHERE run_id=? ORDER BY fixture', job.id).all()
    ).results;
    const inputs = [
      ['devis', job.input_pdf],
      ['scan', job.input_scan],
      ...stored.map((row) => [row.fixture, row.bytes]),
    ];
    const entries = await Promise.all(
      inputs
        .filter(([, v]) => v?.length || v?.byteLength)
        .map(async ([id, v]) => {
          const previous = cached[id];
          if (
            previous?.sha256 === fixtureHashes[id] &&
            (previous.processorRevision === processor?.revision || !processor) &&
            previous.lines?.length
          )
            return [id, previous];
          return [id, await extractPublicFixture(id, new Uint8Array(v))];
        }),
    );
    if (!entries.length) throw new Error('empty');
    const extraction = Object.fromEntries(entries),
      corrections = JSON.parse(job.corrections);
    const project =
      job.persona === 'c' ? foodReport : entries.some(([id]) => B_FIXTURES[id]) ? bReport : resultFor;
    const report = project(extraction, job.retained_date, corrections);
    const { pdf, pack, count, files } = await renderReport({
      ...report,
      extraction,
      corrections,
      revision: job.revision,
      publishedAt: Date.now(),
      pdfOnly: job.attempts >= 3,
    });
    const publishedAt = Date.now();
    const totalBytes = pdf.byteLength + (pack?.byteLength ?? 0);
    if (totalBytes > 1500000) throw Error('render_too_large');
    const live = `id=? AND revision=? AND lease=? AND status='processing' AND closed=0 AND EXISTS (SELECT 1 FROM sandboxes s WHERE s.id=runs.sandbox AND s.expires>?)`;
    const check = [job.id, job.revision, lease, Date.now()];
    await db.batch([
      query(
        db,
        `INSERT OR IGNORE INTO deliveries(run_id,revision,published_at,summary,draft,deadline,date_source,action,extraction,pdf,pack,file_count,files,extracted_date,extracted_source)
        SELECT id,revision,?,?,?,?,?,?,?,?,?,?,?,?,? FROM runs WHERE ${live} AND
        (SELECT coalesce(sum(length(pdf)+coalesce(length(pack),0)),0) FROM deliveries)+? <= 100000000`,
        publishedAt,
        report.summary,
        report.draft,
        report.date,
        report.dateSource,
        report.action,
        JSON.stringify(extraction),
        pdf,
        pack,
        count,
        JSON.stringify(
          files.map(({ name, key, category, title, mime }) => ({
            name,
            key,
            category: category || key,
            title,
            mime,
          })),
        ),
        report.originalDate ?? null,
        report.extractedDateSource ?? null,
        ...check,
        totalBytes,
      ),
      query(
        db,
        `UPDATE lot_events SET published_at=?,published_revision=?
        WHERE run_id=? AND published_at IS NULL AND revision<=? AND EXISTS(SELECT 1 FROM deliveries d WHERE d.run_id=? AND d.revision=?)`,
        publishedAt,
        job.revision,
        job.id,
        job.revision,
        job.id,
        job.revision,
      ),
      query(
        db,
        `UPDATE runs SET status='published',published_at=?,published_revision=revision,summary=?,draft=?,output_pdf=NULL,notifications=lots,lease=NULL
        WHERE ${live} AND EXISTS (SELECT 1 FROM deliveries d WHERE d.run_id=runs.id AND d.revision=runs.revision)`,
        publishedAt,
        report.summary,
        report.draft,
        ...check,
      ),
      query(db, `UPDATE runs SET status='failed',lease=NULL WHERE ${live}`, ...check),
    ]);
  } catch {
    await query(
      db,
      `UPDATE runs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,lease=NULL,due=?
      WHERE id=? AND revision=? AND lease=?`,
      Date.now() + 500,
      job.id,
      job.revision,
      lease,
    ).run();
  }
  return true;
}

async function reconcile(db, initialDelay = 0) {
  if (initialDelay) await delay(initialDelay);
  await query(
    db,
    "UPDATE runs SET status='failed',lease=NULL WHERE status='processing' AND attempts>=3 AND lease_end<=?",
    Date.now(),
  ).run();
  for (let i = 0; i < 4; i++) {
    if (!(await drainOne(db))) break;
    await delay(520);
  }
}

// The slot exists before the first upload. Its changing UUID fences every request and worker lease.
async function openSlot(db, sandbox) {
  const read = () =>
    query(
      db,
      `SELECT x.dossier_id dossierId,x.scenario,x.generation FROM dossier_slots x JOIN sandboxes s ON s.id=x.sandbox AND s.persona=x.persona
    WHERE x.sandbox=? AND x.persona=? AND s.expires>?`,
      sandbox.id,
      sandbox.persona,
      Date.now(),
    ).first();
  const current = await read();
  if (current) return current;
  await query(
    db,
    `INSERT OR IGNORE INTO dossier_slots(sandbox,persona,dossier_id,scenario)
    SELECT s.id,s.persona,coalesce(r.id,?),CASE WHEN s.persona='b' AND r.id IS NOT NULL THEN 'atelier' ELSE ? END
    FROM sandboxes s LEFT JOIN runs r ON r.sandbox=s.id AND r.persona=s.persona
    WHERE s.id=? AND s.persona=? AND s.expires>?`,
    crypto.randomUUID(),
    defaultScenario(sandbox.persona),
    sandbox.id,
    sandbox.persona,
    Date.now(),
  ).run();
  return read();
}
async function reset(db, sandbox, data) {
  if (!data?.dossier || typeof data.dossier !== 'string' || data.persona !== sandbox.persona)
    return error('Dossier à réinitialiser inconnu.', 400);
  if (data.dossier !== sandbox.dossierId) return respond({ reset: false });
  const active = `EXISTS(SELECT 1 FROM dossier_slots x JOIN sandboxes s ON x.sandbox=s.id AND x.persona=s.persona
    WHERE x.sandbox=? AND x.persona=? AND x.dossier_id=? AND s.expires>?)`;
  const guard = [sandbox.id, sandbox.persona, data.dossier, Date.now()];
  const result = await db.batch([
    query(
      db,
      `DELETE FROM connector_grants WHERE sandbox=? AND persona=? AND ${active}`,
      sandbox.id,
      sandbox.persona,
      ...guard,
    ),
    query(
      db,
      `DELETE FROM runs WHERE id=? AND sandbox=? AND persona=? AND ${active}`,
      data.dossier,
      sandbox.id,
      sandbox.persona,
      ...guard,
    ),
    query(
      db,
      `UPDATE dossier_slots SET dossier_id=?,scenario=?,generation=generation+1 WHERE sandbox=? AND persona=? AND dossier_id=?
      AND ${active} RETURNING dossier_id`,
      crypto.randomUUID(),
      defaultScenario(sandbox.persona),
      sandbox.id,
      sandbox.persona,
      data.dossier,
      ...guard,
    ),
  ]);
  return respond({ reset: Boolean(result[2].results.length) });
}
function fileHref(path, id, revision, name) {
  const params = new URLSearchParams({ dossier: id });
  if (revision) params.set('revision', String(revision));
  if (name) params.set('name', name);
  return path + '?' + params.toString();
}
const linkedFiles = (files, id, revision) =>
  files.map((file) => ({ ...file, href: fileHref('/api/fichier', id, revision, file.name) }));
// Archives published before manifests were introduced remain downloadable by their exact ZIP entry names.
async function fileManifest(db, id, revision, files, pdfCount) {
  if (files) return JSON.parse(files);
  if (!pdfCount) return [];
  const row = await query(
    db,
    'SELECT pack FROM deliveries WHERE run_id=? AND revision=?',
    id,
    revision,
  ).first();
  let names = [];
  if (row?.pack)
    unzipSync(new Uint8Array(row.pack), {
      filter(entry) {
        names.push(entry.name);
        return false;
      },
    });
  else names = ['Dashboard-r' + revision + '.pdf'];
  const manifest = names.map((name) => {
    const key = deliverableKeyOf(name) || 'dashboard';
    return {
      name,
      key,
      category: key,
      title: DELIVERABLE_CATALOG.find((row) => row.key === key)?.label || name,
      mime: MIME[name.split('.').at(-1)],
    };
  });
  await query(
    db,
    'UPDATE deliveries SET files=? WHERE run_id=? AND revision=? AND files IS NULL',
    JSON.stringify(manifest),
    id,
    revision,
  ).run();
  return manifest;
}
async function runFor(db, sandbox) {
  const row = await query(
    db,
    `SELECT r.id,r.status,r.submitted submittedAt,r.published_at publishedAt,r.notifications,r.summary,r.draft,
    r.revision,r.published_revision publishedRevision,r.closed,length(r.input_pdf)>0 hasPdf,length(r.input_scan)>0 hasScan,r.corrections,
    d.deadline date,d.date_source dateSource,d.extracted_date extractedDate,d.extracted_source extractedDateSource,d.action,d.files manifest,d.extraction,coalesce(d.file_count,0) fileCount FROM runs r LEFT JOIN deliveries d ON d.run_id=r.id AND d.revision=r.published_revision
    WHERE r.sandbox=? AND r.persona=? AND r.id=?`,
    sandbox.id,
    sandbox.persona,
    sandbox.dossierId,
  ).first();
  if (!row) return null;
  const { id, hasPdf, hasScan, corrections, extraction, manifest, ...publicRow } = row;
  const storedInputs = (
    await query(db, 'SELECT fixture FROM run_inputs WHERE run_id=?', id).all()
  ).results.map((x) => x.fixture);
  const inputs = scenarios[sandbox.scenario].fixtures
    .map((f) => f.id)
    .filter(
      (key) => storedInputs.includes(key) || (key === 'devis' && hasPdf) || (key === 'scan' && hasScan),
    );
  const files = linkedFiles(
    await fileManifest(db, id, row.publishedRevision, manifest, row.fileCount),
    id,
    row.publishedRevision,
  );
  const past = (
    await query(
      db,
      'SELECT revision,published_at publishedAt,file_count fileCount FROM deliveries WHERE run_id=? ORDER BY revision DESC',
      id,
    ).all()
  ).results;
  const lotEvents = (
    await query(
      db,
      'SELECT revision,submitted submittedAt,published_at publishedAt,published_revision publishedRevision FROM lot_events WHERE run_id=? ORDER BY revision',
      id,
    ).all()
  ).results;
  const coversBoth = Boolean(extraction && JSON.parse(extraction).devis && JSON.parse(extraction).scan);
  return {
    ...publicRow,
    id,
    files,
    deliverables: files,
    actionOwner: row.action ? (sandbox.scenario === 'c' ? 'Coordination de collecte' : 'Client') : null,
    pdfHref: row.publishedRevision ? fileHref('/api/livraison.pdf', id, row.publishedRevision) : null,
    packHref: row.fileCount > 1 ? fileHref('/api/livraison.zip', id, row.publishedRevision) : null,
    initialPackHref: assets.initialPack && coversBoth ? fileHref('/api/edition-initiale.zip', id) : null,
    lotEvents,
    packStatus: publicRow.fileCount > 1 ? 'complete' : publicRow.fileCount === 1 ? 'pdf-only' : 'pending',
    hasInitialPack: Boolean(assets.initialPack && coversBoth),
    extractedDate: row.extractedDate ?? (hasPdf ? originalDate : null),
    extractedDateSource: row.extractedDateSource ?? (hasPdf ? 'Devis CD-041, page 1.' : null),
    closed: Boolean(row.closed),
    inputs,
    corrections: JSON.parse(corrections),
    extraction: extraction ? JSON.parse(extraction) : null,
    history: past.map((r) => ({
      ...r,
      href: fileHref('/api/livraison.pdf', id, r.revision),
      packHref: r.fileCount > 1 ? fileHref('/api/livraison.zip', id, r.revision) : null,
    })),
  };
}

async function submit(db, sandbox, data, ctx) {
  const fixtures = scenarios[sandbox.scenario].fixtures;
  if (!Array.isArray(data?.uploads) || data.uploads.length < 1 || data.uploads.length > fixtures.length)
    return error('Choisissez les pièces fictives de ce scénario.', 400);
  const inputs = new Map();
  for (const raw of data.uploads) {
    if (typeof raw !== 'string' || raw.length > 300000) return error('Format de pièce invalide.', 400);
    let bytes;
    try {
      bytes = unpack(raw);
    } catch {
      return error('Format de pièce invalide.', 400);
    }
    const hash = await sha(bytes);
    const fixture = fixtures.find((f) => fixtureHashes[f.id] === hash);
    if (!fixture) return error('Seules les pièces fictives de ce dossier sont admises.', 422);
    inputs.set(fixture.id, bytes);
  }
  const now = Date.now(),
    command = crypto.randomUUID(),
    ids = JSON.stringify([...inputs.keys()]);
  // The two legacy input columns contain the already accepted fixtures of migrated Atelier dossiers.
  const additions = `SELECT count(*) FROM json_each(?) j WHERE NOT EXISTS
     (SELECT 1 FROM run_inputs i WHERE i.run_id=runs.id AND i.fixture=j.value)
     AND NOT(j.value='devis' AND length(runs.input_pdf)>0) AND NOT(j.value='scan' AND length(runs.input_scan)>0)`;
  const batch = await db.batch([
    query(
      db,
      `INSERT INTO runs(id,sandbox,persona,status,submitted,due,input_pdf,input_scan,last_added,lot_command)
      SELECT x.dossier_id,s.id,s.persona,'queued',?,?,zeroblob(0),zeroblob(0),?,? FROM sandboxes s JOIN dossier_slots x
      ON x.sandbox=s.id AND x.persona=s.persona WHERE s.id=? AND s.persona=? AND s.expires>? AND x.dossier_id=?
      ON CONFLICT(sandbox,persona) DO UPDATE SET status='queued',revision=runs.revision+1,lots=runs.lots+1,
      attempts=0,lease=NULL,last_added=(${additions}),submitted=excluded.submitted,due=excluded.due,lot_command=excluded.lot_command
      WHERE runs.id=excluded.id AND runs.closed=0 AND runs.revision<16 AND (${additions})>0 RETURNING last_added,revision`,
      now,
      now + 550,
      inputs.size,
      command,
      sandbox.id,
      sandbox.persona,
      now,
      sandbox.dossierId,
      ids,
      ids,
    ),
    ...[...inputs].map(([fixture, bytes]) =>
      query(
        db,
        `INSERT OR IGNORE INTO run_inputs(run_id,fixture,bytes)
      SELECT id,?,? FROM runs WHERE id=? AND lot_command=? AND NOT(?='devis' AND length(input_pdf)>0) AND NOT(?='scan' AND length(input_scan)>0)`,
        fixture,
        bytes,
        sandbox.dossierId,
        command,
        fixture,
        fixture,
      ),
    ),
    query(
      db,
      `INSERT OR IGNORE INTO lot_events(run_id,revision,submitted) SELECT id,revision,submitted FROM runs WHERE id=? AND lot_command=?`,
      sandbox.dossierId,
      command,
    ),
  ]);
  const inserted = batch[0].results[0];
  if (!inserted) {
    const existing = await query(
      db,
      'SELECT closed,revision FROM runs WHERE sandbox=? AND persona=?',
      sandbox.id,
      sandbox.persona,
    ).first();
    if (existing?.closed) return error('Ce dossier est clôturé.', 409);
    if (existing?.revision >= 16) return error('Le quota de révisions de ce bac est atteint.', 429);
    return error('Les pièces de ce lot ont déjà été déposées.', 409);
  }
  ctx.waitUntil(reconcile(db, 600));
  return respond(
    {
      status: 'queued',
      revision: inserted.revision,
      added: inserted.last_added,
      duplicates: data.uploads.length - inserted.last_added,
    },
    202,
  );
}

async function correct(db, sandbox, data, ctx) {
  const date = data?.date,
    reason = data?.reason?.trim?.(),
    base = data?.revision;
  if (
    !realDate(date) ||
    typeof reason !== 'string' ||
    !reason ||
    reason.length > 180 ||
    /[\u0000-\u001f]/.test(reason) ||
    !Number.isInteger(base)
  )
    return error('Indiquez une date valide et un motif court.', 400);
  const now = Date.now();
  const updated = await query(
    db,
    `UPDATE runs SET retained_date=?,corrections=json_insert(corrections,'$[#]',json_object(
    'date',?,'reason',?,'author',?,'createdAt',?,'revision',revision+1)),revision=revision+1,status='queued',attempts=0,lease=NULL,submitted=?,due=?
    WHERE id=? AND sandbox=? AND persona=? AND closed=0 AND revision=? AND published_revision=revision AND revision<15
    AND EXISTS(SELECT 1 FROM deliveries d WHERE d.run_id=runs.id AND d.revision=runs.revision AND d.deadline IS NOT NULL AND d.deadline<>?)
    AND EXISTS(SELECT 1 FROM sandboxes WHERE id=runs.sandbox AND persona=runs.persona AND expires>?) RETURNING revision`,
    date,
    date,
    reason,
    'Client fictif ' + sandbox.persona.toUpperCase(),
    now,
    now,
    now + 550,
    sandbox.dossierId,
    sandbox.id,
    sandbox.persona,
    base,
    date,
    now,
  ).first();
  if (!updated)
    return error(
      'Correction indisponible. Relisez la dernière livraison et choisissez une nouvelle date.',
      409,
    );
  ctx.waitUntil(reconcile(db, 600));
  return respond({ status: 'queued', revision: updated.revision }, 202);
}

async function closeDossier(db, sandbox, data, ctx) {
  if (typeof data?.closed !== 'boolean') return error('Indiquez l’état de clôture.', 400);
  const row = await query(
    db,
    `UPDATE runs SET closed=?,status=CASE WHEN status='processing' THEN 'queued' ELSE status END,
    attempts=CASE WHEN status='processing' THEN 0 ELSE attempts END,lease=NULL,due=?
    WHERE id=? AND sandbox=? AND persona=? AND closed<>? AND EXISTS(SELECT 1 FROM sandboxes WHERE id=runs.sandbox AND persona=runs.persona AND expires>?) RETURNING closed`,
    Number(data.closed),
    Date.now(),
    sandbox.dossierId,
    sandbox.id,
    sandbox.persona,
    Number(data.closed),
    Date.now(),
  ).first();
  if (!row) {
    const current = await query(
      db,
      'SELECT closed FROM runs WHERE id=? AND sandbox=? AND persona=?',
      sandbox.dossierId,
      sandbox.id,
      sandbox.persona,
    ).first();
    return current ? respond({ closed: Boolean(current.closed) }) : error('Aucun dossier déposé.', 404);
  }
  if (!row.closed) ctx.waitUntil(reconcile(db));
  return respond({ closed: Boolean(row.closed) });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url),
      path = url.pathname;
    if (handlesConnector(path)) return handleConnector(request, env, digestCookie);
    if (request.method === 'GET') {
      if (path === '/' || path === '/recette/')
        return respond(page, 200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (path === '/robots.txt')
        return respond('User-agent: *\nDisallow: /\n', 200, { 'Content-Type': 'text/plain' });
      const fixture = [...fixtureList, ...bFixtureList, ...foodFixtureList].find((item) => item.url === path);
      const entry = path === '/assets/logo.webp' ? assets.logo : fixture ? assets[fixture.id] : null;
      if (entry) return respond(unpack(entry.data), 200, { 'Content-Type': entry.type });
    }
    if (
      ![
        '/api/services',
        '/api/session',
        '/api/reset',
        '/api/fichier',
        '/api/fichiers',
        '/api/depot',
        '/api/dossier',
        '/api/livraison.pdf',
        '/api/correction',
        '/api/cloture',
        '/api/edition-initiale.zip',
        '/api/livraison.zip',
      ].includes(path)
    )
      return error('Route inconnue.', 404);
    if (!env.DB) return error('Stockage de recette indisponible.', 503);
    if (request.method === 'POST' && request.headers.get('Origin') !== url.origin)
      return error('Origine invalide.', 403);
    const db = env.DB;
    try {
      const id = await digestCookie(request);
      const sandbox = id
        ? await query(db, 'SELECT id,persona FROM sandboxes WHERE id=? AND expires>?', id, Date.now()).first()
        : null;
      if (path === '/api/session' && request.method === 'POST') {
        const data = await readBody(request);
        if (!['a', 'b', 'c', 'sans'].includes(data?.persona)) return error('Profil de recette inconnu.', 400);
        if (sandbox) {
          await query(db, 'UPDATE sandboxes SET persona=? WHERE id=?', data.persona, id).run();
          return respond({ persona: data.persona });
        }
        const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
        const digest = await sha(new TextEncoder().encode(raw));
        const now = Date.now();
        await db.batch([
          query(db, 'DELETE FROM sandboxes WHERE expires<=?', now),
          query(
            db,
            'INSERT INTO sandboxes(id,persona,expires) SELECT ?,?,? WHERE (SELECT count(*) FROM sandboxes)<256',
            digest,
            data.persona,
            now + DAY,
          ),
        ]);
        if (!(await query(db, 'SELECT id FROM sandboxes WHERE id=?', digest).first()))
          return error('Capacité de recette atteinte.', 429);
        return respond({ persona: data.persona }, 201, {
          'Set-Cookie': cookieName + '=' + raw + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400',
        });
      }
      if (sandbox && sandbox.persona !== 'sans') {
        const slot = await openSlot(db, sandbox);
        if (!slot) return error('Le profil sélectionné a changé.', 409);
        Object.assign(sandbox, slot);
        if (slot.scenario === 'atelier') await restoreLegacy(db, sandbox);
      }
      if (path === '/api/dossier' && request.method === 'GET') {
        ctx.waitUntil(reconcile(db));
        const scenario = scenarios[sandbox?.scenario];
        return respond({
          persona: sandbox?.persona ?? null,
          dossierId: sandbox?.dossierId ?? null,
          scenario: scenario
            ? {
                id: sandbox.scenario,
                title: scenario.title,
                clientLabel: 'Client ' + sandbox.persona.toUpperCase(),
              }
            : null,
          run: scenario ? await runFor(db, sandbox) : null,
          fixtures: (scenario?.fixtures ?? []).map((f) => ({ ...f, sha256: fixtureHashes[f.id] })),
        });
      }
      if (!sandbox) return error('Choisissez un profil de recette.', 401);
      if (sandbox.persona === 'sans')
        return error('Un abonnement fictif actif est requis avant le dépôt.', 402);
      const data = request.method === 'POST' ? await readBody(request) : null;
      if (path === '/api/reset' && request.method === 'POST') return await reset(db, sandbox, data);
      const submittedId = request.method === 'POST' ? data?.dossier : url.searchParams.get('dossier');
      // Old unqualified URLs remain valid only until their original client resets the dossier.
      if (
        (submittedId != null || sandbox.generation > 0) &&
        submittedId !== sandbox.dossierId &&
        !(path === '/api/services' && request.method === 'GET' && submittedId == null)
      )
        return error('Ce dossier de recette n’est plus actif.', request.method === 'POST' ? 409 : 404);
      if (path === '/api/services') {
        const result = await handleDossierServices(db, sandbox, request.method, data);
        return respond(result.data, result.status);
      }
      if (path === '/api/edition-initiale.zip' && request.method === 'GET') {
        const dbRow = await query(
          db,
          `SELECT d.extraction FROM runs r JOIN deliveries d ON d.run_id=r.id AND d.revision=r.published_revision
          WHERE r.id=? AND r.sandbox=? AND r.persona=?`,
          sandbox.dossierId,
          sandbox.id,
          sandbox.persona,
        ).first();
        const sources = dbRow ? JSON.parse(dbRow.extraction) : {};
        if (!assets.initialPack || !sources.devis || !sources.scan)
          return error('Édition initiale indisponible.', 404);
        return respond(unpack(assets.initialPack.data), 200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename=Edition-initiale-fictive.zip',
        });
      }
      if (
        ['/api/livraison.pdf', '/api/livraison.zip', '/api/fichier', '/api/fichiers'].includes(path) &&
        request.method === 'GET'
      ) {
        const rev = url.searchParams.get('revision');
        if (rev !== null && !/^[1-9]\d?$/.test(rev)) return error('Révision inconnue.', 404);
        const individual = path === '/api/fichier',
          listing = path === '/api/fichiers',
          archive = path.endsWith('.zip');
        if (individual || listing) {
          const row = await query(
            db,
            `SELECT d.revision,d.files,d.file_count FROM runs r JOIN deliveries d ON d.run_id=r.id
            WHERE r.sandbox=? AND r.persona=? AND r.id=? AND d.revision=coalesce(?,r.published_revision)`,
            sandbox.id,
            sandbox.persona,
            sandbox.dossierId,
            rev === null ? null : Number(rev),
          ).first();
          if (!row) return error('Livraison indisponible.', 404);
          const files = await fileManifest(db, sandbox.dossierId, row.revision, row.files, row.file_count);
          if (listing)
            return respond({
              revision: row.revision,
              files: linkedFiles(files, sandbox.dossierId, row.revision),
            });
          const file = files.find((f) => f.name === url.searchParams.get('name'));
          if (!file) return error('Fichier absent de cette révision.', 404);
          const source = await query(
            db,
            'SELECT ' +
              (row.file_count === 1 ? 'pdf' : 'pack') +
              ' bytes FROM deliveries WHERE run_id=? AND revision=?',
            sandbox.dossierId,
            row.revision,
          ).first();
          if (!source?.bytes) return error('Fichier indisponible.', 404);
          const bytes = new Uint8Array(source.bytes);
          const content =
            row.file_count === 1
              ? bytes
              : unzipSync(bytes, { filter: (entry) => entry.name === file.name })[file.name];
          if (!content) return error('Fichier absent de cette archive.', 404);
          return respond(content, 200, {
            'Content-Type': file.mime,
            'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
          });
        }
        const field = archive ? 'pack' : 'pdf';
        const row = await query(
          db,
          `SELECT d.${field} bytes,d.revision FROM runs r JOIN deliveries d ON d.run_id=r.id
          WHERE r.sandbox=? AND r.persona=? AND r.id=? AND d.revision=coalesce(?,r.published_revision)`,
          sandbox.id,
          sandbox.persona,
          sandbox.dossierId,
          rev === null ? null : Number(rev),
        ).first();
        if (!row?.bytes) return error('Livraison indisponible.', 404);
        return respond(new Uint8Array(row.bytes), 200, {
          'Content-Type': archive ? 'application/zip' : 'application/pdf',
          'Content-Disposition':
            'attachment; filename=' +
            (archive ? 'Livraison-r' + row.revision + '.zip' : 'Tableau-de-bord-r' + row.revision + '.pdf'),
        });
      }
      if (request.method !== 'POST') return error('Méthode non autorisée.', 405);
      if (path === '/api/depot') return await submit(db, sandbox, data, ctx);
      if (path === '/api/correction') return await correct(db, sandbox, data, ctx);
      if (path === '/api/cloture') return await closeDossier(db, sandbox, data, ctx);
      return error('Méthode non autorisée.', 405);
    } catch {
      return error('Le service de recette est temporairement indisponible.', 503);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(reconcile(env.DB));
  },
};
