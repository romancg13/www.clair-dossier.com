import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstResults, unreadPieces, type ExtractionRow } from '../src/lib/ai-first-results.ts';

const row = (over: Partial<ExtractionRow>): ExtractionRow => ({
  document_id: 'd1',
  status: 'ok',
  error: null,
  created_at: '2026-11-28T10:00:00Z',
  doc_type: 'Mise en demeure',
  summary: 'Le bailleur réclame deux loyers.',
  dates: [],
  ...over,
});
const names = { d1: 'mise-en-demeure.pdf', d2: 'archive.zip' };

test('premiers résultats : pièces lues depuis la dernière analyse, échéances repérées seulement', () => {
  const rows = [
    row({
      dates: [
        { kind: 'deadline', date: '2026-12-15', label: 'Paiement sous huit jours' },
        { kind: 'document_date', date: '2026-11-20', label: 'Date du courrier' },
        { kind: 'deadline', date: 12, label: 'forme invalide' },
        'pas un objet',
      ],
    }),
    row({ document_id: 'ancien', created_at: '2026-11-01T10:00:00Z' }),
    row({ document_id: 'd2', status: 'unsupported' }),
  ];
  const out = firstResults(rows, names, '2026-11-15T00:00:00Z');
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'mise-en-demeure.pdf');
  assert.deepEqual(out[0].deadlines, [{ date: '2026-12-15', label: 'Paiement sous huit jours' }]);
  assert.equal(firstResults(rows, names, null).length, 2, 'sans analyse : toutes les pièces lues');
});

test('premiers résultats : sortie de modèle malformée tolérée, résumé borné', () => {
  const out = firstResults([row({ doc_type: null, summary: 'x'.repeat(900), dates: { piege: true } })], {}, null);
  assert.equal(out[0].name, 'Pièce');
  assert.equal(out[0].type, null);
  assert.ok((out[0].summary ?? '').length <= 320);
  assert.deepEqual(out[0].deadlines, []);
});

test('pièces non lues : motif sans détail technique, pièces supprimées ignorées', () => {
  const rows = [
    row({ document_id: 'd2', status: 'unsupported', error: 'Fichier illisible, protégé ou corrompu (Failed to parse PDF at offset 12)' }),
    row({ document_id: 'supprimee', status: 'unsupported', error: 'Format non pris en charge (application/zip)' }),
    row({}),
  ];
  assert.deepEqual(unreadPieces(rows, names), [{ id: 'd2', name: 'archive.zip', reason: 'Fichier illisible, protégé ou corrompu' }]);
});
