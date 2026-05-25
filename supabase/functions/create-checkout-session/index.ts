import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://www.clair-dossier.com';

type BillingPeriod = 'monthly' | 'yearly';

const priceEnvByPlan: Record<string, Record<BillingPeriod, string[]>> = {
  'client-essential': {
    monthly: ['STRIPE_CLIENT_ESSENTIEL_MONTHLY_PRICE_ID', 'VITE_STRIPE_CLIENT_ESSENTIEL_MONTHLY_PRICE_ID'],
    yearly: ['STRIPE_CLIENT_ESSENTIEL_YEARLY_PRICE_ID', 'VITE_STRIPE_CLIENT_ESSENTIEL_YEARLY_PRICE_ID'],
  },
  business: {
    monthly: ['STRIPE_BUSINESS_MONTHLY_PRICE_ID', 'VITE_STRIPE_BUSINESS_MONTHLY_PRICE_ID'],
    yearly: ['STRIPE_BUSINESS_YEARLY_PRICE_ID', 'VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID'],
  },
  'cabinet-solo': {
    monthly: ['STRIPE_CABINET_SOLO_MONTHLY_PRICE_ID', 'VITE_STRIPE_CABINET_SOLO_MONTHLY_PRICE_ID'],
    yearly: ['STRIPE_CABINET_SOLO_YEARLY_PRICE_ID', 'VITE_STRIPE_CABINET_SOLO_YEARLY_PRICE_ID'],
  },
  'cabinet-pro': {
    monthly: ['STRIPE_CABINET_PRO_MONTHLY_PRICE_ID', 'VITE_STRIPE_CABINET_PRO_MONTHLY_PRICE_ID'],
    yearly: ['STRIPE_CABINET_PRO_YEARLY_PRICE_ID', 'VITE_STRIPE_CABINET_PRO_YEARLY_PRICE_ID'],
  },
  'cabinet-premium': {
    monthly: ['STRIPE_CABINET_PREMIUM_MONTHLY_PRICE_ID', 'VITE_STRIPE_CABINET_PREMIUM_MONTHLY_PRICE_ID'],
    yearly: ['STRIPE_CABINET_PREMIUM_YEARLY_PRICE_ID', 'VITE_STRIPE_CABINET_PREMIUM_YEARLY_PRICE_ID'],
  },
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, request);
  if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Payment configuration missing' }, 500, request);

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication required' }, 401, request);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401, request);

    const { planId, billingPeriod } = await request.json();
    const period: BillingPeriod = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    const envNames = priceEnvByPlan[String(planId || '')]?.[period] || [];
    const price = envNames.map((name) => Deno.env.get(name)).find(Boolean);
    if (!price) {
      return jsonResponse({ error: 'Stripe price is not configured for this plan' }, 400, request);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const metadata = { plan_id: String(planId), billing_period: period, user_id: userData.user.id };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // SEC-04 : automatic methods restreintes aux méthodes sans redirect
      // (card / Apple Pay / Google Pay / Link). Bloque klarna, paypal, etc.
      // qui ont des fenêtres de chargeback plus longues et surface de fraude élevée.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      customer_email: userData.user.email,
      client_reference_id: userData.user.id,
      line_items: [{ price, quantity: 1 }],
      success_url: `${siteUrl}/success`,
      cancel_url: `${siteUrl}/cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata,
      subscription_data: { metadata },
    });

    return jsonResponse({ id: session.id, url: session.url }, 200, request);
  } catch (error) {
    console.error('create-checkout-session error', error);
    return jsonResponse({ error: 'Unable to create checkout session' }, 500, request);
  }
});
