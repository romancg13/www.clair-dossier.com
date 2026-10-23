import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync, zipSync, strToU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { buildDocx, buildXlsx, docxToText, xlsxToText } from '../supabase/functions/_shared/office.ts';
import {
  DELIVERABLE_CATALOG,
  applyOverrides,
  buildChronology,
  buildDeliverables,
  deliverableKeyOf,
  type DeadlineRow,
} from '../supabase/functions/_shared/deliverables.ts';
import { trackingStep, TIMELINE_STEPS } from '../packages/core/src/dossiers.ts';
import { bulkPieces, demoAnalysis, DEMO_PIECES } from '../src/demo/fixture.ts';

const cov = { total: 11, extracted: 11, unsupported: 0, failed: 0, pending: 0, complete: true };
const at = new Date('2026-10-23T10:00:00Z');

test('DOCX : écriture puis relecture du texte (accents, caractères XML échappés)', () => {
  const bytes = buildDocx([{ kind: 'title', text: 'Résumé' }, { kind: 'para', text: 'Montant < 5 000 € & « délai »' }, { kind: 'bullet', text: 'Ligne 2' }], 'Test');
  const text = docxToText(bytes);
  assert.match(text, /Résumé/);
  assert.match(text, /Montant < 5 000 € & « délai »/);
  assert.match(text, /Ligne 2/);
});

