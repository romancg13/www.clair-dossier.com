// Revue de la PR #68, lot « verif » : contrôle des citations et des dates (C08, C11, C23).
// Fonctions pures du moteur + pile de recette en mémoire (règles, sans IA, sans réseau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stack } from './helpers/recette.ts';
import { consolidatedQuoteStatus, guardAnalysis, verifyExtraction, type StoredExtraction } from '../supabase/functions/_shared/engine/verify.ts';
import type { AnalysisOutput, ExtractionOutput } from '../supabase/functions/_shared/engine/schemas.ts';
import type { PreparedPiece } from '../supabase/functions/_shared/engine/reading.ts';
import { buildChronology } from '../supabase/functions/_shared/analysis-model.ts';
import { buildView } from '../supabase/functions/_shared/rendus/view.ts';
import type { RenduView } from '../supabase/functions/_shared/rendus/index.ts';

const piece = (text: string) => ({ text, pageTexts: null, pages: null }) as unknown as PreparedPiece;
const extraction = (o: Partial<ExtractionOutput>): ExtractionOutput =>
  ({
    document_type: 'courrier', language: 'fr', summary: '',
    parties: [], dates: [], amounts: [], references: [], obligations: [], requests: [], alleged_facts: [], referenced_documents: [],
    missing_elements: [], quality: { readable: true, notes: '' },
    ...o,
  }) as unknown as ExtractionOutput;
const analysis = (o: Partial<AnalysisOutput>): AnalysisOutput =>
  ({
    situation: 'Une phrase.', summary_short: 's', summary_long: 'l',
    parties: [], facts: [], key_facts: [], amounts: [], deadlines: [], contradictions: [], missing_items: [], milestones: [],
    primary_action: { label: 'Préparer votre réponse', owner: 'client', rationale: 'r', due_date: null },
    attention_points: [], next_actions: [], reminder_drafts: [],
    ...o,
  }) as unknown as AnalysisOutput;
/** Champs posés par les vérifications (statut d'extrait, élément non vérifié), absents des types de sortie. */
const chk = (x: unknown) => x as { unverified?: boolean; evidence: { status?: string }[] };
const q = (quote: string, document_id = 'c') => ({ document_id, page: null, locator: null, quote });
const guard = (a: AnalysisOutput, data: StoredExtraction, id = 'c') =>
  guardAnalysis(a, { knownDocs: new Set([id]), eventKeys: new Set(), extractions: new Map([[id, { data, vision: false }]]) }).analysis;
const view = (a: ReturnType<typeof guard>) =>
  buildView({
    title: 'T', revision: 1, generatedAt: new Date('2026-11-18T10:00:00Z'),
    analysis: { ...a, events: [] } as never,
    coverage: { total: 1, extracted: 1, unsupported: 0, failed: 0, pending: 0, complete: true },
    pieces: [{ id: 'c', file_name: 'courrier.pdf', created_at: '2026-11-18' }], overrides: [], deadlineRows: [], provider: 'anthropic',
  });

/* ── C08 : une citation consolidée doit être CONTENUE dans un extrait vérifié ── */

const COURRIER = 'Cabinet Verdier Gestion\nAtelier Lumen SARL\nNous vous réclamons la somme de 3 480,00 € au titre de la régularisation des charges 2025.';
const RECLAME = 'Nous vous réclamons la somme de 3 480,00 € au titre de la régularisation des charges 2025.';
const courrier = () =>
  verifyExtraction(
    extraction({
      parties: [
        { name: 'Cabinet Verdier Gestion', role: 'gestionnaire', evidence: [{ page: null, locator: 'ligne 1', quote: 'Cabinet Verdier Gestion' }] },
        { name: 'Atelier Lumen SARL', role: 'preneur', evidence: [{ page: null, locator: 'ligne 2', quote: 'Atelier Lumen SARL' }] },
      ],
      amounts: [{ amount: 3480, currency: 'EUR', label: 'Régularisation des charges 2025', kind: 'claimed', evidence: [{ page: null, locator: 'ligne 3', quote: RECLAME }] }],
    } as never),
    piece(COURRIER),
  );

test('C08 : une citation inventée qui contient un nom de partie n’est pas « trouvée »', () => {
  const data = courrier();
  assert.equal(chk(data.parties[0]).evidence[0].status, 'found', 'preuve d’extraction vérifiée dans le texte');
  const ex = new Map([['c', { data, vision: false }]]);
  const invente = 'Le Cabinet Verdier Gestion accepte de ramener la somme due à 3 210,00 € et renonce à toute pénalité';
  assert.equal(consolidatedQuoteStatus(q(invente), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('Atelier Lumen SARL doit payer une pénalité avant le 1er décembre 2026'), ex), 'not_found');
  // Le fait inventé reste « à vérifier », jamais « Fiabilité élevée ».
  const g = guard(analysis({ facts: [{ text: 'Le bailleur renonce à toute pénalité', status: 'documented', evidence: [q(invente)] }] as never }), data);
  assert.equal(chk(g.facts[0]).unverified, true);
  assert.equal(chk(g.facts[0]).evidence[0].status, 'not_found');
});

