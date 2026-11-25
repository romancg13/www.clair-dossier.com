// REMISE §11, « vérification de citation » : un mot isolé ne marque JAMAIS une citation « trouvée ».
// Il faut un passage (≥ 2 mots significatifs contigus, sur des limites de mots) ou une valeur typée
// concordante (date complète, montant, référence) ; un nom de partie court se vérifie par comparaison aux
// parties extraites de la même pièce. Et la règle métier qui en dépend : une facture échue sans preuve de
// non-paiement reste un « Paiement à vérifier ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consolidatedQuoteStatus, guardAnalysis, reliability, verifyExtraction, type StoredExtraction } from '../supabase/functions/_shared/engine/verify.ts';
import type { AnalysisOutput, ExtractionOutput } from '../supabase/functions/_shared/engine/schemas.ts';
import type { PreparedPiece } from '../supabase/functions/_shared/engine/reading.ts';
import { buildAttention } from '../supabase/functions/_shared/attention.ts';
import type { AnalysisData } from '../supabase/functions/_shared/analysis-model.ts';

const piece = (text: string) => ({ text, pageTexts: null, pages: null }) as unknown as PreparedPiece;
const scan = () => ({ text: null, pageTexts: null, pages: null }) as unknown as PreparedPiece;
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
const chk = (x: unknown) => x as { unverified?: boolean; evidence: { status?: string }[] };
const q = (quote: string, document_id = 'c') => ({ document_id, page: null, locator: null, quote });
const un = (data: StoredExtraction, vision = false) => new Map([['c', { data, vision }]]);
const guard = (a: AnalysisOutput, data: StoredExtraction) => guardAnalysis(a, { knownDocs: new Set(['c']), eventKeys: new Set(), extractions: un(data) }).analysis;
const ev = (quote: string) => [{ page: null, locator: null, quote }];

/* Courrier du gestionnaire : une partie au nom long, une au nom court, une date, un montant, une référence. */
const ATTENTE = 'Une réponse de votre part est attendue avant le 15 janvier 2027';
const RECLAME = 'Nous vous réclamons la somme de 3 480,00 € au titre de la régularisation des charges 2025.';
const TEXTE = `Cabinet Verdier Gestion\nLumen\nRéf. RC2025118\n${RECLAME}\n${ATTENTE}. Cordialement.`;
const courrier = () =>
  verifyExtraction(
    extraction({
      parties: [
        { name: 'Cabinet Verdier Gestion', role: 'gestionnaire', evidence: ev('Cabinet Verdier Gestion') },
        { name: 'Lumen', role: 'preneur', evidence: ev('Lumen') },
      ],
      dates: [{ date: '2027-01-15', precision: 'day', label: 'Réponse attendue', kind: 'deadline', evidence: ev(ATTENTE) }],
      amounts: [{ amount: 3480, currency: 'EUR', label: 'Régularisation des charges 2025', kind: 'claimed', evidence: ev(RECLAME) }],
      references: [{ value: 'RC2025118', label: 'Référence du courrier', evidence: ev('Réf. RC2025118') }],
    } as never),
    piece(TEXTE),
  );

test('citations : un mot isolé, même long et réellement présent dans la pièce, n’est jamais « trouvé »', () => {
  const data = courrier();
  assert.ok([...data.parties, ...data.dates, ...data.amounts, ...data.references].every((i) => i.evidence.every((e) => (e as { status?: string }).status === 'found')), 'preuves d’extraction retrouvées dans le texte');
  for (const mot of ['janvier', 'réponse', 'régularisation', 'réclamons', 'charges', 'Cordialement', 'Verdier', 'Lumen', 'Gestion'])
    assert.equal(consolidatedQuoteStatus(q(mot), un(data)), 'not_found', `« ${mot} » seul ne prouve rien`);
  // Un mot isolé entouré de mots vides reste un mot isolé.
  for (const pauvre of ['le janvier', 'de la réponse', 'au titre de', 'votre part', 'la somme de'])
    assert.equal(consolidatedQuoteStatus(q(pauvre), un(data)), 'not_found', `« ${pauvre} » : un seul mot significatif au plus`);
  // Le fait qui ne s'appuie que sur un mot reste « à vérifier », jamais « Fiabilité élevée ».
  const g = guard(analysis({ facts: [{ text: 'Le bailleur a accordé un délai jusqu’en janvier', status: 'documented', evidence: [q('janvier')] }] as never }), data);
  assert.equal(chk(g.facts[0]).evidence[0].status, 'not_found');
  assert.equal(chk(g.facts[0]).unverified, true);
  assert.equal(reliability(chk(g.facts[0]).evidence as never).level, 'a_verifier');
});

