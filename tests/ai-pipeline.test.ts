import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIcs,
  checkEvidence,
  collectEvidence,
  coverage,
  deadlineKey,
  detectInputKind,
  estimateCostCents,
  safeFileName,
  toCsv,
} from '../supabase/functions/_shared/ai-pipeline.ts';

test("détection du type de pièce : MIME réel d'abord, extension ensuite", () => {
  assert.equal(detectInputKind('scan.PDF', null), 'pdf');
  assert.equal(detectInputKind('photo', 'image/jpeg'), 'image');
  assert.equal(detectInputKind('contrat.docx', 'application/octet-stream'), 'docx');
  assert.equal(detectInputKind('export.xlsx', null), 'sheet');
  assert.equal(detectInputKind('mail.eml', null), 'text');
  assert.equal(detectInputKind('archive.zip', 'application/zip'), 'unsupported');
  assert.equal(detectInputKind('x.heic', 'image/heic'), 'unsupported');
});

test('preuves : pièce inconnue, extrait vide et page hors limite sont rejetés', () => {
  const known = new Set(['doc-a']);
  const pages = new Map<string, number | null>([['doc-a', 3]]);
  assert.deepEqual(checkEvidence([{ document_id: 'doc-a', page: 2, quote: 'Art. 7' }], known, pages), { ok: true, problems: [] });
  const bad = checkEvidence(
    [
      { document_id: 'doc-z', page: 1, quote: 'x' },
      { document_id: 'doc-a', page: 9, quote: '  ' },
    ],
    known,
    pages,
  );
  assert.equal(bad.ok, false);
  assert.equal(bad.problems.length, 3);
  // Page inconnue (DOCX converti) : la page n'est pas contrôlée, l'extrait reste exigé.
  assert.equal(checkEvidence([{ document_id: 'doc-a', page: 40, quote: 'ok' }], known, new Map([['doc-a', null]])).ok, true);
});

test('collecte récursive des preuves dans une sortie structurée', () => {
  const out = {
    parties: [{ name: 'A', evidence: [{ document_id: 'd1', page: 1, quote: 'q' }] }],
    nested: { deadlines: [{ evidence: [{ document_id: 'd2', page: null, quote: 'r' }, { bogus: true }] }] },
  };
  assert.deepEqual(collectEvidence(out).map((e) => e.document_id), ['d1', 'd2']);
});

test('coût : tarif par modèle, 0 pour un modèle inconnu', () => {
  assert.equal(estimateCostCents('claude-opus-5-5', 1_000_000, 0, 1), 400);
  assert.equal(estimateCostCents('claude-opus-5-5', 0, 100_000, 1), 200);
  assert.equal(estimateCostCents('modele-inconnu', 1_000_000, 1_000_000), 0);
});

test('CSV : séparateur « ; », BOM, guillemets doublés', () => {
  const csv = toCsv(['a', 'b'], [['x;y', 'il a dit "non"'], [1, null]]);
  assert.ok(csv.startsWith('﻿a;b\r\n'));
  assert.ok(csv.includes('"x;y";"il a dit ""non"""'));
  assert.ok(csv.endsWith('1;\r\n'));
});

test('ICS : date sans heure = VALUE=DATE (aucun fuseau), échappement RFC 5545', () => {
  const ics = buildIcs(
    [
      { uid: 'u1@clair-dossier.com', date: '2026-11-03', summary: 'Réponse; mise en demeure, délai' },
      { uid: 'u2', date: '2026-11-04', time: '14:30', summary: 'RDV' },
    ],
    'Test',
    new Date('2026-10-23T10:00:00Z'),
  );
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261103'));
  assert.ok(ics.includes('SUMMARY:Réponse\\; mise en demeure\\, délai'));
  assert.ok(ics.includes('DTSTART;TZID=Europe/Paris:20261104T143000'));
  assert.ok(ics.includes('DTSTAMP:20261023T100000Z'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('couverture : « complète » seulement sans pièce en attente ni en erreur', () => {
  assert.equal(coverage(['ok', 'ok']).complete, true);
  assert.equal(coverage(['ok', 'unsupported']).complete, true);
  assert.equal(coverage(['ok', null]).complete, false);
  assert.equal(coverage(['ok', 'error']).complete, false);
  assert.equal(coverage([]).complete, false);
  assert.deepEqual(coverage(['ok', null, 'error', 'unsupported']), { total: 4, extracted: 1, unsupported: 1, failed: 1, pending: 1, complete: false });
});

test("clé d'échéance stable et nom de fichier sûr", () => {
  assert.equal(deadlineKey('Réponse à la mise en demeure', '2026-11-03'), deadlineKey('reponse a la mise en demeure', '2026-11-03'));
  assert.equal(deadlineKey('Échéance', '2026-11-03'), '2026-11-03:echeance');
  assert.equal(safeFileName('Résumé IA r1 (final).pdf'), 'Resume_IA_r1_final_.pdf');
});
