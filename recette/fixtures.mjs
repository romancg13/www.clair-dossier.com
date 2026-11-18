// Seules les empreintes de ces pièces synthétiques sont admissibles en recette publique.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { zipSync } from 'fflate';
import { fileURLToPath } from 'node:url';
import { buildChronology } from '../supabase/functions/_shared/analysis-model.ts';
import {
  checkEvidence,
  collectEvidence,
  detectInputKind,
} from '../supabase/functions/_shared/ai-pipeline.ts';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const definitions = [
  ['devis', 'devis.pdf', 'Devis CD-041.pdf', 'application/pdf'],
  ['scan', 'scan.png', 'Bon de réception numérisé.png', 'image/png'],
  ['avenant', 'avenant.pdf', 'Avenant au devis.pdf', 'application/pdf'],
  ['contradiction', 'contradiction.pdf', 'Courrier sur la date de retour.pdf', 'application/pdf'],
  ['illisible', 'illisible.png', 'Numérisation illisible.png', 'image/png'],
  ['incompatible', 'incompatible.bin', 'Format non pris en charge.bin', 'application/octet-stream'],
  ['manuel', 'manuel.pdf', 'Note de suivi historique.pdf', 'application/pdf'],
];
export const fixtures = new Map(
  definitions.map(([id, file, name, mime]) => {
    const path = fileURLToPath(new URL('./fixtures/' + file, import.meta.url));
    const bytes = readFileSync(path);
    return [id, { id, path, name, mime, bytes, digest: hash(bytes) }];
  }),
);

// Les pièces du corpus volumineux ont des contenus et empreintes distincts.
export const volumeDocuments = [];
for (let index = 0; index < 179; index++) {
  const id = 'suivi-' + String(index + 1).padStart(3, '0');
  const date = new Date(Date.UTC(2025, 8, 1 + index * 2))
    .toISOString()
    .slice(0, 10)
    .split('-')
    .reverse()
    .join('/');
  const name = 'Note de suivi ' + (index + 1) + '.txt';
  const bytes = Buffer.from('Note fictive de suivi CD-041 ' + (index + 1) + '\nVisite du ' + date + '.\n');
  const item = { id, name, mime: 'text/plain', bytes, digest: hash(bytes) };
  volumeDocuments.push(item);
  fixtures.set(id, item);
}
const archive = Buffer.from(
  zipSync(Object.fromEntries(volumeDocuments.map((f) => [f.name, f.bytes])), {
    mtime: new Date('2026-01-01T12:00:00Z'),
  }),
);
export const volume = {
  id: 'volume',
  name: 'Lot de 179 notes fictives.zip',
  mime: 'application/zip',
  bytes: archive,
  digest: hash(archive),
};
export const selectable = [...fixtures.values()].filter((f) => !f.id.startsWith('suivi-')).concat(volume);
export async function extractFixture(fixture) {
  const kind = detectInputKind(fixture.name, fixture.mime);
  if (kind === 'unsupported') return { status: 'unsupported', lines: [] };
  const [tool, args] =
    kind === 'image'
      ? ['tesseract', ['stdin', 'stdout', '-l', 'eng', '--psm', '6']]
      : ['pdftotext', ['-layout', '-', '-']];
  const stdout =
    kind === 'text'
      ? Buffer.from(fixture.bytes).toString('utf8')
      : await new Promise((ok, fail) => {
          const child = execFile(tool, args, { timeout: 15000, maxBuffer: 128 * 1024 }, (e, output) =>
            e ? fail(e) : ok(output),
          );
          child.stdin.on('error', fail);
          child.stdin.end(fixture.bytes);
        });
  const lines = stdout
    .trim()
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  return { status: lines.length ? 'ok' : 'unreadable', lines };
}

const isoDate = (value) => value.split('/').reverse().join('-');

