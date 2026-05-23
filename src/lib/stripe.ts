import { supabase } from './supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined);
const paymentsApiUrl = import.meta.env.VITE_PAYMENTS_API_URL?.replace(/\/$/, '') || '';
const localNodeCheckoutEndpoint = import.meta.env.DEV ? '/api/create-checkout-session' : '';
const nodeCheckoutEndpoint = paymentsApiUrl ? `${paymentsApiUrl}/api/create-checkout-session` : localNodeCheckoutEndpoint;

export type BillingPeriod = 'monthly' | 'yearly';

const nodeCheckoutPlanIds = new Set(['client-essential', 'business', 'cabinet-solo', 'cabinet-pro']);

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

export class CheckoutAuthRequiredError extends Error {
  constructor() {
    super('Créez votre compte pour choisir cette formule.');
    this.name = 'CheckoutAuthRequiredError';
  }
}

const isSupabaseCheckoutConfigured = Boolean(functionsUrl && anonKey);

export const isStripeBaseConfigured = Boolean(nodeCheckoutEndpoint || isSupabaseCheckoutConfigured);

export function getStripePriceId(planId: string, billingPeriod: BillingPeriod) {
  return stripePriceIds[planId]?.[billingPeriod];
}

export function isPlanCheckoutAvailable(planId: string, billingPeriod: BillingPeriod) {
  if (planId === 'discovery') return true;
  const hasNodeBackend = Boolean(nodeCheckoutEndpoint && nodeCheckoutPlanIds.has(planId));
  const hasSupabaseBackend = Boolean(isSupabaseCheckoutConfigured && getStripePriceId(planId, billingPeriod));
  return hasNodeBackend || hasSupabaseBackend;
}

export async function redirectToCheckout(planId: string, billingPeriod: BillingPeriod): Promise<void> {
  if (!isPlanCheckoutAvailable(planId, billingPeriod)) {
    throw new Error('Cette formule n’est pas disponible au paiement automatique.');
  }

  const { session, authHeader } = await getCheckoutSession();
  if (supabase && !session) {
    throw new CheckoutAuthRequiredError();
  }

  const checkoutEndpoint = nodeCheckoutEndpoint && nodeCheckoutPlanIds.has(planId)
    ? nodeCheckoutEndpoint
    : `${functionsUrl}/create-checkout-session`;

  const response = await fetch(checkoutEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({
      planId,
      billingPeriod,
      customerEmail: session?.user.email,
      userId: session?.user.id,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`,
    }),
  });

  if (!response.ok) {
    const message = await getCheckoutErrorMessage(response);
    console.error('Erreur create-checkout-session', message);
    throw new Error(message);
  }

  const checkoutData = (await response.json()) as { url?: string };
  if (!checkoutData.url) {
    throw new Error('Session Stripe invalide.');
  }

  window.location.assign(checkoutData.url);
}

async function getCheckoutSession() {
  if (!supabase) return { session: null, authHeader: '' };
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  return {
    session,
    authHeader: session ? `Bearer ${session.access_token}` : '',
  };
}

async function getCheckoutErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // The backend may return a plain text platform error.
  }
  return "Le paiement n'est pas encore disponible. Vérifiez la configuration Stripe serveur.";
}
