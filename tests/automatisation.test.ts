/**
 * Automatisation client/admin — identité, inscription, brouillons isolés,
 * quotas (lecture serveur + messages), synchronisation Stripe.
 * Le comportement SQL réel (quota atomique, RLS, override) est testé à part
 * par tests/sql/migrations.pglite.mjs.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  AMOUNT_HELP,
  COMMON_FIELDS,
  effectiveBillingEmail,
  fieldsFor,
  displayName,
  greeting,
  isOtpCode,
  parseDossierEntitlement,
  parseSubmissionError,
  profileNeedsCompletion,
  quotaLimitMessage,
  quotaReached,
  quotaUsageLabel,
  requiresOrganization,
  suggestNameSplit,
  userMessage,
  validatePhone,
  validateSignup,
} from '../packages/core/src/index.ts';
import {
  blankDraft,
  cleanAnswers,
  isUuid,
  listDrafts,
  loadDraft,
  newDraftId,
  removeDraft,
  saveDraft,
  type KeyValueStore,
} from '../src/lib/drafts.ts';
import {
  adminNotificationText,
  extractPeriod,
  planIdFromSubscription,
  subscriptionIdFromInvoice,
  subscriptionRow,
} from '../supabase/functions/_shared/stripe-sync.ts';

function memoryStore(): KeyValueStore & { dump: () => Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

/* ── Identité ─────────────────────────────────────────────────────────── */

test('nom affiché : prénom + nom, jamais l’e-mail', () => {
  assert.equal(displayName({ first_name: 'Jean', last_name: 'Gomes', full_name: 'j.gomes@avocats-gojuris.fr' }), 'Jean Gomes');
  assert.equal(displayName({ full_name: 'Jean Gomes' }), 'Jean Gomes');
  assert.equal(displayName({ full_name: 'j.gomes@avocats-gojuris.fr', company_name: 'GoJuris' }), 'GoJuris');
  assert.equal(displayName({ full_name: 'j.gomes@avocats-gojuris.fr' }), null);
  assert.equal(greeting({ first_name: 'Alice', last_name: 'Martin' }), 'Bonjour, Alice Martin');
  assert.equal(greeting(null), 'Bonjour');
});

test('ancien compte : complétion demandée, suggestion jamais imposée', () => {
  assert.equal(profileNeedsCompletion({ full_name: 'Jean Gomes' }), true);
  assert.equal(profileNeedsCompletion({ first_name: 'Jean', last_name: 'Gomes' }), false);
  assert.deepEqual(suggestNameSplit('Jean-Pierre de la Fontaine'), { first: 'Jean-Pierre', last: 'de la Fontaine' });
  assert.deepEqual(suggestNameSplit('a@b.fr'), { first: '', last: '' });
});

const validSignup = {
  companyType: 'pme',
  firstName: 'Alice',
  lastName: 'Martin',
  organizationName: 'Martin SAS',
  email: 'alice@martin.fr',
  password: 'motdepasse',
  phone: '',
  acceptedTerms: true,
};

test('inscription : formulaire complet valide, téléphone vide accepté', () => {
  assert.deepEqual(validateSignup(validSignup), {});
});

test('inscription : champs obligatoires', () => {
  const e = validateSignup({ ...validSignup, firstName: ' ', lastName: '', email: '', password: '', acceptedTerms: false });
  assert.ok(e.firstName && e.lastName && e.email && e.password && e.acceptedTerms);
  assert.match(validateSignup({ ...validSignup, password: 'court' }).password ?? '', /8 caractères/);
  assert.match(validateSignup({ ...validSignup, email: 'pas-un-email' }).email ?? '', /invalide/);
});

test('inscription : structure obligatoire sauf particulier', () => {
  assert.ok(validateSignup({ ...validSignup, organizationName: '' }).organizationName);
  assert.equal(validateSignup({ ...validSignup, companyType: 'particulier', organizationName: '' }).organizationName, undefined);
  assert.equal(requiresOrganization('particulier'), false);
  assert.equal(requiresOrganization('artisan'), true);
});

test('téléphone facultatif : vide ou valide accepté, invalide refusé', () => {
  assert.equal(validatePhone(''), null);
  assert.equal(validatePhone('+33 6 12 34 56 78'), null);
  assert.equal(validatePhone('06 12 34 56 78'), null);
  assert.ok(validatePhone('12'));
  assert.ok(validatePhone('abc def ghi'));
  assert.ok(validateSignup({ ...validSignup, phone: 'n/a' }).phone);
});

test('code de vérification : 6 chiffres', () => {
  assert.equal(isOtpCode('123456'), true);
  assert.equal(isOtpCode('12345'), false);
  assert.equal(isOtpCode('12a456'), false);
});

