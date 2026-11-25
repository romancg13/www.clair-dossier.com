import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync, zipSync, strToU8 } from 'fflate';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { buildDocx, buildXlsx, docxToText, xlsxToText } from '../supabase/functions/_shared/office.ts';
import {
  DELIVERABLE_CATALOG,
  applyOverrides,
  buildChronology,
  buildDatesPdf,
  buildDeliverables,
  deliverableKeyFromName,
  deliverableKeyOf,
  type DeadlineRow,
} from '../supabase/functions/_shared/deliverables.ts';
import { trackingStep, TIMELINE_STEPS } from '../packages/core/src/dossiers.ts';
import { bulkPieces, demoAnalysis, DEMO_PIECES } from '../src/demo/fixture.ts';
import { LOGO_HEIGHT, LOGO_PNG_BASE64, LOGO_WIDTH } from '../supabase/functions/_shared/brand-logo.ts';

const cov = { total: 11, extracted: 11, unsupported: 0, failed: 0, pending: 0, complete: true };
const at = new Date('2026-10-23T10:00:00Z');

test('DOCX : écriture puis relecture du texte (accents, caractères XML échappés)', () => {
  const bytes = buildDocx([{ kind: 'title', text: 'Résumé' }, { kind: 'para', text: 'Montant < 5 000 € & « délai »' }, { kind: 'bullet', text: 'Ligne 2' }], 'Test');
  const text = docxToText(bytes);
  assert.match(text, /Résumé/);
  assert.match(text, /Montant < 5 000 € & « délai »/);
  assert.match(text, /Ligne 2/);
});

