import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://clair-dossier.com';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Stripe portal configuration is missing' }, 500);

  try {
    const { customerId, returnUrl } = await request.json();
    if (!customerId) return jsonResponse({ error: 'customerId is required' }, 400);
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return jsonResponse({ error: 'Authentication required' }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401);

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (subscriptionError) {
      console.error('customer-portal subscription check error', subscriptionError);
      return jsonResponse({ error: 'Unable to verify customer ownership' }, 500);
    }
    if (!subscription) return jsonResponse({ error: 'Customer is not attached to this user' }, 403);

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