/** La synthèse déterministe de recette se limite aux libellés du corpus ci-dessus. */
export function analyze(rows) {
  const analysis = {
    summary_short: '',
    summary_long: '',
    action_owner: 'Client',
    parties: [],
    facts: [],
    deadlines: [],
    contradictions: [],
    missing_items: [],
    attention_points: [],
    next_actions: [],
    reminder_drafts: [],
    events: [],
  };
  const dateCandidates = [];
  const documents = [];
  for (const row of rows) {
    const extraction = JSON.parse(row.extraction);
    if (extraction.status !== 'ok') {
      analysis.missing_items.push({
        text: fixtures.get(row.fixture).name,
        why:
          extraction.status === 'unsupported'
            ? 'Format non pris en charge : fournir une copie PDF lisible.'
            : 'Copie illisible : joindre une nouvelle numérisation.',
      });
      continue;
    }
    const dates = [];
    for (const line of extraction.lines) {
      const evidence = [{ document_id: row.id, page: 1, quote: line }];
      if (/^(Client|Prestataire) : /.test(line)) {
        const [role, name] = line.split(' : ');
        if (!analysis.parties.some((p) => p.role === role && p.name === name))
          analysis.parties.push({ name, role, evidence });
      }
      if (/^(Objet :|Prix TTC :|Le bon ne porte pas de signature)/.test(line)) {
        analysis.facts.push({ text: line.replace('18400 EUR', '18 400 €'), status: 'documented', evidence });
      }
      const match = line.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (!match) continue;
      const date = isoDate(match[1]);
      if (line.startsWith('Retour du procès-verbal')) {
        dateCandidates.push({ fixture: row.fixture, date, evidence });
      } else {
        const label = line.startsWith('Reception des')
          ? 'Réception des trois fenêtres'
          : line.split(/ (?:le|du) \d/)[0];
        dates.push({
          date,
          precision: 'day',
          label,
          kind: row.fixture === 'scan' ? 'event_date' : 'document_date',
          evidence: [{ page: 1, quote: line }],
        });
        analysis.facts.push({ text: line, status: 'documented', evidence });
      }
    }
    documents.push({ document_id: row.id, data: { dates } });
  }
  analysis.events = buildChronology(documents);
  const amended = dateCandidates.find((d) => d.fixture === 'avenant');
  const currentDates = dateCandidates.filter((d) => !amended || d.fixture !== 'devis');
  const disputed = new Set(currentDates.map((d) => d.date)).size > 1;
  for (const d of currentDates) {
    analysis.deadlines.push({
      title: 'Retour du procès-verbal',
      date: d.date,
      kind: disputed ? 'hypothesis' : 'mentioned',
      responsible: 'Client',
      basis: disputed
        ? 'Les pièces indiquent des dates différentes. Faire confirmer la date.'
        : d.evidence[0].quote,
      priority: 'normale',
      evidence: d.evidence,
    });
  }
  if (disputed)
    analysis.contradictions.push({
      text: 'Les dates de retour du procès-verbal divergent.',
      evidence: currentDates.flatMap((d) => d.evidence),
    });
  const hasScan = rows.some((r) => r.fixture === 'scan' && JSON.parse(r.extraction).status === 'ok');
  const hasDevis = rows.some((r) => r.fixture === 'devis' && JSON.parse(r.extraction).status === 'ok');
  const situation = hasDevis
    ? 'Le devis porte sur le remplacement de trois fenêtres pour 18 400 € TTC.'
    : 'Le devis initial ne figure pas dans ce lot.';
  const followup = hasScan
    ? 'Le bon de réception déposé ne porte pas de signature.'
    : 'Le bon de réception ne figure pas dans ce lot.';
  analysis.summary_short = situation + ' ' + followup;
  analysis.summary_long = disputed
    ? 'Le devis ou son avenant et le courrier indiquent des dates différentes pour le retour du procès-verbal.'
    : followup;
  const unreadable = analysis.missing_items[0];
  analysis.next_actions.push(
    unreadable
      ? 'Joindre une copie lisible de « ' + unreadable.text + ' ».'
      : disputed
        ? 'Faire confirmer la date de retour.'
        : hasScan
          ? 'Demander le bon de réception signé.'
          : 'Joindre le bon de réception.',
  );
  if (hasScan) {
    analysis.missing_items.push({
      text: 'Bon de réception signé',
      why: 'La copie reçue ne porte pas de signature.',
    });
    analysis.reminder_drafts.push({
      audience: 'third_party',
      subject: 'Chantier CD-041 — bon de réception signé',
      recipient_hint: 'Atelier Témoin',
      body: 'Bonjour, notre exemplaire du bon de réception des trois fenêtres ne porte pas de signature. Pourriez-vous nous retourner un exemplaire signé si vous en disposez ? Merci.\nÀ envoyer uniquement après vérification de votre dossier.',
      suggested_date: null,
    });
  } else if (hasDevis) {
    analysis.missing_items.push({
      text: 'Bon de réception',
      why: 'Le devis prévoit le retour du procès-verbal.',
    });
  }
  const sources = checkEvidence(
    collectEvidence(analysis),
    new Set(rows.map((r) => r.id)),
    new Map(rows.map((r) => [r.id, 1])),
  );
  if (!sources.ok) throw new Error('INVALID_EVIDENCE');
  for (const e of collectEvidence(analysis)) {
    const row = rows.find((r) => r.id === e.document_id);
    if (!row || !JSON.parse(row.extraction).lines.includes(e.quote)) throw new Error('INVALID_QUOTE');
  }
  const extracted = rows.filter((r) => JSON.parse(r.extraction).status === 'ok').length;
  const unsupported = rows.filter((r) => JSON.parse(r.extraction).status === 'unsupported').length;
  return {
    analysis,
    coverage: {
      total: rows.length,
      extracted,
      unsupported,
      failed: rows.length - extracted - unsupported,
      pending: 0,
      complete: extracted === rows.length,
    },
  };
}

export function categoryInputs(analysis, coverage, pieces, corrections) {
  return {
    resume: [
      analysis.summary_short,
      analysis.summary_long,
      analysis.parties,
      analysis.facts,
      analysis.contradictions,
      analysis.missing_items,
      analysis.next_actions,
      pieces,
    ],
    dashboard: [
      analysis.summary_short,
      analysis.next_actions,
      analysis.deadlines,
      analysis.missing_items,
      coverage,
    ],
    chronologie: [analysis.events, corrections],
    dates: [analysis.events, corrections],
    echeances: [analysis.deadlines],
    relances: [analysis.reminder_drafts],
  };
}
