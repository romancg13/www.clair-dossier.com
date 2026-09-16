/**
 * Messages d'erreur utilisateur — français, actionnables, sans détail technique.
 *
 * MASTER_PROMPT §50 / §27 : l'utilisateur comprend et sait quoi faire ; la
 * cause technique reste dans les journaux applicatifs, jamais à l'écran.
 * Les traductions d'authentification reprennent mot pour mot celles du site
 * web (`src/lib/auth.tsx`) pour que les deux plateformes parlent pareil.
 */

export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
    return 'Un compte existe déjà avec cet email. Connectez-vous.';
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('password should be at least')) return 'Mot de passe trop court (6 caractères minimum).';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Adresse email invalide.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (m.includes('email not confirmed')) return "Email non confirmé. Vérifiez votre boîte mail.";
  return message;
}

export type FailureKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'forbidden'
  | 'not-found'
  | 'too-large'
  | 'quota'
  | 'server'
  | 'unknown';

/** Classe une erreur brute sans jamais exposer son contenu à l'utilisateur. */
export function classifyFailure(error: unknown): FailureKind {
  const raw = typeof error === 'string' ? error : (error as { message?: string })?.message ?? '';
  const m = raw.toLowerCase();
  const status = (error as { status?: number })?.status;
  if (status === 401 || m.includes('jwt') || m.includes('session')) return 'auth';
  if (status === 403 || m.includes('row-level security') || m.includes('not authorized')) return 'forbidden';
  if (status === 404 || m.includes('not found')) return 'not-found';
  if (status === 413 || m.includes('payload too large') || m.includes('exceeded the maximum')) return 'too-large';
  if (status === 429 || m.includes('rate limit')) return 'quota';
  if (typeof status === 'number' && status >= 500) return 'server';
  if (m.includes('timeout') || m.includes('aborted')) return 'timeout';
  if (m.includes('network') || m.includes('fetch failed') || m.includes('offline') || m.includes('connexion'))
    return 'network';
  return 'unknown';
}

const MESSAGES: Record<FailureKind, string> = {
  network: 'Connexion indisponible. Vérifiez votre réseau puis réessayez.',
  timeout: "L'opération a mis trop de temps. Réessayez dans un instant.",
  auth: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  forbidden: "Vous n'avez pas accès à cet élément.",
  'not-found': 'Cet élément est introuvable. Il a peut-être été supprimé.',
  'too-large': 'Ce fichier est trop volumineux (maximum 25 Mo).',
  quota: 'Trop de demandes en peu de temps. Patientez quelques instants.',
  server: "Le service est momentanément indisponible. Réessayez dans quelques minutes.",
  unknown: "L'opération n'a pas abouti. Réessayez ; si le problème persiste, contactez l'assistance.",
};

/** Message affichable. `context` précise l'action (« Impossible d'importer le document. »). */
export function userMessage(error: unknown, context?: string): string {
  const base = MESSAGES[classifyFailure(error)];
  return context ? `${context} ${base}` : base;
}

/** Vrai si l'erreur justifie une nouvelle tentative automatique. */
export function isRetryable(error: unknown): boolean {
  const kind = classifyFailure(error);
  return kind === 'network' || kind === 'timeout' || kind === 'server';
}
