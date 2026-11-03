// Formats bureautiques (DOCX, XLSX) en lecture ET en écriture, sans dépendance
// autre que fflate (zip). Partagé par la fonction `ai-worker` (Deno) et le site
// (démo, navigateur) ; testé sous Node (tests/office.test.ts).
//
// Lecture : uniquement le texte (aucune macro, aucune relation externe, aucun
// objet embarqué n'est interprété) ; archives bornées contre les bombes zip.
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate';

const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

function unzipBounded(bytes: Uint8Array, wanted: (name: string) => boolean): Record<string, Uint8Array> {
  let total = 0;
  return unzipSync(bytes, {
    filter: (f) => {
      if (!wanted(f.name)) return false;
      total += f.originalSize;
      if (f.originalSize > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) throw new Error('Archive trop volumineuse une fois décompressée');
      return true;
    },
  });
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? _;
  });
}

// XML 1.0 n'accepte pas les caractères de contrôle (hors tab / sauts de ligne).
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
export function escapeXml(s: string): string {
  return s.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Lecture ────────────────────────────────────────────────────────────── */

/** Texte d'un DOCX : paragraphes séparés par des sauts de ligne. */
export function docxToText(bytes: Uint8Array): string {
  const files = unzipBounded(bytes, (n) => n === 'word/document.xml');
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('DOCX invalide (word/document.xml absent)');
  return decodeXml(
    strFromU8(xml)
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texte d'un XLSX : une section par feuille, cellules séparées par « ; ». */
export function xlsxToText(bytes: Uint8Array): string {
  const files = unzipBounded(bytes, (n) => n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
      )
    : [];
  const names = files['xl/workbook.xml'] ? [...strFromU8(files['xl/workbook.xml']).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decodeXml(m[1])) : [];
  const sheets = Object.keys(files)
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return sheets
    .map((path, i) => {
      const rows = [...strFromU8(files[path]).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
        [...row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
          .map((c) => {
            const attrs = c[1];
            const inner = c[2] ?? '';
            const type = attrs.match(/\bt="([^"]+)"/)?.[1];
            if (type === 'inlineStr') return decodeXml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
            const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
            return type === 's' ? (shared[Number(v)] ?? '') : decodeXml(v);
          })
          .join(';'),
      );
      return `## Feuille ${names[i] ?? i + 1}\n${rows.join('\n')}`;
    })
    .join('\n\n')
    .trim();
}

/* ── Écriture DOCX ──────────────────────────────────────────────────────── */

export type DocBlock =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'note'; text: string };

const NAVY = '0D1B3D';
const GOLD = 'A8873A';

function run(text: string, opts: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {}): string {
  const rpr = [
    opts.bold ? '<w:b/>' : '',
    opts.italic ? '<w:i/>' : '',
    `<w:color w:val="${opts.color ?? NAVY}"/>`,
    `<w:sz w:val="${opts.size ?? 21}"/>`,
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>',
  ].join('');
  return text
    .split('\n')
    .map((line, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`)
    .join('');
}

function paragraph(b: DocBlock): string {
  switch (b.kind) {
    case 'title':
      return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${run(b.text, { bold: true, size: 36 })}</w:p>`;
    case 'subtitle':
      return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="C7A654"/></w:pBdr><w:spacing w:after="240"/></w:pPr>${run(b.text, { size: 18, color: GOLD })}</w:p>`;
    case 'heading':
      return `<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>${run(b.text.toUpperCase(), { bold: true, size: 20, color: GOLD })}</w:p>`;
    case 'bullet':
      return `<w:p><w:pPr><w:ind w:left="360" w:hanging="220"/><w:spacing w:after="60"/></w:pPr>${run(`•  ${b.text}`)}</w:p>`;
    case 'note':
      return `<w:p><w:pPr><w:spacing w:before="240"/></w:pPr>${run(b.text, { italic: true, size: 16, color: '64748B' })}</w:p>`;
    default:
      return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${run(b.text)}</w:p>`;
  }
}

/** DOCX minimal valide (Word, LibreOffice, Pages) — mise en forme directe. */
export function buildDocx(blocks: DocBlock[], title: string): Uint8Array {
  const body = blocks.map(paragraph).join('');
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    ),
    'docProps/core.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>ClairDossier</dc:creator></cp:coreProperties>`,
    ),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    ),
  });
}

/* ── Écriture XLSX ──────────────────────────────────────────────────────── */

export type Cell = string | number | null | undefined;
export interface Sheet {
  name: string;
  headers: string[];
  rows: Cell[][];
  widths?: number[];
}

function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function sheetXml(sheet: Sheet): string {
  const cell = (v: Cell, r: number, c: number, header: boolean) => {
    const ref = `${colName(c)}${r}`;
    const style = header ? ' s="1"' : ' s="2"';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
    const s = v === null || v === undefined ? '' : String(v);
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(s)}</t></is></c>`;
  };
  const rows = [sheet.headers, ...sheet.rows].map((row, i) => `<row r="${i + 1}">${row.map((v, c) => cell(v, i + 1, c, i === 0)).join('')}</row>`).join('');
  const widths = sheet.headers.map((_, i) => sheet.widths?.[i] ?? 22);
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

/** XLSX minimal valide : en-têtes en gras sur fond bleu nuit, ligne figée, retours à la ligne. */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const safe = sheets.map((s, i) => ({ ...s, name: (s.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || `Feuille ${i + 1}`) }));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safe.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safe.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safe.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${safe.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0D1B3D"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>',
    ),
  };
  safe.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))));
  return zipSync(files);
}
