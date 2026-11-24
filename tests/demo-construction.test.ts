// Démo « assurance construction » (dossier FICTIF, traitement SIMULÉ) :
// cohérence des données sources, absence de conclusion, projet de rapport corrigé,
// PDF réellement généré (lu par tests/helpers/pdf-text.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  DOSSIER,
  STATUS_LABEL,
  allSourcedItems,
  pageText,
  type SourceRef,
} from '../src/demo/construction/dossier.ts';
import { FLAGGED_PARAGRAPH_ID, buildReport, isReadyToValidate, reportFileName } from '../src/demo/construction/report.ts';
import { renderReportPdf } from '../src/demo/construction/report-pdf.ts';
import { extractPdfText } from './helpers/pdf-text.ts';

const FORBIDDEN_CONCLUSION = /imputable|est due à|responsabilité de .* (est|sont) engagée|garantie .* (acquise|mobilisable|refusée)/i;
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

function everySource(): SourceRef[] {
  const report = buildReport(DOSSIER, {});
  const corrected = buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: report.flagged!.suggestion });
  return [
    ...allSourcedItems(DOSSIER).flatMap((i) => i.sources),
    ...DOSSIER.findings.flatMap((f) => f.versions?.flatMap((v) => v.sources) ?? []),
    ...[report, corrected].flatMap((r) => r.sections.flatMap((s) => s.paragraphs.flatMap((p) => p.sources))),
  ];
}

test('libellés des trois statuts, exactement', () => {
  assert.deepEqual(Object.values(STATUS_LABEL), ['Fait établi', 'Déclaration', 'Point à vérifier']);
});

test('cinq pièces des cinq types demandés, pages numérotées, données manifestement fictives', () => {
  assert.equal(DOSSIER.pieces.length, 5);
  assert.deepEqual(
    DOSSIER.pieces.map((p) => [p.numero, p.typeLabel]),
    [[1, 'PV de réception'], [2, 'Déclaration de sinistre'], [3, 'Compte rendu de visite'], [4, 'Devis'], [5, 'Courriel']],
  );
  assert.deepEqual(DOSSIER.pieces.map((p) => p.pages.length), [2, 1, 3, 1, 1]);
  assert.equal(DOSSIER.reference, 'DEMO-IC-2025-014');
  for (const p of DOSSIER.pieces) assert.match(p.pages[0], /FICTI/, `${p.title} : mention « fictif » en page 1`);
  for (const party of DOSSIER.parties) assert.match(party.name, /\(fictif|\(fictive/, party.name);
});

test('chaque source cite un passage présent mot pour mot à la page indiquée', () => {
  const sources = everySource();
  assert.ok(sources.length > 15);
  for (const s of sources) {
    const text = pageText(DOSSIER, s.pieceId, s.page);
    assert.ok(text, `${s.pieceId} p.${s.page} existe`);
    assert.ok(s.passage.length >= 8, `passage assez long : « ${s.passage} »`);
    assert.ok(!s.passage.includes('\n'), `passage sur un seul paragraphe : « ${s.passage} »`);
    assert.ok(text!.includes(s.passage), `« ${s.passage} » absent de ${s.pieceId} p.${s.page}`);
  }
});

test('tout constat et tout événement porte un statut parmi les trois et au moins une source', () => {
  const items = allSourcedItems(DOSSIER);
  assert.ok(DOSSIER.chronology.length >= 6 && DOSSIER.findings.length >= 4);
  assert.equal(items.length, DOSSIER.chronology.length + DOSSIER.findings.length);
  for (const i of items) {
    assert.ok(i.status in STATUS_LABEL, `${i.id} : statut`);
    assert.ok(i.sources.length >= 1, `${i.id} : source`);
  }
  // Une déclaration de partie n'est jamais présentée comme un fait établi.
  const apparition = DOSSIER.chronology.filter((e) => e.contradictionId);
  assert.ok(apparition.length === 2 && apparition.every((e) => e.status !== 'etabli'));
});

test('exactement une contradiction : deux dates distinctes pour le même événement, chacune sourcée', () => {
  const contradictions = DOSSIER.findings.filter((f) => f.kind === 'contradiction');
  assert.equal(contradictions.length, 1);
  const [c] = contradictions;
  assert.equal(c.status, 'a_verifier');
  assert.equal(c.versions!.length, 2);
  const dates = c.versions!.map((v) => v.date);
  assert.deepEqual(dates, ['2024-11-18', '2025-01-06']);
  assert.deepEqual(c.versions!.map((v) => v.sources[0].pieceId), ['piece-5', 'piece-2']);
  // Les deux événements de chronologie concernés pointent vers cette contradiction.
  const linked = DOSSIER.chronology.filter((e) => e.contradictionId === c.id);
  assert.deepEqual(linked.map((e) => e.date).sort(), dates);
  assert.ok(linked.every((e) => e.event === c.event), 'même événement');
});

test('exactement une pièce annoncée, absente de la liste des pièces', () => {
  const missing = DOSSIER.findings.filter((f) => f.kind === 'piece-manquante');
  assert.equal(missing.length, 1);
  const [m] = missing;
  assert.equal(m.status, 'a_verifier');
  assert.equal(m.announced!.date, '2025-02-12');
  assert.match(m.announced!.title, /recherche de fuite/);
  assert.deepEqual([m.sources[0].pieceId, m.sources[0].page], ['piece-3', 3]);
  assert.ok(!DOSSIER.pieces.some((p) => /recherche de fuite/i.test(p.title) || p.date === m.announced!.date));
});

test('relecture juridique : statuts, qualification et pièces sans marque de brouillon', () => {
  const corrected = buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: buildReport(DOSSIER, {}).flagged!.suggestion });
  // Aucune phrase « Fait établi » ne qualifie les infiltrations autrement que comme déclarées.
  const etablis = [
    ...allSourcedItems(DOSSIER).filter((i) => i.status === 'etabli').map((i) => ('label' in i ? i.label : (i as { text: string }).text)),
    ...corrected.sections.flatMap((s) => s.paragraphs).filter((p) => p.status === 'etabli').map((p) => p.text),
  ];
  assert.ok(etablis.length > 10);
  for (const t of etablis) if (/infiltrations/i.test(t)) assert.match(t, /infiltrations déclarées/i, t);
  // La déclaration de sinistre : date du document établie, envoi et réception non établis.
  const decl = DOSSIER.chronology.find((e) => e.id === 'evt-declaration')!;
  assert.equal(decl.status, 'etabli');
  assert.match(flat(decl.label), /^Déclaration de sinistre datée du 20 février 2025, .*date d’envoi et de réception non établies par les pièces/);
  assert.doesNotMatch(JSON.stringify(corrected), /adressée à l’assureur/);
  // La contradiction est explicite sur la date déduite.
  const c = DOSSIER.findings.find((f) => f.kind === 'contradiction')!;
  assert.match(c.text, /depuis hier/);
  assert.match(flat(c.text), /date déduite de « depuis hier »/);
  // La pièce 2 rapporte une date d'apparition (même événement que le courriel).
  assert.match(flat(pageText(DOSSIER, 'piece-2', 1)!), /les infiltrations sont apparues pour la première fois le 6 janvier 2025\./);
  // Aucune marque « À CONFIRMER » dans le texte des pièces.
  for (const p of DOSSIER.pieces) for (const page of p.pages) assert.doesNotMatch(page, /À CONFIRMER/i, p.id);
});

