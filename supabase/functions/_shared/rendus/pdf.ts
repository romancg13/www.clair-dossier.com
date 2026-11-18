// Mise en page PDF à la charte ClairDossier : fond blanc, marine #0D1B3D, filet
// champagne, logo officiel, Cormorant Garamond (titres) et Inter (texte)
// incorporées en sous-ensemble, A4 portrait, corps 11 pt, texte sélectionnable.
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export interface PdfAssets {
  body: Uint8Array; // Inter 400
  bold: Uint8Array; // Inter 600
  title: Uint8Array; // Cormorant Garamond 600
  logo: Uint8Array; // PNG (logo horizontal, fond clair)
}

const NAVY = rgb(0x0d / 255, 0x1b / 255, 0x3d / 255);
const CHAMPAGNE = rgb(0xc4 / 255, 0xa4 / 255, 0x56 / 255);
const SLATE = rgb(0x4a / 255, 0x53 / 255, 0x66 / 255); // contraste ≥ 7:1 sur blanc
const LINE = rgb(0.86, 0.85, 0.82);
const W = 595.28, H = 841.89, M = 56, BOTTOM = 70;

// Espaces insécables (fines ou non) unifiés en U+00A0 : jamais de coupure à l'intérieur (« 3 480,00 € »), remplacés par une espace au dessin.
const clean = (s: string) => s.replace(/[\u00a0\u202f\u2009]/g, '\u00a0').replace(/\t/g, ' ').replace(/[\u0000-\u0008\u000b-\u001f]/g, '');
/** Texte dessiné ou métadonnée sans découpage : espaces ordinaires. */
const plain = (s: string) => clean(s).replace(/\u00a0/g, ' ');

export class Pdf {
  pdf!: PDFDocument;
  f!: { body: PDFFont; bold: PDFFont; title: PDFFont };
  logo!: PDFImage;
  page!: PDFPage;
  y = 0;
  private constructor(private readonly kicker: string, private readonly footer: string) {}

  static async create(assets: PdfAssets, meta: { title: string; kicker: string; footer: string; subject: string }): Promise<Pdf> {
    const d = new Pdf(meta.kicker, meta.footer);
    d.pdf = await PDFDocument.create();
    d.pdf.registerFontkit(fontkit);
    d.pdf.setTitle(plain(meta.title), { showInWindowTitleBar: true });
    d.pdf.setAuthor('ClairDossier');
    d.pdf.setSubject(plain(meta.subject));
    d.pdf.setLanguage('fr-FR');
    d.pdf.setProducer('ClairDossier');
    d.pdf.setCreator('ClairDossier');
    d.f = {
      body: await d.pdf.embedFont(assets.body, { subset: true }),
      bold: await d.pdf.embedFont(assets.bold, { subset: true }),
      title: await d.pdf.embedFont(assets.title, { subset: true }),
    };
    d.logo = await d.pdf.embedPng(assets.logo);
    d.newPage();
    return d;
  }

