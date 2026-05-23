import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://www.clair-dossier.com';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, request);
  if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Billing configuration missing' }, 500, request);

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication required' }, 401, request);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401, request);

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userData.user.id)
      .not('stripe_customer_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscriptionError) console.error('customer-portal subscription lookup error', subscriptionError);
    if (!subscription?.stripe_customer_id) return jsonResponse({ error: 'No Stripe customer found' }, 404, request);

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${siteUrl}/abonnement`,
    });
    return jsonResponse({ url: portal.url }, 200, request);
  } catch (error) {
    console.error('customer-portal error', error);
    return jsonResponse({ error: 'Unable to create customer portal session' }, 500, request);
  }
});