test('typographie française dans les données : espaces insécables, apostrophe typographique', () => {
  const all = JSON.stringify(DOSSIER) + JSON.stringify(buildReport(DOSSIER, {}));
  assert.doesNotMatch(all, / [;:!?»]|« /, 'espace ordinaire avant ; : ! ? » ou après «');
  assert.doesNotMatch(all, /\d (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|%|cm|m|€)(?![\p{L}\d])/u, 'espace ordinaire entre nombre et unité ou mois');
  assert.doesNotMatch(all, /[nN]° /);
  assert.doesNotMatch(all.replace(/\\"/g, ''), /'/, 'apostrophe droite');
  assert.match(pageText(DOSSIER, 'piece-4', 1)!, /2\u00a0840,00\u00a0€/);
  assert.match(pageText(DOSSIER, 'piece-3', 2)!, /28\u00a0%/);
  assert.match(pageText(DOSSIER, 'piece-2', 1)!, /6\u00a0janvier 2025/);
  assert.match(pageText(DOSSIER, 'piece-1', 1)!, /lot n°\u00a07 «\u202fMenuiseries extérieures\u202f»/);
  assert.match(pageText(DOSSIER, 'piece-5', 1)!, /Date\u202f: 19\u00a0novembre 2024, 08\u00a0h\u00a042/);
});

test('aucune conclusion sur la cause, la responsabilité ou la garantie ; ni délai légal ni règle de droit', () => {
  const report = buildReport(DOSSIER, {});
  const corrected = buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: report.flagged!.suggestion });
  const all = [
    JSON.stringify(DOSSIER),
    ...[report, corrected].map((r) => JSON.stringify(r)),
  ].join('\n');
  assert.doesNotMatch(all, FORBIDDEN_CONCLUSION);
  assert.doesNotMatch(all, /article [LR]?\.? ?\d|code civil|code des assurances|garantie décennale|délai (légal|de prescription)|prescri/i);
  const reserved = report.sections.find((s) => s.id === 'appreciation')!;
  assert.match(flat(reserved.paragraphs.map((p) => p.text).join(' ')), /relève de l’appréciation de l’expert/);
  assert.match(flat(reserved.paragraphs.map((p) => p.text).join(' ')), /aucune conclusion n’est générée/i);
  assert.match(report.label, /projet préparé pour la démonstration — traitement simulé/i);
});

