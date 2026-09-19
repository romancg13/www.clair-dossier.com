// LB13 — diagnostic puis mise en service idempotente de l'offre
// « −20 % pendant 4 mois sur les formules mensuelles, code à saisir avant le
// 21 septembre 2026 » (borne exclusive : 21/09/2026 00:00 Europe/Paris).
//
// USAGE (la clé n'est jamais affichée ni écrite) :
//   export STRIPE_SECRET_KEY=rk_live_…   # clé restreinte recommandée (voir plus bas)
//   node scripts/create-lb13-promo.mjs            # 1) DIAGNOSTIC seul, aucune écriture
//   node scripts/create-lb13-promo.mjs --apply    # 2) applique le plan affiché, puis relit
//   node scripts/create-lb13-promo.mjs --keep-annual-promos --apply
//        (ne touche pas aux liens annuels ; LB13 resterait alors saisissable en annuel)
//
// Droits minimaux d'une clé restreinte : Coupons (écriture), Promotion codes
// (écriture), Payment Links (écriture), Prices/Products (lecture),
// Customer portal (lecture). Rien n'est jamais supprimé : un ancien code non
// conforme est seulement désactivé (active=false) — les remises déjà
// acquises continuent. Relancer le script ne crée aucun doublon.
//
// Version d'API : celle du SDK installé (stripe@22 → 2026-08-26.dahlia), où un
// code promo se rattache au coupon par promotion: { type: 'coupon', coupon }.

import Stripe from 'stripe';
import { LB13, applyLb13, collectLb13State, couponIdOf, planLb13 } from './lib/lb13.mjs';
import { stripeKey } from './lib/credentials.mjs';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const found = stripeKey(args.has('--test') ? 'test' : 'live');
const KEY = found?.key;
if (!KEY || !/^(sk|rk)_(test|live)_/.test(KEY)) {
  console.error('\n❌ Aucune clé Stripe : `stripe login` (session réutilisée) ou export STRIPE_SECRET_KEY=… puis relance.\n');
  process.exit(1);
}
const mode = KEY.includes('_live_') ? 'live' : 'test';
const stripe = new Stripe(KEY, { maxNetworkRetries: 2 });
const now = Math.floor(Date.now() / 1000);

function print(plan) {
  const icon = { ok: '✅', warn: '⚠️ ', error: '❌' };
  for (const d of plan.diag) console.log(`${icon[d.level]} ${d.m}`);
  if (!plan.actions.length) {
    console.log('\n→ Aucune action nécessaire.');
    return;
  }
  console.log(`\n→ Plan (${plan.actions.length} action(s)) :`);
  for (const a of plan.actions) {
    const what = a.type === 'create_coupon'
      ? `créer le coupon ${a.params.id} (−${a.params.percent_off} %, repeating ${a.params.duration_in_months} mois, redeem_by ${LB13.deadlineIso}, ${a.params.applies_to?.products?.length ?? 0} produit(s))`
      : a.type === 'create_promotion_code'
        ? `créer le code « ${a.params.code} » → coupon ${a.params.promotion.coupon}, expire le ${LB13.deadlineIso}`
        : a.type === 'deactivate_promotion_code'
          ? `désactiver le code non conforme ${a.id}`
          : `${a.type === 'enable_link_promotions' ? 'autoriser' : 'retirer'} les codes promo sur ${a.url}`;
    console.log(`   • ${what}`);
  }
}

async function main() {
  let account = 'non lisible avec cette clé (droit « Account » absent)';
  try {
    const acct = await stripe.accounts.retrieve();
    account = `${acct.id}${acct.settings?.dashboard?.display_name ? ` (${acct.settings.dashboard.display_name})` : ''}`;
  } catch {
    /* clé restreinte sans lecture du compte : le mode suffit au diagnostic */
  }
  console.log(`\nCompte Stripe : ${account} · clé : ${found.source}`);
  console.log(`Mode : ${mode === 'live' ? '🔴 LIVE' : '🟢 TEST'} · échéance ${LB13.deadlineIso} (timestamp ${LB13.deadlineTs}) · ${APPLY ? 'APPLICATION' : 'DIAGNOSTIC (lecture seule)'}\n`);

  const state = await collectLb13State(stripe, { now, mode });
  if (!state.portalsReadable) console.log('⚠️  Configuration du portail client non lisible avec cette clé : vérifier au Dashboard (changement d\'offre et codes promo).');
  const mismatch = [...state.coupons, ...state.promotionCodes].find((o) => o.livemode !== (mode === 'live'));
  if (mismatch) throw new Error(`objet ${mismatch.id} dans un mode différent de la clé`);

  let plan = planLb13(state);
  if (args.has('--keep-annual-promos')) plan.actions = plan.actions.filter((a) => a.type !== 'disable_link_promotions');
  print(plan);

  if (!APPLY) {
    console.log('\nDiagnostic seul. Relancer avec --apply pour exécuter exactement ce plan.\n');
    return;
  }
  if (!plan.actions.length) return;
  await applyLb13(stripe, plan, (m) => console.log(`   ✓ ${m}`));

  console.log('\nRelecture après application…');
  const after = await collectLb13State(stripe, { now: Math.floor(Date.now() / 1000), mode });
  plan = planLb13(after);
  if (args.has('--keep-annual-promos')) plan.actions = plan.actions.filter((a) => a.type !== 'disable_link_promotions');
  print(plan);
  const live = after.promotionCodes.find((pc) => pc.active && String(pc.code).toUpperCase() === LB13.code);
  if (live) {
    console.log(`\nPreuve : code « ${live.code} » = ${live.id} · coupon ${couponIdOf(live)} · livemode=${live.livemode} · expires_at=${live.expires_at}`);
  }
  if (plan.actions.length || plan.diag.some((d) => d.level === 'error')) {
    console.error('\n❌ État final non conforme : voir ci-dessus.\n');
    process.exit(2);
  }
  console.log('\n🎉 LB13 conforme. Vérifier ensuite sur www.clair-dossier.com/tarifs : Checkout mensuel → saisir LB13 → total remisé AVANT paiement (ne pas payer).');
  console.log('   Puis GitHub → Settings → Variables → VITE_LB13_LIVE=true et relancer le déploiement (le site cesse d\'afficher « mise en service en cours »).\n');
}

main().catch((e) => {
  console.error('\n❌ Échec :', e?.message ?? e, '\n');
  process.exit(1);
});
