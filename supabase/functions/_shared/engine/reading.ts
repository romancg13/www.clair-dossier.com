// Lecture d'une pièce : type réel, nombre de pages, texte par page ou texte à
// repères (e-mail, tableur). Aucune dépendance de plateforme : l'extraction du
// texte PDF et l'OCR éventuel sont injectés par l'adaptateur.
import { PDFDocument } from 'pdf-lib';
import { detectInputKind, type InputKind } from '../ai-pipeline.ts';
import { docxToText, xlsxToText } from '../office.ts';

export const MAX_PIECE_BYTES = 30 * 1024 * 1024;

export interface ReadingCaps {
  /** Texte de chaque page d'un PDF (index 0 = page 1). */
  pdfText?: (bytes: Uint8Array) => Promise<string[]>;
}

export interface PreparedPiece {
  kind: InputKind;
  mime: string;
  pages: number | null;
  /** Texte par page (PDF texte) ; null si le PDF est une image (scan). */
  pageTexts: string[] | null;
  /** Texte à repères (e-mail, tableur, texte, DOCX). */
  text: string | null;
  /** Vrai si la lecture exige un fournisseur multimodal (scan, photo). */
  needsVision: boolean;
  bytes: Uint8Array;
}

export type PrepareResult = { ok: true; piece: PreparedPiece } | { ok: false; reason: string };

const MIME_BY_KIND: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sheet: 'text/csv', text: 'text/plain' };

/* ── Courriel (RFC 822, cas courants) ───────────────────────────────────── */

function decodeQP(s: string): Uint8Array {
  const clean = s.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '=' && /^[0-9A-F]{2}$/i.test(clean.slice(i + 1, i + 3))) {
      out.push(parseInt(clean.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(...new TextEncoder().encode(clean[i]));
  }
  return new Uint8Array(out);
}

function decodeB64(s: string): Uint8Array {
  const bin = atob(s.replace(/[^A-Za-z0-9+/=]/g, ''));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** En-tête encodé RFC 2047 (=?UTF-8?Q?…?= / =?UTF-8?B?…?=). */
export function decodeMimeWords(v: string): string {
  return v.replace(/=\?([^?]+)\?([QBqb])\?([^?]*)\?=/g, (_m, _cs: string, enc: string, data: string) => {
    try {
      const bytes = enc.toUpperCase() === 'B' ? decodeB64(data) : decodeQP(data.replace(/_/g, ' '));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return data;
    }
  });
}

/** Texte à repères d'un courriel simple : en-têtes utiles puis paragraphes du corps texte. */
export function emlToText(raw: string): string {
  const src = raw.length > 2_000_000 ? raw.slice(0, 2_000_000) : raw;
  const sep = src.search(/\r?\n\r?\n/);
  const head = sep >= 0 ? src.slice(0, sep) : src;
  let body = sep >= 0 ? src.slice(sep).replace(/^\r?\n\r?\n/, '') : '';
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) headers.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
  }
  const cte = (headers.get('content-transfer-encoding') ?? '').toLowerCase();
  const ctype = headers.get('content-type') ?? 'text/plain';
  const boundary = /boundary="?([^";]+)"?/i.exec(ctype)?.[1];
  if (boundary) {
    // Multipart : première partie text/plain.
    const parts = body.split(`--${boundary}`);
    const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p)) ?? parts[1] ?? '';
    return emlToText(`${[...headers].filter(([k]) => ['from', 'to', 'date', 'subject'].includes(k)).map(([k, v]) => `${k}: ${v}`).join('\n')}\n${plain.replace(/^\r?\n/, '')}`);
  }
  if (cte === 'quoted-printable') body = new TextDecoder('utf-8').decode(decodeQP(body));
  else if (cte === 'base64') body = new TextDecoder('utf-8').decode(decodeB64(body));
  const lines: string[] = [];
  for (const [k, label] of [['from', 'De'], ['to', 'À'], ['date', 'Date'], ['subject', 'Objet']] as const) {
    const v = headers.get(k);
    if (v) lines.push(`[en-tête ${label}] ${decodeMimeWords(v)}`);
  }
  body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .forEach((p, i) => lines.push(`[corps § ${i + 1}] ${p}`));
  return lines.join('\n');
}

/** Tableur → lignes à repères « [feuille X, ligne N] a ; b ; c ». */
export function sheetTextWithLocators(text: string): string {
  const out: string[] = [];
  let sheet = 'Feuille 1';
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    const h = /^## Feuille (.+)$/.exec(line);
    if (h) {
      sheet = h[1];
      n = 0;
      continue;
    }
    n++;
    const cells = line.split(';').map((c) => c.trim());
    if (cells.some(Boolean)) out.push(`[feuille ${sheet}, ligne ${n}] ${cells.filter(Boolean).join(' ; ')}`);
  }
  return out.join('\n');
}

