/**
 * Offre LB13 — source unique des conditions affichées (bannière, /tarifs) ;
 * mêmes valeurs que la configuration Stripe (scripts/lib/lb13.mjs).
 *
 * « Avant le 21 septembre 2026 » = borne exclusive le 21/09/2026 à 00:00,
 * heure de Paris (CEST, UTC+2) = 2026-09-20T22:00:00Z. Après cette date, la
 * promotion publique disparaît ; les remises déjà acquises vont à leur terme.
 *
 * La réduction réelle est appliquée par Stripe, jamais par le site. Tant que
 * la mise en service LIVE n'a pas été vérifiée (script puis Checkout réel), la
 * variable de build VITE_LB13_LIVE reste absente : le site signale alors que
 * le code peut encore être refusé, au lieu d'annoncer une offre utilisable.
 */
export const LB13_OFFER = {
  code: 'LB13',
  percentOff: 20,
  months: 4,
  deadlineIso: '2026-09-21T00:00:00+02:00',
  deadlineLabel: 'avant le 21 septembre 2026',
} as const;

export const LB13_DEADLINE_MS = Date.parse(LB13_OFFER.deadlineIso);

// `?.` : module aussi importé hors Vite (tests Node), où import.meta.env n'existe pas.
export const LB13_LIVE_VERIFIED = import.meta.env?.VITE_LB13_LIVE === 'true';

export type Lb13Phase = 'active' | 'pending' | 'ended';

export function lb13Phase(nowMs: number, liveVerified: boolean = LB13_LIVE_VERIFIED): Lb13Phase {
  if (nowMs >= LB13_DEADLINE_MS) return 'ended';
  return liveVerified ? 'active' : 'pending';
}

/** Mensualité remisée (4 premiers mois), arrondie au centime. */
export function lb13DiscountedMonthly(priceMonthly: number): number {
  return Math.round(priceMonthly * (100 - LB13_OFFER.percentOff)) / 100;
}

/** Paramètre de requête qui porte l'intention promotionnelle (bannière → tarifs → connexion → tarifs). */
export const LB13_INTENT_PARAM = 'offre';
export const LB13_INTENT_VALUE = 'lb13';

/**
 * Préremplit le code sur un Payment Link MENSUEL uniquement quand l'offre est
 * vérifiée et en cours. Le client peut toujours saisir le code à la main ;
 * Stripe reste seul juge de sa validité (échéance contrôlée côté Stripe).
 */
export function withLb13Prefill(checkoutUrl: string, opts: { monthly: boolean; intent: boolean; phase: Lb13Phase }): string {
  if (!opts.monthly || !opts.intent || opts.phase !== 'active') return checkoutUrl;
  const url = new URL(checkoutUrl);
  url.searchParams.set('prefilled_promo_code', LB13_OFFER.code);
  return url.toString();
}
