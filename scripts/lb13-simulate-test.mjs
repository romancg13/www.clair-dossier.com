// Simulation LB13 en mode TEST Stripe (refuse toute clé LIVE) : applique la
// configuration LB13 dans le compte de test, crée un client sur une horloge de
// test, souscrit la formule mensuelle Essentiel avec le code LB13, avance
// l'horloge de 5 mois et vérifie les montants : 4 × 15,20 € puis 19,00 €.
//
//   export STRIPE_SECRET_KEY=sk_test_…
//   node scripts/lb13-simulate-test.mjs
//
// Hors taxes (aucune taxe automatique sur l'abonnement simulé), sans prorata
// ni essai. Les objets de test (horloge, client, abonnement) sont supprimés à
// la fin ; le coupon et le code LB13 de TEST sont conservés.

import Stripe from 'stripe';
import { LB13, applyLb13, collectLb13State, expectedInvoiceAmounts, planLb13 } from './lib/lb13.mjs';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY || !/^(sk|rk)_test_/.test(KEY)) {
  console.error('\n❌ Clé de TEST requise (sk_test_… / rk_test_…). Une clé LIVE est refusée.\n');
  process.exit(1);
}
const stripe = new Stripe(KEY);
const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: Boolean(cond) });
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

async function waitReady(clockId) {
  for (let i = 0; i < 60; i += 1) {
    const c = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (c.status === 'ready') return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('horloge de test non prête après 120 s');
}

function addMonthsUtc(ts, n) {
  const d = new Date(ts * 1000);
  d.setUTCMonth(d.getUTCMonth() + n);
  return Math.floor(d.getTime() / 1000);
}

async function monthlyEssentielPrice() {
  for await (const p of stripe.prices.list({ active: true, type: 'recurring', expand: ['data.product'], limit: 100 })) {
    const plan = p.metadata?.planId ?? (typeof p.product === 'object' ? p.product.metadata?.planId : undefined);
    if (plan === 'essentiel' && p.recurring?.interval === 'month' && p.unit_amount === 1900 && p.currency === 'eur') return p;
  }
  const product = await stripe.products.create({ name: 'ClairDossier — Essentiel (simulation LB13)', metadata: { planId: 'essentiel', lb13_simulation: 'true' } });
  return stripe.prices.create({ product: product.id, unit_amount: 1900, currency: 'eur', recurring: { interval: 'month' }, metadata: { planId: 'essentiel', lb13_simulation: 'true' } });
}

async function main() {
  const now = Math.floor(Date.now() / 1000);
  if (now >= LB13.deadlineTs) console.log('ℹ️  Échéance réelle dépassée : la simulation utilise un code de test sans échéance réelle bloquante.');

  // 1) Configuration LB13 dans le compte de TEST (même logique que la prod).
  const state = await collectLb13State(stripe, { now, mode: 'test' });
  const plan = planLb13(state);
  plan.actions = plan.actions.filter((a) => !a.type.endsWith('link_promotions'));
  if (plan.actions.length) await applyLb13(stripe, plan, (m) => console.log(`   ✓ ${m}`));

  // 2) Recherche du code : casse indifférente, code inconnu refusé.
  const variants = ['LB13', 'lb13', 'Lb13'];
  const found = [];
  for (const v of variants) found.push((await stripe.promotionCodes.list({ code: v, active: true, limit: 1 })).data[0]?.id ?? null);
  check('LB13 trouvé quelle que soit la casse', found.every((id) => id && id === found[0]), found.join(' / '));
  const unknown = (await stripe.promotionCodes.list({ code: 'LB14', active: true, limit: 1 })).data.length;
  check('code inconnu absent', unknown === 0);
  const promo = await stripe.promotionCodes.retrieve(found[0]);

  // 3) Abonnement mensuel Essentiel sur horloge de test.
  const price = await monthlyEssentielPrice();
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: now, name: 'Simulation LB13' });
  try {
    const customer = await stripe.customers.create({ email: 'simulation-lb13@example.com', test_clock: clock.id, payment_method: 'pm_card_visa', invoice_settings: { default_payment_method: 'pm_card_visa' } });
    const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: price.id }], discounts: [{ promotion_code: promo.id }] });
    for (let m = 1; m <= LB13.durationInMonths; m += 1) {
      await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: addMonthsUtc(now, m) + 3600 });
      await waitReady(clock.id);
    }
    const invoices = [];
    for await (const inv of stripe.invoices.list({ customer: customer.id, limit: 100 })) invoices.push(inv);
    invoices.sort((a, b) => a.created - b.created);
    const amounts = invoices.map((i) => i.total);
    const expected = expectedInvoiceAmounts(price.unit_amount);
    check('4 mensualités à 15,20 € puis retour à 19,00 €', JSON.stringify(amounts.slice(0, expected.length)) === JSON.stringify(expected), `obtenu ${amounts.join(', ')} · attendu ${expected.join(', ')}`);
    const refreshed = await stripe.subscriptions.retrieve(sub.id);
    check('abonnement toujours au prix de base (aucun prix réduit créé)', refreshed.items.data[0].price.id === price.id && refreshed.items.data[0].price.unit_amount === 1900);
    check('remise terminée après 4 mois', !(refreshed.discounts ?? []).length);
  } finally {
    await stripe.testHelpers.testClocks.del(clock.id).catch(() => {});
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies (mode TEST).`);
  process.exit(failed ? 2 : 0);
}

main().catch((e) => {
  console.error('\n❌ Échec :', e?.message ?? e, '\n');
  process.exit(1);
});
