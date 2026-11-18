import assert from 'node:assert/strict';
import test from 'node:test';
import { cohortConversion, computeRevenue, formatCents, monthlyCents, type RevenueRow } from '../src/lib/revenue.ts';
import { isMissingColumn, priceTerms } from '../supabase/functions/_shared/stripe-sync.ts';

const NOW = new Date('2026-10-12T12:00:00Z');
const row = (over: Partial<RevenueRow>): RevenueRow => ({
  status: 'active', plan_id: 'essentiel', unit_amount: 1900, currency: 'eur', billing_interval: 'month',
  interval_count: 1, quantity: 1, cancel_at_period_end: false, canceled_at: null, created_at: '2026-01-01T00:00:00Z', ...over,
});

test('MRR : mensuel tel quel, annuel ramené au mois, quantité prise en compte', () => {
  assert.equal(monthlyCents(row({})), 1900);
  assert.equal(monthlyCents(row({ unit_amount: 20520, billing_interval: 'year' })), 1710);
  assert.equal(monthlyCents(row({ quantity: 2 })), 3800);
  assert.equal(monthlyCents(row({ unit_amount: null })), null);
});

test('synthèse : actifs, impayés à risque, essais exclus, résiliations et attrition 30 j', () => {
  const s = computeRevenue([
    row({}),
    row({ plan_id: 'entrepreneur', unit_amount: 3900, cancel_at_period_end: true, created_at: '2026-10-01T00:00:00Z' }),
    row({ status: 'past_due', unit_amount: 3900 }),
    row({ status: 'trialing' }),
    row({ status: 'canceled', canceled_at: '2026-10-05T00:00:00Z' }),
    row({ status: 'canceled', canceled_at: '2026-05-05T00:00:00Z' }),
  ], NOW);
  assert.equal(s.mrrCents, 5800);
  assert.equal(s.arrCents, 69600);
  assert.equal(s.atRiskCents, 3900);
  assert.equal(s.active, 2);
  assert.equal(s.trialing, 1);
  assert.equal(s.pastDue, 1);
  assert.equal(s.cancelingAtPeriodEnd, 1);
  assert.equal(s.canceled30d, 1);
  assert.equal(s.new30d, 1);
  assert.equal(s.churnRate30d, 1 / 3);
  assert.deepEqual(s.byPlan.map((p) => p.planId), ['entrepreneur', 'essentiel']);
});

test('aucune estimation : une ligne sans montant est comptée à part, hors MRR', () => {
  const s = computeRevenue([row({ unit_amount: null }), row({})], NOW);
  assert.equal(s.mrrCents, 1900);
  assert.equal(s.missingAmount, 1);
  assert.equal(computeRevenue([], NOW).churnRate30d, null);
});

test('impayé sans montant : MRR à risque inconnu, jamais 0 € affiché à tort', () => {
  const s = computeRevenue([row({}), row({ status: 'past_due', unit_amount: null })], NOW);
  assert.equal(s.mrrCents, 1900);
  assert.equal(s.missingAtRisk, 1);
  assert.equal(s.missingAmount, 0);
});

test('nouveaux abonnements : payants seulement (essai ou résiliation récents exclus)', () => {
  const recent = '2026-10-05T00:00:00Z';
  const s = computeRevenue([
    row({ created_at: recent }),
    row({ status: 'trialing', created_at: recent }),
    row({ status: 'canceled', created_at: recent, canceled_at: '2026-10-06T00:00:00Z' }),
  ], NOW);
  assert.equal(s.new30d, 1);
});

test('devises : aucune addition entre devises, lignes étrangères comptées à part', () => {
  const s = computeRevenue([row({}), row({ currency: 'usd', unit_amount: 5000 }), row({ status: 'canceled', currency: 'usd' })], NOW);
  assert.equal(s.mrrCents, 1900);
  assert.equal(s.otherCurrency, 1);
  assert.equal(s.currency, 'eur');
});

test('conversion de cohorte : seuls les inscrits de la période, jamais plus de 100 %', () => {
  const rows = [row({ user_id: 'a' }), row({ user_id: 'old' }), row({ user_id: 'b', status: 'trialing' })];
  assert.equal(cohortConversion(rows, ['a', 'b']), 0.5);
  assert.equal(cohortConversion(rows, []), null);
  assert.ok((cohortConversion(rows, ['a']) ?? 0) <= 1);
});

test('montants affichés au centime', () => {
  assert.equal(formatCents(1710).replace(/\s/g, ' '), '17,10 €');
});

test('webhook : conditions tarifaires copiées de Stripe, repli si la migration manque', () => {
  const terms = priceTerms({
    id: 'sub_1', status: 'active', customer: 'cus_1',
    items: { data: [{ quantity: 1, price: { id: 'price_1', unit_amount: 3900, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } } }] },
  });
  assert.deepEqual(terms, { unit_amount: 3900, currency: 'eur', billing_interval: 'month', interval_count: 1, quantity: 1 });
  assert.deepEqual(priceTerms({ id: 'sub_2', status: 'active', customer: 'cus_2' }), {
    unit_amount: null, currency: null, billing_interval: null, interval_count: null, quantity: null,
  });
  assert.ok(isMissingColumn('PGRST204') && isMissingColumn('42703') && !isMissingColumn('23505'));
});

test('webhook : plusieurs lignes de même périodicité totalisées, sinon aucun montant', () => {
  const price = (amount: number, interval = 'month') => ({ unit_amount: amount, currency: 'eur', recurring: { interval, interval_count: 1 } });
  const multi = priceTerms({ id: 's', status: 'active', customer: 'c', items: { data: [{ quantity: 2, price: price(1000) }, { quantity: 1, price: price(500) }] } });
  assert.deepEqual(multi, { unit_amount: 2500, currency: 'eur', billing_interval: 'month', interval_count: 1, quantity: 1 });
  const mixed = priceTerms({ id: 's', status: 'active', customer: 'c', items: { data: [{ price: price(1000) }, { price: price(9000, 'year') }] } });
  assert.equal(mixed.unit_amount, null);
});
