/**
 * Droits & abonnement — couche unique, agnostique du prestataire de paiement.
 *
 * RÈGLE ABSOLUE (MASTER_PROMPT V.5) : **le serveur est la seule source de
 * vérité**. Ce module ne calcule aucun droit à partir du client ; il se contente
 * de LIRE une réponse serveur et de la présenter. Tant que le serveur ne publie
 * rien (situation actuelle : abonnements Stripe par Payment Links, rapprochement
 * manuel par l'équipe, aucun webhook — voir /etat-du-produit), l'état est
 * `unknown` et **aucune fonctionnalité n'est verrouillée côté client** : le
 * comportement reste exactement celui d'aujourd'hui.
 *
 * Aucune dépendance à Stripe, à Apple ou à Google ici : l'application parle à
 * ce contrat, jamais à un prestataire.
 */

export type PlanId =
  | 'gratuit'
  | 'essentiel'
  | 'entrepreneur'
  | 'business-pme-20'
  | 'business-pme-50'
  | 'business-pme-pro'
  | 'business-pme-premium'
  | 'business-pme-sur-mesure';

export const PLAN_LABELS: Record<PlanId, string> = {
  gratuit: 'Compte gratuit',
  essentiel: 'Essentiel',
  entrepreneur: 'Entrepreneur',
  'business-pme-20': 'Business PME 20',
  'business-pme-50': 'Business PME 50',
  'business-pme-pro': 'Business / PME Pro',
  'business-pme-premium': 'Business / PME Premium',
  'business-pme-sur-mesure': 'Business / PME personnalisée',
};

export type SubscriptionSource = 'stripe' | 'apple' | 'google' | 'manuel';

/** Ce que le serveur publie (aucun champ obligatoire hors `plan` et `status`). */
export type Entitlements = {
  plan: PlanId;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  source?: SubscriptionSource;
  /** Fin de période en cours (ISO). Affichage seulement. */
  current_period_end?: string | null;
  /** Quotas publiés par le serveur. `null` = illimité, absent = non appliqué. */
  limits?: {
    dossiers?: number | null;
    users?: number | null;
    storage_bytes?: number | null;
  };
  /** Capacités nommées activées par le serveur (liste blanche). */
  features?: string[];
};

export type EntitlementsState =
  | { kind: 'unknown'; reason: 'not-published' | 'offline' | 'error' }
  | { kind: 'known'; entitlements: Entitlements };

/** État par défaut : inconnu, donc rien n'est verrouillé côté client. */
export const UNKNOWN_ENTITLEMENTS: EntitlementsState = { kind: 'unknown', reason: 'not-published' };

/**
 * Valide une réponse serveur. Retourne `unknown` (et non une valeur inventée)
 * dès que la charge utile n'est pas exploitable.
 */
export function parseEntitlements(payload: unknown): EntitlementsState {
  if (!payload || typeof payload !== 'object') return { kind: 'unknown', reason: 'not-published' };
  const p = payload as Record<string, unknown>;
  const plan = typeof p.plan === 'string' ? p.plan : null;
  const status = typeof p.status === 'string' ? p.status : null;
  if (!plan || !status) return { kind: 'unknown', reason: 'error' };
  if (!(plan in PLAN_LABELS)) return { kind: 'unknown', reason: 'error' };
  const allowed = ['active', 'trialing', 'past_due', 'canceled', 'none'];
  if (!allowed.includes(status)) return { kind: 'unknown', reason: 'error' };
  const limitsRaw = (p.limits ?? undefined) as Record<string, unknown> | undefined;
  const num = (v: unknown): number | null | undefined =>
    v === null ? null : typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return {
    kind: 'known',
    entitlements: {
      plan: plan as PlanId,
      status: status as Entitlements['status'],
      source: typeof p.source === 'string' ? (p.source as SubscriptionSource) : undefined,
      current_period_end: typeof p.current_period_end === 'string' ? p.current_period_end : null,
      limits: limitsRaw
        ? {
            dossiers: num(limitsRaw.dossiers),
            users: num(limitsRaw.users),
            storage_bytes: num(limitsRaw.storage_bytes),
          }
        : undefined,
      features: Array.isArray(p.features) ? p.features.filter((f): f is string => typeof f === 'string') : undefined,
    },
  };
}

export type QuotaVerdict =
  | { allowed: true; reason: 'no-server-limit' | 'within-limit' }
  | { allowed: false; reason: 'limit-reached'; limit: number; message: string };

/**
 * Le client n'interdit une action QUE si le serveur a publié une limite.
 * Sans limite publiée, on autorise (le serveur reste l'arbitre final).
 */
export function checkDossierQuota(state: EntitlementsState, currentCount: number): QuotaVerdict {
  if (state.kind !== 'known') return { allowed: true, reason: 'no-server-limit' };
  const limit = state.entitlements.limits?.dossiers;
  if (limit === undefined || limit === null) return { allowed: true, reason: 'no-server-limit' };
  if (currentCount < limit) return { allowed: true, reason: 'within-limit' };
  return {
    allowed: false,
    reason: 'limit-reached',
    limit,
    message: `Votre formule ${PLAN_LABELS[state.entitlements.plan]} couvre ${limit} dossier${limit > 1 ? 's' : ''}. Contactez l'assistance pour en ouvrir davantage.`,
  };
}

/** Une capacité nommée est active seulement si le serveur l'a listée. */
export function hasFeature(state: EntitlementsState, feature: string): boolean | 'unknown' {
  if (state.kind !== 'known') return 'unknown';
  const list = state.entitlements.features;
  if (!list) return 'unknown';
  return list.includes(feature);
}

/** Phrase d'état affichable dans l'écran Compte — jamais inventée. */
export function subscriptionSummary(state: EntitlementsState): string {
  if (state.kind !== 'known') {
    return "Votre abonnement est suivi par l'équipe ClairDossier. Aucun paiement n'est géré dans l'application.";
  }
  const { plan, status } = state.entitlements;
  const label = PLAN_LABELS[plan];
  switch (status) {
    case 'active':
    case 'trialing':
      return `Formule ${label} — active.`;
    case 'past_due':
      return `Formule ${label} — paiement en attente. L'assistance peut vous aider.`;
    case 'canceled':
      return `Formule ${label} — résiliée.`;
    default:
      return 'Aucun abonnement actif.';
  }
}
