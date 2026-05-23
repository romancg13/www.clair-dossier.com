import { supabase } from './supabase';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined);

export type BillingPeriod = 'monthly' | 'yearly';

const stripePriceIds: Record<string, Record<BillingPeriod, string | undefined>> = {
  'client-essential': {
    monthly: import.meta.env.VITE_STRIPE_CLIENT_ESSENTIEL_MONTHLY_PRICE_ID,
    yearly: import.meta.env.VITE_STRIPE_CLIENT_ESSENTIEL_YEARLY_PRICE_ID,
  },
  business: {
    monthly: import.meta.env.VITE_STRIPE_BUSINESS_MONTHLY_PRICE_ID,
    yearly: import.meta.env.VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID,
  },
  'cabinet-solo': {
    monthly: import.meta.env.VITE_STRIPE_CABINET_SOLO_MONTHLY_PRICE_ID,
    yearly: import.meta.env.VITE_STRIPE_CABINET_SOLO_YEARLY_PRICE_ID,
  },
  'cabinet-pro': {
    monthly: import.meta.env.VITE_STRIPE_CABINET_PRO_MONTHLY_PRICE_ID,
    yearly: import.meta.env.VITE_STRIPE_CABINET_PRO_YEARLY_PRICE_ID,
  },
  'cabinet-premium': {
    monthly: import.meta.env.VITE_STRIPE_CABINET_PREMIUM_MONTHLY_PRICE_ID,
    yearly: import.meta.env.VITE_STRIPE_CABINET_PREMIUM_YEARLY_PRICE_ID,
  },
};

export const isStripeBaseConfigured = Boolean(stripePublicKey && functionsUrl && anonKey);

export function getStripePriceId(planId: string, billingPeriod: BillingPeriod) {
  return stripePriceIds[planId]?.[billingPeriod];
}

export function isPlanCheckoutAvailable(planId: string, billingPeriod: BillingPeriod) {
  if (planId === 'discovery') return true;
  return Boolean(isStripeBaseConfigured && getStripePriceId(planId, billingPeriod));
}

export async function redirectToCheckout(planId: string, billingPeriod: BillingPeriod): Promise<void> {
  if (!isStripeBaseConfigured || !functionsUrl || !anonKey || !getStripePriceId(planId, billingPeriod)) {
    throw new Error('Le paiement sera disponible après configuration Stripe.');
  }
  if (!supabase) {
    throw new Error('Créez votre compte pour choisir cette formule.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error('Créez votre compte pour choisir cette formule.');
  }

  const response = await fetch(`${functionsUrl}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify({
      planId,
      billingPeriod,
      customerEmail: sessionData.session.user.email,
      userId: sessionData.session.user.id,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`,
    }),
  });

  if (!response.ok) {
    console.error('Erreur create-checkout-session', await response.text());
    throw new Error("Le paiement n'est pas encore disponible. Vérifiez la configuration Stripe serveur.");
  }

  const checkoutData = (await response.json()) as { url?: string };
  if (!checkoutData.url) {
    throw new Error('Session Stripe invalide.');
  }

  window.location.assign(checkoutData.url);
}
