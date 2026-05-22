import Stripe from 'npm:stripe';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const siteUrl = Deno.env.get('SITE_URL') || 'https://clair-dossier.com';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY is not configured' }, 500);

  try {
    const { customerId, returnUrl } = await request.json();
    if (!customerId) return jsonResponse({ error: 'customerId is required' }, 400);
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
