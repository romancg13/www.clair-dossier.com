import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plans } from '../src/data/pricing';
import {
  LB13,
  MONTHLY_LINKS,
  YEARLY_LINKS,
  applyLb13,
  collectLb13State,
  couponIdOf,
  expectedInvoiceAmounts,
  planLb13,
} from '../scripts/lib/lb13.mjs';

type Obj = Record<string, any>;

/** Client Stripe simulé : état en mémoire, API minimale utilisée par LB13. */
function fakeStripe(init: { coupons?: Obj[]; codes?: Obj[]; monthlyPromos?: boolean; yearlyPromos?: boolean; portals?: Obj[] } = {}) {
  const products = MONTHLY_LINKS.map((_, i) => `prod_${i}`);
  const links = [
    ...MONTHLY_LINKS.map((url, i) => ({ id: `plink_m${i}`, url, active: true, allow_promotion_codes: init.monthlyPromos ?? true, livemode: true, items: [{ price: { id: `price_m${i}`, product: products[i], recurring: { interval: 'month' } } }] })),
    ...YEARLY_LINKS.map((url, i) => ({ id: `plink_y${i}`, url, active: true, allow_promotion_codes: init.yearlyPromos ?? true, livemode: true, items: [{ price: { id: `price_y${i}`, product: products[i], recurring: { interval: 'year' } } }] })),
  ];
  const coupons: Obj[] = init.coupons ?? [];
  const codes: Obj[] = init.codes ?? [];
  const calls: string[] = [];
  const page = (data: Obj[]) => Promise.resolve({ data, has_more: false });
  let seq = 0;
  const stripe = {
    calls,
    links,
    coupons: {
      list: () => page(coupons),
      create: (p: Obj) => {
        calls.push('coupons.create');
        if (coupons.some((c) => c.id === p.id)) throw new Error('resource_already_exists');
        const c = { object: 'coupon', livemode: true, valid: true, max_redemptions: null, amount_off: null, ...p };
        coupons.push(c);
        return Promise.resolve(c);
      },
    },
    promotionCodes: {
      list: (p: Obj) => page(codes.filter((c) => (p.code ? c.code.toUpperCase() === String(p.code).toUpperCase() : true) && (p.active === undefined || c.active === p.active))),
      create: (p: Obj) => {
        calls.push('promotionCodes.create');
        if (codes.some((c) => c.active && c.code.toUpperCase() === String(p.code).toUpperCase())) throw new Error('code actif déjà existant');
        const pc = { id: `promo_${++seq}`, object: 'promotion_code', livemode: true, customer: null, max_redemptions: null, restrictions: { first_time_transaction: false, minimum_amount: null }, ...p };
        codes.push(pc);
        return Promise.resolve(pc);
      },
      update: (id: string, p: Obj) => {
        calls.push(`promotionCodes.update:${id}`);
        Object.assign(codes.find((c) => c.id === id)!, p);
        return Promise.resolve({});
      },
    },
    paymentLinks: {
      list: () => page(links),
      listLineItems: (id: string) => page(links.find((l) => l.id === id)!.items),
      update: (id: string, p: Obj) => {
        calls.push(`paymentLinks.update:${id}`);
        Object.assign(links.find((l) => l.id === id)!, p);
        return Promise.resolve({});
      },
    },
    billingPortal: { configurations: { list: () => page(init.portals ?? []) } },
  };
  return { stripe, products, coupons, codes };
}

const BEFORE = LB13.deadlineTs - 3 * 24 * 3600; // 2026-09-18
const goodCoupon = (extra: Obj = {}) => ({ id: 'LB13-20PCT-4M', percent_off: 20, amount_off: null, duration: 'repeating', duration_in_months: 4, redeem_by: LB13.deadlineTs, valid: true, max_redemptions: null, livemode: true, metadata: { campagne: 'LB13' }, ...extra });

test('échéance : borne exclusive 21/09/2026 00:00 Paris = 2026-09-20T22:00:00Z', () => {
  assert.equal(Date.parse(LB13.deadlineIso) / 1000, LB13.deadlineTs);
  assert.equal(new Date(LB13.deadlineTs * 1000).toISOString(), '2026-09-20T22:00:00.000Z');
});