test('C08 : une citation vide ou trop courte n’est pas « trouvée »', () => {
  const ex = new Map([['c', { data: courrier(), vision: false }]]);
  assert.equal(consolidatedQuoteStatus(q(''), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q(' « » '), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('Ga'), ex), 'not_found');
});

test('C08 : une citation recopiée ou extraite d’un extrait vérifié reste « trouvée »', () => {
  const ex = new Map([['c', { data: courrier(), vision: false }]]);
  assert.equal(consolidatedQuoteStatus(q('Cabinet Verdier Gestion'), ex), 'found', 'nom de partie recopié');
  assert.equal(consolidatedQuoteStatus(q('la somme de 3 480,00 €'), ex), 'found', 'sous-chaîne d’un extrait vérifié');
  assert.equal(consolidatedQuoteStatus(q(RECLAME), ex), 'found', 'extrait recopié à l’identique (consolidation par règles)');
});

/* ── C11 : une échéance « date écrite » doit porter une date présente dans son extrait ── */

const ATTENTE = 'Une réponse de votre part est attendue avant le 15 janvier 2027';
const attente = () =>
  verifyExtraction(
    extraction({ dates: [{ date: '2027-01-15', precision: 'day', label: 'Réponse attendue', kind: 'deadline', evidence: [{ page: null, locator: 'corps § 2', quote: ATTENTE }] }] } as never),
    piece(`Madame,\n${ATTENTE}. Cordialement.`),
  );
const echeance = (date: string, quote: string) =>
  analysis({
    deadlines: [{ title: 'Répondre au courrier', date, kind: 'mentioned', basis: 'courrier', priority: 'haute', owner: 'client', owner_name: null, evidence: [q(quote)] }] as never,
    primary_action: { label: 'Préparer votre réponse', owner: 'client', rationale: 'r', due_date: date },
  });

