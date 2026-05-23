import Stripe from 'npm:stripe';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://clair-dossier.com';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY is not configured' }, 500);

  try {
    const { planId, billingPeriod, successUrl, cancelUrl, customerEmail, userId } = await request.json();
    const period: BillingPeriod = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    const envName = priceEnvByPlan[String(planId || '')]?.[period];
    const price = envName ? Deno.env.get(envName) : undefined;
    if (!price) {
      return jsonResponse({ error: 'Stripe price is not configured for this plan' }, 400);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const metadata = { plan_id: planId || 'unknown', billing_period: period, user_id: userId || '' };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      client_reference_id: userId,
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl || `${siteUrl}/success`,
      cancel_url: cancelUrl || `${siteUrl}/cancel`,
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
