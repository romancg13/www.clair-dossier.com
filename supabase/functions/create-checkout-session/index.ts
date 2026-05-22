import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://clair-dossier.com';

const priceEnvByPlan: Record<string, string> = {
  'client-essential': 'STRIPE_PRICE_CLIENT_ESSENTIAL',
  business: 'STRIPE_PRICE_BUSINESS',
  'cabinet-solo': 'STRIPE_PRICE_CABINET_SOLO',
  'cabinet-pro': 'STRIPE_PRICE_CABINET_PRO',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY is not configured' }, 500);

  try {
    const { planId, successUrl, cancelUrl, customerEmail, userId } = await request.json();
    if (planId === 'discovery') {
      return jsonResponse({ error: 'Discovery plan does not require Stripe Checkout' }, 400);
    }
    if (planId === 'cabinet-premium') {
      return jsonResponse({ error: 'Cabinet Premium is handled by demo and custom quote' }, 400);
    }

    const envName = priceEnvByPlan[String(planId || '')];
    const price = envName ? Deno.env.get(envName) : undefined;
    if (!price) {
      return jsonResponse({ error: 'Stripe price is not configured for this plan' }, 400);
    }

    let verifiedUserId = '';
    let verifiedCustomerEmail = typeof customerEmail === 'string' ? customerEmail : undefined;
    if (userId) {
      if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Supabase auth verification is not configured' }, 500);
      const token = request.headers.get('authorization')?.replace('Bearer ', '');
      if (!token) return jsonResponse({ error: 'Authentication required' }, 401);
      const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user || userData.user.id !== userId) {
        return jsonResponse({ error: 'Invalid authenticated user' }, 403);
      }
      verifiedUserId = userData.user.id;
      verifiedCustomerEmail = userData.user.email || verifiedCustomerEmail;
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: verifiedCustomerEmail,
      client_reference_id: verifiedUserId || undefined,
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl || `${siteUrl}/success`,
      cancel_url: cancelUrl || `${siteUrl}/cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: { plan_id: planId || 'unknown', user_id: verifiedUserId },
      subscription_data: { metadata: { plan_id: planId || 'unknown', user_id: verifiedUserId } },
    });

    return jsonResponse({ id: session.id });
  } catch (error) {
    console.error('create-checkout-session error', error);
    return jsonResponse({ error: 'Unable to create checkout session' }, 500);
  }
});