test('les liens LB13 sont exactement les Payment Links publiés sur /tarifs', () => {
  const paid = plans.filter((p) => p.priceMonthly !== null && p.ctaHref.startsWith('https://buy.stripe.com/'));
  assert.deepEqual([...MONTHLY_LINKS], paid.map((p) => p.ctaHref));
  assert.deepEqual([...YEARLY_LINKS], paid.map((p) => p.ctaHrefYearly));
});

test('situation LIVE constatée (aucun code) : plan complet, restreint aux formules mensuelles', async () => {
  const f = fakeStripe();
  const plan = planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' }));
  assert.ok(plan.diag.some((d) => d.level === 'error' && /Aucun code promo/.test(d.m)));
  const types = plan.actions.map((a) => a.type);
  assert.deepEqual(types.filter((t) => t.startsWith('create')), ['create_coupon', 'create_promotion_code']);
  const coupon = plan.actions.find((a) => a.type === 'create_coupon')!.params;
  assert.equal(coupon.percent_off, 20);
  assert.equal(coupon.duration, 'repeating');
  assert.equal(coupon.duration_in_months, 4);
  assert.equal(coupon.redeem_by, LB13.deadlineTs);
  assert.equal(coupon.max_redemptions, undefined, 'jamais max_redemptions=4 pour « 4 mois »');
  assert.deepEqual(coupon.applies_to.products.sort(), [...f.products].sort());
  const code = plan.actions.find((a) => a.type === 'create_promotion_code')!.params;
  assert.deepEqual(code.promotion, { type: 'coupon', coupon: 'LB13-20PCT-4M' });
  assert.equal(code.code, 'LB13');
  assert.equal(code.expires_at, LB13.deadlineTs);
  assert.equal(code.restrictions, undefined, 'aucune restriction première commande / minimum');
  assert.equal(types.filter((t) => t === 'disable_link_promotions').length, 6, 'codes retirés des 6 liens annuels (même produit)');
  assert.equal(types.filter((t) => t === 'enable_link_promotions').length, 0);
});