test('C11 : date mal lue (1er mai au lieu du 15 janvier) ramenée à « à confirmer », sans date d’action', () => {
  const g = guard(echeance('2027-05-01', ATTENTE), attente());
  const d = g.deadlines[0];
  assert.equal(chk(d).evidence[0].status, 'found', 'l’extrait, lui, figure bien dans la pièce');
  assert.equal(d.kind, 'hypothesis');
  assert.equal(chk(d).unverified, true);
  assert.equal(d.priority, 'normale');
  assert.equal(g.primary_action.due_date, null);
  assert.ok(g.guard.notes.some((n) => /absente de l'extrait cité/.test(n)));
  const v = view(g);
  assert.equal(v.echeances.confirmed.length, 0, 'aucune « date confirmée »');
  assert.ok(v.echeances.to_confirm.some((x) => x.date === '2027-05-01' && x.reliability.level === 'a_verifier'));
  assert.notEqual(v.tableau.next_date?.status, 'confirmee');
  assert.equal(v.tableau.action.due_date, null);
});

test('C11 : extrait allongé par le modèle avec la fausse date : non confirmé non plus', () => {
  const g = guard(echeance('2027-05-01', `${ATTENTE}, au plus tard le 1er mai 2027`), attente());
  assert.equal(chk(g.deadlines[0]).unverified, true);
  assert.equal(g.primary_action.due_date, null);
  assert.equal(view(g).echeances.confirmed.length, 0);
});

test('C11 : date réellement écrite dans l’extrait : toujours confirmée', () => {
  const g = guard(echeance('2027-01-15', ATTENTE), attente());
  const d = g.deadlines[0];
  assert.equal(d.kind, 'mentioned');
  assert.equal(chk(d).unverified, false);
  assert.equal(d.priority, 'haute');
  assert.equal(g.primary_action.due_date, '2027-01-15');
  assert.deepEqual(g.guard.notes, []);
  const v = view(g);
  assert.deepEqual(v.echeances.confirmed.map((x) => [x.date, x.reliability.level]), [['2027-01-15', 'elevee']]);
  assert.equal(v.tableau.next_date?.status, 'confirmee');
});

/* ── C23 : les jalons de la chronologie gardent le statut et le repère de leurs extraits ── */

test('C23 : jalons issus de pièces texte « Fiabilité élevée », repères conservés', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf', 'Avis-echeance-T4-2026.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml', 'Bail-commercial-2021.pdf']);
  await s.run();
  const v = (await s.store.getView('D1'))!.view as RenduView;
  const ms = v.chronologie.milestones;
  assert.ok(ms.length >= 3);
  for (const m of ms) assert.ok(!m.reliability.reasons.includes('extrait non retrouvé dans la pièce'), `faux avertissement sur « ${m.label} »`);
  const courrierM = ms.find((m) => m.label === 'Courrier (Cabinet Verdier Gestion)');
  assert.ok(courrierM, 'jalon du courrier présent');
  assert.equal(courrierM.reliability.level, 'elevee');
  // Les deux dates de signature du bail ne sont « à vérifier » que parce qu'elles se contredisent.
  for (const m of ms.filter((x) => /^Signature du bail/.test(x.label))) assert.deepEqual(m.reliability.reasons, ['contredit par une autre pièce']);
  // Le repère d'un courriel (en-tête, paragraphe) est restitué.
  assert.ok(v.chronologie.all.some((e) => e.sources.some((x) => x.where === 'en-tête Date')));
});

test('C23 : buildChronology recopie statut et repère quand ils existent, rien de plus sinon', () => {
  const [e] = buildChronology([
    { document_id: 'a', data: { dates: [{ date: '2026-10-12', precision: 'day', kind: 'document_date', label: 'Courrier', evidence: [{ page: 1, locator: 'en-tête', quote: 'Marseille, le 12 octobre 2026', status: 'found' }] }] } },
  ] as never);
  assert.deepEqual(e.evidence, [{ document_id: 'a', page: 1, locator: 'en-tête', quote: 'Marseille, le 12 octobre 2026', status: 'found' }]);
  // Extractions sans statut ni repère (démo du site, ancien moteur) : forme inchangée.
  const [f] = buildChronology([{ document_id: 'b', data: { dates: [{ date: '2026-09-20', precision: 'day', kind: 'event_date', label: 'Relance', evidence: [{ page: 2, quote: 'Relance du 20/09/2026' }] }] } }]);
  assert.deepEqual(f.evidence, [{ document_id: 'b', page: 2, quote: 'Relance du 20/09/2026' }]);
});

/* ── Contre-revue : correspondances sur des limites de mots, contenu minimal d'un extrait consolidé ── */

test('C11 : « 5 janvier 2027 » coupé dans « 15 janvier 2027 » ne confirme pas le 5 janvier', () => {
  const g = guard(echeance('2027-01-05', '5 janvier 2027'), attente());
  const d = g.deadlines[0];
  assert.equal(chk(d).evidence[0].status, 'not_found', 'fragment coupé au milieu d’un nombre');
  assert.equal(chk(d).unverified, true);
  assert.equal(g.primary_action.due_date, null);
  const v = view(g);
  assert.equal(v.echeances.confirmed.length, 0, 'aucune « date confirmée »');
  assert.ok(v.echeances.to_confirm.some((x) => x.date === '2027-01-05' && x.reliability.level === 'a_verifier'));
  assert.equal(v.tableau.action.due_date, null);
  // Le vrai fragment, lui, reste retrouvé et confirme la vraie date.
  const ok = guard(echeance('2027-01-15', '15 janvier 2027'), attente());
  assert.equal(chk(ok.deadlines[0]).unverified, false);
  assert.equal(ok.primary_action.due_date, '2027-01-15');
});

test('C11 : coupe au chiffre refusée aussi à l’extraction (texte de la pièce) et au format numérique', () => {
  const texte = piece('Réponse attendue avant le 15/01/2027. Rendez-vous le 11 mai 2027. Cabinet Verdier Gestion réclame 13 480,00 €.');
  const one = (quote: string) => chk(verifyExtraction(extraction({ dates: [{ date: '2027-01-05', precision: 'day', label: 'x', kind: 'deadline', evidence: [{ page: null, locator: null, quote }] }] } as never), texte).dates[0]).evidence[0].status;
  assert.equal(one('5/01/2027'), 'not_found');
  assert.equal(one('1 mai 2027'), 'not_found');
  assert.equal(one('net Verdier Ges'), 'not_found');
  assert.equal(one('3 480,00 €'), 'not_found');
  // Témoins : fragments entiers, y compris après une apostrophe.
  assert.equal(one('15/01/2027'), 'found');
  assert.equal(one('11 mai 2027'), 'found');
  assert.equal(one('13 480,00 €'), 'found');
  assert.equal(chk(verifyExtraction(extraction({ references: [{ kind: 'article', value: '5', evidence: [{ page: null, locator: null, quote: 'article 5' }] }] } as never), piece("En application de l'article 5 du bail.")).references[0]).evidence[0].status, 'found');
});

test('C08 : un extrait consolidé trop pauvre (« 2027 », un seul nombre) n’est pas « trouvé »', () => {
  const ex = new Map([['c', { data: attente(), vision: false }]]);
  assert.equal(consolidatedQuoteStatus(q('2027'), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('15'), ex), 'not_found');
  const g = guard(analysis({ facts: [{ text: 'Le délai expire en 2027', status: 'documented', evidence: [q('2027')] }] as never }), attente());
  assert.equal(chk(g.facts[0]).unverified, true);
  // Témoins : deux mots, ou un mot de quatre lettres au moins.
  assert.equal(consolidatedQuoteStatus(q('janvier 2027'), ex), 'found');
  assert.equal(consolidatedQuoteStatus(q('réponse'), ex), 'found');
});
