// Crée la promo LB13 : −20 % pendant 4 mois sur tout abonnement mensuel,
// code à activer (redeem) avant le 21 septembre 2026, puis active le code
// promo sur les 6 Payment Links mensuels.
//
// USAGE (ta clé n'est jamais vue par l'assistant) :
//   export STRIPE_SECRET_KEY=sk_live_... | rk_live_...   (clé restreinte OK)
//   node scripts/create-lb13-promo.mjs
//
// Idempotent : si le code promo LB13 existe déjà, on ne le recrée pas.

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error(
    "\n❌ STRIPE_SECRET_KEY non défini. export STRIPE_SECRET_KEY=... puis relance.\n",
  );
  process.exit(1);
}
if (!/^(sk|rk)_(test|live)_/.test(KEY)) {
  console.error(
    "\n❌ Clé invalide (attendu sk_/rk_ test|live). Reçue :",
    KEY.slice(0, 8) + "...\n",
  );
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: "2024-12-18.acacia" });

const CODE = "LB13";
const PERCENT_OFF = 20;
const DURATION_MONTHS = 4;
// Le code doit être utilisable AVANT le 21 septembre 2026 (heure de Paris, CEST = UTC+2).
const EXPIRES_AT = Math.floor(
  new Date("2026-09-21T23:59:59+02:00").getTime() / 1000,
);

// Les 6 Payment Links MENSUELS (la promo porte sur l'abonnement mensuel).
const MONTHLY_LINKS = [
  "https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605", // Essentiel 19
  "https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606", // Entrepreneur 39
  "https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607", // Business PME 20 (49)
  "https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608", // Business PME 50 (89)
  "https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609", // Business PME Pro (169)
  "https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a", // Business PME Premium (299)
];

async function main() {
  // 1) Le code promo existe déjà ?
  const existing = await stripe.promotionCodes.list({ code: CODE, limit: 1 });
  if (existing.data.length > 0) {
    console.log(
      `ℹ️  Le code promo ${CODE} existe déjà (${existing.data[0].id}) — pas recréé.`,
    );
  } else {
    // 2) Coupon −20 % répété sur 4 mois.
    const coupon = await stripe.coupons.create({
      percent_off: PERCENT_OFF,
      duration: "repeating",
      duration_in_months: DURATION_MONTHS,
      name: `LB13 −${PERCENT_OFF}% pendant ${DURATION_MONTHS} mois`,
      metadata: { campagne: "LB13", partenaire: "P1000 Allauch by LB13" },
    });
    console.log(
      `✅ Coupon créé : ${coupon.id} (−${PERCENT_OFF}% x ${DURATION_MONTHS} mois)`,
    );

    // 3) Code promo LB13, à redeem avant le 21 sept.
    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: CODE,
      expires_at: EXPIRES_AT,
      active: true,
      metadata: { campagne: "LB13" },
    });
    console.log(
      `✅ Code promo créé : ${promo.code} (${promo.id}), expire le 21/09/2026.`,
    );
  }

  // 4) Active la saisie du code sur les Payment Links mensuels.
  const all = [];
  let params = { limit: 100 };
  // Pagination simple.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await stripe.paymentLinks.list(params);
    all.push(...page.data);
    if (!page.has_more) break;
    params = { ...params, starting_after: page.data[page.data.length - 1].id };
  }
  const byUrl = new Map(all.map((pl) => [pl.url, pl]));

  for (const url of MONTHLY_LINKS) {
    const pl = byUrl.get(url);
    if (!pl) {
      console.warn(
        `⚠️  Payment Link introuvable pour ${url} — active "Autoriser les codes promo" à la main dans le dashboard.`,
      );
      continue;
    }
    if (pl.allow_promotion_codes) {
      console.log(`ℹ️  ${pl.id} accepte déjà les codes promo.`);
      continue;
    }
    try {
      await stripe.paymentLinks.update(pl.id, { allow_promotion_codes: true });
      console.log(`✅ Codes promo activés sur ${pl.id} (${url}).`);
    } catch (e) {
      console.warn(
        `⚠️  Impossible d'activer via l'API sur ${pl.id} (${e.message}). Fais-le dans le dashboard : Payment Link > "Autoriser les codes promo".`,
      );
    }
  }

  console.log(
    "\n🎉 Terminé. Le code LB13 donne −20 % pendant 4 mois sur les abonnements mensuels, jusqu'au 21/09/2026.\n",
  );
}

main().catch((e) => {
  console.error("\n❌ Échec :", e.message, "\n");
  process.exit(1);
});
