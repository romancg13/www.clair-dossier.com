/**
 * Génère les pièces PDF du dossier étalon (tests/fixtures/dossier-etalon/) à partir
 * de manifest.json. Déterministe : mêmes entrées → mêmes octets (aucune date de
 * création, aucun identifiant aléatoire), ce qui rend les doublons stricts
 * reproductibles et permet de vérifier en CI que les fichiers commités sont à jour.
 *
 * Données FICTIVES uniquement (interdit n° 15). Usage : npm run gen:etalon
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

type Rendu = {
  /** "texte" (défaut) : texte natif ; "image" : page image sans couche texte (numérisation). */
  type?: "texte" | "image";
  /** Taille de police en points. */
  taille?: number;
  /** Marge gauche en points. */
  marge?: number;
  /** Producteur déclaré dans le dictionnaire Info. */
  producteur?: string;
};

type Piece = {
  fichier: string;
  titre: string;
  categorie: string;
  role: "original" | "doublon_strict" | "quasi_doublon" | "illisible" | "injection";
  /** Pièce dont celle-ci est la copie octet pour octet. */
  copie_de?: string;
  /** Pièce dont celle-ci reprend le texte avec un rendu différent. */
  quasi_doublon_de?: string;
  texte?: string[];
  rendu?: Rendu;
};

type Manifest = { dossier: Record<string, string>; pieces: Piece[] };

const DIR = resolve(__dirname, "../tests/fixtures/dossier-etalon");
const manifest = JSON.parse(readFileSync(resolve(DIR, "manifest.json"), "utf8")) as Manifest;

// WinAnsiEncoding : latin-1 + quelques caractères de la plage 0x80–0x9F.
const WINANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94,
  "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c, "Ÿ": 0x9f,
};

function encodeWinAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const mapped = WINANSI[ch];
    if (mapped !== undefined) {
      out.push(mapped);
      continue;
    }
    const code = ch.codePointAt(0) ?? 0x3f;
    out.push(code <= 0xff ? code : 0x3f);
  }
  return out;
}

function pdfString(text: string): number[] {
  const bytes: number[] = [0x28]; // (
  for (const b of encodeWinAnsi(text)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) bytes.push(0x5c); // échappe ( ) \
    bytes.push(b);
  }
  bytes.push(0x29); // )
  return bytes;
}

function ascii(text: string): number[] {
  return Array.from(Buffer.from(text, "latin1"));
}

/** Assemble le fichier PDF (en-tête, objets, xref, trailer) à partir des objets numérotés. */
function assemblerPdf(objets: number[][]): Buffer {
  const out: number[] = ascii("%PDF-1.4\n%âãÏÓ\n");
  const offsets: number[] = [];
  objets.forEach((body, i) => {
    offsets.push(out.length);
    out.push(...ascii(`${i + 1} 0 obj\n`), ...body, ...ascii("\nendobj\n"));
  });
  const xref = out.length;
  out.push(...ascii(`xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`));
  for (const off of offsets) out.push(...ascii(`${String(off).padStart(10, "0")} 00000 n \n`));
  out.push(
    ...ascii(`trailer\n<< /Size ${objets.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`),
  );
  return Buffer.from(out);
}

/**
 * PDF d'une page contenant uniquement une image (numérisation sans couche texte) :
 * bitmap gris 48×64 en clair (aucun filtre), bruit déterministe façon scan pâle.
 */
function buildPdfImage(rendu: Rendu): Buffer {
  const largeur = 48;
  const hauteur = 64;
  const pixels: number[] = [];
  for (let i = 0; i < largeur * hauteur; i++) {
    const bruit = (Math.imul(i + 1, 2654435761) >>> 0) % 256;
    pixels.push(bruit < 36 ? 30 + (bruit % 20) : 214 + (bruit % 40));
  }
  const objets: number[][] = [];
  const add = (bytes: number[]) => objets.push(bytes) && objets.length;
  add(ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  add(ascii("<< /Type /Pages /Kids [6 0 R] /Count 1 >>"));
  add(ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  add([...ascii("<< /Producer "), ...pdfString(rendu.producteur ?? "Scanner fictif v0"), ...ascii(" >>")]);
  add([
    ...ascii(
      `<< /Type /XObject /Subtype /Image /Width ${largeur} /Height ${hauteur} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`,
    ),
    ...pixels,
    ...ascii("\nendstream"),
  ]);
  const content = ascii("q 480 0 0 640 57 101 cm /Im1 Do Q\n");
  const contentId = add([...ascii(`<< /Length ${content.length} >>\nstream\n`), ...content, ...ascii("endstream")]);
  // L'objet 6 doit être la page (référencé par /Kids) : on insère la page avant le contenu.
  objets.splice(5, 0, ascii(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 5 0 R >> >> /Contents ${contentId + 1} 0 R >>`,
  ));
  return assemblerPdf(objets);
}

/** PDF 1.4 minimal, une police Helvetica, N pages de texte. */
function buildPdf(lines: string[], rendu: Rendu): Buffer {
  const taille = rendu.taille ?? 11;
  const marge = rendu.marge ?? 56;
  const interligne = Math.round(taille * 1.35);
  const parPage = Math.floor((842 - 2 * marge) / interligne);
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += parPage) pages.push(lines.slice(i, i + parPage));

  const objets: number[][] = [];
  const add = (bytes: number[]) => objets.push(bytes) && objets.length; // renvoie le numéro d'objet

  // 1 : catalogue, 2 : pages (remplis après), 3 : police, 4 : info
  add([]);
  add([]);
  add(ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  add([...ascii("<< /Producer "), ...pdfString(rendu.producteur ?? "ClairDossier dossier etalon"), ...ascii(" >>")]);

  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const content: number[] = ascii(`BT /F1 ${taille} Tf ${marge} ${842 - marge} Td ${interligne} TL\n`);
    pageLines.forEach((line, i) => {
      content.push(...pdfString(line), ...ascii(i === pageLines.length - 1 ? " Tj\n" : " Tj T*\n"));
    });
    content.push(...ascii("ET\n"));
    const contentId = add([
      ...ascii(`<< /Length ${content.length} >>\nstream\n`),
      ...content,
      ...ascii("endstream"),
    ]);
    const pageId = add(
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
    pageIds.push(pageId);
  }
  objets[0] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objets[1] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  return assemblerPdf(objets);
}

const parFichier = new Map(manifest.pieces.map((p) => [p.fichier, p]));
const rendus = new Map<string, Buffer>();

function render(piece: Piece): Buffer {
  const cached = rendus.get(piece.fichier);
  if (cached) return cached;
  let buf: Buffer;
  if (piece.rendu?.type === "image") {
    buf = buildPdfImage(piece.rendu);
  } else if (piece.copie_de) {
    const source = parFichier.get(piece.copie_de);
    if (!source) throw new Error(`${piece.fichier} : copie_de introuvable (${piece.copie_de})`);
    buf = render(source);
  } else {
    const source = piece.quasi_doublon_de ? parFichier.get(piece.quasi_doublon_de) : piece;
    if (!source?.texte) throw new Error(`${piece.fichier} : aucun texte à rendre`);
    buf = buildPdf(source.texte, piece.rendu ?? {});
  }
  rendus.set(piece.fichier, buf);
  return buf;
}

let n = 0;
for (const piece of manifest.pieces) {
  writeFileSync(resolve(DIR, piece.fichier), render(piece));
  n++;
}
console.log(`dossier étalon : ${n} pièce(s) générée(s) dans ${DIR}`);
