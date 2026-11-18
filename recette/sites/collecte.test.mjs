import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { FOOD_FIXTURES, foodReport, foodEvidenceValid } from './collecte.mjs';
import { renderReport } from './report.mjs';

const evidence = Object.fromEntries(Object.entries(FOOD_FIXTURES).map(([id, f]) => [id, { lines: f.lines }]));
const stamp = Date.parse('2026-11-19T06:00:00Z');

test('collecte · 4 pièces, 15 fichiers, échéances confirmées de 08:30, 09:30, 10:30', async () => {
  const report = foodReport(evidence);
  for (const fact of report.analysis.facts) {
    for (const ref of fact.evidence) assert.ok(evidence[ref.document_id].lines.includes(ref.quote));
  }
  const result = await renderReport({ ...report, revision: 1, publishedAt: stamp });
  assert.equal(result.count, 15);
  const archive = unzipSync(result.pack);
  assert.deepEqual(
    Object.keys(archive),
    result.files.map((f) => f.name),
  );
  const calendar = new TextDecoder().decode(archive['Echeances-r1.ics']);
  assert.deepEqual(calendar.match(/^DTSTART.+$/gm), [
    'DTSTART;TZID=Europe/Paris:20261119T083000',
    'DTSTART;TZID=Europe/Paris:20261119T093000',
    'DTSTART;TZID=Europe/Paris:20261119T103000',
  ]);
  assert.match(report.summary, /20 cartons.*144 kg/);
  assert.match(report.draft, /Objet :.*quai B/);
});

test('collecte · un inventaire isolé et une correction gardent leurs périmètres', () => {
  const inventory = foodReport({ inventaire: evidence.inventaire });
  assert.equal(inventory.date, null);
  assert.equal(inventory.deadlineRows.length, 0);
  assert.match(inventory.analysis.missing_items.map((m) => m.text).join(' '), /Courriel de tournée/);
  assert.equal(foodEvidenceValid('inventaire', ['Total prévu : 20 cartons, 144 kg.']), false);
  const revised = foodReport(evidence, '2026-11-18', [
    { date: '2026-11-18', reason: 'Confirmation à anticiper', author: 'Client fictif C', createdAt: stamp },
  ]);
  assert.equal(revised.originalDate, '2026-11-19');
  assert.deepEqual(
    revised.deadlineRows.map((d) => [d.due_date, d.due_time]),
    [
      ['2026-11-19', '09:30:00'],
      ['2026-11-19', '10:30:00'],
      ['2026-11-18', '08:30:00'],
    ],
  );
  assert.match(revised.dateSource, /Confirmation à anticiper/);
});
