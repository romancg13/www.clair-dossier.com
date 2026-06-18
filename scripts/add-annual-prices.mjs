#!/usr/bin/env node
/**
 * Ajoute un prix ANNUEL (récurrent, interval=year, total = mensuel x 12 x 0.9)
 * + un Payment Link annuel à chaque produit ClairDossier existant.
 * À lancer UNE fois (non idempotent : relancer crée des doublons de prix).
 *
 *   export STRIPE_SECRET_KEY=rk_live_... && node scripts/add-annual-prices.mjs
 */
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY || !/^(sk|rk)_(test|live)_/.test(KEY)) {
  console.error('❌ STRIPE_SECRET_KEY invalide.');
  process.exit(1);
}
const stripe = new Stripe(KEY, { apiVersion: '2024-12-18.acacia' });
const SOURCE = 'clair-dossier-showcase';
const SITE_URL = 'https://www.clair-dossier.com';

// Mensuel HT par plan — aligné sur src/data/pricing.ts.
const MONTHLY = {
  essentiel: 19,
  entrepreneur: 39,
  'business-pme-20': 49,
  'business-pme-50': 89,
  'business-pme-pro': 169,
  'business-pme-premium': 299,
};

async function main() {
  console.log(`Mode : ${KEY.includes('_live_') ? '🔴 LIVE' : '🟢 TEST'}`);
  const products = {};
  for await (const p of stripe.products.list({ active: true, limit: 100 })) {
    if (p.metadata?.source === SOURCE && p.metadata?.planId) products[p.metadata.planId] = p.id;
  }
  const out = {};
  for (const [planId, monthly] of Object.entries(MONTHLY)) {
    const productId = products[planId];
    if (!productId) {
      console.error(`   ❌ produit introuvable pour ${planId}`);
      continue;
    }
    const annualCents = Math.round(monthly * 12 * 0.9 * 100);
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: annualCents,
      currency: 'eur',
      recurring: { interval: 'year' },
      metadata: { planId, billing: 'yearly' },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: {
        type: 'redirect',
        redirect: { url: `${SITE_URL}/compte?paid=${encodeURIComponent(planId)}` },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_collection: 'always',
      metadata: { planId, source: SOURCE, billing: 'yearly' },
    });
    out[planId] = link.url;
    console.log(`   ✓ ${planId.padEnd(22)} ${annualCents / 100} €/an  ${link.url}`);
  }
  console.log('\n──────────── ANNUAL PAYMENT LINKS ────────────');
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('\n❌ Erreur :', err.message);
  process.exit(1);
});
