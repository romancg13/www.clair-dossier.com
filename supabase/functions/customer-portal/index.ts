import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://clair-dossier.com';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY is not configured' }, 500);
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase function auth is not configured' }, 500);

  try {
    const { customerId, returnUrl } = await request.json();
    if (!customerId) return jsonResponse({ error: 'customerId is required' }, 400);

    const authorization = request.headers.get('Authorization');
    if (!authorization) return jsonResponse({ error: 'Authentication required' }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('customer-portal subscription authorization error', error);
      return jsonResponse({ error: 'Unable to verify subscription ownership' }, 403);
    }
    if (!subscription) return jsonResponse({ error: 'Subscription not found for current user' }, 403);

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${siteUrl}/abonnement`,
    });
    return jsonResponse({ url: portal.url });
  } catch (error) {
    console.error('customer-portal error', error);
    return jsonResponse({ error: 'Unable to create customer portal session' }, 500);
  }
});
