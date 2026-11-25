// Revue de la PR #68, lot « règles » : non-régression des règles déterministes
// d'analyse (supabase/functions/_shared/engine/rules.ts et text-rules.ts).
// Constats C01, C09, C10, C21, C22 — pièces fictives écrites ici, sans réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparePiece, type PreparedPiece } from '../supabase/functions/_shared/engine/reading.ts';
import { consolidateByRules, extractByRules } from '../supabase/functions/_shared/engine/rules.ts';
import { findAmounts } from '../supabase/functions/_shared/engine/text-rules.ts';
import { buildChronology } from '../supabase/functions/_shared/analysis-model.ts';
import { buildView } from '../supabase/functions/_shared/rendus/view.ts';
import type { ExtractionOutput } from '../supabase/functions/_shared/engine/schemas.ts';

const TODAY = '2026-11-18';

/** PDF texte fictif (une chaîne par page), lu comme le ferait le moteur. */
const pdf = (...pages: string[]): PreparedPiece => ({ kind: 'pdf' as PreparedPiece['kind'], mime: 'application/pdf', pages: pages.length, pageTexts: pages, text: null, needsVision: false, bytes: new Uint8Array() });

async function eml(raw: string, name = 'Courriel.eml'): Promise<PreparedPiece> {
  const r = await preparePiece(new TextEncoder().encode(raw), name, null);
  assert.ok(r.ok, 'courriel lisible');
  return r.piece;
}

/** En-tête de courrier fictif du gestionnaire, suivi du corps donné. */
const courrier = (...corps: string[]) => `Cabinet Verdier Gestion
Gestion locative — 12 rue des Lauriers, 13006 Marseille

Marseille, le 12 octobre 2026

Atelier Lumen SARL
À l'attention de Mme Camille Roche, gérante

Objet : régularisation des charges locatives 2025

Madame,

${corps.join('\n\n')}`;

function consolider(pieces: { id: string; data: ExtractionOutput }[]) {
  const input = pieces.map((p) => ({ document_id: p.id, file_name: `${p.id}.pdf`, data: p.data }));
  const events = buildChronology(input.map((p) => ({ document_id: p.document_id, data: p.data as never })));
  return consolidateByRules({ today: TODAY, title: 'Dossier fictif', typology: null, objective: null, pieces: input, events: events as never, total: input.length, unreadable: [], others: [] });
}

const datesOf = (x: ExtractionOutput, kind?: string) => x.dates.filter((d) => !kind || d.kind === kind).map((d) => d.date).sort();

/* ── C01 : « du … au » hors plage de dates ───────────────────────────────── */

test('C01 — « règlement du solde au plus tard le … » : l’échéance écrite est retenue et proposée', () => {
  const x = extractByRules(pdf(courrier('Nous vous remercions de procéder au règlement du solde au plus tard le 15 janvier 2027.')), 'courrier.pdf');
  assert.deepEqual(datesOf(x, 'deadline'), ['2027-01-15']);
  const a = consolider([{ id: 'courrier', data: x }]);
  assert.equal(a.primary_action.label, 'Préparer votre réponse');
  assert.equal(a.primary_action.due_date, '2027-01-15');
  assert.match(a.situation, /réponse attendue avant le 15 janvier 2027/i);
});

test('C01 — « règlement du loyer au titre du 1er trimestre … exigible le … » : échéance retenue', () => {
  const x = extractByRules(pdf(courrier('Le règlement du loyer au titre du 1er trimestre 2027 est exigible le 1er janvier 2027.')), 'courrier.pdf');
  assert.deepEqual(datesOf(x, 'deadline'), ['2027-01-01']);
});

