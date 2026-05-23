import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://clair-dossier.com';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

type BillingPeriod = 'monthly' | 'yearly';

const priceEnvByPlan: Record<string, Record<BillingPeriod, string>> = {
  'client-essential': {
    monthly: 'VITE_STRIPE_CLIENT_ESSENTIEL_MONTHLY_PRICE_ID',
    yearly: 'VITE_STRIPE_CLIENT_ESSENTIEL_YEARLY_PRICE_ID',
  },
  business: {
    monthly: 'VITE_STRIPE_BUSINESS_MONTHLY_PRICE_ID',
    yearly: 'VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID',
  },
  'cabinet-solo': {
    monthly: 'VITE_STRIPE_CABINET_SOLO_MONTHLY_PRICE_ID',
    yearly: 'VITE_STRIPE_CABINET_SOLO_YEARLY_PRICE_ID',
  },
  'cabinet-pro': {
    monthly: 'VITE_STRIPE_CABINET_PRO_MONTHLY_PRICE_ID',
    yearly: 'VITE_STRIPE_CABINET_PRO_YEARLY_PRICE_ID',
  },
  'cabinet-premium': {
    monthly: 'VITE_STRIPE_CABINET_PREMIUM_MONTHLY_PRICE_ID',
    yearly: 'VITE_STRIPE_CABINET_PREMIUM_YEARLY_PRICE_ID',
  },
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
}

function safeReturnUrl(value: unknown, fallbackPath: string) {
  const fallback = new URL(fallbackPath, siteUrl).toString();
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const url = new URL(value);
    return url.origin === new URL(siteUrl).origin ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY is not configured' }, 500);
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase auth is not configured' }, 500);

  try {
    const token = getBearerToken(request);
    if (!token) return jsonResponse({ error: 'Authentication required' }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401);

    const { planId, billingPeriod, successUrl, cancelUrl } = await request.json();
    const period: BillingPeriod = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    const envName = priceEnvByPlan[String(planId || '')]?.[period];
    const price = envName ? Deno.env.get(envName) : undefined;
    if (!price) {
      return jsonResponse({ error: 'Stripe price is not configured for this plan' }, 400);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const metadata = { plan_id: String(planId), billing_period: period, user_id: userData.user.id };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      automatic_payment_methods: { enabled: true },
      customer_email: userData.user.email,
      client_reference_id: userData.user.id,
      line_items: [{ price, quantity: 1 }],
      success_url: safeReturnUrl(successUrl, '/success'),
      cancel_url: safeReturnUrl(cancelUrl, '/cancel'),
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata,
      subscription_data: { metadata },
    });

    return jsonResponse({ id: session.id, url: session.url });
  } catch (error) {
    console.error('create-checkout-session error', error);
    return jsonResponse({ error: 'Unable to create checkout session' }, 500);
  }
});
