// Charte PDF ClairDossier — gabarit institutionnel commun aux livrables
// (marine / champagne-or / blanc, couleurs de src/index.css @theme) et
// primitives de mise en page : encadrés, tuiles, tableaux, frise, cartes.
// Partagé par `ai-worker` (Deno) et le site (démo navigateur), testé sous Node.
//
// Aucune dépendance hors pdf-lib : polices standard (Times pour les titres,
// Helvetica pour le texte), logo officiel incorporé une seule fois par document
// (brand-logo.ts, ~5 Ko). Tout le texte est dessiné en texte réel (sélectionnable).
// Aucun contenu produit par le modèle n'est interprété : uniquement dessiné.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import { LOGO_HEIGHT, LOGO_PNG_BASE64, LOGO_WIDTH } from './brand-logo.ts';

const hex = (h: string): RGB => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);

/** Couleurs exactes de la charte (src/index.css, bloc @theme). */
export const C = {
  navy: hex('0d1b3d'),
  navy700: hex('1e2c52'),
  gold: hex('c4a456'),
  gold300: hex('f0d99a'),
  gold700: hex('7a5f28'),
  cream50: hex('fbf9f4'),
  cream100: hex('f5f0e6'),
  cream200: hex('ebe2cf'),
  ink: hex('0a1228'),
  slate: hex('5a6378'),
  slate300: hex('a3aab9'),
  white: rgb(1, 1, 1),
} as const;

/** Format A4, marges et zone utile. */
export const PAGE = { W: 595.28, H: 841.89, M: 48, BOTTOM: 58 } as const;
const { W, H, M, BOTTOM } = PAGE;
export const CW = W - 2 * M;

