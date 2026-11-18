// Les six rendus ClairDossier à partir du jeu de données unique (view.ts).
// Fichiers par catégorie : tableau de bord (PDF), résumé (PDF + DOCX),
// chronologie (PDF + XLSX + CSV), dates modifiables (PDF à formulaire + XLSX + CSV),
// échéances (PDF + ICS des seules dates confirmées + XLSX), relances (DOCX + PDF).
// Noms « <Slug>-r<révision>.<ext> » conservés : compatibles avec les rendus déjà livrés.
import { PDFTextField } from 'pdf-lib';
import { DELIVERABLE_CATALOG, type DeliverableKey } from '../analysis-model.ts';
import { toCsv } from '../ai-pipeline.ts';
import { buildDocx, buildXlsx, type DocBlock } from '../office.ts';
import { frEuro, frLongDate } from '../engine/text-rules.ts';
import { Pdf, type PdfAssets } from './pdf.ts';
import { buildView, categoryData, type RenduView, type Src, type ViewInput, type Reliab, type DeadlineView } from './view.ts';

export * from './view.ts';
export type { PdfAssets } from './pdf.ts';

export interface RenduFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export const MIMES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  ics: 'text/calendar;charset=utf-8',
} as const;

export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function viewHashes(v: RenduView): Promise<Record<DeliverableKey, string>> {
  const data = categoryData(v);
  const out = {} as Record<DeliverableKey, string>;
  for (const k of Object.keys(data) as DeliverableKey[]) out[k] = await sha256Hex(canonicalJson(data[k]));
  return out;
}

const long = (d: string | null | undefined) => (d ? frLongDate(d) : 'date à déterminer');
const short = (d: string | null | undefined) => (d ? d.split('-').reverse().join('/') : '');
const srcText = (s: Src | null) => (s ? `${s.piece}${s.where ? `, ${s.where}` : ''} — « ${s.quote.length > 140 ? `${s.quote.slice(0, 139)}…` : s.quote} »` : 'non sourcé');
const srcShort = (s: Src | null) => (s ? `${s.piece}${s.where ? `, ${s.where}` : ''}` : '—');
const relText = (r: Reliab) => (r.level === 'elevee' ? 'Fiabilité élevée' : `Vérification recommandée : ${r.reasons.join(', ')}`);
const name = (key: DeliverableKey, rev: number, ext: string) => `${DELIVERABLE_CATALOG.find((d) => d.key === key)!.slug}-r${rev}.${ext}`;

function footer(v: RenduView, demo: boolean): string {
  return `ClairDossier — ${v.dossier.title} — révision ${v.dossier.revision}. Document généré automatiquement à partir des pièces du dossier : à vérifier ; il ne constitue pas un conseil juridique.${v.dossier.simulation ? ' Analyse produite par règles déterministes (sans IA).' : ''}${demo ? ' Données fictives (recette).' : ''}`;
}

