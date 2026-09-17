/**
 * Quota de dossiers — lecture de la réponse serveur et messages utilisateur.
 *
 * La décision appartient EXCLUSIVEMENT à la base (déclencheur
 * `dossiers_guard`, migration 20260917120000) : le quota y est vérifié et
 * consommé dans la même transaction que la validation du dossier. Ce module
 * n'autorise ni n'interdit rien ; il présente ce que le serveur publie et
 * traduit ses refus en français.
 */

export type DossierEntitlement = {
  applies: boolean;
  unlimited: boolean;
  dossierLimit: number | null;
  used: number;
  periodEnd: string | null;
  planId: string | null;
  subscriptionStatus: string | null;
  blockedReason: 'suspended' | 'payment' | null;
};

/** Réponse de `get_my_dossier_entitlement()` → objet typé, ou null si inexploitable. */
export function parseDossierEntitlement(payload: unknown): DossierEntitlement | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.applies !== 'boolean' || typeof p.unlimited !== 'boolean') return null;
  const limit = typeof p.dossier_limit === 'number' ? p.dossier_limit : null;
  const used = typeof p.used === 'number' ? p.used : 0;
  const blocked = p.blocked_reason === 'suspended' || p.blocked_reason === 'payment' ? p.blocked_reason : null;
  return {
    applies: p.applies,
    unlimited: p.unlimited,
    dossierLimit: limit,
    used,
    periodEnd: typeof p.period_end === 'string' ? p.period_end : null,
    planId: typeof p.plan_id === 'string' ? p.plan_id : null,
    subscriptionStatus: typeof p.subscription_status === 'string' ? p.subscription_status : null,
    blockedReason: blocked,
  };
}

function frenchDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Ligne d'état du compte : « 12 / 20 », « Illimités », ou null si non appliqué. */
export function quotaUsageLabel(e: DossierEntitlement | null): string | null {
  if (!e || !e.applies) return null;
  if (e.unlimited) return 'Illimités';
  if (e.dossierLimit === null) return null;
  return `${e.used} / ${e.dossierLimit}`;
}

/** Vrai si une nouvelle validation serait refusée (affichage préventif seulement). */
export function quotaReached(e: DossierEntitlement | null): boolean {
  if (!e) return false;
  if (e.blockedReason) return true;
  if (!e.applies || e.unlimited || e.dossierLimit === null) return false;
  return e.used >= e.dossierLimit;
}

export function quotaLimitMessage(periodEnd: string | null): string {
  const when = periodEnd ? ` à partir du ${frenchDate(periodEnd)}` : ' dès le renouvellement de votre abonnement';
  return `Vous avez atteint la limite de dossiers incluse dans votre abonnement pour cette période. Vous pourrez créer un nouveau dossier${when}, ou modifier votre offre.`;
}

export type SubmissionFailure =
  | { kind: 'quota'; message: string }
  | { kind: 'email'; message: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'rate'; message: string }
  | { kind: 'duplicate'; message: string };

/**
 * Traduit un refus de validation renvoyé par la base. Retourne null si
 * l'erreur n'est pas un refus métier connu (erreur technique générique).
 */
export function parseSubmissionError(error: unknown): SubmissionFailure | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { message?: string; details?: string | null; code?: string };
  const message = e.message ?? '';
  if (message.includes('DOSSIER_QUOTA_EXCEEDED')) {
    let periodEnd: string | null = null;
    try {
      const detail = JSON.parse(e.details ?? '{}') as { period_end?: string | null };
      periodEnd = detail.period_end ?? null;
    } catch {
      periodEnd = null;
    }
    return { kind: 'quota', message: quotaLimitMessage(periodEnd) };
  }
  if (message.includes('EMAIL_NOT_VERIFIED')) {
    return { kind: 'email', message: 'Votre adresse e-mail doit être vérifiée avant de valider un dossier.' };
  }
  if (message.includes('SUBMISSION_BLOCKED')) {
    return e.details === 'suspended'
      ? { kind: 'blocked', message: "Votre compte est suspendu. Contactez l'assistance ClairDossier." }
      : {
          kind: 'blocked',
          message:
            "Le paiement de votre abonnement est en attente : la création de dossiers est suspendue. Vos dossiers existants restent accessibles.",
        };
  }
  if (message.includes('RATE_LIMITED')) {
    return { kind: 'rate', message: 'Trop de dossiers validés en peu de temps. Patientez quelques minutes.' };
  }
  if (e.code === '23505' && message.includes('client_request')) {
    return { kind: 'duplicate', message: 'Votre dossier a déjà été enregistré.' };
  }
  return null;
}