test('citations : un passage d’au moins deux mots significatifs contigus, sur des limites de mots, est « trouvé »', () => {
  const ex = un(courrier());
  for (const passage of ['réponse de votre part', 'attendue avant le 15 janvier 2027', 'janvier 2027', 'régularisation des charges 2025', 'la somme de 3 480,00 €', RECLAME, ATTENTE])
    assert.equal(consolidatedQuoteStatus(q(passage), ex), 'found', `« ${passage} »`);
  // Mots présents mais NON contigus, ou coupés au milieu d'un mot ou d'un nombre : ce n'est pas un passage de la pièce.
  for (const faux of ['réponse attendue', 'somme régularisation', 'ponse de votre part', '5 janvier 2027', 'charges 202'])
    assert.equal(consolidatedQuoteStatus(q(faux), ex), 'not_found', `« ${faux} »`);
  // Passage inventé autour d'éléments vrais : toujours refusé.
  assert.equal(consolidatedQuoteStatus(q('Le Cabinet Verdier Gestion renonce à la somme de 3 480,00 €'), ex), 'not_found');
});

test('citations : une valeur typée seule (date complète, montant, référence) est vérifiée par concordance avec la pièce', () => {
  const ex = un(courrier());
  // Date complète écrite autrement que dans la pièce : même jour → trouvée ; autre jour → non.
  assert.equal(consolidatedQuoteStatus(q('15/01/2027'), ex), 'found');
  assert.equal(consolidatedQuoteStatus(q('le 2027-01-15'), ex), 'found');
  assert.equal(consolidatedQuoteStatus(q('16/01/2027'), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('15/01/2026'), ex), 'not_found');
  // Date incomplète : ce n'est pas une valeur typée.
  assert.equal(consolidatedQuoteStatus(q('2027'), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('01/2027'), ex), 'not_found');
  // Montant écrit sans les décimales ni l'espace : même somme → trouvé ; autre somme → non.
  assert.equal(consolidatedQuoteStatus(q('3480 €'), ex), 'found');
  assert.equal(consolidatedQuoteStatus(q('3 480 euros'), ex), 'found');
  assert.equal(consolidatedQuoteStatus(q('3 490 €'), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('13 480,00 €'), ex), 'not_found');
  // Référence d'un seul tenant : identique à une référence extraite → trouvée ; voisine → non.
  assert.equal(consolidatedQuoteStatus(q('RC2025118'), ex), 'found');
  assert.equal(consolidatedQuoteStatus(q('RC2025119'), ex), 'not_found');
  // Valeur vraie habillée d'un texte inventé : la concordance de la valeur ne valide pas la phrase.
  assert.equal(consolidatedQuoteStatus(q('paiement intégral reçu le 15/01/2027'), ex), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('remise accordée de 3 480 €'), ex), 'not_found');
});

test('citations : un nom de partie court reste vérifiable, par comparaison aux parties extraites de la même pièce', () => {
  const data = courrier();
  const g = guard(
    analysis({
      parties: [
        { name: 'Lumen', role: 'preneur', evidence: [q('Lumen')] }, // nom court, cité tel quel
        { name: 'Cabinet Verdier Gestion', role: 'gestionnaire', evidence: [q('Verdier')] }, // mot distinctif du nom
        { name: 'Cabinet Verdier', role: 'gestionnaire', evidence: [q('Cabinet Verdier Gestion')] }, // nom complet : passage
        { name: 'Durand', role: 'tiers', evidence: [q('Lumen')] }, // la pièce nomme Lumen, pas Durand
        { name: 'Cabinet Verdier Gestion', role: 'gestionnaire', evidence: [q('Cabinet')] }, // mot générique
        { name: 'Cabinet Verdier Gestion', role: 'gestionnaire', evidence: [q('janvier')] }, // mot présent, pas un nom
      ],
      // Le même mot cité à l'appui d'un FAIT ne prouve rien : seul un élément « partie » se vérifie par son nom.
      facts: [{ text: 'Lumen reconnaît devoir la somme', status: 'documented', evidence: [q('Lumen')] }],
    } as never),
    data,
  );
  assert.deepEqual(g.parties.map((p) => chk(p).evidence[0].status), ['found', 'found', 'found', 'not_found', 'not_found', 'not_found']);
  assert.deepEqual(g.parties.map((p) => chk(p).unverified), [false, false, false, true, true, true]);
  assert.equal(chk(g.facts[0]).unverified, true);
  // Sans le nom de l'élément (appel direct), un mot isolé n'est jamais trouvé.
  assert.equal(consolidatedQuoteStatus(q('Lumen'), un(data)), 'not_found');
  assert.equal(consolidatedQuoteStatus(q('Lumen'), un(data), { partyName: 'Lumen' }), 'found');
  assert.equal(consolidatedQuoteStatus(q('Lumen'), un(data), { partyName: 'Lumen SARL' }), 'found', 'forme sociale ajoutée par le modèle');
});

