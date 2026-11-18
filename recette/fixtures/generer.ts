// Génère les pièces binaires du dossier fictif (recette/fixtures/pieces/) à partir
// de dossier-lumen.ts. Reproductible : `npx tsx recette/fixtures/generer.ts`.
// Le scan est une image de texte (rendue par ImageMagick) insérée dans un PDF :
// il ne contient AUCUN texte extractible, comme un vrai document numérisé.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildXlsx } from '../../supabase/functions/_shared/office.ts';
import { PIECES_LUMEN, grosLot, type PieceFictive } from './dossier-lumen.ts';

const OUT = new URL('./pieces/', import.meta.url).pathname;
const FIXED_DATE = new Date('2026-11-18T08:00:00Z');

async function pdfTexte(pages: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  pdf.setProducer('ClairDossier — recette (pièce fictive)');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = pdf.addPage([595.28, 841.89]);
    let y = 780;
    for (const para of text.split('\n')) {
      const words = para.split(' ');
      let line = '';
      const flush = () => {
        page.drawText(line, { x: 60, y, size: 10.5, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 15;
        line = '';
      };
      for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(t, 10.5) > 475 && line) {
          flush();
          line = w;
        } else line = t;
      }
      if (line) flush();
      else y -= 8;
    }
  }
  return pdf.save({ useObjectStreams: false });
}

async function pdfScan(pages: string[]): Promise<Uint8Array> {
  const dir = mkdtempSync(join(tmpdir(), 'scan-'));
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  for (const [i, text] of pages.entries()) {
    const png = join(dir, `p${i}.jpg`);
    execFileSync('convert', ['-size', '1240x1754', 'xc:#f7f5ef', '-font', 'DejaVu-Sans', '-pointsize', '26', '-fill', '#1d1d1d', '-annotate', '+110+160', text, '-rotate', '0.6', '-attenuate', '0.25', '+noise', 'Gaussian', '-blur', '0x0.4', '-strip', '-quality', '62', png]);
    const img = await pdf.embedJpg(readFileSync(png));
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return pdf.save({ useObjectStreams: false });
}

function imageFloue(): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), 'img-'));
  const f = join(dir, 'floue.jpg');
  execFileSync('convert', ['-size', '800x600', 'plasma:grey60-grey80', '-blur', '0x14', '-quality', '60', '-strip', f]);
  return readFileSync(f);
}

async function bytesOf(p: PieceFictive): Promise<Uint8Array> {
  switch (p.forme) {
    case 'pdf-texte':
      return pdfTexte(p.pages!);
    case 'pdf-scan':
      return pdfScan(p.pages!);
    case 'xlsx': {
      const f = p.feuilles![0];
      const width = Math.max(...f.lignes.map((l) => l.length));
      const pad = (l: (string | number)[]) => [...l, ...Array(width - l.length).fill('')];
      return buildXlsx([{ name: f.nom, headers: pad(f.lignes[0]).map(String), rows: f.lignes.slice(1).map(pad), widths: [44, 26, 18, 16] }]);
    }
    case 'eml':
      return new TextEncoder().encode(p.eml!.replace(/\n/g, '\r\n'));
    case 'image-illisible':
      return imageFloue();
    case 'binaire-non-pris-en-charge':
      return Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, ...Array.from({ length: 500 }, (_, i) => (i * 37) % 251)]);
    case 'texte':
      return new TextEncoder().encode(p.pages!.join('\n\n'));
  }
}

for (const p of [...PIECES_LUMEN, ...grosLot()]) {
  const out = p.fichier.startsWith('Facture-2026-') ? join(OUT, 'gros-lot', p.fichier) : join(OUT, p.fichier);
  execFileSync('mkdir', ['-p', join(OUT, 'gros-lot')]);
  writeFileSync(out, await bytesOf(p));
}
console.log(`pièces écrites dans ${OUT}`);
