#!/usr/bin/env node
/**
 * Crée les 5 produits payants ClairDossier dans ton compte Stripe, avec :
 *  - 1 produit par plan
 *  - 1 prix mensuel récurrent en EUR
 *  - 1 Payment Link prêt à coller dans pricing.ts (ctaHref)
 *
 * USAGE (depuis la racine du repo clair-dossier) :
 *
 *   1. Récupère ta clé secrète depuis https://dashboard.stripe.com/apikeys
 *      (commence par sk_live_... pour la prod, ou sk_test_... pour tester)
 *
 *   2. Exporte-la en variable d'env (NE LA COMMITS JAMAIS) :
 *
 *        export STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
 *
 *   3. Installe Stripe SDK localement (déjà fait si tu lances depuis ce repo) :
 *
 *        npm install --no-save stripe@latest
 *
 *   4. Lance le script :
 *
 *        node scripts/create-stripe-products.mjs
 *
 *      Le script affiche les Payment Link URLs à la fin. Copie-les
 *      moi en chat (ces URLs publiques sont SAFE à partager — elles
 *      ne donnent que l'écran de paiement, pas l'API).
 *
 *   5. Si tu veux supprimer les produits créés (test), repasse en mode
 *      'archive' dans le dashboard (Products → ... → Archive).
 *
 * Le script est idempotent au niveau Stripe : si tu le relances, il
 * crée de nouveaux produits/prix (pas de dédoublonnage automatique).
 * Donc lance-le UNE fois en prod.
 */

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('\n❌ STRIPE_SECRET_KEY non défini.');
  console.error('Lance :  export STRIPE_SECRET_KEY=sk_test_... && node scripts/create-stripe-products.mjs\n');
  process.exit(1);
}

if (!/^sk_(test|live)_/.test(KEY)) {
  console.error('\n❌ La clé doit commencer par sk_test_ ou sk_live_. Reçue :', KEY.slice(0, 8) + '...');
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: '2024-12-18.acacia' });

// Plans à créer — alignés sur src/data/pricing.ts.
// Le plan Découverte (gratuit) et Cabinet Premium (sur devis) ne sont pas
// inclus : pas de paiement automatisé pour eux.
const PLANS = [
  {
    planId: 'client-essentiel',
    name: 'ClairDossier — Client Essentiel',
    description: 'Pour les particuliers et indépendants qui suivent leurs dossiers en autonomie. 5 dossiers, 1 utilisateur, support email, résumé IA limité.',
    monthlyEuros: 19,
  },
  {
    planId: 'business-pme',
    name: 'ClairDossier — Business / PME',
    description: 'Pour les PME avec plusieurs dossiers récurrents et des équipes internes. 20 dossiers, 5 utilisateurs, support prioritaire, résumé IA + rédaction limitée, modèles, récurrents.',
    monthlyEuros: 49,
  },
  {
    planId: 'cabinet-solo',
    name: 'ClairDossier — Cabinet Solo',
    description: "Pour les avocats indépendants. 50 dossiers, 3 utilisateurs, support prioritaire, IA complète (résumé + rédaction).",
    monthlyEuros: 79,
  },
  {
    planId: 'cabinet-pro',
    name: 'ClairDossier — Cabinet Pro',
    description: 'Pour les cabinets multi-avocats avec statistiques avancées et workflows. Dossiers illimités, 15 utilisateurs, support dédié, IA complète incluant GPT-4o.',
    monthlyEuros: 149,
  },
  {
    planId: 'cabinet-premium',
    name: 'ClairDossier — Cabinet Premium',
    description: 'Solution entreprise : marque blanche, API, SSO, audit avancé. Utilisateurs et dossiers illimités, support entreprise.',
    monthlyEuros: 299,
  },
];

const SITE_URL = 'https://www.clair-dossier.com';

async function createPlanFlow(plan) {
  console.log(`\n→ ${plan.planId} (${plan.monthlyEuros} €/mois)...`);

  // 1. Product
  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: {
      planId: plan.planId,
      source: 'clair-dossier-showcase',
    },
  });

  // 2. Recurring price (EUR, monthly)
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.monthlyEuros * 100,
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { planId: plan.planId },
  });

  // 3. Payment Link (ce qu'on colle dans pricing.ts ctaHref)
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: {
      type: 'redirect',
      redirect: { url: `${SITE_URL}/?paid=${encodeURIComponent(plan.planId)}` },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    payment_method_collection: 'always',
    metadata: { planId: plan.planId },
  });

  console.log(`   ✓ Product   : ${product.id}`);
  console.log(`   ✓ Price     : ${price.id}`);
  console.log(`   ✓ Payment   : ${paymentLink.url}`);

  return {
    planId: plan.planId,
    productId: product.id,
    priceId: price.id,
    paymentLinkUrl: paymentLink.url,
  };
}

async function main() {
  console.log('Création des produits ClairDossier sur Stripe.');
  console.log(`Mode : ${KEY.startsWith('sk_live_') ? '🔴 LIVE' : '🟢 TEST'}`);

  const results = [];
  for (const plan of PLANS) {
    try {
      results.push(await createPlanFlow(plan));
    } catch (err) {
      console.error(`   ❌ Erreur sur ${plan.planId} :`, err.message);
      // continue avec les suivants
    }
  }

  console.log('\n\n──────────── À COLLER DANS LE CHAT ────────────');
  console.log('Voici les Payment Link URLs (safe à partager) :\n');
  for (const r of results) {
    console.log(`  ${r.planId.padEnd(20)} → ${r.paymentLinkUrl}`);
  }

  console.log('\nJe mettrai à jour src/data/pricing.ts avec ces URLs.');
  console.log('────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('\n❌ Erreur fatale :', err.message);
  process.exit(1);
});
