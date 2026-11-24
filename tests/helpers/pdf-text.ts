// Extracteur de texte minimal pour les PDF produits par pdf-lib (polices standard).
// pdf-lib compresse les flux de contenu (FlateDecode) et écrit le texte en chaînes
// hexadécimales WinAnsi (<…> Tj). On décompresse chaque flux avec fflate, puis on
// décode les opérandes de Tj / TJ. Réutilisable par les tests E2E (PDF téléchargé).
// Usage : extractPdfText(bytes) → une ligne par opérateur de texte, dans l'ordre des
// flux ; pour chercher un passage coupé en plusieurs lignes, normaliser les blancs :
// extractPdfText(bytes).replace(/\s+/g, ' ').
import { unzlibSync } from 'fflate';

// Octets 0x80–0x9F de WinAnsiEncoding (le reste coïncide avec Latin-1).
const WIN_ANSI_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰',
  0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

const winAnsi = (codes: number[]) => codes.map((c) => WIN_ANSI_HIGH[c] ?? String.fromCharCode(c)).join('');

function latin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
}

function decodeHex(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  const padded = clean.length % 2 ? `${clean}0` : clean;
  const codes: number[] = [];
  for (let i = 0; i < padded.length; i += 2) codes.push(parseInt(padded.slice(i, i + 2), 16));
  return winAnsi(codes);
}

function decodeLiteral(lit: string): string {
  const codes: number[] = [];
  for (let i = 0; i < lit.length; i++) {
    const c = lit[i];
    if (c !== '\\') {
      codes.push(c.charCodeAt(0));
      continue;
    }
    const n = lit[++i];
    const oct = /^[0-7]{1,3}/.exec(lit.slice(i));
    if (oct) {
      codes.push(parseInt(oct[0], 8));
      i += oct[0].length - 1;
    } else codes.push(({ n: 10, r: 13, t: 9, b: 8, f: 12 } as Record<string, number>)[n] ?? n.charCodeAt(0));
  }
  return winAnsi(codes);
}

const STRING = /<([0-9A-Fa-f\s]*)>|\(((?:\\.|[^\\)])*)\)/g;
const decodeString = (m: RegExpExecArray) => (m[1] !== undefined ? decodeHex(m[1]) : decodeLiteral(m[2]));

function textOfContent(content: string): string[] {
  const out: string[] = [];
  const op = /(<[0-9A-Fa-f\s]*>|\((?:\\.|[^\\)])*\))\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
  for (let m = op.exec(content); m; m = op.exec(content)) {
    const source = m[1] ?? m[2];
    const parts: string[] = [];
    STRING.lastIndex = 0;
    for (let s = STRING.exec(source); s; s = STRING.exec(source)) parts.push(decodeString(s));
    out.push(parts.join(''));
  }
  return out;
}

/** Texte de tous les flux du PDF (décompressés si FlateDecode), une ligne par opérateur Tj/TJ. */
export function extractPdfText(bytes: Uint8Array): string {
  const raw = latin1(bytes);
  const lines: string[] = [];
  const re = /stream\r?\n/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    let stop = end;
    if (raw[stop - 1] === '\n') stop--;
    if (raw[stop - 1] === '\r') stop--;
    const data = bytes.subarray(start, stop);
    let content: string;
    try {
      content = latin1(unzlibSync(data)); // FlateDecode
    } catch {
      content = latin1(data); // flux non compressé
    }
    lines.push(...textOfContent(content));
    re.lastIndex = end + 'endstream'.length; // « endstream » contient « stream »
  }
  return lines.join('\n');
}
