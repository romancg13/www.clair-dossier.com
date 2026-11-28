import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { expandArchives } from '../src/lib/archives.ts';

const zip = () =>
  zipSync({
    'contrat.pdf': strToU8('%PDF-1.4 contrat'),
    'sous-dossier/facture.pdf': strToU8('%PDF-1.4 facture'),
    'releve.xlsx': strToU8('tableur'),
    '__MACOSX/._contrat.pdf': strToU8('x'),
    '.DS_Store': strToU8('x'),
    'vide.txt': new Uint8Array(0),
  });

test('archive ZIP : remplacée par ses fichiers acceptés ; le reste est signalé, jamais déposé', async () => {
  const autre = new File([strToU8('note')], 'note.txt', { type: 'text/plain' });
  const r = await expandArchives([new File([zip() as BlobPart], 'pieces.zip'), autre]);
  assert.deepEqual(r.files.map((f) => f.name), ['contrat.pdf', 'facture.pdf', 'note.txt']);
  assert.equal(r.files[0].type, 'application/pdf');
  assert.deepEqual(r.skipped.sort(), ['releve.xlsx', 'vide.txt']);
});

test('archive renommée en .pdf (régression du 28/11) : reconnue à sa signature et ouverte', async () => {
  const r = await expandArchives([new File([zip() as BlobPart], 'pieces-fictives-test-ia.pdf', { type: 'application/pdf' })]);
  assert.deepEqual(r.files.map((f) => f.name), ['contrat.pdf', 'facture.pdf']);
});

test('document Word (conteneur ZIP) et vrai PDF : jamais ouverts comme archives', async () => {
  const docx = new File([zip() as BlobPart], 'courrier.docx');
  const pdf = new File([strToU8('%PDF-1.7')], 'vrai.pdf');
  const r = await expandArchives([docx, pdf]);
  assert.deepEqual(r.files, [docx, pdf]);
  assert.deepEqual(r.skipped, []);
});

test('archive corrompue : signalée, rien n’est déposé', async () => {
  const r = await expandArchives([new File([strToU8('PK\u0003\u0004pas une archive')], 'cassee.zip')]);
  assert.equal(r.files.length, 0);
  assert.match(r.skipped[0], /archive illisible/);
});