test('XLSX : écriture puis relecture (plusieurs feuilles, nombres, cellules vides)', () => {
  const bytes = buildXlsx([
    { name: 'Dates', headers: ['Date', 'Montant'], rows: [['03/11/2026', 12880], ['', null]] },
    { name: 'Historique/2026', headers: ['Motif'], rows: [['correction « manuelle »']] },
  ]);
  const text = xlsxToText(bytes);
  assert.match(text, /## Feuille Dates\nDate;Montant\n03\/11\/2026;12880/);
  assert.match(text, /Feuille Historique 2026/);
  assert.match(text, /correction « manuelle »/);
});

test('lecteurs bornés : une archive démesurée est refusée (bombe zip)', () => {
  const huge = zipSync({ 'word/document.xml': new Uint8Array(60 * 1024 * 1024) }, { level: 9 });
  assert.ok(huge.byteLength < 1_000_000, 'archive compressée petite');
  assert.throws(() => docxToText(huge), /trop volumineuse/);
  assert.throws(() => docxToText(zipSync({ 'autre.xml': strToU8('<x/>') })), /DOCX invalide/);
});

test('chronologie déterministe : fusion des doublons, sources cumulées, tri, échéances exclues', () => {
  const events = buildChronology([
    { document_id: 'a', data: { dates: [{ date: '2026-09-29', precision: 'day', kind: 'event_date', label: 'Contestation', evidence: [{ page: 1, quote: 'x' }] }, { date: '2026-09-30', precision: 'day', kind: 'deadline', label: 'Échéance', evidence: [] }] } },
    { document_id: 'b', data: { dates: [{ date: '2026-09-29', precision: 'day', kind: 'event_date', label: 'contestation', evidence: [{ page: 2, quote: 'y' }] }, { date: '2026-06', precision: 'month', kind: 'document_date', label: 'CGV', evidence: [] }, { date: 'vers 2025', precision: 'unknown', kind: 'event_date', label: 'invalide', evidence: [] }] } },
    { document_id: 'c', data: null },
  ]);
  assert.deepEqual(events.map((e) => [e.date, e.label]), [['2026-06', 'CGV'], ['2026-09-29', 'Contestation']]);
  assert.deepEqual(events[1].evidence.map((e) => e.document_id), ['a', 'b']);
});

test('corrections humaines : la dernière l’emporte, masquage conservé, historique intact', () => {
  const [e] = buildChronology([{ document_id: 'a', data: { dates: [{ date: '2026-09-20', precision: 'day', kind: 'event_date', label: 'Relance', evidence: [] }] } }]);
  const out = applyOverrides([e], [
    { event_key: e.key, retained_date: '2026-09-22', label: null, hidden: false, reason: 'cachet de la poste', author: 'A', created_at: '2026-10-01T10:00:00Z' },
    { event_key: e.key, retained_date: '2026-09-21', label: null, hidden: false, reason: 'accusé de réception', author: 'B', created_at: '2026-10-02T10:00:00Z' },
  ]);
  assert.equal(out[0].retained_date, '2026-09-21');
  assert.equal(out[0].date, '2026-09-20', 'date extraite conservée');
  assert.equal(out[0].author, 'B');
  assert.equal(out[0].edited, true);
});

test('suivi en 4 étapes fondé sur les événements réels', () => {
  assert.deepEqual(TIMELINE_STEPS, ['Dossier créé', 'Traitement en cours', 'Livrables disponibles', 'Dossier clôturé']);
  const f = { status: 'brouillon', hasDeliverables: false, processing: false, closed: false };
  assert.equal(trackingStep(f), 1);
  assert.equal(trackingStep({ ...f, processing: true }), 2);
  assert.equal(trackingStep({ ...f, status: 'valide' }), 2, '« valide » sans livrable ne déclare pas de livrable');
  assert.equal(trackingStep({ ...f, hasDeliverables: true, processing: true }), 3, 'mise à jour en cours : les livrables restent disponibles');
  assert.equal(trackingStep({ ...f, hasDeliverables: true, closed: true }), 4);
  assert.equal(trackingStep({ ...f, forcedStep: 5 }), 2, 'ancienne étape forcée (1–5) bornée au traitement');
});

test('six livrables : 13 fichiers valides, noms reconnus, formats PDF/DOCX/XLSX/CSV/ICS', async () => {
  const files = await buildDeliverables({ title: 'Dossier test', revision: 2, generatedAt: at, analysis: demoAnalysis(), coverage: cov, pieces: DEMO_PIECES });
  assert.equal(files.length, 13);
  for (const d of DELIVERABLE_CATALOG) assert.ok(files.some((f) => f.key === d.key), `livrable ${d.key} présent`);
  for (const f of files) assert.equal(deliverableKeyOf(f.name), f.key, f.name);
  assert.equal(deliverableKeyOf('Contrat signé.pdf'), null, 'un livrable manuel n’est jamais confondu');
  for (const f of files.filter((x) => x.name.endsWith('.pdf'))) {
    const pdf = await PDFDocument.load(f.bytes);
    assert.ok(pdf.getPageCount() >= 1, f.name);
  }
  for (const f of files.filter((x) => /\.(docx|xlsx)$/.test(x.name))) assert.ok(Object.keys(unzipSync(f.bytes)).length >= 4, f.name);
  const ics = strFromU8(files.find((f) => f.name.endsWith('.ics'))!.bytes);
  assert.match(ics, /DTSTART;VALUE=DATE:20261109/);
  const relances = docxToText(files.find((f) => f.name === 'Relances-r2.docx')!.bytes);
  assert.match(relances, /aucun envoi automatique/i);
});

test('échéances : correction humaine et ajout manuel reflétés dans les livrables', async () => {
  const rows: DeadlineRow[] = [
    { ai_key: '2026-11-09:fin-du-delai-laisse-par-la-deuxieme-relance', title: 'Fin du délai (corrigée)', due_date: '2026-11-12', due_time: null, priority: 'haute', done: false, user_edited: true, description: null },
    { ai_key: null, title: 'Rendez-vous expert', due_date: '2026-11-20', due_time: '14:30:00', priority: 'normale', done: false, user_edited: false, description: 'ajout manuel' },
  ];
  const files = await buildDeliverables({ title: 'T', revision: 1, generatedAt: at, analysis: demoAnalysis(), coverage: cov, pieces: DEMO_PIECES, deadlineRows: rows });
  const xlsx = xlsxToText(files.find((f) => f.name === 'Echeances-r1.xlsx')!.bytes);
  assert.match(xlsx, /12\/11\/2026;;Fin du délai \(corrigée\);Date calculée — corrigée par vous/);
  assert.match(xlsx, /20\/11\/2026;14:30;Rendez-vous expert;Ajoutée manuellement/);
  const ics = strFromU8(files.find((f) => f.name.endsWith('.ics'))!.bytes);
  assert.match(ics, /DTSTART;TZID=Europe\/Paris:20261120T143000/);
});

test('couverture partielle : mention explicite dans les livrables, jamais « complète »', async () => {
  const files = await buildDeliverables({ title: 'T', revision: 1, generatedAt: at, analysis: demoAnalysis(), coverage: { ...cov, total: 13, extracted: 11, unsupported: 1, failed: 1, complete: false }, pieces: DEMO_PIECES });
  const resume = docxToText(files.find((f) => f.name === 'Resume-IA-r1.docx')!.bytes);
  assert.match(resume, /Analyse PARTIELLE — 11\/13 pièces exploitées, 1 en échec, 1 non prise\(s\) en charge/);
  assert.doesNotMatch(resume, /Analyse complète/);
});

test('dossier de 190 pièces : chronologie et six livrables générés en moins de 10 s', async () => {
  const t0 = Date.now();
  const bulk = bulkPieces();
  const pieces = [...DEMO_PIECES, ...bulk.pieces];
  assert.equal(pieces.length, 190);
  const analysis = demoAnalysis(true);
  assert.ok(analysis.events.length >= 190, `${analysis.events.length} événements`);
  const files = await buildDeliverables({ title: 'Dossier volumineux', revision: 1, generatedAt: at, analysis, coverage: { ...cov, total: 190, extracted: 190 }, pieces });
  const chrono = await PDFDocument.load(files.find((f) => f.name === 'Chronologie-r1.pdf')!.bytes);
  assert.ok(chrono.getPageCount() > 3);
  assert.ok(Date.now() - t0 < 10_000, `${Date.now() - t0} ms`);
});
