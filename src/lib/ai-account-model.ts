/** Logique pure de l'analyse automatique par compte (sans dépendance réseau, testée). */

/** Version des conditions acceptées (journalisée en base avec l'horodatage). */
export const AI_ACCOUNT_TERMS_VERSION = 'ia-2026-11';

export interface AiAccountStatus {
  enabled: boolean;
  termsVersion: string | null;
  acceptedAt: string | null;
  /** L'interrupteur général autorise ce compte (ouvert, ou pilote pour l'administration). */
  gateAllows: boolean;
  /** Abonnement actif ou dérogation. */
  eligible: boolean;
}

interface AiAccountRow {
  enabled: boolean | null;
  terms_version: string | null;
  accepted_at: string | null;
  gate_allows: boolean | null;
  eligible: boolean | null;
}

export function parseAiAccount(data: unknown): AiAccountStatus | null {
  const row = (Array.isArray(data) ? data[0] : data) as AiAccountRow | null | undefined;
  if (!row) return null;
  return {
    enabled: row.enabled === true,
    termsVersion: row.terms_version ?? null,
    acceptedAt: row.accepted_at ?? null,
    gateAllows: row.gate_allows === true,
    eligible: row.eligible === true,
  };
}

/** Fenêtre d'acceptation : seulement si l'analyse est ouverte, le compte éligible et rien n'est encore accepté. */
export function shouldAskAiConsent(status: AiAccountStatus | null, dismissed: boolean): boolean {
  if (!status || dismissed) return false;
  return status.gateAllows && status.eligible && !status.enabled;
}

const ERRORS: Record<string, string> = {
  ANALYSE_FERMEE: "L'analyse automatique n'est pas encore ouverte pour votre compte.",
  AUTH_REQUIRED: 'Connectez-vous pour continuer.',
};

export function aiAccountError(message: string): string {
  const code = Object.keys(ERRORS).find((k) => message.includes(k));
  return code ? ERRORS[code] : "L'opération n'a pas abouti. Réessayez dans un instant.";
}

