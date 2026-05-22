const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined);

export const isStripeConfigured = Boolean(functionsUrl && anonKey);

type CheckoutOptions = {
  customerEmail?: string | null;
  userId?: string | null;
  accessToken?: string;
};

export async function redirectToCheckout(planId: string, options: CheckoutOptions = {}): Promise<void> {
  if (!isStripeConfigured || !functionsUrl || !anonKey) {
    throw new Error('Paiement bientôt disponible : configurez Stripe et les fonctions serveur pour activer le checkout.');
  }

  const response = await fetch(`${functionsUrl}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.accessToken || anonKey}`,
    },
    body: JSON.stringify({
      planId,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`,
      customerEmail: options.customerEmail || undefined,
      userId: options.userId || undefined,
    }),
  });

  if (!response.ok) {
    console.error('Erreur create-checkout-session', await response.text());
    throw new Error("Le paiement n'est pas encore disponible. Vérifiez la configuration Stripe serveur.");
  }

  const data = (await response.json()) as { id?: string; url?: string };
  if (!data.url) {
    throw new Error('Session Stripe invalide.');
  }

  window.location.assign(data.url);
}

export async function redirectToCustomerPortal(customerId: string, accessToken?: string): Promise<void> {
  if (!isStripeConfigured || !functionsUrl || !anonKey) {
    throw new Error('Portail Stripe bientôt disponible : configurez Stripe et les fonctions serveur.');
  }

  const response = await fetch(`${functionsUrl}/customer-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken || anonKey}`,
    },
    body: JSON.stringify({
      customerId,
      returnUrl: `${window.location.origin}/abonnement`,
    }),
  });

  if (!response.ok) {
    console.error('Erreur customer-portal', await response.text());
    throw new Error("Le portail client Stripe n'est pas encore disponible.");
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error('URL de portail Stripe invalide.');
  }

  window.location.assign(data.url);
}