  newPage() {
    this.page = this.pdf.addPage([W, H]);
    const lh = 24;
    const lw = (this.logo.width / this.logo.height) * lh;
    this.page.drawImage(this.logo, { x: M, y: H - M - lh + 6, width: lw, height: lh });
    const k = plain(this.kicker.toUpperCase());
    this.page.drawText(k, { x: W - M - this.f.bold.widthOfTextAtSize(k, 7.5), y: H - M - 4, size: 7.5, font: this.f.bold, color: SLATE, characterSpacing: 0.6 } as never);
    this.page.drawLine({ start: { x: M, y: H - M - 26 }, end: { x: W - M, y: H - M - 26 }, thickness: 1.2, color: CHAMPAGNE });
    this.y = H - M - 50;
  }

  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of clean(text).split('\n')) {
      let line = '';
      for (const word of para.split(/[ \t\n]+/)) {
        if (!word) continue;
        const t = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(t.replace(/\u00a0/g, ' '), size) > width && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      out.push(line);
    }
    return out.map((l) => l.replace(/\u00a0/g, ' '));
  }

  text(s: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number; width?: number } = {}) {
    const font = o.font ?? this.f.body, size = o.size ?? 11, ind = o.indent ?? 0;
    const lh = size * 1.42;
    for (const l of this.wrap(s, font, size, o.width ?? W - 2 * M - ind)) {
      this.ensure(lh);
      this.page.drawText(l, { x: M + ind, y: this.y - size, size, font, color: o.color ?? NAVY });
      this.y -= lh;
    }
    this.y -= o.gap ?? 4;
  }

  title(s: string, sub?: string) {
    this.text(s, { font: this.f.title, size: 24, gap: 2 });
    if (sub) this.text(sub, { size: 9, color: SLATE, gap: 12 });
  }

  h2(s: string) {
    this.ensure(46);
    this.y -= 8;
    this.page.drawRectangle({ x: M, y: this.y - 10, width: 14, height: 2, color: CHAMPAGNE });
    this.y -= 16;
    this.text(s.toUpperCase(), { font: this.f.bold, size: 9, gap: 6 });
  }

  bullet(s: string, size = 11) {
    const lines = this.wrap(s, this.f.body, size, W - 2 * M - 14);
    this.ensure(lines.length * size * 1.42);
    this.page.drawCircle({ x: M + 4, y: this.y - size * 0.62, size: 1.6, color: CHAMPAGNE });
    this.text(s, { size, indent: 14, gap: 3 });
  }

  /** Mention de source compacte : « Pièce, p. 1 — “extrait” ». */
  source(label: string) {
    this.text(label, { size: 8.5, color: SLATE, indent: 14, gap: 6 });
  }

  /** Encadré : filet champagne à gauche, contenu dessiné par la fonction. */
  callout(draw: () => void) {
    const top = this.y;
    const pageBefore = this.page;
    this.y -= 6;
    const save = M;
    void save;
    draw();
    if (this.page === pageBefore) this.page.drawRectangle({ x: M - 12, y: this.y + 2, width: 3, height: top - this.y - 2, color: CHAMPAGNE });
    this.y -= 6;
  }

  /** Tableau simple : en-tête répété à chaque page, cellules repliées. */
  table(cols: { label: string; width: number }[], rows: string[][], size = 8.5) {
    const pad = 4;
    const drawHeader = () => {
      this.ensure(22);
      let x = M;
      for (const c of cols) {
        this.page.drawText(plain(c.label.toUpperCase()), { x: x + pad, y: this.y - 10, size: 7.5, font: this.f.bold, color: NAVY });
        x += c.width;
      }
      this.y -= 16;
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.8, color: CHAMPAGNE });
    };
    drawHeader();
    for (const r of rows) {
      const cells = r.map((v, i) => this.wrap(v, this.f.body, size, cols[i].width - 2 * pad));
      const h = Math.max(...cells.map((c) => c.length)) * size * 1.35 + 2 * pad;
      if (this.y - h < BOTTOM) {
        this.newPage();
        drawHeader();
      }
      let x = M;
      cells.forEach((lines, i) => {
        lines.forEach((l, j) => this.page.drawText(l, { x: x + pad, y: this.y - pad - size - j * size * 1.35, size, font: this.f.body, color: NAVY }));
        x += cols[i].width;
      });
      this.y -= h;
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.4, color: LINE });
    }
    this.y -= 8;
  }

  async save(): Promise<Uint8Array> {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.5, color: CHAMPAGNE });
      this.wrap(this.footer, this.f.body, 7, W - 2 * M - 50).slice(0, 2).forEach((l, j) => p.drawText(l, { x: M, y: 36 - j * 9, size: 7, font: this.f.body, color: SLATE }));
      const n = `${i + 1} / ${pages.length}`;
      p.drawText(n, { x: W - M - this.f.body.widthOfTextAtSize(n, 7.5), y: 36, size: 7.5, font: this.f.body, color: SLATE });
    });
    return this.pdf.save();
  }
}

export const COLORS = { NAVY, CHAMPAGNE, SLATE };
export const PAGE = { W, H, M };