test('C01 — seules les bornes d’une plage sont écartées, pas les autres dates de la phrase', () => {
  const x = extractByRules(pdf(courrier('Merci de payer le loyer du 1er janvier 2027 au 31 mars 2027 avant le 15 janvier 2027.')), 'courrier.pdf');
  assert.deepEqual(datesOf(x, 'deadline'), ['2027-01-15'], 'échéance gardée');
  assert.ok(!x.dates.some((d) => d.date === '2027-01-01' || d.date === '2027-03-31'), 'bornes de la plage écartées');
  const y = extractByRules(pdf(courrier('Loyer du 1er octobre au 31 décembre 2026, exigible le 1er octobre 2026.')), 'courrier.pdf');
  assert.deepEqual(datesOf(y, 'deadline'), ['2026-10-01']);
  assert.ok(!y.dates.some((d) => d.date === '2026-12-31'), 'borne « au 31 décembre 2026 » écartée');
});

test('C01 (témoin) — une période reste ignorée : aucune date tirée de ses bornes', () => {
  for (const s of [
    'Période : 4e trimestre 2026 (du 1er octobre 2026 au 31 décembre 2026)',
    'Période du 1er au 31 décembre 2026.',
    'Période : 01/10/2026 – 31/12/2026',
  ]) {
    const x = extractByRules(pdf(courrier(s)), 'courrier.pdf');
    assert.deepEqual(datesOf(x), ['2026-10-12'], s);
  }
});

/* ── C09 : montant précédé d'une année ou d'un nombre ────────────────────── */

test('C09 — un montant qui suit une année n’absorbe pas ses chiffres', () => {
  const v = (s: string) => findAmounts(s).map((a) => a.value);
  assert.deepEqual(v('Montant réclamé au titre des charges 2025 480,00 €'), [480]);
  assert.deepEqual(v('Solde au 31/12/2025 980,00 €'), [980]);
  assert.deepEqual(v('Provision pour charges 2025 250,00 €'), [250]);
  assert.deepEqual(v('Total : 3480.00 €'), [3480], 'décimales séparées par un point');
  // Témoins : groupements de milliers inchangés.
  assert.deepEqual(v('Total 3 480,00 €'), [3480]);
  assert.deepEqual(v('Charges 2025 2 480,00 €'), [2480]);
  assert.deepEqual(v('soit 12 500 euros'), [12500]);
  assert.deepEqual(v('1.250,50 EUR'), [1250.5]);
  assert.deepEqual(v('3 480,00 €'), [3480]);
});

test('C09 — situation : « 480,00 € » et non « 25 480,00 € » quand la ligne suit une année', () => {
  const page = 'Cabinet Verdier Gestion\nRelevé de charges\nMontant réclamé au titre des charges 2025\n480,00 €\nMerci de régler.';
  const x = extractByRules(pdf(page), 'releve.pdf');
  assert.deepEqual(x.amounts.map((a) => [a.amount, a.kind]), [[480, 'claimed']]);
  const a = consolider([{ id: 'releve', data: x }]);
  assert.match(a.situation, /réclame 480,00 € au titre des charges/);
  assert.doesNotMatch(a.situation, /25\s480/);
});

/* ── C10 : somme en faveur du client ─────────────────────────────────────── */

test('C10 — « solde en faveur du locataire » : pas une somme réclamée au client', () => {
  const x = extractByRules(
    pdf(courrier("Après arrêté des comptes de l'exercice 2025, la régularisation des charges locatives fait apparaître un solde en faveur du locataire de 270,00 €, qui sera déduit de votre prochain avis d'échéance.")),
    'courrier.pdf',
  );
  assert.deepEqual(x.amounts.map((a) => [a.amount, a.kind]), [[270, 'other']]);
  const a = consolider([{ id: 'courrier', data: x }]);
  assert.doesNotMatch(a.situation, /réclame/);
  assert.ok(!a.key_facts.some((f) => /Somme réclamée/.test(f.text)));
  assert.ok(!a.amounts.some((m) => m.kind === 'claimed' || m.kind === 'due'));
});

