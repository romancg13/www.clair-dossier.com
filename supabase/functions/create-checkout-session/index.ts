import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://clair-dossier.com';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

const priceEnvByPlan: Record<string, string> = {
  discovery: 'STRIPE_PRICE_DISCOVERY',
  'client-essential': 'STRIPE_PRICE_CLIENT_ESSENTIAL',
  business: 'STRIPE_PRICE_BUSINESS',
  'cabinet-solo': 'STRIPE_PRICE_CABINET_SOLO',
  'cabinet-pro': 'STRIPE_PRICE_CABINET_PRO',
  'cabinet-premium': 'STRIPE_PRICE_CABINET_PREMIUM',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY is not configured' }, 500);

  try {
    const { planId, successUrl, cancelUrl } = await request.json();
    const envName = priceEnvByPlan[String(planId || '')];
    const price = envName ? Deno.env.get(envName) : undefined;
    if (!price) {
      return jsonResponse({ error: 'Stripe price is not configured for this plan' }, 400);
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Supabase Auth is not configured for checkout' }, 500);
    }

    const authHeader = request.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Authentication required for paid checkout' }, 401);
    }
    const userId = authData.user.id;
    const customerEmail = authData.user.email;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const session = await stripe.checkout.sessions.create({
      mode: planId === 'discovery' ? 'payment' : 'subscription',
      customer_email: customerEmail,
      client_reference_id: userId,
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl || `${siteUrl}/success`,
      cancel_url: cancelUrl || `${siteUrl}/cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: { plan_id: planId || 'unknown', user_id: userId || '' },
      subscription_data: planId === 'discovery' ? undefined : { metadata: { plan_id: planId || 'unknown', user_id: userId || '' } },
    });

    return jsonResponse({ id: session.id, url: session.url });
  } catch (error) {
    console.error('create-checkout-session error', error);
    return jsonResponse({ error: 'Unable to create checkout session' }, 500);
  }
});
