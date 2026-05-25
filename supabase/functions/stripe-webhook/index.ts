import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const ALLOWED_PLAN_IDS = new Set([
  'client-essential',
  'business',
  'cabinet-solo',
  'cabinet-pro',
  'cabinet-premium',
]);
const ALLOWED_BILLING_PERIODS = new Set(['monthly', 'yearly']);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === 'active' || status === 'canceled' || status === 'incomplete' || status === 'past_due') return status;
  return 'incomplete';
}

function safePlan(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return ALLOWED_PLAN_IDS.has(value) ? value : null;
}

function safeBillingPeriod(value: unknown): 'monthly' | 'yearly' | null {
  if (typeof value !== 'string') return null;
  return ALLOWED_BILLING_PERIODS.has(value) ? (value as 'monthly' | 'yearly') : null;
}

async function safeUserId(
  supabase: ReturnType<typeof createClient>,
  value: unknown,
): Promise<string | null> {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) return null;
  const { data, error } = await supabase.auth.admin.getUserById(value);
  if (error || !data?.user) return null;
  return data.user.id;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response('Webhook configuration missing', { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing Stripe signature', { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // ─── Idempotence : insertion en première étape (SEC-01) ───
  const { error: idempError } = await supabase
    .from('stripe_events_processed')
    .insert({ event_id: event.id, event_type: event.type });

  if (idempError) {
    if (idempError.code === '23505') {
      // Déjà traité — replay légitime ou tentative malveillante
      return new Response(JSON.stringify({ received: true, idempotent: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Stripe webhook idempotence error', idempError.code);
    return new Response('Idempotence check failed', { status: 500 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Validation user_id (SEC-03)
      const validatedUserId = await safeUserId(supabase, session.client_reference_id);

      const { error: paymentError } = await supabase.from('payments').upsert({
        user_id: validatedUserId,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_checkout_session_id: session.id,
        amount_total: session.amount_total,
        currency: session.currency || 'eur',
        status: session.payment_status || 'paid',
        plan_id: safePlan(session.metadata?.plan_id), // SEC-02
        billing_period: safeBillingPeriod(session.metadata?.billing_period), // SEC-02
        metadata: session.metadata || {},
      }, { onConflict: 'stripe_checkout_session_id' });
      if (paymentError) throw paymentError;
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;

      // Validation user_id (SEC-03) + plan whitelisting (SEC-02)
      const validatedUserId = await safeUserId(supabase, subscription.metadata?.user_id);
      const validatedPlan = safePlan(subscription.metadata?.plan_id);
      const validatedPeriod = safeBillingPeriod(subscription.metadata?.billing_period);

      // Si le plan ou la période ne sont pas valides, on log mais on accepte le webhook
      // (sinon Stripe retentera indéfiniment). On stocke des valeurs sûres.
      const { error: subscriptionError } = await supabase.from('subscriptions').upsert({
        user_id: validatedUserId,
        plan_id: validatedPlan || 'unknown',
        billing_period: validatedPeriod || 'monthly',
        stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
        stripe_subscription_id: subscription.id,
        status: normalizeSubscriptionStatus(subscription.status),
        current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_subscription_id' });
      if (subscriptionError) throw subscriptionError;
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    // Si le traitement échoue après l'idempotence, on retire l'event pour permettre un retry Stripe
    await supabase.from('stripe_events_processed').delete().eq('event_id', event.id);
    console.error('Stripe webhook persistence error', error instanceof Error ? error.message : 'unknown');
    return new Response('Webhook persistence error', { status: 500 });
  }
});