test('C10 — trop-perçu et solde en votre faveur : classés hors réclamation', () => {
  const kinds = (s: string) => extractByRules(pdf(courrier(s)), 'c.pdf').amounts.map((a) => [a.amount, a.kind]);
  assert.deepEqual(kinds('Régularisation des charges 2025 : trop-perçu de 270,00 € remboursé.'), [[270, 'other']]);
  assert.deepEqual(kinds('La régularisation fait apparaître un solde en votre faveur de 270,00 €.'), [[270, 'other']]);
  assert.deepEqual(kinds('Le solde en faveur du locataire, soit 270,00 €, vous sera remboursé.'), [[270, 'other']]);
});

test('C10 — les vraies réclamations restent « claimed », même à côté d’un crédit', () => {
  const kinds = (s: string) => extractByRules(pdf(courrier(s)), 'c.pdf').amounts.map((a) => [a.amount, a.kind]);
  assert.deepEqual(kinds('La régularisation des charges locatives fait apparaître un solde en faveur du bailleur de 3 480,00 €.'), [[3480, 'claimed']]);
  assert.deepEqual(kinds("Après déduction d'un trop-perçu de 270,00 €, le solde en faveur du bailleur s'élève à 3 480,00 €."), [[270, 'other'], [3480, 'claimed']]);
  assert.deepEqual(kinds('Nous vous demandons le remboursement de la somme de 500,00 €.'), [[500, 'claimed']]);
  assert.deepEqual(kinds('Après déduction du trop-perçu, le solde restant dû est de 500,00 €.'), [[500, 'due']]);
});

/* ── C21 : date fixée par le titulaire au tiers ──────────────────────────── */

const COURRIEL_TITULAIRE = (phrase: string) => `From: Camille Roche <camille.roche@atelier-lumen.example>
To: Cabinet Verdier Gestion <gestion@verdier-gestion.example>
Date: Tue, 20 Oct 2026 09:42:00 +0200
Subject: Charges 2025
Content-Type: text/plain; charset=UTF-8

Madame Verdier,

${phrase}

Cordialement,
Camille Roche
`;

test('C21 — la date que le titulaire impose au gestionnaire n’est pas « sa » réponse attendue', async () => {
  const c = extractByRules(pdf(courrier('Nous vous remercions de bien vouloir nous faire parvenir votre règlement ou vos observations. Une réponse de votre part est attendue avant le 15 janvier 2027.')), 'courrier.pdf');
  const m = extractByRules(await eml(COURRIEL_TITULAIRE("Je conteste l'écart et vous demande les justificatifs de la taxe foncière avant le 30 novembre 2026.")), 'courriel.eml');
  const a = consolider([{ id: 'courrier', data: c }, { id: 'courriel', data: m }]);
  assert.match(a.situation, /réponse attendue avant le 15 janvier 2027/i);
  assert.doesNotMatch(a.situation, /30 novembre 2026/);
  assert.equal(a.primary_action.label, 'Préparer votre réponse');
  assert.equal(a.primary_action.owner, 'client');
  assert.equal(a.primary_action.due_date, '2027-01-15');
  const asked = a.deadlines.find((d) => d.date === '2026-11-30');
  assert.equal(asked?.owner, 'tiers', 'la date reste listée, à la charge du gestionnaire');
});

test('C21 (témoin) — une demande du cabinet au titulaire reste son échéance', async () => {
  const raw = `From: Cabinet Verdier Gestion <gestion@verdier-gestion.example>
To: Camille Roche <camille.roche@atelier-lumen.example>
Date: Tue, 20 Oct 2026 09:42:00 +0200
Subject: Charges 2025
Content-Type: text/plain; charset=UTF-8

Madame,

Je vous demande de régler le solde avant le 30 novembre 2026.

Cordialement,
Hélène Verdier
`;
  const a = consolider([{ id: 'courriel', data: extractByRules(await eml(raw), 'courriel.eml') }]);
  assert.equal(a.primary_action.due_date, '2026-11-30');
  assert.equal(a.deadlines.find((d) => d.date === '2026-11-30')?.owner, 'client');
});

/* ── C22 : incise « X, le <date>, … » ────────────────────────────────────── */

