// Edge Function: stripe-webhook — synchronisation des abonnements.
//
// Stripe est la source de vérité financière. Cette fonction ne fait que
// RECOPIER son état (offre, statut, période) dans `subscriptions`, d'où la
// base calcule les quotas. Aucun paiement n'est jamais activé depuis une
// page de retour (/compte?paid=…) : uniquement depuis un événement signé.
//
// Garanties :
//  - signature Stripe vérifiée (STRIPE_WEBHOOK_SECRET) — sinon 400 ;
//  - idempotence : chaque event.id n'est appliqué qu'une fois (table
//    stripe_events) ; un rejeu partiel est ré-appliqué sans doublon (upsert) ;
//  - rattachement au compte : `client_reference_id` posé par le site sur le
//    lien de paiement, vérifié (UUID + utilisateur existant) ;
//  - aucun secret ni donnée de carte dans les journaux.
//
// Déploiement : `supabase functions deploy stripe-webhook --no-verify-jwt`
// (Stripe n'envoie pas de jeton Supabase ; la signature le remplace).
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET ; SUPABASE_URL et
// SUPABASE_SERVICE_ROLE_KEY sont injectés par la plateforme.

import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  HANDLED_EVENTS,
  isUuid,
  paymentEmailMatchesAccount,
  planIdFromSubscription,
  subscriptionIdFromInvoice,
  subscriptionRow,
  type StripeLikeSubscription,
} from '../_shared/stripe-sync.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function retrieveSubscription(id: string): Promise<StripeLikeSubscription> {
  return (await stripe.subscriptions.retrieve(id, {
    expand: ['items.data.price.product'],
  })) as unknown as StripeLikeSubscription;
}

async function knownPlan(planId: string | null): Promise<string | null> {
  if (!planId) return null;
  const { data } = await admin.from('plan_entitlements').select('plan_id').eq('plan_id', planId).maybeSingle();
  return data ? planId : null;
}

async function upsert(userId: string, sub: StripeLikeSubscription): Promise<void> {
  const row = subscriptionRow(userId, sub, await knownPlan(planIdFromSubscription(sub)));
  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw new Error(`upsert subscriptions: ${error.code ?? 'erreur'}`);
  await admin.from('audit_logs').insert({
    actor_id: userId,
    actor_role: 'stripe_webhook',
    action: 'abonnement_synchronise',
    resource_type: 'abonnement',
    resource_id: sub.id,
    target_user_id: userId,
    metadata: { statut: sub.status, offre: row.plan_id ?? 'inconnue', fin_periode: row.current_period_end ?? '' },
  });
}

/** Utilisateur déjà rattaché à cet abonnement (événements postérieurs au paiement). */
async function ownerOf(subscriptionId: string): Promise<string | null> {
  const { data } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
}

async function handle(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription' || !session.subscription) return 'ignoré (pas un abonnement)';
      const userId = session.client_reference_id;
      if (!isUuid(userId)) return 'non rattaché (paiement hors compte) — rapprochement manuel';
      const { data: user } = await admin.auth.admin.getUserById(userId);
      if (!user?.user) return 'non rattaché (compte introuvable) — rapprochement manuel';
      // Le client_reference_id vient d'une URL modifiable : il n'est accepté
      // que si l'e-mail saisi au paiement correspond au compte référencé
      // (e-mail d'authentification ou e-mail de facturation déclaré).
      const paymentEmail = session.customer_details?.email ?? session.customer_email ?? null;
      const { data: prof } = await admin.from('profiles').select('billing_email').eq('id', userId).maybeSingle();
      const billingEmail = (prof as { billing_email: string | null } | null)?.billing_email ?? null;
      if (!paymentEmailMatchesAccount(paymentEmail, [user.user.email, billingEmail])) {
        return 'non rattaché (e-mail du paiement différent du compte) — rapprochement manuel';
      }
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      await upsert(userId, await retrieveSubscription(subId));
      return 'abonnement rattaché';
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as unknown as StripeLikeSubscription;
      const owner = await ownerOf(sub.id);
      if (!owner) return 'en attente du rattachement (checkout.session.completed)';
      await upsert(owner, await retrieveSubscription(sub.id));
      return 'abonnement mis à jour';
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subId = subscriptionIdFromInvoice(event.data.object as Parameters<typeof subscriptionIdFromInvoice>[0]);
      if (!subId) return 'ignoré (facture hors abonnement)';
      const owner = await ownerOf(subId);
      if (!owner) return 'en attente du rattachement';
      await upsert(owner, await retrieveSubscription(subId));
      return event.type === 'invoice.paid' ? 'renouvellement enregistré' : 'échec de paiement enregistré';
    }
    default:
      return 'ignoré';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SERVICE_ROLE) {
    return json(500, { error: 'not_configured' });
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) return json(400, { error: 'missing_signature' });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch {
    return json(400, { error: 'invalid_signature' });
  }

  if (!HANDLED_EVENTS.has(event.type)) return json(200, { received: true, ignored: event.type });

  // Idempotence : un événement déjà appliqué n'est jamais rejoué.
  const { error: insertError } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (insertError) {
    if (insertError.code !== '23505') return json(500, { error: 'storage_unavailable' });
    const { data: previous } = await admin
      .from('stripe_events')
      .select('processed_at')
      .eq('id', event.id)
      .maybeSingle();
    if ((previous as { processed_at: string | null } | null)?.processed_at) {
      return json(200, { received: true, duplicate: true });
    }
    // Tentative précédente interrompue : ré-application sûre (upsert).
  }

  try {
    const outcome = await handle(event);
    await admin.from('stripe_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
    return json(200, { received: true, outcome });
  } catch (e) {
    console.error('[stripe-webhook]', event.type, event.id, e instanceof Error ? e.message : 'erreur');
    // 500 → Stripe réessaie automatiquement (événement non marqué traité).
    return json(500, { error: 'processing_failed' });
  }
});