/* ── ICS : dates confirmées uniquement (RFC 5545, lignes pliées à 75 octets) ── */
function icsFold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
export function buildConfirmedIcs(v: RenduView, stamp: Date): string {
  const dt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const needsTz = v.echeances.confirmed.some((d) => d.time);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ClairDossier//Echeances//FR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsEsc(`ClairDossier — ${v.dossier.title}`)}`];
  if (needsTz) lines.push('BEGIN:VTIMEZONE', 'TZID:Europe/Paris', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE');
  for (const d of v.echeances.confirmed) {
    const day = d.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${d.key.replace(/[^A-Za-z0-9:-]/g, '-')}@clair-dossier.com`, `DTSTAMP:${dt}`);
    if (d.time) lines.push(`DTSTART;TZID=Europe/Paris:${day}T${d.time.replace(/:/g, '').slice(0, 4)}00`);
    else lines.push(`DTSTART;VALUE=DATE:${day}`);
    lines.push(`SUMMARY:${icsEsc(`${v.dossier.title} — ${d.title}`)}`, `DESCRIPTION:${icsEsc(`${d.nature}. Responsable : ${d.owner}. Source : ${srcShort(d.source)}.`)}`, 'STATUS:CONFIRMED', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/* ── Rendu par catégorie ─────────────────────────────────────────────────── */

async function dashboardPdf(v: RenduView, a: PdfAssets, demo: boolean) {
  const p = await Pdf.create(a, { title: `Tableau de bord — ${v.dossier.title}`, kicker: `Tableau de bord · révision ${v.dossier.revision}`, footer: footer(v, demo), subject: 'Tableau de bord du dossier' });
  p.title(v.dossier.title, `Situation au ${long(v.dossier.as_of)} · ${v.dossier.coverage_label}`);
  p.h2('Situation');
  p.text(v.tableau.situation, { size: 12, gap: 8 });
  p.h2('Votre prochaine action');
  p.callout(() => {
    p.text(v.tableau.action.label, { font: p.f.bold, size: 15, gap: 2 });
    p.text(v.tableau.action.rationale, { size: 10.5, gap: 2 });
    p.text(`Responsable : ${v.tableau.action.owner_label}${v.tableau.action.due_date ? ` · Avant le ${long(v.tableau.action.due_date)}` : ''}`, { size: 9.5, gap: 2 });
  });
  p.h2('Prochaine date');
  const n = v.tableau.next_date;
  if (n) {
    p.text(`${long(n.date)}${n.time ? ` à ${n.time.slice(0, 5).replace(':', ' h ')}` : ''} — ${n.title}`, { font: p.f.bold, size: 12, gap: 2 });
    p.source(`${n.status === 'confirmee' ? 'Date confirmée' : 'Date à confirmer'} · Responsable : ${n.owner} · ${relText(n.reliability)}`);
    p.source(`Source : ${srcText(n.source)}`);
  } else p.text('Aucune date confirmée dans les pièces du dossier.', { gap: 6 });
  if (v.tableau.cabinet) {
    p.h2('Ce que doit faire votre cabinet');
    p.text(v.tableau.cabinet);
  }
  if (v.tableau.alerts.length) {
    p.h2('Points d’attention');
    for (const t of v.tableau.alerts) p.bullet(t, 10.5);
  }
  return p.save();
}

function resumeBlocks(v: RenduView): DocBlock[] {
  return [
    { kind: 'title', text: 'Résumé du dossier' },
    { kind: 'subtitle', text: `${v.dossier.title} — situation au ${long(v.dossier.as_of)} — ${v.dossier.coverage_label}` },
    { kind: 'heading', text: 'L’essentiel' },
    ...v.resume.facts.map((f): DocBlock => ({ kind: 'bullet', text: `${f.text} [${f.status} · ${srcShort(f.source)} · ${relText(f.reliability)}]` })),
    { kind: 'heading', text: 'Pièces absentes du lot' },
    ...(v.resume.missing.length ? v.resume.missing.map((m): DocBlock => ({ kind: 'bullet', text: `${m.label} — ${m.why}` })) : [{ kind: 'para', text: 'Aucune pièce citée ne manque.' } as DocBlock]),
    { kind: 'heading', text: 'Détail' },
    ...v.resume.contradictions.map((c): DocBlock => ({ kind: 'bullet', text: `${c.text} [${c.sources.map(srcShort).join(' ; ')}]` })),
    ...v.resume.amounts.map((x): DocBlock => ({ kind: 'bullet', text: `${x.label} : ${frEuro(x.amount)} [${srcShort(x.source)}]` })),
    ...v.resume.parties.map((x): DocBlock => ({ kind: 'bullet', text: `${x.name} — ${x.role}` })),
    { kind: 'note', text: footer(v, false) },
  ];
}

async function resumePdf(v: RenduView, a: PdfAssets, demo: boolean) {
  const p = await Pdf.create(a, { title: `Résumé — ${v.dossier.title}`, kicker: `Résumé · révision ${v.dossier.revision}`, footer: footer(v, demo), subject: 'Résumé du dossier' });
  p.title('Résumé du dossier', `${v.dossier.title} · situation au ${long(v.dossier.as_of)}`);
  p.h2('L’essentiel');
  for (const f of v.resume.facts) {
    p.bullet(f.text);
    p.source(`${f.status} · ${srcText(f.source)} · ${relText(f.reliability)}`);
  }
  p.h2('Pièces absentes du lot');
  if (v.resume.missing.length) for (const m of v.resume.missing) p.bullet(`${m.label} — ${m.why}`, 10.5);
  else p.text('Aucune pièce citée ne manque.');
  if (v.resume.contradictions.length || v.resume.amounts.length) {
    p.h2('Détail (renvois aux pièces)');
    for (const c of v.resume.contradictions) {
      p.bullet(c.text, 10);
      p.source(c.sources.map(srcShort).join(' ; '));
    }
    if (v.resume.amounts.length) p.table([{ label: 'Montant', width: 80 }, { label: 'Objet', width: 250 }, { label: 'Source', width: 153 }], v.resume.amounts.map((x) => [frEuro(x.amount), x.label, srcShort(x.source)]));
  }
  return p.save();
}

async function chronoPdf(v: RenduView, a: PdfAssets, demo: boolean) {
  const p = await Pdf.create(a, { title: `Chronologie — ${v.dossier.title}`, kicker: `Chronologie · révision ${v.dossier.revision}`, footer: footer(v, demo), subject: 'Chronologie du dossier' });
  p.title('Chronologie', `${v.dossier.title} · ${v.chronologie.all.filter((e) => !e.hidden).length} événements datés`);
  p.h2('Les jalons');
  if (!v.chronologie.milestones.length) p.text('Aucun jalon daté pour le moment.');
  for (const m of v.chronologie.milestones) {
    p.bullet(`${long(m.date)} — ${m.label}${m.corrected ? ' (date corrigée)' : ''}`);
    p.source(`Importance : ${m.importance} · Certitude : ${m.reliability.level === 'elevee' ? 'élevée' : `à vérifier (${m.reliability.reasons.join(', ')})`} · ${srcShort(m.source)}`);
  }
  p.newPage();
  p.text('Annexe — chronologie complète', { font: p.f.title, size: 18, gap: 8 });
  p.table(
    [{ label: 'Date', width: 64 }, { label: 'Événement', width: 210 }, { label: 'Nature', width: 74 }, { label: 'Références', width: 135 }],
    v.chronologie.all.filter((e) => !e.hidden).map((e) => [short(e.date) + (e.corrected ? ' *' : ''), e.label, e.nature, e.sources.map(srcShort).join(' ; ')]),
  );
  p.text('* date corrigée : la date extraite et l’historique figurent dans « Dates modifiables ».', { size: 8.5 });
  return p.save();
}

async function datesPdf(v: RenduView, a: PdfAssets, demo: boolean) {
  const p = await Pdf.create(a, { title: `Dates modifiables — ${v.dossier.title}`, kicker: `Dates modifiables · révision ${v.dossier.revision}`, footer: footer(v, demo), subject: 'Dates modifiables' });
  p.title('Dates modifiables', `${v.dossier.title} · formulaire à remplir`);
  p.text('Corrigez une date dans la colonne « Date retenue » (format JJ/MM/AAAA) et indiquez la raison, puis enregistrez le fichier et déposez-le dans votre dossier. Vous pouvez aussi corriger la date directement en ligne. L’historique des corrections est conservé.', { size: 10, gap: 10 });
  const form = p.pdf.getForm();
  const keys: string[] = [];
  const rows = v.dates.rows.filter((r) => r.status !== 'masquee');
  p.ensure(20);
  for (const [x, t] of [[56, 'ÉVÉNEMENT'], [300, 'DATE RETENUE'], [390, 'RAISON DE LA CORRECTION']] as const) p.page.drawText(t, { x, y: p.y - 8, size: 7.5, font: p.f.bold });
  p.y -= 16;
  rows.forEach((r, i) => {
    const label = `${r.label}`;
    const lines = p.wrap(label, p.f.body, 9.5, 230);
    p.ensure(lines.length * 13 + 30);
    const top = p.y;
    lines.forEach((l, j) => p.page.drawText(l, { x: 56, y: top - 10 - j * 13, size: 9.5, font: p.f.body }));
    p.page.drawText(`Extraite : ${short(r.extracted)}${r.flag ? ` · ${r.flag}` : ''}${r.status === 'corrigee' ? ' · corrigée' : ''}`, { x: 56, y: top - 14 - lines.length * 13, size: 8, font: r.flag ? p.f.bold : p.f.body });
    const d = form.createTextField(`date_retenue_${i}`);
    d.setText(short(r.retained));
    d.addToPage(p.page, { x: 300, y: top - 22, width: 82, height: 18, borderWidth: 0.6, font: p.f.body });
    d.setFontSize(9.5);
    const m = form.createTextField(`raison_${i}`);
    m.setText(r.reason ?? '');
    m.addToPage(p.page, { x: 390, y: top - 22, width: 149, height: 18, borderWidth: 0.6, font: p.f.body });
    m.setFontSize(8.5);
    keys.push(r.key);
    p.y = top - Math.max(30, lines.length * 13 + 22);
  });
  const k = form.createTextField('cles');
  k.setText(JSON.stringify(keys));
  k.enableReadOnly();
  k.addToPage(p.page, { x: 0, y: 0, width: 1, height: 1, borderWidth: 0, hidden: true } as never);
  form.updateFieldAppearances(p.f.body);
  if (v.dates.history.length) {
    p.h2('Historique des corrections');
    p.table([{ label: 'Le', width: 90 }, { label: 'Date retenue', width: 70 }, { label: 'Raison', width: 213 }, { label: 'Auteur', width: 110 }], v.dates.history.map((h) => [h.at.replace('T', ' ').slice(0, 16), short(h.retained), h.reason, h.author]));
  }
  return p.save();
}

/** Corrections lues dans un formulaire « Dates modifiables » rempli. */
export async function readDatesForm(bytes: Uint8Array): Promise<{ key: string; retained: string; reason: string }[]> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const keysField = form.getFields().find((f) => f.getName() === 'cles');
  if (!(keysField instanceof PDFTextField)) throw new Error("Ce PDF n'est pas un formulaire « Dates modifiables » ClairDossier.");
  const keys = JSON.parse(keysField.getText() ?? '[]') as string[];
  const out: { key: string; retained: string; reason: string }[] = [];
  keys.forEach((key, i) => {
    const d = form.getTextField(`date_retenue_${i}`).getText()?.trim() ?? '';
    const r = form.getTextField(`raison_${i}`).getText()?.trim() ?? '';
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    if (m) out.push({ key, retained: `${m[3]}-${m[2]}-${m[1]}`, reason: r });
  });
  return out;
}

function deadlineRowsPdf(p: Pdf, list: DeadlineView[]) {
  for (const d of list) {
    p.bullet(`${long(d.date)}${d.time ? ` à ${d.time.slice(0, 5).replace(':', ' h ')}` : ''} — ${d.title}`);
    p.source(`${d.nature} · Responsable : ${d.owner} · ${relText(d.reliability)} · ${srcShort(d.source)}`);
  }
}

async function echeancesPdf(v: RenduView, a: PdfAssets, demo: boolean) {
  const p = await Pdf.create(a, { title: `Échéances — ${v.dossier.title}`, kicker: `Échéances · révision ${v.dossier.revision}`, footer: footer(v, demo), subject: 'Échéances du dossier' });
  p.title('Échéances', `${v.dossier.title} · au ${long(v.dossier.as_of)}`);
  p.h2('Dates confirmées');
  if (v.echeances.none_confirmed) p.text('Aucune date confirmée dans les pièces du dossier.');
  deadlineRowsPdf(p, v.echeances.confirmed);
  if (v.echeances.to_confirm.length) {
    p.h2('À confirmer');
    deadlineRowsPdf(p, v.echeances.to_confirm);
  }
  if (v.echeances.past.length) {
    p.h2('Dates passées');
    deadlineRowsPdf(p, v.echeances.past);
  }
  p.text('Le calendrier joint (.ics) ne contient que les dates confirmées. Une date à confirmer n’est pas une date validée.', { size: 8.5 });
  return p.save();
}

function relancesBlocks(v: RenduView): DocBlock[] {
  return [
    { kind: 'title', text: 'Relances — brouillons' },
    { kind: 'subtitle', text: `${v.dossier.title} — rien n’est envoyé automatiquement` },
    ...(v.relances.drafts.length ? [] : [{ kind: 'para', text: 'Aucune relance utile pour le moment.' } as DocBlock]),
    ...v.relances.drafts.flatMap((d): DocBlock[] => [
      { kind: 'heading', text: d.subject },
      { kind: 'para', text: `Destinataire : ${d.recipient}` },
      { kind: 'para', text: `Condition d’envoi : ${d.condition}${d.related_deadline ? ` (échéance liée : ${long(d.related_deadline)})` : ''}` },
      { kind: 'para', text: d.body },
    ]),
    { kind: 'note', text: 'Brouillons à relire et adapter ; un courrier engageant (mise en demeure, renonciation…) mérite l’avis d’un professionnel du droit.' },
  ];
}

async function relancesPdf(v: RenduView, a: PdfAssets, demo: boolean) {
  const p = await Pdf.create(a, { title: `Relances — ${v.dossier.title}`, kicker: `Relances · révision ${v.dossier.revision}`, footer: footer(v, demo), subject: 'Brouillons de relance' });
  p.title('Relances', 'Brouillons prêts à copier — rien n’est envoyé automatiquement');
  if (!v.relances.drafts.length) p.text('Aucune relance utile pour le moment.');
  for (const d of v.relances.drafts) {
    p.h2(d.subject);
    p.source(`Destinataire : ${d.recipient} · Condition d’envoi : ${d.condition}`);
    p.text(d.body, { size: 10.5, gap: 8 });
  }
  return p.save();
}

export interface RenderOptions {
  assets: PdfAssets;
  demo?: boolean;
}

/** Fichiers d'une catégorie. */
export async function categoryFiles(key: DeliverableKey, v: RenduView, o: RenderOptions, stamp: Date): Promise<RenduFile[]> {
  const rev = v.dossier.revision, demo = Boolean(o.demo), enc = new TextEncoder();
  switch (key) {
    case 'dashboard':
      return [{ name: name(key, rev, 'pdf'), mime: MIMES.pdf, bytes: await dashboardPdf(v, o.assets, demo) }];
    case 'resume':
      return [
        { name: name(key, rev, 'pdf'), mime: MIMES.pdf, bytes: await resumePdf(v, o.assets, demo) },
        { name: name(key, rev, 'docx'), mime: MIMES.docx, bytes: buildDocx(resumeBlocks(v), `Résumé — ${v.dossier.title}`) },
      ];
    case 'chronologie': {
      const headers = ['Date retenue', 'Date extraite', 'Précision', 'Nature', 'Événement', 'Références', 'Corrigée', 'Raison'];
      const rows = v.chronologie.all.map((e) => [short(e.date), short(e.extracted), e.precision, e.nature, e.label, e.sources.map(srcShort).join(' ; '), e.corrected ? 'oui' : 'non', e.reason ?? '']);
      return [
        { name: name(key, rev, 'pdf'), mime: MIMES.pdf, bytes: await chronoPdf(v, o.assets, demo) },
        { name: name(key, rev, 'xlsx'), mime: MIMES.xlsx, bytes: buildXlsx([{ name: 'Chronologie', headers, rows, widths: [13, 13, 10, 16, 48, 40, 10, 30] }]) },
        { name: name(key, rev, 'csv'), mime: MIMES.csv, bytes: enc.encode(toCsv(headers, rows)) },
      ];
    }
    case 'dates': {
      const headers = ['Clé', 'Événement', 'Date extraite', 'Date retenue', 'Statut', 'Raison', 'Auteur', 'Modifiée le', 'Source'];
      const rows = v.dates.rows.map((r) => [r.key, r.label, short(r.extracted), short(r.retained), r.status, r.reason ?? '', r.author ?? '', r.edited_at ? short(r.edited_at.slice(0, 10)) : '', srcShort(r.source)]);
      return [
        { name: name(key, rev, 'pdf'), mime: MIMES.pdf, bytes: await datesPdf(v, o.assets, demo) },
        { name: name(key, rev, 'xlsx'), mime: MIMES.xlsx, bytes: buildXlsx([{ name: 'Dates', headers, rows }, { name: 'Historique', headers: ['Horodatage (UTC)', 'Clé', 'Date retenue', 'Libellé', 'Masquée', 'Raison', 'Auteur'], rows: v.dates.history.map((h) => [h.at.replace('T', ' ').slice(0, 16), h.key, short(h.retained), h.label ?? '', h.hidden ? 'oui' : '', h.reason, h.author]) }]) },
        { name: name(key, rev, 'csv'), mime: MIMES.csv, bytes: enc.encode(toCsv(headers, rows)) },
      ];
    }
    case 'echeances':
      return [
        { name: name(key, rev, 'pdf'), mime: MIMES.pdf, bytes: await echeancesPdf(v, o.assets, demo) },
        { name: name(key, rev, 'ics'), mime: MIMES.ics, bytes: enc.encode(buildConfirmedIcs(v, stamp)) },
        { name: name(key, rev, 'xlsx'), mime: MIMES.xlsx, bytes: buildXlsx([{ name: 'Échéances', headers: ['Date', 'Heure', 'Échéance', 'Statut', 'Nature', 'Responsable', 'Fiabilité', 'Source'], rows: [...v.echeances.confirmed.map((d) => ['confirmée', d] as const), ...v.echeances.to_confirm.map((d) => ['à confirmer', d] as const), ...v.echeances.past.map((d) => ['passée', d] as const)].map(([s, d]) => [short(d.date), d.time?.slice(0, 5) ?? '', d.title, s, d.nature, d.owner, d.reliability.level === 'elevee' ? 'élevée' : 'à vérifier', srcShort(d.source)]) }]) },
      ];
    case 'relances':
      return [
        { name: name(key, rev, 'docx'), mime: MIMES.docx, bytes: buildDocx(relancesBlocks(v), `Relances — ${v.dossier.title}`) },
        { name: name(key, rev, 'pdf'), mime: MIMES.pdf, bytes: await relancesPdf(v, o.assets, demo) },
      ];
  }
}

/** Renderer du moteur (ports) : vue + empreintes, puis fichiers à la demande. */
export function createRenderer(o: RenderOptions) {
  return {
    async prepare(input: ViewInput) {
      const view = buildView(input);
      return { view, hashes: await viewHashes(view) };
    },
    async files(category: DeliverableKey, input: ViewInput, view: unknown) {
      return categoryFiles(category, view as RenduView, o, input.generatedAt);
    },
  };
}