const BAIL = (rappel: string, fin = 'Fait à Marseille, le 5 mars 2021.') => `BAIL COMMERCIAL n° BC-2021-0147

Entre les soussignés : SCI des Tilleuls, bailleur, et Atelier Lumen SARL, preneur.

${rappel}

Le Preneur verse un loyer mensuel de 1 200,00 €.

${fin}`;

const COURRIER_CITE = courrier(
  'Conformément au bail commercial n° BC-2021-0147, signé le 5 mars 2021, nous vous réclamons la somme de 3 480,00 € au titre de la régularisation des charges 2025.',
  'Pour mémoire, le 2 octobre 2026, vous avez réglé la provision trimestrielle.',
  'Une réponse de votre part est attendue avant le 15 janvier 2027.',
);

test('C22 — une incise datée n’est pas la date du document : pas de fausse contradiction', () => {
  const bail = extractByRules(pdf(BAIL('Il est rappelé que, le 15 février 2021, le Bailleur a acquis le local situé 12 rue Paradis.')), 'bail.pdf');
  assert.deepEqual(datesOf(bail, 'document_date'), ['2021-03-05'], 'date de signature seule');
  assert.equal(bail.dates.find((d) => d.date === '2021-02-15')?.kind, 'event_date');
  const c = extractByRules(pdf(COURRIER_CITE), 'courrier.pdf');
  assert.equal(c.dates.find((d) => d.date === '2026-10-02')?.kind, 'event_date', '« Pour mémoire, le … » est un événement');
  assert.deepEqual(datesOf(c, 'document_date'), ['2026-10-12'], 'en-tête « Marseille, le … » conservé');
  const a = consolider([{ id: 'courrier', data: c }, { id: 'bail', data: bail }]);
  assert.ok(!a.contradictions.some((x) => x.kind === 'date'), 'les deux pièces concordent sur le 5 mars 2021');
  assert.equal(a.primary_action.label, 'Préparer votre réponse');
});

test('C22 — la date citée est comparée à toutes les dates propres de la pièce citée', () => {
  const bail = extractByRules(pdf(BAIL('Établi le 1er mars 2021.', 'Fait à Marseille, le 5 mars 2021.')), 'bail.pdf');
  assert.deepEqual(datesOf(bail, 'document_date'), ['2021-03-01', '2021-03-05']);
  const a = consolider([{ id: 'courrier', data: extractByRules(pdf(COURRIER_CITE), 'courrier.pdf') }, { id: 'bail', data: bail }]);
  assert.ok(!a.contradictions.some((x) => x.kind === 'date'));
});

test('C22 (témoin) — un vrai écart de date reste signalé', () => {
  const bail = extractByRules(pdf(BAIL('Le Bailleur a acquis le local le 15 février 2021.', 'Fait à Marseille, le 3 mars 2021.')), 'bail.pdf');
  const a = consolider([{ id: 'courrier', data: extractByRules(pdf(COURRIER_CITE), 'courrier.pdf') }, { id: 'bail', data: bail }]);
  assert.ok(a.contradictions.some((x) => x.kind === 'date' && /5 mars 2021.*3 mars 2021/.test(x.text)));
  assert.equal(a.primary_action.label, 'Vérifier la date');
});

/* ── Contre-revue (2e passage) ───────────────────────────────────────────── */