function csvToSheetText(csv: string): string {
  return `## Feuille CSV\n${csv.replace(/^﻿/, '').replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ';').replace(/"/g, '')}`;
}

/** Signatures binaires : le type déclaré ne suffit pas. */
function sniff(bytes: Uint8Array): 'pdf' | 'zip' | 'png' | 'jpeg' | 'gif' | 'webp' | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  if (b[0] === 0x50 && b[1] === 0x4b) return 'zip';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

export async function preparePiece(bytes: Uint8Array, fileName: string, declaredMime: string | null, caps: ReadingCaps = {}): Promise<PrepareResult> {
  if (bytes.byteLength === 0) return { ok: false, reason: 'Pièce vide : merci de la redéposer.' };
  if (bytes.byteLength > MAX_PIECE_BYTES) return { ok: false, reason: 'Pièce trop volumineuse (plus de 30 Mo) : merci de la scinder ou de la compresser.' };
  const kind = detectInputKind(fileName, declaredMime);
  const sig = sniff(bytes);
  try {
    if (kind === 'pdf') {
      if (sig !== 'pdf') return { ok: false, reason: "Ce fichier porte l'extension PDF mais n'en est pas un : merci de redéposer le document d'origine." };
      const pages = (await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
      const texts = caps.pdfText ? await caps.pdfText(bytes) : null;
      const chars = texts ? texts.join('').replace(/\s/g, '').length : 0;
      const scanned = !texts || chars < 40;
      return { ok: true, piece: { kind, mime: 'application/pdf', pages, pageTexts: scanned ? null : texts, text: null, needsVision: scanned, bytes } };
    }
    if (kind === 'image') {
      if (!sig || sig === 'pdf' || sig === 'zip') return { ok: false, reason: "Image illisible ou format non reconnu : merci d'envoyer une photo JPEG ou PNG nette." };
      const mime = sig === 'jpeg' ? 'image/jpeg' : `image/${sig}`;
      return { ok: true, piece: { kind, mime, pages: 1, pageTexts: null, text: null, needsVision: true, bytes } };
    }
    if (kind === 'docx') {
      if (sig !== 'zip') return { ok: false, reason: 'Document Word illisible : merci de le réenregistrer au format .docx.' };
      const text = docxToText(bytes);
      if (!text.trim()) return { ok: false, reason: 'Document sans texte exploitable.' };
      const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p, i) => `[§ ${i + 1}] ${p}`);
      return { ok: true, piece: { kind, mime: MIME_BY_KIND.docx, pages: null, pageTexts: null, text: paras.join('\n'), needsVision: false, bytes } };
    }
    if (kind === 'sheet') {
      const isCsv = /\.csv$/i.test(fileName) || declaredMime === 'text/csv';
      if (!isCsv && sig !== 'zip') return { ok: false, reason: 'Tableur illisible : merci de le réenregistrer au format .xlsx ou .csv.' };
      const raw = isCsv ? csvToSheetText(new TextDecoder('utf-8').decode(bytes)) : xlsxToText(bytes);
      const text = sheetTextWithLocators(raw);
      if (!text.trim()) return { ok: false, reason: 'Tableur vide.' };
      return { ok: true, piece: { kind, mime: isCsv ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pages: null, pageTexts: null, text, needsVision: false, bytes } };
    }
    if (kind === 'text') {
      if (sig === 'pdf' || sig === 'zip' || sig === 'png' || sig === 'jpeg') return { ok: false, reason: 'Le contenu ne correspond pas à un texte.' };
      const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const isEml = /\.eml$/i.test(fileName) || declaredMime === 'message/rfc822' || /^(from|received|return-path):/im.test(raw.slice(0, 500));
      const text = isEml
        ? emlToText(raw)
        : raw.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).map((p, i) => `[§ ${i + 1}] ${p}`).join('\n');
      if (!text.trim()) return { ok: false, reason: 'Pièce sans texte exploitable.' };
      return { ok: true, piece: { kind, mime: isEml ? 'message/rfc822' : 'text/plain', pages: null, pageTexts: null, text, needsVision: false, bytes } };
    }
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return { ok: false, reason: `Format non pris en charge (.${ext || '?'}) : merci d'envoyer un PDF, une photo JPEG/PNG, un document Word (.docx), un tableur (.xlsx/.csv) ou un courriel (.eml).` };
  } catch (e) {
    return { ok: false, reason: `Pièce illisible, protégée ou corrompue : merci de la redéposer (${e instanceof Error ? e.message.slice(0, 80) : 'erreur'}).` };
  }
}