test('XLSX : écriture puis relecture (plusieurs feuilles, nombres, cellules vides)', () => {
  const bytes = buildXlsx([
    { name: 'Dates', headers: ['Date', 'Montant'], rows: [['03/11/2026', 12880], ['', null]] },
    { name: 'Historique/2026', headers: ['Motif'], rows: [['correction « manuelle »']] },
  ]);
  const text = xlsxToText(bytes);
  assert.match(text, /## Feuille Dates\nDate;Montant\n03\/11\/2026;12880/);
  assert.match(text, /Feuille Historique 2026/);
  assert.match(text, /correction « manuelle »/);
});

test('lecteurs bornés : une archive démesurée est refusée (bombe zip)', () => {
  const huge = zipSync({ 'word/document.xml': new Uint8Array(60 * 1024 * 1024) }, { level: 9 });
  assert.ok(huge.byteLength < 1_000_000, 'archive compressée petite');
  assert.throws(() => docxToText(huge), /trop volumineuse/);
  assert.throws(() => docxToText(zipSync({ 'autre.xml': strToU8('<x/>') })), /DOCX invalide/);
});

test('chronologie déterministe : fusion des doublons, sources cumulées, tri, échéances exclues', () => {
  const events = buildChronology([
    { document_id: 'a', data: { dates: [{ date: '2026-09-29', precision: 'day', kind: 'event_date', label: 'Contestation', evidence: [{ page: 1, quote: 'x' }] }, { date: '2026-09-30', precision: 'day', kind: 'deadline', label: 'Échéance', evidence: [] }] } },
    { document_id: 'b', data: { dates: [{ date: '2026-09-29', precision: 'day', kind: 'event_date', label: 'contestation', evidence: [{ page: 2, quote: 'y' }] }, { date: '2026-06', precision: 'month', kind: 'document_date', label: 'CGV', evidence: [] }, { date: 'vers 2025', precision: 'unknown', kind: 'event_date', label: 'invalide', evidence: [] }] } },
    { document_id: 'c', data: null },
  ]);
  assert.deepEqual(events.map((e) => [e.date, e.label]), [['2026-06', 'CGV'], ['2026-09-29', 'Contestation']]);
  assert.deepEqual(events[1].evidence.map((e) => e.document_id), ['a', 'b']);
});

test('corrections humaines : la dernière l’emporte, masquage conservé, historique intact', () => {
  const [e] = buildChronology([{ document_id: 'a', data: { dates: [{ date: '2026-09-20', precision: 'day', kind: 'event_date', label: 'Relance', evidence: [] }] } }]);
  const out = applyOverrides([e], [
    { event_key: e.key, retained_date: '2026-09-22', label: null, hidden: false, reason: 'cachet de la poste', author: 'A', created_at: '2026-10-01T10:00:00Z' },
    { event_key: e.key, retained_date: '2026-09-21', label: null, hidden: false, reason: 'accusé de réception', author: 'B', created_at: '2026-10-02T10:00:00Z' },
  ]);
  assert.equal(out[0].retained_date, '2026-09-21');
  assert.equal(out[0].date, '2026-09-20', 'date extraite conservée');
  assert.equal(out[0].author, 'B');
  assert.equal(out[0].edited, true);
});

test('suivi en 4 étapes fondé sur les événements réels', () => {
  assert.deepEqual(TIMELINE_STEPS, ['Dossier créé', 'Traitement en cours', 'Documents disponibles', 'Dossier clôturé']);
  const f = { status: 'brouillon', hasDeliverables: false, processing: false, closed: false };
  assert.equal(trackingStep(f), 1);
  assert.equal(trackingStep({ ...f, processing: true }), 2);
  assert.equal(trackingStep({ ...f, status: 'valide' }), 2, '« valide » sans livrable ne déclare pas de livrable');
  assert.equal(trackingStep({ ...f, hasDeliverables: true, processing: true }), 3, 'mise à jour en cours : les documents restent disponibles');
  assert.equal(trackingStep({ ...f, hasDeliverables: true, closed: true }), 4);
  assert.equal(trackingStep({ ...f, forcedStep: 5 }), 2, 'ancienne étape forcée (1–5) bornée au traitement');
});

test('six livrables : 13 fichiers valides, noms reconnus, formats PDF/DOCX/XLSX/CSV/ICS', async () => {
  const files = await buildDeliverables({ title: 'Dossier test', revision: 2, generatedAt: at, analysis: demoAnalysis(), coverage: cov, pieces: DEMO_PIECES });
  assert.equal(files.length, 13);
  for (const d of DELIVERABLE_CATALOG) assert.ok(files.some((f) => f.key === d.key), `livrable ${d.key} présent`);
  for (const f of files) assert.equal(deliverableKeyOf(f.name), f.key, f.name);
  assert.equal(deliverableKeyOf('Contrat signé.pdf'), null, 'un livrable manuel n’est jamais confondu');
  // Alias historiques (affichage uniquement — la décision généré/manuel revient à generated_by) :
  assert.equal(deliverableKeyFromName('Resume-IA-r3.pdf'), 'resume', 'le nom strict reste reconnu');
  assert.equal(deliverableKeyFromName('Resume-IA.pdf'), 'resume', 'slug sans révision');
  assert.equal(deliverableKeyFromName('resume-ia (1).PDF'), 'resume', 'casse, copie numérotée');
  assert.equal(deliverableKeyFromName('Échéances-r2.ics'), 'echeances', 'accents ignorés');
  assert.equal(deliverableKeyFromName('Dates-modifiables_v2.docx'), 'dates', 'séparateur underscore');
  assert.equal(deliverableKeyFromName('Contrat signé.pdf'), null, 'pièce quelconque jamais rattachée');
  assert.equal(deliverableKeyFromName('Resumeria.pdf'), null, 'préfixe sans séparateur refusé');
  for (const f of files.filter((x) => x.name.endsWith('.pdf'))) {
    const pdf = await PDFDocument.load(f.bytes);
    assert.ok(pdf.getPageCount() >= 1, f.name);
  }
  for (const f of files.filter((x) => /\.(docx|xlsx)$/.test(x.name))) assert.ok(Object.keys(unzipSync(f.bytes)).length >= 4, f.name);
  const ics = strFromU8(files.find((f) => f.name.endsWith('.ics'))!.bytes);
  assert.match(ics, /DTSTART;VALUE=DATE:20261109/);
  const relances = docxToText(files.find((f) => f.name === 'Relances-r2.docx')!.bytes);
  assert.match(relances, /aucun envoi automatique/i);
});

test('échéances : correction humaine et ajout manuel reflétés dans les livrables', async () => {
  const rows: DeadlineRow[] = [
    { ai_key: '2026-11-09:fin-du-delai-laisse-par-la-deuxieme-relance', title: 'Fin du délai (corrigée)', due_date: '2026-11-12', due_time: null, priority: 'haute', done: false, user_edited: true, description: null },
    { ai_key: null, title: 'Rendez-vous expert', due_date: '2026-11-20', due_time: '14:30:00', priority: 'normale', done: false, user_edited: false, description: 'ajout manuel' },
  ];
  const files = await buildDeliverables({ title: 'T', revision: 1, generatedAt: at, analysis: demoAnalysis(), coverage: cov, pieces: DEMO_PIECES, deadlineRows: rows });
  const xlsx = xlsxToText(files.find((f) => f.name === 'Echeances-r1.xlsx')!.bytes);
  assert.match(xlsx, /12\/11\/2026;;Fin du délai \(corrigée\);Date calculée — corrigée par vous/);
  assert.match(xlsx, /20\/11\/2026;14:30;Rendez-vous expert;Ajoutée manuellement/);
  const ics = strFromU8(files.find((f) => f.name.endsWith('.ics'))!.bytes);
  assert.match(ics, /DTSTART;TZID=Europe\/Paris:20261120T143000/);
});

test('couverture partielle : mention explicite dans les livrables, jamais « complète »', async () => {
  const files = await buildDeliverables({ title: 'T', revision: 1, generatedAt: at, analysis: demoAnalysis(), coverage: { ...cov, total: 13, extracted: 11, unsupported: 1, failed: 1, complete: false }, pieces: DEMO_PIECES });
  const resume = docxToText(files.find((f) => f.name === 'Resume-IA-r1.docx')!.bytes);
  assert.match(resume, /Analyse PARTIELLE — 11\/13 pièces exploitées, 1 en échec, 1 non prise\(s\) en charge/);
  assert.doesNotMatch(resume, /Analyse complète/);
});

test('dossier de 190 pièces : chronologie et six livrables générés en moins de 10 s', async () => {
  const t0 = Date.now();
  const bulk = bulkPieces();
  const pieces = [...DEMO_PIECES, ...bulk.pieces];
  assert.equal(pieces.length, 190);
  const analysis = demoAnalysis(true);
  assert.ok(analysis.events.length >= 190, `${analysis.events.length} événements`);
  const files = await buildDeliverables({ title: 'Dossier volumineux', revision: 1, generatedAt: at, analysis, coverage: { ...cov, total: 190, extracted: 190 }, pieces });
  const chrono = await PDFDocument.load(files.find((f) => f.name === 'Chronologie-r1.pdf')!.bytes);
  assert.ok(chrono.getPageCount() > 3);
  assert.ok(Date.now() - t0 < 10_000, `${Date.now() - t0} ms`);
});

/* ── Charte PDF : logo, pagination, six compositions, texte sélectionnable ── */

const win1252 = new TextDecoder('windows-1252');
const squash = (s: string) => s.replace(/\s+/g, '');

/** Texte réellement dessiné, page par page (opérateurs Tj des flux de contenu). */
async function pdfInspect(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages().map((p) => {
    const c = p.node.Contents();
    const streams = c instanceof PDFArray ? c.asArray().map((r) => pdf.context.lookup(r)) : [c];
    const ops = streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString('latin1')).join('\n');
    return [...ops.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)].map((m) => win1252.decode(Buffer.from(m[1], 'hex'))).join(' ');
  });
  const images = pdf.context.enumerateIndirectObjects().map(([, o]) => o).filter((o): o is PDFRawStream => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
  return { pdf, pages, images, keywords: (pdf.getKeywords() ?? '').split(' ').filter(Boolean) };
}