// Régression de C01 : un tiret ne relie deux dates en plage que pour une paire isolée,
// dans une phrase qui annonce une période. Une liste d'échéances garde toutes ses dates.
test('C01 (contre-revue) — une liste d’échéances séparées par des tirets garde ses dates', () => {
  const x = extractByRules(pdf(courrier('Échéancier – sommes à payer : 05/01/2027 - 05/02/2027 - 05/03/2027.')), 'courrier.pdf');
  assert.deepEqual(datesOf(x, 'deadline'), ['2027-01-05', '2027-02-05', '2027-03-05']);
  const a = consolider([{ id: 'courrier', data: x }]);
  assert.equal(a.primary_action.label, 'Préparer votre réponse');
  assert.equal(a.primary_action.due_date, '2027-01-05');
  const y = extractByRules(pdf(courrier('Dates à payer : 05/01/2027 - 05/04/2027.')), 'courrier.pdf');
  assert.deepEqual(datesOf(y, 'deadline'), ['2027-01-05', '2027-04-05']);
  const z = extractByRules(pdf(courrier('Échéances de paiement : 01/01/2027 – 01/04/2027 – 01/07/2027.')), 'courrier.pdf');
  assert.deepEqual(datesOf(z).filter((d) => d !== '2026-10-12'), ['2027-01-01', '2027-04-01', '2027-07-01']);
  // Témoins : une période annoncée reste une plage.
  for (const s of ['Période : 01/10/2026 – 31/12/2026', 'Exercice 2025 : 01/01/2025 - 31/12/2025.']) {
    assert.deepEqual(datesOf(extractByRules(pdf(courrier(s)), 'courrier.pdf')), ['2026-10-12'], s);
  }
});

test('C10 (contre-revue) — crédit du client cité après le montant ou suivi d’un mot de contexte', () => {
  for (const s of [
    'La régularisation des charges 2025 fait apparaître un solde de 270,00 € en votre faveur.',
    'La régularisation des charges 2025 fait apparaître un solde de 270,00 € en faveur du locataire.',
    'Régularisation des charges 2025 : 270,00 € en votre faveur.',
    'Solde en votre faveur après régularisation : 270,00 €.',
    'Solde créditeur après régularisation : 270,00 €.',
    'Trop-perçu au titre de la régularisation des charges 2025 : 270,00 €.',
    'La régularisation fait apparaître un trop-perçu de provisions de 270,00 €.',
    'La régularisation des charges 2025 fait apparaître un solde en faveur de votre société de 270,00 €.',
  ]) {
    const x = extractByRules(pdf(courrier(s)), 'courrier.pdf');
    assert.deepEqual(x.amounts.map((m) => [m.amount, m.kind]), [[270, 'other']], s);
    const a = consolider([{ id: 'courrier', data: x }]);
    assert.doesNotMatch(a.situation, /réclame/, s);
    assert.ok(!a.key_facts.some((f) => /Somme réclamée/.test(f.text)), s);
  }
});

test('C10 (contre-revue, témoin) — un crédit cité plus loin dans la phrase ne change pas une somme due', () => {
  const kinds = (s: string) => extractByRules(pdf(courrier(s)), 'c.pdf').amounts.map((a) => [a.amount, a.kind]);
  assert.deepEqual(kinds('Nous vous réclamons 3 480,00 € ; le trop-perçu de 2024 avait été porté en votre faveur.'), [[3480, 'claimed']]);
  assert.deepEqual(kinds('La régularisation des charges 2025 : 3 480,00 €.'), [[3480, 'claimed']]);
  assert.deepEqual(kinds('Trop-perçu 2024 de 120,00 € ; régularisation des charges 2025 : 3 480,00 €.'), [[120, 'other'], [3480, 'claimed']]);
});

const COURRIEL_VERS = (to: string, phrase: string) => COURRIEL_TITULAIRE(phrase).replace(/^To: .*$/m, `To: ${to}`);
const COURRIER_15_JANVIER = courrier('Nous vous remercions de bien vouloir nous faire parvenir votre règlement ou vos observations. Une réponse de votre part est attendue avant le 15 janvier 2027.');

