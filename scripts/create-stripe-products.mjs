#!/usr/bin/env node
/**
 * (Re)crée les produits payants ClairDossier dans Stripe :
 *  - archive d'abord les anciens produits + Payment Links (metadata.source)
 *  - crée 1 produit + 1 prix mensuel EUR + 1 Payment Link par plan
 *  - affiche les Payment Link URLs à coller dans src/data/pricing.ts
 *
 * USAGE :
 *   export STRIPE_SECRET_KEY=sk_live_... | rk_live_...   (clé restreinte OK)
 *   node scripts/create-stripe-products.mjs
 *
 * Idempotent : relancer archive les anciens avant de recréer (pas de doublon
 * de liens actifs). Cible : PME, artisans, entreprises individuelles, prof. libérales.
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('\n❌ STRIPE_SECRET_KEY non défini.');
  process.exit(1);
}
if (!/^(sk|rk)_(test|live)_/.test(KEY)) {
  console.error('\n❌ La clé doit commencer par sk_test_/sk_live_ ou rk_test_/rk_live_. Reçue :', KEY.slice(0, 8) + '...');
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: '2024-12-18.acacia' });
const SOURCE = 'clair-dossier-showcase';
const SITE_URL = 'https://www.clair-dossier.com';

// Grille tarifaire 2026 — alignée sur src/data/pricing.ts.
// Le plan « sur devis » n'est pas inclus (pas de paiement automatisé).
// Descriptions limitées aux capacités réellement livrées (invariant I10) : volume de
// dossiers, utilisateurs, support. Les produits déjà créés sur Stripe doivent être
// mis à jour manuellement dans le dashboard (cf. DECISIONS.md D-003).
const PLANS = [
  { planId: 'essentiel', name: 'ClairDossier — Essentiel', monthlyEuros: 19,
    description: "Pour les indépendants et entrepreneurs individuels qui structurent leurs premiers dossiers. 5 dossiers, 1 utilisateur, support e-mail." },
  { planId: 'entrepreneur', name: 'ClairDossier — Entrepreneur', monthlyEuros: 39,
    description: "Pour les entrepreneurs et professions libérales avec un flux régulier de dossiers. 10 dossiers, 2 utilisateurs, support e-mail prioritaire." },
  { planId: 'business-pme-20', name: 'ClairDossier — Business PME 20', monthlyEuros: 49,
    description: "Pour les TPE/PME. 20 dossiers, 5 utilisateurs, support prioritaire." },
  { planId: 'business-pme-50', name: 'ClairDossier — Business PME 50', monthlyEuros: 89,
    description: "Pour les PME avec plusieurs dossiers en parallèle. 50 dossiers, 5 utilisateurs, support prioritaire." },
  { planId: 'business-pme-pro', name: 'ClairDossier — Business / PME Pro', monthlyEuros: 169,
    description: "Pour les structures multi-collaborateurs. Dossiers illimités, 15 utilisateurs, support dédié." },
  { planId: 'business-pme-premium', name: 'ClairDossier — Business / PME Premium', monthlyEuros: 299,
    description: "Pour les entreprises. Dossiers et utilisateurs illimités, support entreprise." },
];

async function archiveOld() {
  let archivedLinks = 0;
  let archivedProducts = 0;
  // Désactive les anciens Payment Links (tous les nôtres ont metadata.planId).
  for await (const link of stripe.paymentLinks.list({ active: true, limit: 100 })) {
    if (link.metadata?.planId || link.metadata?.source === SOURCE) {
      try { await stripe.paymentLinks.update(link.id, { active: false }); archivedLinks++; } catch (e) { /* noop */ }
    }
  }
  // Archive les anciens produits.
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.metadata?.source === SOURCE) {
      try { await stripe.products.update(product.id, { active: false }); archivedProducts++; } catch (e) { /* noop */ }
    }
  }
  console.log(`Archivé : ${archivedProducts} produit(s), ${archivedLinks} Payment Link(s).`);
}

async function createPlanFlow(plan) {
  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: { planId: plan.planId, source: SOURCE },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.monthlyEuros * 100,
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { planId: plan.planId },
  });
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: {
      type: 'redirect',
      redirect: { url: `${SITE_URL}/compte?paid=${encodeURIComponent(plan.planId)}` },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    payment_method_collection: 'always',
    metadata: { planId: plan.planId, source: SOURCE },
  });
  console.log(`   ✓ ${plan.planId.padEnd(22)} ${product.id} | ${price.id} | ${paymentLink.url}`);
  return { planId: plan.planId, productId: product.id, priceId: price.id, paymentLinkUrl: paymentLink.url };
}

async function main() {
  console.log(`Mode : ${KEY.includes('_live_') ? '🔴 LIVE' : '🟢 TEST'}`);
  await archiveOld();
  console.log('\nCréation des nouveaux produits :');
  const results = [];
  for (const plan of PLANS) {
    try { results.push(await createPlanFlow(plan)); }
    catch (err) { console.error(`   ❌ ${plan.planId} :`, err.message); }
  }
  console.log('\n──────────── PAYMENT LINKS (à coller dans pricing.ts) ────────────');
  console.log(JSON.stringify(Object.fromEntries(results.map((r) => [r.planId, r.paymentLinkUrl])), null, 2));
  console.log('──────────────────────────────────────────────────────────────────\n');
}

main().catch((err) => { console.error('\n❌ Erreur fatale :', err.message); process.exit(1); });
