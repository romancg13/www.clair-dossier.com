/**
 * Parcours MFA admin (TOTP natif Supabase) — erreurs et rendu du QR.
 *
 * Séparé de la console pour être testable sans React (tests/mfa-errors.test.ts).
 * Règle (§ sécurité admin) : messages précis par cause réelle, mais jamais de
 * stack trace, de token, de secret TOTP ni de clé API — ni à l'écran ni en log.
 */

export type MfaPhase = 'bootstrap' | 'verify';

type MfaErrorShape = {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
};

function shape(e: unknown): MfaErrorShape {
  if (typeof e !== 'object' || e === null) {
    return { message: typeof e === 'string' ? e : undefined };
  }
  const o = e as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name : undefined,
    code: typeof o.code === 'string' ? o.code : undefined,
    status: typeof o.status === 'number' ? o.status : undefined,
    message: typeof o.message === 'string' ? o.message : undefined,
  };
}

/** Détails techniques sûrs à logger : uniquement name/code/status/message. */
export function mfaErrorDetails(e: unknown): MfaErrorShape {
  return shape(e);
}

/** Message utilisateur précis selon la cause réelle (codes GoTrue d'abord,
 *  repli sur le message pour les versions qui n'envoient pas de code). */
export function mfaErrorMessage(e: unknown, phase: MfaPhase): string {
  const { name, code, status, message } = shape(e);
  const m = (message ?? '').toLowerCase();

  // Configuration du projet Supabase : MFA TOTP désactivée (dashboard).
  if (
    code === 'mfa_totp_enroll_not_enabled' ||
    code === 'mfa_totp_verify_not_enabled' ||
    (m.includes('totp') && (m.includes('disabled') || m.includes('not enabled')))
  ) {
    return (
      'La vérification en deux étapes (TOTP) est désactivée sur le projet Supabase. ' +
      'Activez « TOTP (App Authenticator) » dans Authentication → Multi-Factor ' +
      'Authentication du dashboard Supabase, puis réessayez.'
    );
  }
  if (code === 'too_many_enrolled_mfa_factors') {
    return (
      'Trop de facteurs MFA sont enregistrés sur ce compte. Supprimez les facteurs ' +
      'obsolètes dans le dashboard Supabase (Authentication → Users → votre compte ' +
      '→ Factors), puis réessayez.'
    );
  }
  if (
    code === 'session_expired' ||
    code === 'session_not_found' ||
    code === 'bad_jwt' ||
    name === 'AuthSessionMissingError' ||
    status === 401
  ) {
    return 'Votre session a expiré. Reconnectez-vous.';
  }
  if (
    name === 'AuthRetryableFetchError' ||
    e instanceof TypeError ||
    m.includes('failed to fetch') ||
    m.includes('network')
  ) {
    return "Impossible de contacter le service d'authentification. Vérifiez votre connexion, puis réessayez.";
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return 'Trop de tentatives. Patientez quelques minutes, puis réessayez.';
  }
  if (phase === 'verify') {
    if (code === 'mfa_challenge_expired') {
      return 'Le délai de saisie est dépassé. Entrez le nouveau code affiché par votre application.';
    }
    if (code === 'mfa_verification_failed' || code === 'mfa_verification_rejected') {
      return "Code incorrect. Vérifiez votre application d'authentification.";
    }
    return 'Code invalide ou expiré. Réessayez.';
  }
  return 'Vérification MFA impossible pour le moment. Réessayez.';
}

/** Data-URI affichable pour le QR d'enrôlement.
 *  supabase-js ≥ 2 renvoie déjà `data:image/svg+xml;utf-8,<svg …>` avec le SVG
 *  BRUT : les `#` des couleurs y seraient lus comme fragment d'URL. On encode
 *  le SVG, sans toucher à une valeur déjà correctement encodée. */
export function mfaQrSrc(qr: string): string {
  const raw = qr.replace(/^data:image\/svg\+xml;utf-?8,/i, '');
  if (!raw.trimStart().startsWith('<')) return qr;
  return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`;
}
