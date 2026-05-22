import { supabase } from './supabase';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined);

export const isStripeConfigured = Boolean(stripePublicKey && functionsUrl && anonKey);

export async function redirectToCheckout(planId: string): Promise<void> {
  if (!isStripeConfigured || !functionsUrl || !anonKey) {
    throw new Error('Paiement bientôt disponible : configurez Stripe et les fonctions serveur pour activer le checkout.');
  }

  const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  if (!sessionData.session) {
    throw new Error('Connectez-vous ou créez un compte avant de souscrire une formule payante.');
  }
  const accessToken = sessionData.session?.access_token || anonKey;

  const response = await fetch(`${functionsUrl}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      planId,
      customerEmail: sessionData.session?.user.email,
      userId: sessionData.session?.user.id,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`,
    }),
  });

  if (!response.ok) {
    console.error('Erreur create-checkout-session', await response.text());
    throw new Error("Le paiement n'est pas encore disponible. Vérifiez la configuration Stripe serveur.");
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error('Session Stripe invalide.');
  }

  window.location.assign(data.url);
}

export async function redirectToCustomerPortal(): Promise<void> {
  if (!isStripeConfigured || !functionsUrl || !supabase) {
    throw new Error('Portail client bientôt disponible : connectez Supabase, Stripe et les fonctions serveur.');
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    throw new Error('Connectez-vous pour gérer votre abonnement.');
  }

  const response = await fetch(`${functionsUrl}/customer-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ returnUrl: `${window.location.origin}/abonnement` }),
  });

  if (!response.ok) {
    console.error('Erreur customer-portal', await response.text());
    throw new Error("Le portail client n'est pas encore disponible. Vérifiez la configuration Stripe serveur.");
  }

  const portal = (await response.json()) as { url?: string };
  if (!portal.url) {
    throw new Error('Session de portail Stripe invalide.');
  }

  window.location.assign(portal.url);
}
