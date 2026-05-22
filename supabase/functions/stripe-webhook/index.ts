import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
  } catch (error) {
    console.error('Invalid Stripe webhook signature', error);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabase.from('payments').insert({
        user_id: session.client_reference_id || null,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_checkout_session_id: session.id,
        amount_total: session.amount_total,
        currency: session.currency || 'eur',
        status: session.payment_status || 'paid',
        metadata: session.metadata || {},
      });
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase.from('subscriptions').upsert({
        user_id: subscription.metadata?.user_id || null,
        plan_id: subscription.metadata?.plan_id || 'unknown',
        stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_subscription_id' });
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Stripe webhook persistence error', error);
    return new Response('Webhook persistence error', { status: 500 });
  }
});
