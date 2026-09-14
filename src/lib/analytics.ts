/**
 * Mesure d'audience SANS cookie (Lot 2.1) — enveloppe Plausible.
 *
 * Le site ne dépose aucun cookie et ne doit pas en déposer : Plausible
 * fonctionne sans identifiant persistant, donc sans bandeau de consentement.
 * Ce module est INACTIF tant que VITE_PLAUSIBLE_DOMAIN n'est pas défini —
 * aucun script tiers chargé, aucune requête, comportement du site inchangé.
 *
 * Activation (décision humaine — voir docs/GO-LIVE-NETLIFY.md) :
 *   1. créer le site dans Plausible (plausible.io ou instance auto-hébergée) ;
 *   2. définir VITE_PLAUSIBLE_DOMAIN = "www.clair-dossier.com" dans
 *      [build.environment] de netlify.toml (+ VITE_PLAUSIBLE_HOST si auto-hébergé) ;
 *   3. ajouter l'hôte Plausible à script-src et connect-src de la CSP (netlify.toml).
 *
 * Événements nommés — ceux du cahier des charges, et eux seuls :
 *   - abonnement_actif ne peut PAS être émis côté client (l'activation réelle
 *     n'est connue que par Stripe) : réservé à un futur webhook Stripe.
 *   - demo_produit_ouverte / demo_produit_terminee : réservés à la future
 *     démo produit interactive (n'existe pas encore — voir /etat-du-produit).
 */
export type AnalyticsEvent =
  | 'demande_demo'
  | 'devis_grand_compte'
  | 'creation_compte'
  | 'abonnement_actif'
  | 'telechargement_dpa'
  | 'consultation_trust_center'
  | 'demo_produit_ouverte'
  | 'demo_produit_terminee';

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const HOST = (import.meta.env.VITE_PLAUSIBLE_HOST as string | undefined) ?? 'https://plausible.io';

export const analyticsEnabled = Boolean(DOMAIN);

type PlausibleFn = ((event: string, opts?: { props?: Record<string, string | number> }) => void) & {
  q?: unknown[];
};

/** Charge le script Plausible (une seule fois). Sans domaine configuré : no-op. */
export function initAnalytics(): void {
  if (!DOMAIN || typeof document === 'undefined') return;
  if (document.querySelector('script[data-analytics="plausible"]')) return;
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.analytics = 'plausible';
  s.dataset.domain = DOMAIN;
  s.src = `${HOST}/js/script.js`;
  document.head.appendChild(s);
}

/** Émet un événement nommé. Sans domaine configuré : no-op silencieux. */
export function trackEvent(event: AnalyticsEvent, props?: Record<string, string | number>): void {
  if (!DOMAIN || typeof window === 'undefined') return;
  const w = window as Window & { plausible?: PlausibleFn };
  if (!w.plausible) {
    // File d'attente officielle Plausible : les appels émis avant le
    // chargement du script sont rejoués par celui-ci.
    const queued = ((...args: unknown[]) => {
      (queued.q = queued.q ?? []).push(args);
    }) as PlausibleFn;
    w.plausible = queued;
  }
  w.plausible(event, props ? { props } : undefined);
}
