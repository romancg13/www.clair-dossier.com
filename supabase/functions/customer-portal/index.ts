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
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase auth is not configured' }, 500);

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const { returnUrl } = await request.json();
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userData.user.id)
      .not('stripe_customer_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error('customer-portal subscription lookup error', subscriptionError);
      return jsonResponse({ error: 'Unable to load subscription' }, 500);
    }
    if (!subscription?.stripe_customer_id) {
      return jsonResponse({ error: 'No Stripe customer found for this user' }, 404);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl || `${siteUrl}/abonnement`,
    });
    return jsonResponse({ url: portal.url });
  } catch (error) {
    console.error('customer-portal error', error);
    return jsonResponse({ error: 'Unable to create customer portal session' }, 500);
  }
});
