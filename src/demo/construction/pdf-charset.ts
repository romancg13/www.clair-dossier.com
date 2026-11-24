// Jeu de caractères du PDF de démonstration (module PUR, sans pdf-lib) : les polices
// standard (Helvetica, Times) n'encodent que WinAnsi. L'écran s'en sert pour refuser
// l'export d'un texte qui serait altéré ; report-pdf.ts pour normaliser ce qu'il dessine.

// WinAnsi : ASCII imprimable, Latin-1 (0xA0–0xFF) et les 27 signes de 0x80–0x9F.
const WINANSI_OK = /[\x20-\x7E\xA0-\xFFŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/;

/** Espaces insécables (U+202F, U+2007) → U+00A0 ; autres espaces typographiques et tabulation → espace ; fins de ligne → \n. */
export function normalizePdfText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[\u202F\u2007]/g, '\u00A0')
    .replace(/[\t\u2002\u2003\u2009]/g, ' ');
}

const supported = (c: string) => c === '\n' || WINANSI_OK.test(c);

/** Caractères (distincts, dans l'ordre d'apparition) que le PDF ne peut pas rendre tels quels. */
export function unsupportedChars(text: string): string[] {
  return [...new Set(Array.from(normalizePdfText(text)).filter((c) => !supported(c)))];
}

/** Texte prêt à dessiner : normalisé, tout caractère hors WinAnsi remplacé par « ? » (l'écran bloque l'export avant). */
export function pdfSafe(s: string): string {
  return Array.from(normalizePdfText(s))
    .map((c) => (supported(c) ? c : '?'))
    .join('');
}