test('C21 (contre-revue) — demande au tiers : connecteur en tête de phrase, destinataire nommé ou simple adresse', async () => {
  const c = extractByRules(pdf(COURRIER_15_JANVIER), 'courrier.pdf');
  for (const [to, phrase] of [
    ['Cabinet Verdier Gestion <gestion@verdier-gestion.example>', 'Par conséquent, je vous demande les justificatifs avant le 30 novembre 2026.'],
    ['Hélène Verdier <h.verdier@verdier-gestion.example>', "Je conteste l'écart et vous demande les justificatifs de la taxe foncière avant le 30 novembre 2026."],
    ['gestion@verdier-gestion.example', "Je conteste l'écart et vous demande les justificatifs de la taxe foncière avant le 30 novembre 2026."],
    ['Cabinet Verdier Gestion <gestion@verdier-gestion.example>', 'Je vous saurais gré de me transmettre les justificatifs avant le 30 novembre 2026.'],
  ]) {
    const m = extractByRules(await eml(COURRIEL_VERS(to, phrase)), 'courriel.eml');
    const a = consolider([{ id: 'courrier', data: c }, { id: 'courriel', data: m }]);
    const cas = `${to} / ${phrase}`;
    assert.match(a.situation, /réponse attendue avant le 15 janvier 2027/i, cas);
    assert.doesNotMatch(a.situation, /30 novembre 2026/, cas);
    assert.equal(a.primary_action.due_date, '2027-01-15', cas);
    assert.equal(a.primary_action.owner, 'client', cas);
    assert.equal(a.deadlines.find((d) => d.date === '2026-11-30')?.owner, 'tiers', cas);
  }
});

test('C21 (contre-revue, témoin) — une gestionnaire qui écrit au titulaire lui fixe bien son échéance', async () => {
  const raw = `From: Hélène Verdier <h.verdier@verdier-gestion.example>
To: Camille Roche <camille.roche@atelier-lumen.example>
Date: Tue, 20 Oct 2026 09:42:00 +0200
Subject: Charges 2025
Content-Type: text/plain; charset=UTF-8

Madame,

Je vous demande de régler le solde avant le 30 novembre 2026.

Cordialement,
Hélène Verdier
`;
  const c = extractByRules(pdf(COURRIER_15_JANVIER), 'courrier.pdf');
  const a = consolider([{ id: 'courrier', data: c }, { id: 'courriel', data: extractByRules(await eml(raw), 'courriel.eml') }]);
  assert.equal(a.deadlines.find((d) => d.date === '2026-11-30')?.owner, 'client');
  assert.equal(a.primary_action.due_date, '2026-11-30');
});

test('C21 (contre-revue) — tableau de bord : la « prochaine date » n’est pas une date fixée à un tiers', async () => {
  const c = extractByRules(pdf(COURRIER_15_JANVIER), 'courrier.pdf');
  const m = extractByRules(await eml(COURRIEL_TITULAIRE("Je conteste l'écart et vous demande les justificatifs de la taxe foncière avant le 30 novembre 2026.")), 'courriel.eml');
  const a = consolider([{ id: 'courrier', data: c }, { id: 'courriel', data: m }]);
  const found = <T extends { evidence: object[] }>(xs: T[]) => xs.map((x) => ({ ...x, evidence: x.evidence.map((e) => ({ ...e, status: 'found' as const })) }));
  const v = buildView({
    title: 'Dossier fictif', revision: 1, generatedAt: new Date('2026-11-18T10:00:00Z'), provider: 'regles',
    analysis: { ...a, deadlines: found(a.deadlines), events: [] } as never,
    coverage: { total: 2, extracted: 2, unsupported: 0, failed: 0, pending: 0, complete: true },
    pieces: [], overrides: [], deadlineRows: [],
  });
  assert.equal(v.tableau.next_date?.date, '2027-01-15');
  assert.ok(v.echeances.confirmed.some((d) => d.date === '2026-11-30' && d.owner === 'Un tiers'), 'la date du tiers reste listée dans les échéances');
});

test('C09 (contre-revue) — une référence « 2026-001 » n’est pas lue comme des milliers', () => {
  const v = (s: string) => findAmounts(s).map((a) => a.value);
  assert.deepEqual(v('Facture 2026-001 480,00 €'), [480]);
  assert.deepEqual(v('Réf. 26/015 250,00 €'), [250]);
  assert.deepEqual(v('Avoir : -270,00 €'), [270], 'le signe moins d’un avoir reste lisible');
  assert.deepEqual(v('Total 3 480,00 €'), [3480]);
});
