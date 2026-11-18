// Outils textuels déterministes partagés (dates et montants français, phrases, normalisation).

export const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8,
  septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};
const EN_MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const squash = (s: string) => s.replace(/[\s  ]+/g, ' ').trim();

const pad = (n: number) => String(n).padStart(2, '0');
function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

export interface DateHit { iso: string; text: string; index: number }

const FR_LONG = /\b(1er|[0-3]?\d)\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b/gi;
const NUMERIC = /\b([0-3]?\d)\/([01]?\d)\/(\d{4})\b/g;
const RFC = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/g;
const ISO = /\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/g;

/** Dates complètes (jour connu) d'un texte, dans l'ordre d'apparition. */
export function findDates(text: string): DateHit[] {
  const out: DateHit[] = [];
  for (const m of text.matchAll(FR_LONG)) {
    const d = m[1].toLowerCase() === '1er' ? 1 : Number(m[1]);
    const v = iso(Number(m[3]), MONTHS[fold(m[2])] ?? 0, d);
    if (v) out.push({ iso: v, text: m[0], index: m.index ?? 0 });
  }
  for (const m of text.matchAll(NUMERIC)) {
    const v = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (v) out.push({ iso: v, text: m[0], index: m.index ?? 0 });
  }
  for (const m of text.matchAll(RFC)) {
    const v = iso(Number(m[3]), EN_MONTHS[m[2].toLowerCase()] ?? 0, Number(m[1]));
    if (v) out.push({ iso: v, text: m[0], index: m.index ?? 0 });
  }
  for (const m of text.matchAll(ISO)) {
    const v = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (v) out.push({ iso: v, text: m[0], index: m.index ?? 0 });
  }
  return out.sort((a, b) => a.index - b.index);
}

export interface AmountHit { value: number; text: string; index: number }
const AMOUNT = /(\d{1,3}(?:[   .]\d{3})+|\d+)(?:,(\d{1,2}))?\s?(?:€|EUR\b|euros?\b)/gi;

/** Montants en euros écrits en chiffres. */
export function findAmounts(text: string): AmountHit[] {
  const out: AmountHit[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const int = Number(m[1].replace(/[   .]/g, ''));
    const dec = m[2] ? Number(m[2].padEnd(2, '0')) / 100 : 0;
    if (Number.isFinite(int)) out.push({ value: Math.round((int + dec) * 100) / 100, text: m[0], index: m.index ?? 0 });
  }
  return out;
}

export function frEuro(v: number): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, ' ')} €`;
}

const FR_MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « 15 janvier 2027 » (1er pour le premier jour). */
export function frLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!d) return m ? `${FR_MONTH_NAMES[m - 1]} ${y}` : String(y);
  return `${d === 1 ? '1er' : d} ${FR_MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Découpe un texte en phrases sans casser « n° », les décimales ni les initiales.
 * Les phrases sont des sous-chaînes exactes du texte fourni (citations vérifiables).
 */
export function sentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?\n]+(?:[.!?](?!\d)|\n|$)/g;
  let buf = '';
  for (const m of text.matchAll(re)) {
    const part = m[0];
    buf += part;
    const t = buf.trim();
    if (/\b(n°|M|Mme|art|al|p)\.$/i.test(t)) continue;
    if (t) out.push(t);
    buf = '';
  }
  if (buf.trim()) out.push(buf.trim());
  return out.map((s) => s.replace(/\n$/, '').trim()).filter(Boolean);
}

/**
 * Lignes d'une page PDF regroupées en paragraphes : une ligne se poursuit sur la
 * suivante si elle ne finit pas par une ponctuation forte et que la suivante
 * commence par une minuscule, un chiffre ou une parenthèse (retour à la ligne de mise en page).
 */
export function pdfParagraphs(page: string): string[] {
  const lines = page.split(/\r?\n/).map((l) => squash(l)).filter(Boolean);
  const out: string[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && !/[.:;!?»)]$/.test(prev) && /^[a-zà-ÿ0-9(€]/.test(l)) out[out.length - 1] = `${prev} ${l}`;
    else out.push(l);
  }
  return out;
}

/** Libellé court : retire le fragment cité (date, montant), les connecteurs vides, borne la longueur. */
export function shortLabel(sentence: string, remove: string[], max = 90): string {
  let s = sentence;
  for (const r of remove) s = s.split(r).join(' ');
  s = squash(s.replace(/\[[^\]]+\]/g, ' '))
    .replace(/\b(avant le|au plus tard le|le|du|au|de)\s*([,.;:)]|$)/gi, '$2')
    .replace(/\(\s*\)/g, '').replace(/\s*:\s*,/g, ',')
    .replace(/\s+([,.])/g, '$1').replace(/(\S):/g, '$1 :')
    .replace(/[,;:]\s*$/g, '')
    .replace(/^[,;:.\s-]+/, '')
    .replace(/\.$/, '');
  s = squash(s);
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