test('citations : pièce lue visuellement (aucun texte de contrôle) : « inconnu », jamais « trouvé »', () => {
  const data = verifyExtraction(extraction({ dates: [{ date: '2027-01-15', precision: 'day', label: 'Réponse attendue', kind: 'deadline', evidence: ev(ATTENTE) }] } as never), scan());
  const ex = un(data, true);
  assert.equal(consolidatedQuoteStatus(q('janvier'), ex), 'unknown');
  assert.equal(consolidatedQuoteStatus(q('attendue avant le 15 janvier 2027'), ex), 'unknown');
  assert.equal(consolidatedQuoteStatus(q('15/01/2027'), ex), 'unknown');
});

/* ── Règle métier : facture échue sans preuve de non-paiement = « Paiement à vérifier » ── */

const ECHEANCE = 'Échéance de paiement : 30 septembre 2026';
const PENALITES = 'En cas d’impayé, des pénalités de retard seront appliquées.';
const CONSTAT = 'La facture F-2026-077 demeure impayée à ce jour malgré notre relance.';
const facture = (avecConstat: boolean) =>
  verifyExtraction(
    extraction({
      document_type: 'facture',
      dates: [{ date: '2026-09-30', precision: 'day', label: 'Échéance de paiement', kind: 'deadline', evidence: ev(ECHEANCE) }],
      amounts: [{ amount: 1200, currency: 'EUR', label: 'Total TTC', kind: 'due', evidence: ev('Total TTC : 1 200,00 €') }],
      obligations: [{ text: 'Pénalités de retard', owner: 'client', evidence: ev(PENALITES) }],
      alleged_facts: avecConstat ? [{ text: 'Facture impayée', asserted_by: 'émetteur', evidence: ev(CONSTAT) }] : [],
    } as never),
    piece(`Facture F-2026-077\nTotal TTC : 1 200,00 €\n${ECHEANCE}\n${PENALITES}${avecConstat ? `\n${CONSTAT}` : ''}`),
  );
const dossierFacture = (data: StoredExtraction, faits: { text: string; quote: string }[]) => {
  const g = guard(
    analysis({
      deadlines: [{ title: 'Paiement de la facture F-2026-077', date: '2026-09-30', kind: 'mentioned', basis: 'facture', priority: 'haute', owner: 'tiers', owner_name: null, evidence: [q(ECHEANCE)] }] as never,
      facts: faits.map((f) => ({ text: f.text, status: 'documented', evidence: [q(f.quote)] })) as never,
    }),
    data,
  );
  const r = buildAttention({ analysis: { ...g, events: [] } as unknown as AnalysisData, coverage: { total: 1, extracted: 1, unsupported: 0, failed: 0, pending: 0, complete: true }, today: '2026-11-06', documentNames: { c: 'Facture F-2026-077.pdf' }, max: 50 });
  return [...r.items, ...r.more];
};

test('facture échue sans preuve de non-paiement : « Paiement à vérifier », jamais « impayé »', () => {
  const items = dossierFacture(facture(false), []);
  const pay = items.find((i) => i.category === 'paiement_a_verifier');
  assert.ok(pay, 'la facture échue est signalée');
  assert.match(pay.title, /^Paiement à vérifier — échéance passée depuis 37 jours \(30\/09\/2026\)/);
  assert.match(pay.consequence, /ne peut pas être qualifiée d’impayée/);
  assert.ok(!items.some((i) => i.category === 'echeance_depassee'));
});

test('facture échue : un « fait documenté » d’impayé appuyé sur un mot isolé ou une phrase inventée ne vaut pas preuve', () => {
  // Le mot « impayé » figure bien dans la pièce (clause de pénalités) : le citer seul ne prouve aucun non-paiement.
  for (const quote of ['impayé', 'pénalités', 'La facture F-2026-077 est impayée depuis le 30 septembre 2026']) {
    const items = dossierFacture(facture(false), [{ text: 'La facture F-2026-077 est impayée.', quote }]);
    assert.match(items.find((i) => i.category === 'paiement_a_verifier')?.title ?? '', /^Paiement à vérifier/, `citation « ${quote} »`);
    assert.ok(!items.some((i) => i.category === 'echeance_depassee'), `aucun « non-paiement documenté » sur « ${quote} »`);
  }
});

test('facture échue (témoin) : un constat d’impayé réellement écrit dans la pièce est une preuve documentée', () => {
  const items = dossierFacture(facture(true), [{ text: 'La facture F-2026-077 demeure impayée.', quote: 'demeure impayée à ce jour' }]);
  assert.match(items.find((i) => i.category === 'echeance_depassee')?.title ?? '', /non-paiement documenté/);
  assert.ok(!items.some((i) => i.category === 'paiement_a_verifier'));
});
