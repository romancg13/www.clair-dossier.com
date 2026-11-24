// Démo « assurance construction » (dossier FICTIF) : jeu de caractères du PDF validé.
// L'écran bloque l'export d'un texte hors WinAnsi ; le PDF garde les espaces insécables
// et ne déborde jamais de la marge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { DOSSIER } from '../src/demo/construction/dossier.ts';
import { FLAGGED_PARAGRAPH_ID, buildReport } from '../src/demo/construction/report.ts';
import { normalizePdfText, pdfSafe, unsupportedChars } from '../src/demo/construction/pdf-charset.ts';
import { renderReportPdf, wrapText } from '../src/demo/construction/report-pdf.ts';
import { extractPdfText } from './helpers/pdf-text.ts';

const NBSP = '\u00A0';

test('unsupportedChars : flèche, ≠ et émoji signalés une fois chacun, WinAnsi accepté', () => {
  assert.deepEqual(unsupportedChars('Test → fin → ≠ 🏠'), ['→', '≠', '🏠']);
  assert.deepEqual(unsupportedChars('Été «\u00A02\u202F840,00\u00A0€\u00A0» — l’œuvre… n° 2\nfin'), []);
  assert.deepEqual(unsupportedChars('6\u202Fjanvier\t6\u2009mars\u2002\u2003\u2007\r\n'), [], 'espaces typographiques normalisées');
  assert.equal(pdfSafe('a → b'), 'a ? b');
});

test('normalisation : U+202F et U+00A0 deviennent U+00A0, jamais une espace ordinaire', () => {
  assert.equal(normalizePdfText('6\u202Fjanvier'), `6${NBSP}janvier`);
  assert.equal(normalizePdfText(`6${NBSP}janvier`), `6${NBSP}janvier`);
  assert.equal(pdfSafe('le 6\u202Fjanvier 2025'), `le 6${NBSP}janvier 2025`);
  assert.equal(normalizePdfText('a\u2009b\tc'), 'a b c');
});

test('retour à la ligne : un mot plus long que la ligne est coupé au caractère, sans dépassement', async () => {
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const width = 120;
  const long = 'Infiltrations'.repeat(6);
  const lines = wrapText(`avant ${long} après`, font, 10.5, width);
  assert.ok(lines.length > 3, lines.join(' | '));
  for (const l of lines) assert.ok(font.widthOfTextAtSize(l, 10.5) <= width, `« ${l} » dépasse`);
  assert.equal(lines.join('').replace(/ /g, ''), `avant${long}après`, 'aucun caractère perdu');
});

test('retour à la ligne : jamais de coupure sur une espace insécable', async () => {
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const lead = 'mot '.repeat(40);
  for (let width = 60; width < 400; width += 7) {
    const lines = wrapText(`${lead}le 6${NBSP}janvier 2025`, font, 10.5, width);
    assert.ok(lines.some((l) => l.includes(`6${NBSP}janvier`)), `largeur ${width} : ${lines.slice(-3).join(' | ')}`);
  }
});

test('PDF réel : « 6 janvier » insécable reste sur une ligne, encodé U+00A0', async () => {
  const at = new Date('2026-11-24T13:32:00Z');
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const base = 'La déclaration de sinistre de l’occupante situe la première apparition au '.repeat(2);
  let controlBreaks = 0;
  // Décale la date le long de la ligne : à l'une des positions, une espace ordinaire serait coupée.
  for (let k = 0; k <= 90; k += 3) {
    const text = `${'i'.repeat(k)} ${base}6\u202Fjanvier 2025.`;
    // Témoin : même texte avec une espace ordinaire (largeur du paragraphe dans le PDF).
    if (wrapText(text.replace('\u202F', ' '), font, 10.5, 595.28 - 2 * 56 - 10).some((l) => l.endsWith(' 6') || l === '6')) controlBreaks++;
    const report = buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: text });
    const lines = extractPdfText(await renderReportPdf(report, { at })).split('\n');
    assert.ok(lines.some((l) => l.includes(`6${NBSP}janvier 2025`)), `k=${k} : date sur une seule ligne, espace insécable conservée`);
    assert.ok(!lines.some((l) => /(^|\s)6$/.test(l)), `k=${k} : aucune ligne ne se termine par « 6 »`);
    assert.ok(!lines.join('\n').includes('?'), `k=${k} : aucun caractère remplacé par « ? »`);
  }
  assert.ok(controlBreaks > 0, 'le témoin à espace ordinaire est bien coupé entre « 6 » et « janvier »');
});
