import { supabase } from './supabase';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getValidUrl(value: string | undefined, label: string) {
  if (!value) return undefined;
  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    console.error(`Configuration ${label} invalide`);
    return undefined;
  }
}

const configuredFunctionsUrl = getValidUrl(import.meta.env.VITE_SUPABASE_FUNCTIONS_URL, 'Supabase Functions');
const fallbackFunctionsUrl = supabaseUrl ? getValidUrl(`${supabaseUrl}/functions/v1`, 'Supabase Functions') : undefined;
const functionsUrl = configuredFunctionsUrl || fallbackFunctionsUrl;

export type BillingPeriod = 'monthly' | 'yearly';

export class CheckoutAuthRequiredError extends Error {
  constructor() {
    super('Créez votre compte pour choisir cette formule.');
    this.name = 'CheckoutAuthRequiredError';
  }
}

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

const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function redirectToCheckout(planId: string, billingPeriod: BillingPeriod): Promise<void> {
  if (!isStripeBaseConfigured || !functionsUrl || !anonKey || !getStripePriceId(planId, billingPeriod)) {
    throw new Error('Paiement disponible après configuration Stripe.');
  }
  if (!supabase) {
    throw new CheckoutAuthRequiredError();
  }

  const [{ data: sessionData }, { data: userData, error: userError }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);
  if (!sessionData.session || userError || !userData.user) {
    throw new CheckoutAuthRequiredError();
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${functionsUrl}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ planId, billingPeriod }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Le service de paiement met trop de temps à répondre. Réessayez.');
    }
    throw new Error('Paiement indisponible temporairement.');
  }

  if (!response.ok) {
    console.error('Erreur create-checkout-session', response.status);
    throw new Error('Paiement indisponible temporairement.');
  }

  const checkoutData = (await response.json()) as { url?: string };
  if (!checkoutData.url) {
    throw new Error('Paiement disponible après configuration Stripe.');
  }

  window.location.assign(checkoutData.url);
}

export async function redirectToCustomerPortal(): Promise<void> {
  if (!isStripeBaseConfigured || !functionsUrl || !anonKey) {
    throw new Error('Portail client disponible après configuration Stripe.');
  }
  if (!supabase) {
    throw new CheckoutAuthRequiredError();
  }

  const [{ data: sessionData }, { data: userData, error: userError }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);
  if (!sessionData.session || userError || !userData.user) {
    throw new CheckoutAuthRequiredError();
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${functionsUrl}/customer-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Le portail client met trop de temps à répondre. Réessayez.');
    }
    throw new Error('Portail client indisponible temporairement.');
  }

  if (!response.ok) {
    console.error('Erreur customer-portal', response.status);
    throw new Error('Portail client indisponible temporairement.');
  }

  const portalData = (await response.json()) as { url?: string };
  if (!portalData.url) {
    throw new Error('Portail client disponible après configuration Stripe.');
  }

  window.location.assign(portalData.url);
}