test('e-mail de facturation facultatif : repli sur le compte', () => {
  assert.equal(effectiveBillingEmail('', 'compte@x.fr'), 'compte@x.fr');
  assert.equal(effectiveBillingEmail('compta@x.fr', 'compte@x.fr'), 'compta@x.fr');
  assert.equal(effectiveBillingEmail('invalide', 'compte@x.fr'), 'compte@x.fr');
});

/* ── Tunnel : champs et brouillons isolés ─────────────────────────────── */

test('montant en jeu : aide exacte, aucun préremplissage possible', () => {
  assert.equal(
    AMOUNT_HELP,
    'Si vous connaissez le montant concerné, indiquez-le ici. Sinon laissez ce champ vide : il pourra être précisé ultérieurement après analyse de votre dossier.',
  );
  assert.equal(COMMON_FIELDS.find((f) => f.id === 'amount')?.help, AMOUNT_HELP);
  assert.equal(fieldsFor('impaye-precontentieux').find((f) => f.id === 'amount')?.help, AMOUNT_HELP);
  for (const f of COMMON_FIELDS) assert.equal((f as Record<string, unknown>).defaultValue, undefined);
});

test('nouveau dossier : brouillon vierge, identifiant unique au format UUID', () => {
  const a = blankDraft();
  const b = blankDraft();
  assert.notEqual(a.id, b.id);
  assert.ok(isUuid(a.id) && isUuid(newDraftId()));
  assert.deepEqual(a.answers, {});
  assert.equal(a.title, undefined);
  assert.equal(a.step, 1);
});

test('brouillons isolés : restaurer A ne renvoie jamais les valeurs de B', () => {
  const store = memoryStore();
  const a = { ...blankDraft(), typology: 'facture-paiement', title: 'Facture X', answers: { amount: '4800', deadline: '2026-10-15' } };
  const b = { ...blankDraft(), typology: 'rh', title: 'RH Y', answers: { counterparty: 'Salarié Z' } };
  saveDraft(a, store);
  saveDraft(b, store);
  assert.deepEqual(loadDraft(a.id, store)?.answers, { amount: '4800', deadline: '2026-10-15' });
  assert.deepEqual(loadDraft(b.id, store)?.answers, { counterparty: 'Salarié Z' });
  assert.equal(loadDraft(newDraftId(), store), null);
  // Finaliser A ne supprime que A.
  removeDraft(a.id, store);
  assert.equal(loadDraft(a.id, store), null);
  assert.equal(loadDraft(b.id, store)?.title, 'RH Y');
  assert.deepEqual(listDrafts(store).map((d) => d.id), [b.id]);
});

test('brouillon vide jamais enregistré', () => {
  const store = memoryStore();
  saveDraft(blankDraft(), store);
  assert.deepEqual(store.dump(), {});
});

test('ancienne clé globale : convertie en brouillon nommé, jamais restaurée d’office', () => {
  const store = memoryStore();
  store.setItem('clairdossier_draft', JSON.stringify({ typology: 'autre', title: 'Ancien', answers: { amount: '999' }, step: 3 }));
  const drafts = listDrafts(store);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].title, 'Ancien');
  assert.equal(store.getItem('clairdossier_draft'), null);
  // Un nouveau dossier reste vierge.
  assert.deepEqual(blankDraft().answers, {});
});

test('réponses vides ou blanches jamais enregistrées comme valeurs', () => {
  assert.deepEqual(cleanAnswers({ amount: '', counterparty: '  ', situation: ' Relances ' }), { situation: 'Relances' });
});

/* ── Quotas ───────────────────────────────────────────────────────────── */

const ent = (over: Record<string, unknown>) =>
  parseDossierEntitlement({ applies: true, unlimited: false, dossier_limit: 20, used: 12, period_end: '2026-10-12T00:00:00Z', plan_id: 'business-pme-20', subscription_status: 'active', blocked_reason: null, ...over });

test('quota : affichage 12 / 20, illimité, non appliqué', () => {
  assert.equal(quotaUsageLabel(ent({})), '12 / 20');
  assert.equal(quotaUsageLabel(ent({ unlimited: true, dossier_limit: null })), 'Illimités');
  assert.equal(quotaUsageLabel(ent({ applies: false })), null);
  assert.equal(parseDossierEntitlement(null), null);
  assert.equal(parseDossierEntitlement({ applies: 'oui' }), null);
});

test('quota : atteint seulement si le serveur publie une limite', () => {
  assert.equal(quotaReached(ent({ used: 20 })), true);
  assert.equal(quotaReached(ent({ used: 19 })), false);
  assert.equal(quotaReached(ent({ used: 500, unlimited: true, dossier_limit: null })), false);
  assert.equal(quotaReached(ent({ applies: false, used: 500 })), false);
  assert.equal(quotaReached(ent({ blocked_reason: 'payment', used: 0 })), true);
});

