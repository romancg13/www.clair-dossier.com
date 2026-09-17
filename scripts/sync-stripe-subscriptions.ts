/**
 * Rattachement des abonnés EXISTANTS (payés avant le webhook) à leur compte.
 *
 * Le webhook `stripe-webhook` rattache automatiquement les nouveaux paiements
 * (client_reference_id). Les abonnements souscrits avant son déploiement ne
 * portent pas cette information : ce script les rapproche par l'adresse
 * e-mail du client Stripe = adresse du compte ClairDossier.
 *
 * SÉCURITÉ : à lancer par le propriétaire, en local. Les clés ne sont jamais
 * affichées ni écrites. Simulation par défaut ; `--apply` pour écrire.
 *
 *   export STRIPE_SECRET_KEY=rk_live_…            (lecture abonnements/clients)
 *   export SUPABASE_URL=https://buzgokfmxpmyceppvjpp.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=…            (dashboard Supabase → API)
 *   node --import tsx scripts/sync-stripe-subscriptions.ts          # simulation
 *   node --import tsx scripts/sync-stripe-subscriptions.ts --apply  # écriture
 *
 * Idempotent (upsert sur l'identifiant d'abonnement). Ne crée aucun compte,
 * ne modifie rien dans Stripe.
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  planIdFromSubscription,
  subscriptionRow,
  type StripeLikeSubscription,
} from '../supabase/functions/_shared/stripe-sync.ts';

const apply = process.argv.includes('--apply');
const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables manquantes : STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

// Même version d'API que le webhook (périodes lues sur l'abonnement OU ses lignes).
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as Stripe.StripeConfig['apiVersion'] });
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function accountsByEmail(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('lecture des comptes impossible');
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }
  return map;
}

const { data: plans } = await admin.from('plan_entitlements').select('plan_id');
const knownPlans = new Set((plans ?? []).map((p: { plan_id: string }) => p.plan_id));
if (knownPlans.size === 0) {
  console.error('❌ Table plan_entitlements vide ou absente : appliquez d’abord la migration 20260917120000.');
  process.exit(1);
}

const accounts = await accountsByEmail();
let linked = 0;
let unmatched = 0;

for await (const sub of stripe.subscriptions.list({
  status: 'all',
  limit: 100,
  expand: ['data.customer', 'data.items.data.price.product'],
})) {
  if (sub.status === 'incomplete_expired') continue;
  const customer = sub.customer as Stripe.Customer | Stripe.DeletedCustomer;
  const email = 'email' in customer && customer.email ? customer.email.toLowerCase() : null;
  const userId = email ? accounts.get(email) : undefined;
  const planId = planIdFromSubscription(sub as unknown as StripeLikeSubscription);
  const label = `${sub.id} · ${sub.status} · offre ${planId ?? 'inconnue'}`;
  if (!userId) {
    unmatched++;
    console.log(`⚠️  ${label} · aucun compte ClairDossier avec l'adresse du client Stripe — rapprochement manuel`);
    continue;
  }
  const row = subscriptionRow(userId, sub as unknown as StripeLikeSubscription, planId && knownPlans.has(planId) ? planId : null);
  if (apply) {
    const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
    if (error) {
      console.log(`❌ ${label} · écriture refusée (${error.code ?? 'erreur'})`);
      continue;
    }
  }
  linked++;
  console.log(`${apply ? '✅' : '🔎'} ${label} · rattaché au compte ${userId.slice(0, 8)}…`);
}

console.log(`\n${apply ? 'Écrits' : 'À rattacher (simulation)'} : ${linked} · sans compte correspondant : ${unmatched}`);
if (!apply) console.log('Relancez avec --apply pour enregistrer.');
