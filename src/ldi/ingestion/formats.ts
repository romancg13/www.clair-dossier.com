/**
 * LDI — reconnaissance de format.
 *
 * ┌─ L'EXTENSION EST UNE ALLÉGATION ────────────────────────────────────────┐
 * │ Elle est écrite par celui qui transmet le fichier. Un « .pdf » peut être │
 * │ un JPEG renommé, et un fichier sans extension peut être un procès-       │
 * │ verbal. La reconnaissance porte donc D'ABORD sur les octets, et          │
 * │ l'extension n'intervient que pour départager ce que les octets ne        │
 * │ distinguent pas — un `.docx` et un `.xlsx` sont deux archives ZIP.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { FormatFichier } from './types';

/** Signatures binaires, comparées au début du fichier. */
const SIGNATURES: { format: FormatFichier | 'zip'; octets: number[] }[] = [
  { format: 'pdf', octets: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { format: 'zip', octets: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  { format: 'zip', octets: [0x50, 0x4b, 0x05, 0x06] }, // archive vide
  { format: 'image', octets: [0xff, 0xd8, 0xff] }, // JPEG
  { format: 'image', octets: [0x89, 0x50, 0x4e, 0x47] }, // PNG
  { format: 'image', octets: [0x49, 0x49, 0x2a, 0x00] }, // TIFF petit-boutiste
  { format: 'image', octets: [0x4d, 0x4d, 0x00, 0x2a] }, // TIFF gros-boutiste
];

function commencePar(octets: Uint8Array, signature: number[]): boolean {
  if (octets.length < signature.length) return false;
  return signature.every((o, i) => octets[i] === o);
}

/** Extension en minuscules, sans point. Vide si le nom n'en porte pas. */
export function extensionDe(nom: string): string {
  const i = nom.lastIndexOf('.');
  return i > 0 && i < nom.length - 1 ? nom.slice(i + 1).toLowerCase() : '';
}

/**
 * Contenu d'une archive OOXML, déduit de ses entrées.
 * Un `.docx` porte `word/document.xml`, un `.xlsx` porte `xl/workbook.xml`.
 */
export function formatOoxml(entrees: string[]): FormatFichier | null {
  if (entrees.some((e) => e.startsWith('word/'))) return 'docx';
  if (entrees.some((e) => e.startsWith('xl/'))) return 'tableur';
  return null;
}

/**
 * Reconnaît le format d'un fichier.
 *
 * Les archives ZIP sont rendues comme `archive` : seule l'ouverture permet de
 * savoir s'il s'agit d'un `.docx`, d'un `.xlsx` ou d'un vrai `.zip`, et cette
 * décision revient à l'ingestion, qui les ouvre déjà.
 */
export function reconnaitreFormat(nom: string, octets: Uint8Array): FormatFichier {
  for (const { format, octets: signature } of SIGNATURES) {
    if (commencePar(octets, signature)) {
      return format === 'zip' ? 'archive' : format;
    }
  }

  // Aucune signature : on se rabat sur l'extension, pour les formats textuels
  // qui n'en portent pas. La confiance est moindre, et l'extraction le dira.
  switch (extensionDe(nom)) {
    case 'csv':
    case 'tsv':
      return 'csv';
    case 'eml':
      return 'courriel';
    case 'txt':
    case 'md':
    case 'rtf':
      return 'texte';
    case 'heic':
    case 'heif':
      return 'image';
    default:
      return estProbablementTexte(octets) ? 'texte' : 'inconnu';
  }
}

/**
 * Un fichier est tenu pour textuel s'il ne contient pas d'octet nul et reste
 * majoritairement imprimable sur son début. Heuristique volontairement
 * prudente : un binaire pris pour du texte produirait des « pièces » illisibles.
 */
function estProbablementTexte(octets: Uint8Array): boolean {
  const fenetre = octets.subarray(0, 1024);
  if (fenetre.length === 0) return false;

  let imprimables = 0;
  for (const o of fenetre) {
    if (o === 0) return false;
    if (o === 9 || o === 10 || o === 13 || (o >= 32 && o !== 127)) imprimables += 1;
  }
  return imprimables / fenetre.length > 0.9;
}

export const LIBELLES_FORMAT: Record<FormatFichier, string> = {
  pdf: 'PDF',
  docx: 'Document Word',
  tableur: 'Tableur',
  csv: 'Table CSV',
  courriel: 'Courriel',
  texte: 'Texte',
  image: 'Image',
  archive: 'Archive',
  inconnu: 'Format non reconnu',
};
