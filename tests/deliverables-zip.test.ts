import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { buildZip, safeEntryName, zipEntries, zipFileName } from '../src/lib/deliverables-zip.ts';
import { buildDeliverables } from '../supabase/functions/_shared/deliverables.ts';
import { demoAnalysis, DEMO_PIECES } from '../src/demo/fixture.ts';

const mtime = new Date('2026-10-23T10:00:00Z');

test('zip : contenu restitué à l’identique, formats compressés stockés tels quels', () => {
  const pdf = new Uint8Array(4096).fill(7);
  const zip = zipEntries([{ name: 'Resume-IA-r3.pdf', bytes: pdf }, { name: 'Chronologie-r3.csv', bytes: strToU8('Date;Événement\n'.repeat(200)) }], mtime);
  const back = unzipSync(zip);
  assert.deepEqual(Object.keys(back), ['Resume-IA-r3.pdf', 'Chronologie-r3.csv']);
  assert.deepEqual(back['Resume-IA-r3.pdf'], pdf);
  assert.equal(strFromU8(back['Chronologie-r3.csv']).split('\n').length, 201);
  assert.ok(zip.byteLength > 4096, 'PDF non recompressé');
  assert.deepEqual(zipEntries([{ name: 'a.csv', bytes: strToU8('x') }], mtime), zipEntries([{ name: 'a.csv', bytes: strToU8('x') }], mtime), 'archive reproductible');
});

test('zip : noms assainis (aucun chemin), doublons conservés, liste vide refusée', () => {
  assert.equal(safeEntryName('../../etc/passwd'), 'passwd');
  assert.equal(safeEntryName('C:\\Users\\x\\Résumé.pdf'), 'Résumé.pdf');
  assert.equal(safeEntryName('..'), 'fichier');
  assert.equal(safeEntryName('a\u0000b<>.pdf'), 'ab.pdf');
  const back = unzipSync(zipEntries([
    { name: 'Relances-r1.pdf', bytes: strToU8('1') },
    { name: 'relances-r1.pdf', bytes: strToU8('2') },
    { name: 'autre/Relances-r1.pdf', bytes: strToU8('3') },
    { name: '../secret', bytes: strToU8('4') },
  ], mtime));
  assert.deepEqual(Object.keys(back), ['Relances-r1.pdf', 'relances-r1 (2).pdf', 'Relances-r1 (3).pdf', 'secret']);
  assert.ok(Object.keys(back).every((n) => !/[\\/]/.test(n)));
  assert.throws(() => zipEntries([]), /Aucun fichier/);
  assert.equal(zipFileName('Facture impayée — chantier « Maison Témoin »'), 'documents-Facture-impayee-chantier-Maison-Temoin.zip');
  assert.equal(zipFileName(null), 'documents-dossier.zip');
});

test('zip : uniquement les fichiers fournis, échec d’un fichier signalé sans bloquer les autres', async () => {
  const calls: string[] = [];
  const src = (name: string, body: string | null) => ({
    name,
    getBlob: async () => {
      calls.push(name);
      if (body === null) throw new Error('indisponible');
      return new Blob([body]);
    },
  });
  const r = await buildZip([src('a.csv', 'A'), src('b.ics', null), src('c.csv', 'C')], mtime);
  assert.deepEqual(calls, ['a.csv', 'b.ics', 'c.csv'], 'un seul appel par fichier, dans l’ordre');
  assert.deepEqual(r.included, ['a.csv', 'c.csv']);
  assert.deepEqual(r.failed, ['b.ics']);
  assert.deepEqual(Object.keys(unzipSync(r.zip!)), ['a.csv', 'c.csv']);
  const none = await buildZip([src('x.pdf', null)]);
  assert.equal(none.zip, null);
  assert.deepEqual(none.failed, ['x.pdf']);
});

test('zip global : les 13 fichiers de la révision, octet pour octet', async () => {
  const files = await buildDeliverables({ title: 'T', revision: 4, generatedAt: mtime, analysis: demoAnalysis(), coverage: { total: 11, extracted: 11, unsupported: 0, failed: 0, pending: 0, complete: true }, pieces: DEMO_PIECES });
  const { zip, failed } = await buildZip(files.map((f) => ({ name: f.name, getBlob: async () => new Blob([f.bytes as BlobPart], { type: f.mime }) })), mtime);
  assert.deepEqual(failed, []);
  const back = unzipSync(zip!);
  assert.equal(Object.keys(back).length, 13);
  for (const f of files) assert.deepEqual(back[f.name], f.bytes, f.name);
});
