// Logique pure de synchronisation Stripe → base (aucune dépendance Deno ni
// réseau) : testée côté Node dans tests/stripe-sync.test.ts.

export type StripeLikePrice = {
  id?: string;
  metadata?: Record<string, string> | null;
  product?: string | { id?: string; metadata?: Record<string, string> | null } | null;
};

export type StripeLikeSubscription = {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean | null;
  canceled_at?: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      price?: StripeLikePrice | null;
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function iso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Période de facturation courante. Selon la version d'API Stripe, elle est
 * portée par l'abonnement (≤ 2025-02) ou par ses lignes (≥ 2025-03 « basil »).
 */
export function extractPeriod(sub: StripeLikeSubscription): { start: string | null; end: string | null } {
  const item = sub.items?.data?.[0];
  return {
    start: iso(sub.current_period_start ?? item?.current_period_start),
    end: iso(sub.current_period_end ?? item?.current_period_end),
  };
}

/** Identifiant d'offre ClairDossier (metadata.planId posée par scripts/create-stripe-products.mjs). */
export function planIdFromSubscription(sub: StripeLikeSubscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  if (!price) return null;
  const fromPrice = price.metadata?.planId;
  if (fromPrice) return fromPrice;
  const product = price.product;
  if (product && typeof product === 'object' && product.metadata?.planId) return product.metadata.planId;
  return null;
}

export function customerId(sub: StripeLikeSubscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
}

/** Ligne `subscriptions` prête à l'upsert (plan_id validé par l'appelant). */
export function subscriptionRow(userId: string, sub: StripeLikeSubscription, knownPlanId: string | null) {
  const { start, end } = extractPeriod(sub);
  return {
    user_id: userId,
    stripe_customer_id: customerId(sub),
    stripe_subscription_id: sub.id,
    stripe_price_id: sub.items?.data?.[0]?.price?.id ?? null,
    plan_id: knownPlanId,
    status: sub.status,
    current_period_start: start,
    current_period_end: end,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    canceled_at: iso(sub.canceled_at),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Abonnement d'une facture. Le champ a changé de place selon la version d'API
 * de l'endpoint webhook : `invoice.subscription` (≤ 2025-02) ou
 * `invoice.parent.subscription_details.subscription` (≥ 2025-03).
 */
export function subscriptionIdFromInvoice(invoice: {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
}): string | null {
  const ref = invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

/** Événements traités ; les autres sont acquittés sans effet. */
export const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);

/** Texte de notification administrateur — minimisation (aucun titre, aucun contenu). */
export function adminNotificationText(name: string | null): string {
  const who = name?.trim() ? ` par ${name.trim()}` : '';
  return `Nouveau dossier ClairDossier créé${who}. Connectez-vous à votre espace administrateur pour le consulter.`;
}
