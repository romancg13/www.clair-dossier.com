// Rendu PDF réel du projet de rapport (démonstration, dossier fictif) avec pdf-lib.
// Chargé en import dynamique au moment de l'export : pdf-lib reste hors du chunk
// initial de la page. Principes repris de supabase/functions/_shared/deliverables.ts :
// polices standard (jeu WinAnsi), normalisation des caractères, gabarit maîtrisé.
// En-tête et pied de CHAQUE page : « DOSSIER FICTIF — DÉMONSTRATION ClairDossier ».
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { STATUS_LABEL, frLongDate } from './dossier.ts';
import { validationLabel, type Report, type ReportParagraph } from './report.ts';
import { pdfSafe } from './pdf-charset.ts';

export const PDF_BANNER = 'DOSSIER FICTIF — DÉMONSTRATION ClairDossier';

/**
 * Lignes d'au plus `width` points. Coupe uniquement sur les espaces ordinaires (jamais sur
 * U+00A0) ; un mot plus long que la ligne est coupé au caractère (aucun dépassement de marge).
 */
export function wrapText(text: string, f: PDFFont, size: number, width: number): string[] {
  const fits = (t: string) => f.widthOfTextAtSize(t, size) <= width;
  const out: string[] = [];
  for (const para of pdfSafe(text).split('\n')) {
    let line = '';
    for (const word of para.split(/ +/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (fits(t)) {
        line = t;
        continue;
      }
      if (line) out.push(line);
      line = word;
      while (!fits(line)) {
        let n = 1;
        while (n < line.length - 1 && fits(line.slice(0, n + 1))) n++;
        out.push(line.slice(0, n));
        line = line.slice(n);
      }
    }
    out.push(line);
  }
  return out;
}

const NAVY = rgb(0x0d / 255, 0x1b / 255, 0x3d / 255);
const GOLD = rgb(0xc4 / 255, 0xa4 / 255, 0x56 / 255);
const GOLD_TEXT = rgb(0x7a / 255, 0x5f / 255, 0x28 / 255);
const SLATE = rgb(0x5a / 255, 0x63 / 255, 0x78 / 255);
const CREAM = rgb(0xfb / 255, 0xf9 / 255, 0xf4 / 255);

const W = 595.28;
const H = 841.89;
const M = 56;
const TOP = H - 64; // sous l'en-tête
const BOTTOM = 70; // au-dessus du pied

export async function renderReportPdf(report: Report, validation: { at: Date }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Projet de rapport ${report.reference} — dossier fictif`);
  pdf.setAuthor('ClairDossier (démonstration)');
  pdf.setProducer('ClairDossier');
  pdf.setSubject('Démonstration — dossier fictif, traitement simulé');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);

  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 34, width: W, height: 34, color: NAVY });
    page.drawText(PDF_BANNER, { x: M, y: H - 21, size: 8.5, font: bold, color: GOLD });
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y - h < BOTTOM) newPage();
  };
  const lines = (s: string, f: PDFFont, size: number, color = NAVY, indent = 0, lh = size * 1.42) => {
    for (const l of wrapText(s, f, size, W - 2 * M - indent)) {
      ensure(lh);
      page.drawText(l, { x: M + indent, y, size, font: f, color });
      y -= lh;
    }
  };

  newPage();
  // Couverture
  page.drawText(pdfSafe(`Référence ${report.reference} · dossier fictif`), { x: M, y, size: 9, font: bold, color: GOLD_TEXT });
  y -= 30;
  lines('Projet de rapport', serif, 24, NAVY, 0, 28);
  lines(report.title, serif, 15, NAVY, 0, 19);
  lines(report.site, font, 10, SLATE);
  y -= 6;
  lines(report.label, bold, 10, GOLD_TEXT);
  y -= 10;

  // Validation (démonstration)
  const val = validationLabel(validation.at);
  page.drawRectangle({ x: M, y: y - 34, width: W - 2 * M, height: 44, color: CREAM, borderColor: GOLD, borderWidth: 0.8 });
  page.drawText(pdfSafe(val), { x: M + 12, y: y - 8, size: 10.5, font: bold, color: NAVY });
  page.drawText(pdfSafe('Validation enregistrée dans la démonstration uniquement : aucun envoi, aucune signature.'), { x: M + 12, y: y - 24, size: 8.5, font, color: SLATE });
  y -= 58;

  // Légende des statuts
  lines('Statuts', bold, 9.5, NAVY);
  for (const l of report.legend) lines(`${l.label} — ${l.hint}`, font, 9, SLATE, 10);
  y -= 8;

  const paragraphHeight = (p: ReportParagraph) => {
    const textLines = wrapText(p.text, font, 10.5, W - 2 * M - 10).length;
    const srcLines = p.sources.reduce((n, s) => n + wrapText(`${s.label} : « ${s.passage} »`, font, 8.5, W - 2 * M - 22).length, 0);
    return 16 + textLines * 15 + srcLines * 12 + (p.corrected ? 14 : 0) + 12;
  };

  for (const section of report.sections) {
    y -= 10;
    ensure(28 + paragraphHeight(section.paragraphs[0]));
    page.drawRectangle({ x: M, y: y - 3, width: 3, height: 13, color: GOLD });
    lines(section.title.toUpperCase(), bold, 10, NAVY, 10);
    y -= 4;
    for (const p of section.paragraphs) {
      ensure(paragraphHeight(p)); // un paragraphe n'est jamais coupé entre deux pages
      lines(p.status ? `[${STATUS_LABEL[p.status]}]` : '[Réservé à l’appréciation de l’expert]', bold, 8.5, p.status === 'a_verifier' ? GOLD_TEXT : SLATE, 10);
      lines(p.text, font, 10.5, NAVY, 10, 15);
      if (p.corrected) lines('Corrigé par l’expert (démonstration)', bold, 8.5, GOLD_TEXT, 10, 14);
      for (const s of p.sources) lines(`${s.label} : « ${s.passage} »`, font, 8.5, SLATE, 22, 12);
      y -= 12;
    }
  }

  // Annexe : pièces du dossier
  y -= 6;
  ensure(40 + report.pieces.length * 14);
  page.drawRectangle({ x: M, y: y - 3, width: 3, height: 13, color: GOLD });
  lines('ANNEXE — PIÈCES DU DOSSIER (FICTIVES)', bold, 10, NAVY, 10);
  for (const p of report.pieces) lines(`Pièce ${p.numero} — ${p.typeLabel} : ${p.title}, ${frLongDate(p.date)} (${p.pages} p.)`, font, 9.5, NAVY, 10, 14);
  y -= 10;
  lines('Document de démonstration : toutes les données sont fictives et le traitement est simulé. Il ne constitue ni un rapport d’expertise, ni un avis, ni un conseil juridique.', font, 8.5, SLATE);

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.5, color: GOLD });
    p.drawText(PDF_BANNER, { x: M, y: 32, size: 8, font: bold, color: NAVY });
    const n = `${i + 1}/${pages.length}`;
    p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 8), y: 32, size: 8, font, color: SLATE });
  });
  return pdf.save();
}