// Polices standard = jeu WinAnsi : on normalise les espaces fines et on remplace le reste.
const WINANSI_OK = /[\x20-\x7E\xA1-\xFFŒœŠšŸŽž–—‘’‚“”„†‡•…‰‹›€™]/;
export function pdfSafe(s: string): string {
  return Array.from(s.replace(/[    \t]/g, ' ').replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<='))
    .map((c) => (c === '\n' || WINANSI_OK.test(c) ? c : '?'))
    .join('');
}

// Mise en valeur automatique (gras) des montants et des dates : motif fixe, sans modèle.
const MOIS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const EMPH = new RegExp(
  `\\d{1,3}(?: \\d{3})*(?:,\\d+)? ?(?:€|euros?\\b)(?: (?:TTC|HT)\\b)?` +
    `|\\b(?:0?[1-9]|[12]\\d|3[01])/(?:0?[1-9]|1[0-2])(?:/\\d{4})?\\b` +
    `|\\b(?:0[1-9]|1[0-2])/\\d{4}\\b` +
    `|\\b(?:1er|\\d{1,2}) (?:${MOIS})(?: \\d{4})?`,
  'gi',
);

// Largeur SANS crénage : pdf-lib mesure avec crénage mais dessine sans ; on mesure
// donc glyphe par glyphe (avec cache) pour que les espaces entre segments tombent juste.
const GLYPHS = new WeakMap<PDFFont, Map<string, number>>();
function tw(f: PDFFont, t: string, size: number): number {
  let m = GLYPHS.get(f);
  if (!m) GLYPHS.set(f, (m = new Map()));
  let w = 0;
  for (const ch of t) {
    let c = m.get(ch);
    if (c === undefined) m.set(ch, (c = f.widthOfTextAtSize(ch, 1)));
    w += c;
  }
  return w * size;
}

type Run = { t: string; f: PDFFont; sp: boolean };
type Line = Run[];

/** Fragment de texte d'un bloc mesuré (encadré, cellule, carte). */
export interface Piece {
  text: string;
  size?: number;
  font?: PDFFont;
  color?: RGB;
  /** Espace avant le fragment (pt). */
  before?: number;
  /** Mise en gras automatique des montants et dates (défaut : oui). */
  emph?: boolean;
}
type Measured = { rows: { line: Line; size: number; color: RGB; lh: number; before: number; base: PDFFont }[]; h: number };

export interface TextOpts {
  x?: number;
  w?: number;
  size?: number;
  font?: PDFFont;
  color?: RGB;
  emph?: boolean;
  /** Fond dessiné ligne à ligne (un bloc ainsi teinté peut franchir un saut de page). */
  bg?: RGB;
  bar?: RGB;
}

export interface Column {
  label: string;
  /** Largeur en points. */
  w: number;
}
export type Cell = string | Piece[];

export interface TimelineItem {
  /** AAAA, AAAA-MM ou AAAA-MM-JJ : sert au regroupement par mois. */
  iso: string;
  date: string;
  /** Précision sous la date (« approx. »). */
  hint?: string;
  label: string;
  detail: string;
  marker: 'event' | 'document' | 'edited';
}

export interface ListBlock {
  title: string;
  items: { text: string; sub?: string }[];
  empty: string;
}

export interface MessageCard {
  n: number;
  audience: string;
  when: string;
  subject: string;
  to: string;
  body: string;
}

export interface CharteOptions {
  /** Titre du document (« Résumé du dossier »). */
  title: string;
  /** Mention courte en haut à droite (« Document 1/6 »). */
  kicker: string;
  /** Intitulé du dossier. */
  dossier: string;
  /** Révision et date de génération. */
  meta: string;
  /** Couverture de l'analyse ; mise en évidence si partielle. */
  coverage: string;
  partial: boolean;
  demo: boolean;
  /** Mention légale du pied de page. */
  legal: string;
}

const lh = (size: number) => size * 1.42;

export class Charte {
  page!: PDFPage;
  /** Haut du prochain élément. */
  y = 0;
  /** Primitives réellement dessinées : signature structurelle du document (mots-clés PDF). */
  readonly used = new Set<string>();

  private constructor(
    readonly pdf: PDFDocument,
    readonly f: { reg: PDFFont; bold: PDFFont; italic: PDFFont; serif: PDFFont; serifBold: PDFFont },
    private readonly logo: PDFImage,
    private readonly o: CharteOptions,
  ) {}

  static async create(o: CharteOptions): Promise<Charte> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(o.title);
    pdf.setSubject(pdfSafe(o.dossier));
    pdf.setAuthor('ClairDossier');
    pdf.setProducer('ClairDossier');
    pdf.setCreator('ClairDossier');
    pdf.setLanguage('fr-FR');
    const [reg, bold, italic, serif, serifBold] = await Promise.all(
      [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.TimesRoman, StandardFonts.TimesRomanBold].map((n) => pdf.embedFont(n)),
    );
    const logo = await pdf.embedPng(Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0)));
    const c = new Charte(pdf, { reg, bold, italic, serif, serifBold }, logo, o);
    c.newPage(true);
    return c;
  }

  /* ── Texte : césure, gras automatique, dessin ─────────────────────────── */

  /** Découpe un texte en lignes ; montants et dates passent en gras (insécables). */
  lines(text: string, width: number, size: number, base: PDFFont = this.f.reg, emph = true): Line[] {
    const strong = base === this.f.reg ? this.f.bold : base;
    const space = tw(base, ' ', size);
    const out: Line[] = [];
    for (const raw of pdfSafe(text).split('\n')) {
      const mask = new Uint8Array(raw.length);
      const para = emph && strong !== base
        ? raw.replace(EMPH, (m: string, off: number) => {
            mask.fill(1, off, off + m.length);
            return m.replace(/ /g, '\xA0');
          })
        : raw;
      type Atom = { runs: { t: string; f: PDFFont }[]; w: number };
      let cur: Atom[] = [];
      let cw = 0;
      const flush = () => {
        const line: Line = [];
        cur.forEach((a, ai) => a.runs.forEach((r, ri) => {
          const sp = ai > 0 && ri === 0;
          const prev = line[line.length - 1];
          if (prev && prev.f === r.f) prev.t += (sp ? ' ' : '') + r.t;
          else line.push({ t: r.t, f: r.f, sp });
        }));
        out.push(line);
        cur = [];
        cw = 0;
      };
      let i = 0;
      for (const word of para.split(' ')) {
        const at = i;
        i += word.length + 1;
        if (!word) continue;
        const atom: Atom = { runs: [], w: 0 };
        for (let s = 0, k = 1; k <= word.length; k++) {
          if (k === word.length || mask[at + k] !== mask[at + s]) {
            const f = mask[at + s] ? strong : base;
            const t = word.slice(s, k).replace(/\xA0/g, ' ');
            atom.runs.push({ t, f });
            atom.w += tw(f, t, size);
            s = k;
          }
        }
        // Mot plus large que la colonne (nom de fichier, URL) : coupé par caractères.
        if (atom.w > width) {
          if (cur.length) flush();
          for (const r of atom.runs) {
            let t = r.t;
            while (t.length > 1 && tw(r.f, t, size) > width) {
              let n = Math.max(1, Math.min(t.length - 1, Math.floor((t.length * width) / tw(r.f, t, size))));
              while (n > 1 && tw(r.f, t.slice(0, n), size) > width) n--;
              out.push([{ t: t.slice(0, n), f: r.f, sp: false }]);
              t = t.slice(n);
            }
            const w = tw(r.f, t, size);
            if (cur.length && cw + space + w > width) flush();
            cw += (cur.length ? space : 0) + w;
            cur.push({ runs: [{ t, f: r.f }], w });
          }
          continue;
        }
        const add = cur.length ? space + atom.w : atom.w;
        if (cur.length && cw + add > width) {
          flush();
          cur = [atom];
          cw = atom.w;
        } else {
          cur.push(atom);
          cw += add;
        }
      }
      flush();
    }
    return out;
  }

  /** Dessine une ligne dont le HAUT est à `top` (interligne `lh(size)`). */
  private drawLine(line: Line, x: number, top: number, size: number, color: RGB, base: PDFFont): void {
    const baseline = top - (lh(size) - size) / 2 - size * 0.78;
    for (const r of line) {
      if (r.sp) x += tw(base, ' ', size);
      if (r.t) this.page.drawText(r.t, { x, y: baseline, size, font: r.f, color });
      x += tw(r.f, r.t, size);
    }
  }

  /** Texte simple sur une ligne (libellés, en-têtes) ; `right` = aligné à droite sur x. */
  label(t: string, x: number, top: number, size: number, font: PDFFont, color: RGB, right = false): number {
    const s = pdfSafe(t).replace(/\n/g, ' ');
    const w = tw(font, s, size);
    this.page.drawText(s, { x: right ? x - w : x, y: top - (lh(size) - size) / 2 - size * 0.78, size, font, color });
    return w;
  }

  private fit(t: string, font: PDFFont, size: number, width: number): string {
    let s = pdfSafe(t).replace(/\n/g, ' ');
    if (tw(font, s, size) <= width) return s;
    while (s.length > 1 && tw(font, `${s}…`, size) > width) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  }

  measure(pieces: Piece[], width: number): Measured {
    const rows: Measured['rows'] = [];
    let h = 0;
    for (const p of pieces) {
      const size = p.size ?? 9.5;
      const base = p.font ?? this.f.reg;
      this.lines(p.text, width, size, base, p.emph ?? true).forEach((line, i) => {
        const before = i === 0 ? (p.before ?? 0) : 0;
        rows.push({ line, size, color: p.color ?? C.ink, lh: lh(size), before, base });
        h += before + lh(size);
      });
    }
    return { rows, h };
  }

  paint(m: Measured, x: number, top: number): void {
    let y = top;
    for (const r of m.rows) {
      y -= r.before;
      this.drawLine(r.line, x, y, r.size, r.color, r.base);
      y -= r.lh;
    }
  }

  /* ── Pagination, en-tête, pied de page ────────────────────────────────── */

  private get room(): number {
    return H - 70 - BOTTOM;
  }

  /** Passe à la page suivante si `h` points ne tiennent plus ; renvoie vrai s'il y a eu saut. */
  ensure(h: number): boolean {
    if (this.y - h >= BOTTOM) return false;
    this.newPage(false);
    return true;
  }

  gap(h: number): void {
    this.y -= h;
  }

  private newPage(first: boolean): void {
    const { o, f } = this;
    this.page = this.pdf.addPage([W, H]);
    const demo = 'DÉMONSTRATION — DONNÉES FICTIVES';
    if (!first) {
      // Pages suivantes : logo réduit, rappel du document, filet or.
      const lhgt = 16;
      this.page.drawImage(this.logo, { x: M, y: H - 26 - lhgt, width: (lhgt * LOGO_WIDTH) / LOGO_HEIGHT, height: lhgt });
      const recall = `${o.demo ? `${demo} · ` : ''}${o.title} — ${o.dossier}`;
      this.label(this.fit(recall, f.reg, 7.5, CW - 110), W - M, H - 29, 7.5, f.reg, C.slate, true);
      this.page.drawLine({ start: { x: M, y: H - 50 }, end: { x: W - M, y: H - 50 }, thickness: 0.6, color: C.gold });
      this.y = H - 70;
      return;
    }
    // Première page : logo officiel en haut à gauche, sur fond blanc.
    const lhgt = 32;
    this.page.drawImage(this.logo, { x: M, y: H - 26 - lhgt, width: (lhgt * LOGO_WIDTH) / LOGO_HEIGHT, height: lhgt });
    this.label(o.kicker.toUpperCase(), W - M, H - 28, 8, f.bold, C.gold700, true);
    this.label(o.meta, W - M, H - 40, 8, f.reg, C.slate, true);
    if (o.demo) {
      const w = tw(f.bold, demo, 6.5) + 12;
      this.page.drawRectangle({ x: W - M - w, y: H - 67, width: w, height: 13, borderColor: C.gold, borderWidth: 0.7, color: C.cream50 });
      this.label(demo, W - M - 6, H - 54.5, 6.5, f.bold, C.gold700, true);
    }
    // Bandeau marine : titre du document et intitulé du dossier (jamais tronqué en silence).
    const dossier = this.lines(o.dossier, CW - 36, 9.5, f.reg, false).slice(0, 3);
    const top = H - 76;
    const band = 52 + dossier.length * 13 + 12;
    this.page.drawRectangle({ x: M, y: top - band, width: CW, height: band, color: C.navy });
    this.page.drawRectangle({ x: M, y: top - band, width: 4, height: band, color: C.gold });
    this.label(o.title, M + 20, top - 14, 25, f.serif, C.white);
    dossier.forEach((l, i) => this.drawLine(l, M + 20, top - 52 - i * 13, 9.5, C.gold300, f.reg));
    // Couverture de l'analyse : toujours visible, en gras si elle est partielle.
    const strip = top - band;
    this.page.drawRectangle({ x: M, y: strip - 22, width: CW, height: 22, color: C.cream100 });
    if (o.partial) this.page.drawRectangle({ x: M + 20, y: strip - 14, width: 5, height: 5, color: C.gold700 });
    this.label(this.fit(o.coverage, o.partial ? f.bold : f.reg, 8, CW - 50), M + (o.partial ? 31 : 20), strip - 5.5, 8, o.partial ? f.bold : f.reg, o.partial ? C.navy : C.slate);
    this.y = strip - 22 - 18;
    this.used.add('entete-logo');
  }

  /** Pose pieds de page et pagination « Page x/y », puis sérialise le document. */
  async finish(): Promise<Uint8Array> {
    const { f } = this;
    const pages = this.pdf.getPages();
    const legal = this.lines(this.o.legal, CW - 90, 6.5, f.reg, false).slice(0, 2);
    pages.forEach((p, i) => {
      this.page = p;
      p.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.6, color: C.gold });
      legal.forEach((l, j) => this.drawLine(l, M, 42 - j * 9, 6.5, C.slate, f.reg));
      this.label(`Page ${i + 1}/${pages.length}`, W - M, 42, 8, f.bold, C.navy, true);
    });
    this.used.add('pied-pagination');
    this.pdf.setKeywords([...this.used].sort());
    return this.pdf.save();
  }

  /* ── Primitives de composition ────────────────────────────────────────── */

  private rrect(x: number, top: number, w: number, h: number, r: number, style: { color?: RGB; borderColor?: RGB; borderWidth?: number }): void {
    this.page.drawSvgPath(`M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`, { x, y: top, ...style });
  }

  /** Texte courant : passe d'une page à l'autre ligne à ligne. */
  text(s: string, o: TextOpts = {}): void {
    const x = o.x ?? M;
    const w = o.w ?? CW - (x - M);
    const size = o.size ?? 10;
    const base = o.font ?? this.f.reg;
    for (const line of this.lines(s, w, size, base, o.emph ?? true)) {
      this.ensure(lh(size));
      if (o.bg) this.page.drawRectangle({ x: x - 12, y: this.y - lh(size), width: w + 24, height: lh(size) + 0.4, color: o.bg });
      if (o.bar) this.page.drawRectangle({ x: x - 12, y: this.y - lh(size), width: 2.5, height: lh(size) + 0.4, color: o.bar });
      this.drawLine(line, x, this.y, size, o.color ?? C.ink, base);
      this.y -= lh(size);
    }
  }

  /** Titre de rubrique : libellé en capitales et filet. */
  section(title: string): void {
    this.gap(14);
    this.ensure(54);
    const w = this.label(title.toUpperCase(), M, this.y, 8.5, this.f.bold, C.navy);
    this.page.drawRectangle({ x: M, y: this.y - 15.5, width: 22, height: 1.6, color: C.gold });
    this.page.drawLine({ start: { x: M + w + 10, y: this.y - 6.5 }, end: { x: W - M, y: this.y - 6.5 }, thickness: 0.5, color: C.cream200 });
    this.y -= 23;
  }

  /** Ouverture des annexes : bandeau marine. */
  annex(title: string): void {
    this.gap(24);
    this.ensure(84);
    this.page.drawRectangle({ x: M, y: this.y - 20, width: CW, height: 20, color: C.navy });
    this.label(title.toUpperCase(), M + 12, this.y - 3.5, 8, this.f.bold, C.gold300);
    this.y -= 22;
    this.used.add('annexes');
  }

  /** Encadré insécable ; s'il dépasse une page, repli en texte courant teinté. */
  panel(kind: string, pieces: Piece[], style: { bg?: RGB; border?: RGB; bar?: RGB; pad?: number } = {}): void {
    const pad = style.pad ?? 12;
    const m = this.measure(pieces, CW - 2 * pad);
    const h = m.h + 2 * pad;
    this.used.add(kind);
    if (h > this.room) {
      for (const p of pieces) {
        this.gap(p.before ?? 0);
        this.text(p.text, { x: M + 12, w: CW - 24, size: p.size, font: p.font, color: p.color, emph: p.emph, bg: style.bg, bar: style.bar });
      }
      this.gap(10);
      return;
    }
    this.ensure(h);
    this.page.drawRectangle({ x: M, y: this.y - h, width: CW, height: h, color: style.bg, borderColor: style.border, borderWidth: style.border ? 0.8 : 0 });
    if (style.bar) this.page.drawRectangle({ x: M, y: this.y - h, width: 3, height: h, color: style.bar });
    this.paint(m, M + pad, this.y - pad);
    this.y -= h + 10;
  }

  /** Liste à puces (carré or), avec ligne secondaire facultative (source, motif). */
  bullets(items: { text: string; sub?: string }[], x = M, w = CW): void {
    for (const it of items) {
      this.ensure(lh(10) * 2);
      this.page.drawRectangle({ x, y: this.y - 9, width: 3.2, height: 3.2, color: C.gold });
      this.text(it.text, { x: x + 11, w: w - 11 });
      if (it.sub) this.text(it.sub, { x: x + 11, w: w - 11, size: 7.8, color: C.slate, emph: false });
      this.gap(4);
    }
    this.used.add('liste');
  }

  /** Étiquette arrondie ; renvoie sa largeur. */
  pill(t: string, x: number, top: number, tone: 'navy' | 'gold' | 'cream' | 'outline'): number {
    const s = pdfSafe(t).toUpperCase();
    const w = tw(this.f.bold, s, 6.2) + 10;
    const style = tone === 'navy' ? { color: C.navy } : tone === 'gold' ? { color: C.gold } : tone === 'cream' ? { color: C.cream200 } : { color: C.white, borderColor: C.gold, borderWidth: 0.7 };
    this.rrect(x, top, w, 11, 3, style);
    this.label(s, x + 5, top - 1.2, 6.2, this.f.bold, tone === 'navy' ? C.white : tone === 'gold' ? C.navy : C.gold700);
    return w;
  }

  /** Faits numérotés : pastille marine, texte, statut et source en dessous. */
  numbered(items: { text: string; tag: string; tone: 'navy' | 'gold' | 'cream' | 'outline'; sub: string }[], start = 1): void {
    items.forEach((it, i) => {
      const body = this.measure([{ text: it.text, size: 10 }], CW - 30);
      const tagW = tw(this.f.bold, pdfSafe(it.tag).toUpperCase(), 6.2) + 10;
      const sub = this.measure([{ text: it.sub, size: 7.8, color: C.slate, emph: false }], CW - 30 - tagW - 8);
      const h = body.h + 3 + Math.max(11, sub.h) + 6;
      this.ensure(h);
      this.page.drawCircle({ x: M + 9, y: this.y - 8, size: 8.5, color: C.navy });
      const n = String(start + i);
      this.label(n, M + 9 - tw(this.f.bold, n, 8.5) / 2, this.y - 2.6, 8.5, this.f.bold, C.gold300);
      this.paint(body, M + 30, this.y);
      const top = this.y - body.h - 3;
      this.pill(it.tag, M + 30, top, it.tone);
      this.paint(sub, M + 30 + tagW + 8, top);
      this.y -= h;
    });
    this.used.add('faits-numerotes');
  }

  /** Tuiles d'indicateurs : valeur en grand, libellé, précision. */
  tiles(items: { value: string; label: string; sub?: string }[]): void {
    const gapX = 10;
    const w = (CW - gapX * (items.length - 1)) / items.length;
    const h = 82;
    this.ensure(h);
    items.forEach((k, i) => {
      const x = M + i * (w + gapX);
      this.page.drawRectangle({ x, y: this.y - h, width: w, height: h, color: C.cream50, borderColor: C.cream200, borderWidth: 0.8 });
      this.page.drawRectangle({ x, y: this.y - 3, width: w, height: 3, color: C.gold });
      this.label(k.value, x + 12, this.y - 12, 26, this.f.serifBold, C.navy);
      this.lines(k.label.toUpperCase(), w - 24, 6.8, this.f.bold, false).slice(0, 2).forEach((l, j) => this.drawLine(l, x + 12, this.y - 48 - j * 9, 6.8, C.navy700, this.f.bold));
      if (k.sub) this.label(this.fit(k.sub, this.f.reg, 6.8, w - 24), x + 12, this.y - 69, 6.8, this.f.reg, C.slate);
    });
    this.y -= h + 12;
    this.used.add('tuiles');
  }

  /** Jauge horizontale (part exploitée du dossier). */
  gauge(caption: string, ratio: number): void {
    this.ensure(30);
    this.label(caption, M, this.y, 8.5, this.f.bold, C.navy);
    this.page.drawRectangle({ x: M, y: this.y - 22, width: CW, height: 5, color: C.cream200 });
    this.page.drawRectangle({ x: M, y: this.y - 22, width: CW * Math.max(0, Math.min(1, ratio)), height: 5, color: C.navy });
    this.y -= 32;
    this.used.add('jauge');
  }

  /** Deux listes côte à côte ; renvoie faux (rien dessiné) si elles ne tiennent pas sur une page. */
  columns(blocks: [ListBlock, ListBlock]): boolean {
    const gutter = 28;
    const w = (CW - gutter) / 2;
    const ms = blocks.map((b) => this.measure(b.items.length
      ? b.items.flatMap((it, i): Piece[] => [{ text: it.text, size: 9.2, before: i ? 6 : 0 }, ...(it.sub ? [{ text: it.sub, size: 7.5, color: C.slate, emph: false } as Piece] : [])])
      : [{ text: b.empty, size: 9.2, color: C.slate }], w - 11));
    const h = 24 + Math.max(ms[0].h, ms[1].h);
    if (h + 16 > this.room) return false;
    this.gap(14);
    this.ensure(h);
    blocks.forEach((b, i) => {
      const x = M + i * (w + gutter);
      this.label(b.title.toUpperCase(), x, this.y, 8.5, this.f.bold, C.navy);
      this.page.drawRectangle({ x, y: this.y - 15.5, width: 22, height: 1.6, color: C.gold });
      this.page.drawRectangle({ x, y: this.y - 24 - ms[i].h, width: 1.2, height: ms[i].h, color: C.cream200 });
      this.paint(ms[i], x + 11, this.y - 24);
    });
    this.y -= h;
    this.used.add('colonnes');
    return true;
  }

  /** Tableau : en-tête marine répété à chaque page, lignes alternées, cellules multi-lignes. */
  table(cols: Column[], rows: Cell[][], kind = 'tableau'): void {
    const padX = 6;
    const head = () => {
      this.page.drawRectangle({ x: M, y: this.y - 19, width: CW, height: 19, color: C.navy });
      let x = M;
      for (const c of cols) {
        this.label(this.fit(c.label.toUpperCase(), this.f.bold, 6.8, c.w - 2 * padX), x + padX, this.y - 4.6, 6.8, this.f.bold, C.white);
        x += c.w;
      }
      this.y -= 19;
    };
    this.ensure(19 + 40);
    head();
    rows.forEach((row, n) => {
      const cells = row.map((c, i) => this.measure(typeof c === 'string' ? [{ text: c, size: 8.6 }] : c, cols[i].w - 2 * padX));
      const h = Math.max(...cells.map((c) => c.h)) + 9;
      if (h > this.room - 19) {
        // Ligne plus haute qu'une page : repli en texte courant, rien n'est tronqué.
        for (const [i, c] of row.entries()) this.text(`${cols[i].label} : ${typeof c === 'string' ? c : c.map((p) => p.text).join(' — ')}`, { size: 8.6 });
        this.gap(6);
        return;
      }
      if (this.ensure(h)) head();
      if (n % 2 === 1) this.page.drawRectangle({ x: M, y: this.y - h, width: CW, height: h, color: C.cream50 });
      this.page.drawLine({ start: { x: M, y: this.y - h }, end: { x: W - M, y: this.y - h }, thickness: 0.4, color: C.cream200 });
      let x = M;
      cells.forEach((c, i) => {
        this.paint(c, x + padX, this.y - 4.5);
        x += cols[i].w;
      });
      this.y -= h;
    });
    this.used.add(kind);
  }

  /** Bandeau de groupe (statut d'échéance) précédant un tableau. */
  groupBand(title: string, count: number, hint: string, tone: 'navy' | 'gold' | 'cream' | 'outline'): void {
    this.gap(16);
    this.ensure(22 + 19 + 60);
    const bg = tone === 'navy' ? C.navy700 : tone === 'gold' ? C.gold : tone === 'cream' ? C.cream100 : C.white;
    const fg = tone === 'navy' ? C.white : C.navy;
    this.page.drawRectangle({ x: M, y: this.y - 22, width: CW, height: 22, color: bg, borderColor: tone === 'outline' || tone === 'cream' ? C.gold : undefined, borderWidth: tone === 'outline' || tone === 'cream' ? 0.7 : 0, borderDashArray: tone === 'cream' ? [3, 2] : undefined });
    const w = this.label(`${title} (${count})`, M + 10, this.y - 5, 9, this.f.bold, fg);
    this.label(this.fit(hint, this.f.reg, 7.5, CW - w - 36), W - M - 10, this.y - 5.8, 7.5, this.f.reg, tone === 'navy' ? C.gold300 : C.navy700, true);
    this.y -= 22;
    this.used.add('groupes-statut');
  }

  /** Frise chronologique verticale : date à gauche, axe, événement et source à droite. */
  timeline(items: TimelineItem[]): void {
    const axis = M + 88;
    const cx = M + 104;
    const cw = CW - 104;
    let month = '';
    const monthHead = (iso: string, again: boolean) => {
      const [y, m] = iso.split('-');
      const name = m ? `${MOIS.split('|')[Number(m) - 1] ?? m} ${y}` : `Année ${y}`;
      this.label(`${name}${again ? ' (suite)' : ''}`.toUpperCase(), M, this.y - 2, 7.5, this.f.bold, C.gold700);
      this.page.drawLine({ start: { x: cx, y: this.y - 9 }, end: { x: W - M, y: this.y - 9 }, thickness: 0.5, color: C.cream200 });
      this.y -= 20;
    };
    for (const it of items) {
      const m = this.measure([{ text: it.label, size: 10 }, { text: it.detail, size: 7.6, color: C.slate, emph: false, before: 1 }], cw);
      const h = m.h + 11;
      const key = it.iso.slice(0, 7);
      const fresh = key !== month;
      if (fresh) this.gap(month ? 8 : 0);
      const broke = this.ensure(h + (fresh ? 20 : 0));
      if (fresh || broke) monthHead(it.iso, !fresh);
      month = key;
      this.page.drawRectangle({ x: axis - 0.6, y: this.y - h, width: 1.2, height: h, color: C.cream200 });
      this.page.drawCircle({ x: axis, y: this.y - 7, size: 3.6, color: it.marker === 'event' ? C.navy : it.marker === 'edited' ? C.gold : C.white, borderColor: it.marker === 'edited' ? C.gold700 : C.navy, borderWidth: 1.1 });
      this.label(it.date, axis - 12, this.y, 9.5, this.f.bold, C.navy, true);
      if (it.hint) this.label(it.hint, axis - 12, this.y - 12.5, 7.2, this.f.reg, C.slate, true);
      this.paint(m, cx, this.y);
      this.y -= h;
    }
    this.used.add('frise');
  }

  /** Carte de message (projet de relance) : en-tête, objet, destinataire, corps teinté. */
  message(c: MessageCard): void {
    const { f } = this;
    this.gap(10);
    this.ensure(118);
    this.page.drawRectangle({ x: M, y: this.y - 24, width: CW, height: 24, color: C.cream100 });
    this.page.drawRectangle({ x: M, y: this.y - 24, width: 24, height: 24, color: C.navy });
    const n = String(c.n);
    this.label(n, M + 12 - tw(f.serifBold, n, 12) / 2, this.y - 3.5, 12, f.serifBold, C.gold300);
    const ww = this.label(c.when, W - M - 10, this.y - 5.5, 8.6, f.bold, C.gold700, true);
    this.label(this.fit(c.audience, f.bold, 9, CW - 48 - ww - 16), M + 34, this.y - 5.2, 9, f.bold, C.navy);
    this.y -= 24 + 9;
    const field = (name: string, value: string, o: TextOpts) => {
      this.ensure(lh(o.size ?? 10) * 2);
      this.label(name.toUpperCase(), M, this.y - 1.5, 6.5, f.bold, C.slate);
      this.text(value, { x: M + 104, w: CW - 104, ...o });
      this.gap(5);
    };
    field('Objet', c.subject, { size: 10.5, font: f.bold, color: C.navy });
    field('Destinataire proposé', c.to, { size: 9.5 });
    this.ensure(lh(9.8) * 3 + 14);
    this.label('MESSAGE', M, this.y - 1.5, 6.5, f.bold, C.slate);
    this.y -= 14;
    const tint = (hgt: number) => {
      this.page.drawRectangle({ x: M, y: this.y - hgt, width: CW, height: hgt + 0.4, color: C.cream50 });
      this.page.drawRectangle({ x: M, y: this.y - hgt, width: 2.5, height: hgt + 0.4, color: C.gold });
      this.y -= hgt;
    };
    tint(8);
    this.text(c.body, { x: M + 12, w: CW - 24, size: 9.8, bg: C.cream50, bar: C.gold });
    tint(8);
    this.gap(12);
    this.used.add('cartes-message');
  }

  /** Mention de bas de document (précautions de lecture). */
  note(t: string): void {
    this.gap(10);
    this.ensure(30);
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + 40, y: this.y }, thickness: 0.6, color: C.gold });
    this.gap(6);
    this.text(t, { size: 7.8, color: C.slate, font: this.f.italic, emph: false });
  }
}