test('refus serveur traduits en français (quota avec date, e-mail, blocage, doublon)', () => {
  const quota = parseSubmissionError({
    message: 'DOSSIER_QUOTA_EXCEEDED',
    details: JSON.stringify({ limit: 20, used: 20, period_end: '2026-10-12T00:00:00+00:00' }),
  });
  assert.equal(quota?.kind, 'quota');
  assert.match(quota?.message ?? '', /limite de dossiers incluse dans votre abonnement/);
  assert.match(quota?.message ?? '', /12 octobre 2026/);
  assert.equal(parseSubmissionError({ message: 'EMAIL_NOT_VERIFIED' })?.message, 'Votre adresse e-mail doit être vérifiée avant de valider un dossier.');
  assert.match(parseSubmissionError({ message: 'SUBMISSION_BLOCKED', details: 'suspended' })?.message ?? '', /suspendu/);
  assert.match(parseSubmissionError({ message: 'SUBMISSION_BLOCKED', details: 'payment' })?.message ?? '', /paiement/);
  assert.equal(
    parseSubmissionError({ code: '23505', message: 'duplicate key value violates unique constraint "dossiers_client_request_uidx"' })?.message,
    'Votre dossier a déjà été enregistré.',
  );
  assert.equal(parseSubmissionError({ message: 'network error' }), null);
  // Message générique partagé (application mobile) : refus métier prioritaire.
  assert.match(userMessage({ message: 'DOSSIER_QUOTA_EXCEEDED', details: '{}' }), /limite de dossiers/);
  assert.match(quotaLimitMessage(null), /renouvellement/);
});

/* ── Synchronisation Stripe ───────────────────────────────────────────── */

test('période Stripe : ancienne API (abonnement) et nouvelle API (lignes)', () => {
  const legacy = extractPeriod({ id: 'sub_1', status: 'active', customer: 'cus_1', current_period_start: 1760000000, current_period_end: 1762592000 });
  assert.equal(legacy.start, new Date(1760000000 * 1000).toISOString());
  const basil = extractPeriod({ id: 'sub_2', status: 'active', customer: 'cus_1', items: { data: [{ current_period_start: 1760000000, current_period_end: 1762592000 }] } });
  assert.equal(basil.end, new Date(1762592000 * 1000).toISOString());
});

test('offre ClairDossier lue dans les métadonnées Stripe (prix ou produit)', () => {
  assert.equal(planIdFromSubscription({ id: 's', status: 'active', customer: 'c', items: { data: [{ price: { id: 'price_1', metadata: { planId: 'essentiel' } } }] } }), 'essentiel');
  assert.equal(planIdFromSubscription({ id: 's', status: 'active', customer: 'c', items: { data: [{ price: { id: 'price_2', metadata: {}, product: { metadata: { planId: 'business-pme-20' } } } }] } }), 'business-pme-20');
  assert.equal(planIdFromSubscription({ id: 's', status: 'active', customer: 'c', items: { data: [{ price: { id: 'p', product: 'prod_x' } }] } }), null);
});

test('ligne abonnement : statut et période recopiés, offre inconnue jamais inventée', () => {
  const row = subscriptionRow('11111111-1111-4111-8111-111111111111', { id: 'sub_9', status: 'past_due', customer: { id: 'cus_9' }, cancel_at_period_end: true, current_period_start: 1760000000, current_period_end: 1762592000, items: { data: [{ price: { id: 'price_9' } }] } }, null);
  assert.equal(row.status, 'past_due');
  assert.equal(row.stripe_customer_id, 'cus_9');
  assert.equal(row.plan_id, null);
  assert.equal(row.cancel_at_period_end, true);
});

test('notification administrateur : nom seulement, jamais de contenu', () => {
  assert.equal(
    adminNotificationText('Jean Gomes'),
    'Nouveau dossier ClairDossier créé par Jean Gomes. Connectez-vous à votre espace administrateur pour le consulter.',
  );
  assert.equal(adminNotificationText(null), 'Nouveau dossier ClairDossier créé. Connectez-vous à votre espace administrateur pour le consulter.');
});

test('facture → abonnement, quelle que soit la version d’API du webhook', () => {
  assert.equal(subscriptionIdFromInvoice({ subscription: 'sub_old' }), 'sub_old');
  assert.equal(subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: 'sub_new' } } }), 'sub_new');
  assert.equal(subscriptionIdFromInvoice({ subscription: { id: 'sub_obj' } }), 'sub_obj');
  assert.equal(subscriptionIdFromInvoice({}), null);
});
