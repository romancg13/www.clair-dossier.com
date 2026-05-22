const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined);

export const isStripeConfigured = Boolean(stripePublicKey && functionsUrl && anonKey);

export async function redirectToCheckout(planId: string): Promise<void> {
  if (!isStripeConfigured || !functionsUrl || !anonKey) {
    throw new Error('Paiement bientôt disponible : configurez Stripe et les fonctions serveur pour activer le checkout.');
  }

  const { supabase } = await import('./supabase');
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const session = data.session;
  if (!session?.user) {
    throw new Error('Connectez-vous ou créez un compte pour activer un abonnement Stripe.');
  }

  const response = await fetch(`${functionsUrl}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || anonKey}`,
    },
    body: JSON.stringify({
      planId,
      customerEmail: session?.user.email,
      userId: session?.user.id,
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

export async function openCustomerPortal(customerId: string): Promise<void> {
  if (!isStripeConfigured || !functionsUrl || !anonKey) {
    throw new Error('Portail Stripe bientôt disponible : configurez Stripe et les fonctions serveur.');
  }

  const { supabase } = await import('./supabase');
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token || anonKey;

  const response = await fetch(`${functionsUrl}/customer-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      customerId,
      returnUrl: `${window.location.origin}/abonnement`,
    }),
  });

  if (!response.ok) {
    console.error('Erreur customer-portal', await response.text());
    throw new Error("Le portail de facturation n'est pas encore disponible.");
  }

  const portal = (await response.json()) as { url?: string };
  if (!portal.url) throw new Error('Session portail Stripe invalide.');
  window.location.assign(portal.url);
}