test('projet de rapport : un seul paragraphe signalé, qui affirme à tort une date unique', () => {
  const report = buildReport(DOSSIER, {});
  const flagged = report.sections.flatMap((s) => s.paragraphs).filter((p) => p.flag);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].id, FLAGGED_PARAGRAPH_ID);
  assert.match(flat(flagged[0].text), /6 janvier 2025/);
  assert.doesNotMatch(flat(flagged[0].text), /18 novembre 2024/);
  assert.equal(flagged[0].corrected, false);
  assert.equal(isReadyToValidate(report), false);
  // La correction proposée cite les deux dates, leurs sources et « à confirmer ».
  const sugg = flat(report.flagged!.suggestion);
  assert.match(sugg, /18 novembre 2024, date déduite de « depuis hier »/);
  assert.match(sugg, /6 janvier 2025/);
  assert.match(sugg, /pièce 5, p\. 1/);
  assert.match(sugg, /pièce 2, p\. 1/);
  assert.match(sugg, /à confirmer/);
  // Les deux pièces sont citées mot pour mot.
  const [early, late] = DOSSIER.findings.find((f) => f.kind === 'contradiction')!.versions!;
  for (const v of [early, late]) assert.ok(report.flagged!.suggestion.includes(`«\u202f${v.sources[0].passage}\u202f»`), v.sources[0].passage);
  for (const p of report.sections.flatMap((s) => s.paragraphs)) assert.ok(p.status === null || p.status in STATUS_LABEL);
});

test('buildReport avec correction : texte corrigé présent, ancien texte absent, indicateur posé', () => {
  const before = buildReport(DOSSIER, {});
  const original = before.flagged!.original;
  const sugg = before.flagged!.suggestion;
  const after = buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: sugg });
  const p = after.sections.flatMap((s) => s.paragraphs).find((x) => x.id === FLAGGED_PARAGRAPH_ID)!;
  assert.equal(p.text, sugg);
  assert.equal(p.corrected, true);
  assert.equal(p.status, 'a_verifier');
  assert.deepEqual(p.sources.map((s) => s.pieceId).sort(), ['piece-2', 'piece-5']);
  const json = JSON.stringify(after.sections);
  assert.ok(json.includes(sugg));
  assert.ok(!json.includes(original), 'ancien texte absent');
  assert.equal(isReadyToValidate(after), true);
  // Édition libre : prise en compte telle quelle ; texte vide ou inchangé = non corrigé.
  const free = buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: 'Date de première apparition à confirmer : deux pièces divergent.' });
  assert.equal(isReadyToValidate(free), true);
  assert.equal(isReadyToValidate(buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: `  ${original} ` })), false);
  assert.equal(isReadyToValidate(buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: '   ' })), false);
  // Immuabilité : la source unique n'est pas modifiée par le modèle de rapport.
  assert.ok(!JSON.stringify(DOSSIER).includes(sugg));
});

test('PDF réel : texte corrigé exact, mention de validation, sources, statuts, « DOSSIER FICTIF » sur chaque page', async () => {
  const sugg = buildReport(DOSSIER, {}).flagged!.suggestion;
  const report = buildReport(DOSSIER, { [FLAGGED_PARAGRAPH_ID]: sugg });
  const at = new Date('2026-11-24T13:32:00Z');
  const bytes = await renderReportPdf(report, { at });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 1);
  assert.equal(doc.getTitle(), `Projet de rapport ${DOSSIER.reference} — dossier fictif`);
  const raw = extractPdfText(bytes);
  const text = flat(raw);
  assert.ok(text.includes(flat(sugg)), 'texte corrigé exact');
  assert.ok(!text.includes(flat(report.flagged!.original)), 'ancien texte absent du PDF');
  assert.match(text, /Validé par l’expert \(démonstration\) — 24\/11\/2026 à 14:32/);
  assert.match(text, /Corrigé par l’expert/);
  for (const label of Object.values(STATUS_LABEL)) assert.ok(text.includes(label), `statut ${label}`);
  assert.match(text, /Pièce 5 — Courriel, p\. 1/);
  assert.match(text, /Pièce 3 — Compte rendu de visite, p\. 3/);
  assert.match(text, /relève de l’appréciation de l’expert/);
  const banners = raw.split('\n').filter((l) => l === 'DOSSIER FICTIF — DÉMONSTRATION ClairDossier').length;
  assert.equal(banners, doc.getPageCount() * 2, 'en-tête et pied de chaque page');
  assert.doesNotMatch(text, FORBIDDEN_CONCLUSION);
  assert.equal(reportFileName(report), 'Rapport-DEMO-IC-2025-014-valide.pdf');
});

test('extracteur PDF : décode les chaînes hexadécimales WinAnsi (accents, guillemets, €)', async () => {
  const pdf = await PDFDocument.create();
  const { StandardFonts } = await import('pdf-lib');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('Été « 2 840,00 € » — l’œuvre', { x: 50, y: 700, font, size: 12 });
  assert.equal(extractPdfText(await pdf.save()), 'Été « 2 840,00 € » — l’œuvre');
});
