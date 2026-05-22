import { loadStripe } from '@stripe/stripe-js';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined);

export const isStripeConfigured = Boolean(stripePublicKey && functionsUrl && anonKey);

export async function redirectToCheckout(planId: string): Promise<void> {
  if (!isStripeConfigured || !stripePublicKey || !functionsUrl || !anonKey) {
    throw new Error('Paiement bientôt disponible : configurez Stripe et les fonctions serveur pour activer le checkout.');
  }

  const response = await fetch(`${functionsUrl}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      planId,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`,
    }),
  });

  if (!response.ok) {
    console.error('Erreur create-checkout-session', await response.text());
    throw new Error("Le paiement n'est pas encore disponible. Vérifiez la configuration Stripe serveur.");
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new Error('Session Stripe invalide.');
  }

  const stripe = await loadStripe(stripePublicKey);
  if (!stripe) {
    throw new Error('Impossible de charger Stripe.');
  }

  const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
  if (error) {
    console.error('Erreur redirectToCheckout', error);
    throw new Error('Impossible de rediriger vers le paiement Stripe.');
  }
}
