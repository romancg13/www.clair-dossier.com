/**
 * Mesure d'audience SANS cookie (Lot 2.1) — enveloppe Plausible.
 *
 * Le site ne dépose aucun cookie et ne doit pas en déposer : Plausible
 * fonctionne sans identifiant persistant, donc sans bandeau de consentement.
 * Ce module est INACTIF tant que VITE_PLAUSIBLE_DOMAIN n'est pas défini —
 * aucun script tiers chargé, aucune requête, comportement du site inchangé.
 *
 * Activation : site « clair-dossier.com » créé dans Plausible, puis
 * VITE_PLAUSIBLE_DOMAIN défini dans .github/workflows/deploy.yml (GitHub Pages,
 * sans CSP par en-tête). Netlify (inactif) : ajouter l'hôte Plausible à sa CSP.
 *
 * Espaces privés EXCLUS de la mesure (aucune URL de dossier n'est transmise) :
 * PRIVATE_PATHS. Plausible n'enregistre ni la query string (sauf UTM) ni le hash.
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
  | 'demo_produit_terminee'
  | 'debut_checkout'
  /** Clic de l'encart partenaire vers le formulaire ClairNova (campagne DROIT10_2026, src/data/campagnes.ts). */
  | 'clic_clairnova_droit10';

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const HOST = (import.meta.env.VITE_PLAUSIBLE_HOST as string | undefined) ?? 'https://plausible.io';

export const analyticsEnabled = Boolean(DOMAIN);

/** Routes privées jamais mesurées (syntaxe data-exclude de Plausible). */
export const PRIVATE_PATHS = '/compte**, /admin**, /dossier/**';

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
  s.dataset.exclude = PRIVATE_PATHS;
  s.src = `${HOST}/js/script.exclusions.js`;
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