test('application puis relance : conforme, aucun doublon', async () => {
  const f = fakeStripe({ monthlyPromos: false });
  await applyLb13(f.stripe, planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' })));
  const after = planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' }));
  assert.deepEqual(after.actions, []);
  assert.equal(after.diag.filter((d) => d.level === 'error').length, 0);
  assert.ok(f.stripe.links.filter((l) => l.url.includes('V60') && MONTHLY_LINKS.includes(l.url)).every((l) => l.allow_promotion_codes));
  assert.ok(f.stripe.links.filter((l) => YEARLY_LINKS.includes(l.url)).every((l) => !l.allow_promotion_codes));
  const created = f.stripe.calls.length;
  await applyLb13(f.stripe, after);
  assert.equal(f.stripe.calls.length, created, 'relance sans effet');
  assert.equal(f.codes.filter((c) => c.active).length, 1);
});

test('ancien code actif non conforme (échéance 21/09 23:59:59) : désactivé puis remplacé, coupon réutilisé', async () => {
  const f = fakeStripe({
    yearlyPromos: false,
    coupons: [goodCoupon()],
    codes: [{ id: 'promo_old', code: 'lb13', active: true, livemode: true, expires_at: 1790027999, promotion: { type: 'coupon', coupon: 'LB13-20PCT-4M' }, customer: null, max_redemptions: null, restrictions: {} }],
  });
  const plan = planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' }));
  assert.deepEqual(plan.actions.map((a) => a.type), ['deactivate_promotion_code', 'create_promotion_code']);
  await applyLb13(f.stripe, plan);
  assert.equal(f.codes.find((c) => c.id === 'promo_old')!.active, false, 'jamais supprimé, seulement désactivé');
  assert.equal(f.coupons.length, 1);
  assert.deepEqual(planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' })).actions, []);
});

test('coupon mal conçu (max_redemptions=4, sans durée) : nouveau coupon distinct', async () => {
  const f = fakeStripe({ yearlyPromos: false, coupons: [goodCoupon({ max_redemptions: 4, duration: 'once', duration_in_months: null })] });
  const plan = planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' }));
  assert.ok(plan.diag.some((d) => /max_redemptions=4/.test(d.m)));
  assert.equal(plan.actions.find((a) => a.type === 'create_coupon')!.params.id, 'LB13-20PCT-4M-V2');
});

test('produit exclu du coupon ou lien mensuel vendant un prix annuel : détectés', async () => {
  const f = fakeStripe({ yearlyPromos: false, coupons: [goodCoupon({ applies_to: { products: ['prod_0'] } })] });
  f.stripe.links[1].items[0].price.recurring.interval = 'year';
  const plan = planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' }));
  assert.ok(plan.diag.some((d) => /applies_to exclut/.test(d.m)));
  assert.ok(plan.diag.some((d) => d.level === 'error' && /attendu mensuel/.test(d.m)));
});

test("après l'échéance : aucune création ni réactivation", async () => {
  const f = fakeStripe();
  const plan = planLb13(await collectLb13State(f.stripe, { now: LB13.deadlineTs, mode: 'live' }));
  assert.deepEqual(plan.actions, []);
  assert.ok(plan.ended);
});

test('portail : codes promo et passage vers l’annuel signalés', async () => {
  const f = fakeStripe({ portals: [{ id: 'bpc_1', features: { subscription_update: { enabled: true, default_allowed_updates: ['price', 'promotion_code'], products: [{ product: 'prod_0', prices: ['price_m0', 'price_y0'] }] } } }] });
  const plan = planLb13(await collectLb13State(f.stripe, { now: BEFORE, mode: 'live' }));
  assert.ok(plan.diag.some((d) => /saisie de codes promo autorisée/.test(d.m)));
  assert.ok(plan.diag.some((d) => /mensuel → annuel/.test(d.m)));
});

test('rattachement coupon lisible dans les deux versions d’API', () => {
  assert.equal(couponIdOf({ promotion: { type: 'coupon', coupon: 'c1' } }), 'c1');
  assert.equal(couponIdOf({ coupon: { id: 'c2' } }), 'c2');
});

test('montants : Essentiel 19 € → 4 × 15,20 € puis 19 € ; toutes les formules', () => {
  assert.deepEqual(expectedInvoiceAmounts(1900), [1520, 1520, 1520, 1520, 1900]);
  for (const p of plans.filter((x) => x.priceMonthly)) {
    const [first, , , fourth, fifth] = expectedInvoiceAmounts(p.priceMonthly! * 100);
    assert.equal(first, Math.round(p.priceMonthly! * 80));
    assert.equal(fourth, first);
    assert.equal(fifth, p.priceMonthly! * 100);
  }
});

test('site et Stripe partagent les mêmes conditions (promo.ts ↔ scripts/lib/lb13.mjs)', async () => {
  const promo = await import('../src/data/promo');
  assert.equal(promo.LB13_OFFER.code, LB13.code);
  assert.equal(promo.LB13_OFFER.percentOff, LB13.percentOff);
  assert.equal(promo.LB13_OFFER.months, LB13.durationInMonths);
  assert.equal(promo.LB13_DEADLINE_MS, LB13.deadlineTs * 1000);
  assert.equal(promo.LB13_LIVE_VERIFIED, false, 'non vérifié par défaut');
  assert.equal(promo.lb13Phase(LB13.deadlineTs * 1000 - 1, false), 'pending');
  assert.equal(promo.lb13Phase(LB13.deadlineTs * 1000 - 1, true), 'active');
  assert.equal(promo.lb13Phase(LB13.deadlineTs * 1000, true), 'ended');
  assert.equal(promo.lb13DiscountedMonthly(19), 15.2);
  const link = MONTHLY_LINKS[0];
  assert.equal(promo.withLb13Prefill(link, { monthly: true, intent: true, phase: 'pending' }), link, 'pas de préremplissage non vérifié');
  assert.equal(promo.withLb13Prefill(YEARLY_LINKS[0], { monthly: false, intent: true, phase: 'active' }), YEARLY_LINKS[0], 'jamais sur l’annuel');
  assert.equal(new URL(promo.withLb13Prefill(link, { monthly: true, intent: true, phase: 'active' })).searchParams.get('prefilled_promo_code'), 'LB13');
});