const demoInput = () => ({ title: 'Dossier test', revision: 2, generatedAt: at, analysis: demoAnalysis(), coverage: cov, pieces: DEMO_PIECES });

test('charte PDF : logo officiel incorporé une seule fois, pagination « Page x/y », poids maîtrisé', async () => {
  assert.ok(LOGO_PNG_BASE64.length < 12_000, 'logo léger (edge function)');
  assert.deepEqual([...Buffer.from(LOGO_PNG_BASE64, 'base64').subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG valide');
  const files = (await buildDeliverables(demoInput())).filter((f) => f.name.endsWith('.pdf'));
  assert.equal(files.length, 5);
  for (const f of files) {
    const { pages, images } = await pdfInspect(f.bytes);
    const logo = images.filter((i) => String(i.dict.get(PDFName.of('Width'))) === String(LOGO_WIDTH) && String(i.dict.get(PDFName.of('Height'))) === String(LOGO_HEIGHT));
    assert.ok(logo.length >= 1, `${f.name} : logo présent`);
    assert.equal(images.length, 2, `${f.name} : une image (et son masque de transparence), réutilisée sur toutes les pages`);
    pages.forEach((t, i) => assert.ok(t.includes(`Page ${i + 1}/${pages.length}`), `${f.name} : pagination de la page ${i + 1}`));
    assert.ok(pages[0].includes('Dossier test') && /Révision 2/.test(pages[0]) && /Analyse complète/.test(pages[0]), `${f.name} : en-tête complet`);
    assert.ok(pages.every((t) => /ne constitue pas un conseil juridique/.test(t)), `${f.name} : pied de page`);
    assert.ok(f.bytes.byteLength < 60_000, `${f.name} : ${f.bytes.byteLength} octets`);
  }
});

test('six compositions distinctes dans une même charte (structure réellement dessinée)', async () => {
  const input = demoInput();
  const files = await buildDeliverables(input);
  const pdf = (n: string) => files.find((f) => f.name === n)!.bytes;
  const docs = {
    resume: await pdfInspect(pdf('Resume-IA-r2.pdf')),
    dashboard: await pdfInspect(pdf('Dashboard-r2.pdf')),
    chronologie: await pdfInspect(pdf('Chronologie-r2.pdf')),
    dates: await pdfInspect(await buildDatesPdf(input)),
    echeances: await pdfInspect(pdf('Echeances-r2.pdf')),
    relances: await pdfInspect(pdf('Relances-r2.pdf')),
  };
  const signature: Record<keyof typeof docs, string> = { resume: 'encadre-action', dashboard: 'tuiles', chronologie: 'frise', dates: 'tableau-corrections', echeances: 'groupes-statut', relances: 'cartes-message' };
  for (const [k, d] of Object.entries(docs) as [keyof typeof docs, (typeof docs)['resume']][]) {
    assert.ok(d.keywords.includes('entete-logo') && d.keywords.includes('pied-pagination'), `${k} : charte commune`);
    assert.ok(d.keywords.includes(signature[k]), `${k} : composition propre (${signature[k]})`);
    for (const [other, s] of Object.entries(signature)) if (other !== k) assert.ok(!d.keywords.includes(s), `${k} n'emprunte pas la composition de ${other}`);
  }
  assert.equal(new Set(Object.values(docs).map((d) => d.keywords.join(' '))).size, 6, 'six signatures différentes');
  assert.equal(files.length, 13, 'la composition « Dates » imprimable reste hors catalogue');
});

test('PDF : l’essentiel en première page, aucune information du modèle perdue, texte sélectionnable', async () => {
  const a = demoAnalysis();
  const overrides = [{ event_key: a.events[0].key, retained_date: '2026-01-15', label: null, hidden: false, reason: 'tampon dateur', author: 'Titulaire', created_at: '2026-10-20T09:00:00Z' }];
  const files = await buildDeliverables({ ...demoInput(), overrides });
  const text = async (n: string) => (await pdfInspect(files.find((f) => f.name === n)!.bytes)).pages.map(squash);
  const has = (hay: string, needle: string, why: string) => assert.ok(hay.includes(squash(needle)), `${why} : « ${needle} »`);

  const resume = await text('Resume-IA-r2.pdf');
  for (const t of ['LA SITUATION EN BREF', a.summary_short, 'VIGILANCE', a.attention_points[0], 'PROCHAINE ACTION', a.next_actions[0], a.facts[0].text]) has(resume[0], t, 'Résumé, page 1');
  const all = resume.join('');
  for (const t of [a.summary_long, ...a.facts.map((f) => f.text), ...a.attention_points, ...a.next_actions, ...a.contradictions.map((c) => c.text), ...a.missing_items.flatMap((m) => [m.text, m.why]), ...a.parties.flatMap((p) => [p.name, p.role]), ...DEMO_PIECES.map((p) => p.file_name)]) has(all, t, 'Résumé');
  has(all, 'Source : Devis D-2026-041 signé.pdf p.2', 'Résumé, source accessible');

  const dash = (await text('Dashboard-r2.pdf')).join('');
  for (const t of ['11/11', 'PIÈCES EXPLOITÉES', 'PROCHAINE ÉCHÉANCE', '09/11/2026', a.summary_short, ...a.missing_items.map((m) => m.text)]) has(dash, t, 'Dashboard');

  const chrono = (await text('Chronologie-r2.pdf')).join('');
  for (const e of a.events) has(chrono, e.label, 'Chronologie');
  has(chrono, 'date corrigée (extraite : 01/2026 ; motif : tampon dateur)', 'Chronologie, correction visible');

  const ech = (await text('Echeances-r2.pdf')).join('');
  for (const d of a.deadlines) for (const t of [d.title, d.basis]) has(ech, t, 'Échéances');
  for (const t of ['Dates mentionnées dans les pièces (2)', 'Dates calculées (1)', 'Hypothèses à confirmer par un professionnel (1)']) has(ech, t, 'Échéances, groupes');

  const rel = (await text('Relances-r2.pdf')).join('');
  has(rel, 'AUCUN ENVOI AUTOMATIQUE', 'Relances');
  for (const r of a.reminder_drafts) for (const t of [r.subject, r.recipient_hint, ...r.body.split('\n').filter(Boolean)]) has(rel, t, 'Relances');

  const dates = (await pdfInspect(await buildDatesPdf({ ...demoInput(), overrides }))).pages.map(squash).join('');
  for (const t of ['15/01/2026', 'corrigée', 'tampon dateur', 'Titulaire', 'HISTORIQUE DES CORRECTIONS (1)']) has(dates, t, 'Dates modifiables');
});

test('dossier de 190 pièces : pagination continue, logo unique, gabarit robuste aux textes extrêmes', async () => {
  const pieces = [...DEMO_PIECES, ...bulkPieces().pieces];
  const analysis = demoAnalysis(true);
  // Textes extrêmes : mot insécable très long, caractères hors WinAnsi, message de plusieurs pages.
  analysis.attention_points.push(`Référence ${'X'.repeat(400)} → à vérifier ✓`);
  analysis.reminder_drafts.push({ audience: 'third_party', subject: 'Long message', body: Array.from({ length: 160 }, (_, i) => `Paragraphe ${i + 1} du projet de courrier.`).join('\n'), suggested_date: null, recipient_hint: 'À définir' });
  const t0 = Date.now();
  const files = await buildDeliverables({ title: 'Dossier volumineux', revision: 1, generatedAt: at, analysis, coverage: { ...cov, total: 190, extracted: 190 }, pieces });
  assert.ok(Date.now() - t0 < 10_000, `${Date.now() - t0} ms`);
  for (const f of files.filter((x) => x.name.endsWith('.pdf'))) {
    const { pages, images } = await pdfInspect(f.bytes);
    assert.equal(images.length, 2, `${f.name} : logo incorporé une seule fois`);
    pages.forEach((t, i) => assert.ok(t.includes(`Page ${i + 1}/${pages.length}`), `${f.name} p.${i + 1}`));
  }
  const rel = (await pdfInspect(files.find((f) => f.name === 'Relances-r1.pdf')!.bytes)).pages;
  assert.ok(rel.length >= 4, 'message long réparti sur plusieurs pages');
  assert.ok(rel.join(' ').includes('Paragraphe 160 du projet de courrier.'), 'aucune ligne perdue');
  const resume = (await pdfInspect(files.find((f) => f.name === 'Resume-IA-r1.pdf')!.bytes)).pages.map(squash).join('');
  assert.ok(resume.includes('X'.repeat(60)), 'mot insécable découpé, pas tronqué');
  assert.ok(resume.includes(squash('Bon de livraison BL-0179.pdf')), 'toutes les pièces listées');
});
