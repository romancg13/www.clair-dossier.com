/**
 * Indicateurs techniques observables (/securite) — logique pure, testable.
 *
 * Principe : un indicateur n'affiche « Vérifié » que s'il repose sur une
 * vérification réelle, datée, et encore dans sa durée de validité. Sinon :
 *   - vérification trop ancienne ou dernier passage en échec → « À revérifier » ;
 *   - donnée absente, illisible ou incohérente              → « Information indisponible ».
 * Un indicateur n'est ni une certification ni une garantie de sécurité.
 *
 * La date courante est TOUJOURS fournie par l'appelant (évaluée côté client
 * dans un useEffect) : le rendu serveur (pré-rendu) et la première passe
 * d'hydratation restent identiques.
 */

export type Freshness = 'ok' | 'stale' | 'failed' | 'unavailable';

export const DAY_MS = 86_400_000;

/** Durées de validité (jours) au-delà desquelles un constat doit être refait. */
export const VALIDITY_DAYS = {
  /** Contrôles automatiques de publication (typage, tests, construction). */
  build: 30,
  /** Tests SQL de cloisonnement rejoués hors production. */
  sqlIsolation: 30,
} as const;

/** Tolérance d'horloge : une date « dans le futur » au-delà est incohérente. */
const CLOCK_SKEW_MS = DAY_MS;

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function evaluateCheck(
  input: { checkedAt: unknown; validityDays: number; failed?: boolean },
  now: Date,
): Freshness {
  const checked = parseIsoDate(input.checkedAt);
  if (!checked || Number.isNaN(now.getTime())) return 'unavailable';
  if (checked.getTime() - now.getTime() > CLOCK_SKEW_MS) return 'unavailable';
  if (input.failed) return 'failed';
  if (now.getTime() - checked.getTime() > input.validityDays * DAY_MS) return 'stale';
  return 'ok';
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  ok: 'Vérifié',
  stale: 'À revérifier',
  failed: 'À revérifier',
  unavailable: 'Information indisponible',
};

// ── /version.json (écrit par .github/workflows/deploy.yml après typage + tests + build) ──

export type VersionMarker = { commit: string; builtAt: string };

export function parseVersionMarker(raw: unknown): VersionMarker | null {
  if (!raw || typeof raw !== 'object') return null;
  const { commit, builtAt } = raw as Record<string, unknown>;
  if (typeof commit !== 'string' || !/^[0-9a-f]{7,40}$/i.test(commit)) return null;
  if (!parseIsoDate(builtAt)) return null;
  return { commit: commit.toLowerCase(), builtAt: builtAt as string };
}

// ── Relevé des tests SQL de cloisonnement (scripts/gen-security-status.ts) ──

export type SqlCheckRecord = {
  checkedAt: string;
  passed: number;
  failed: number;
  suite: string;
  scope: string;
};

export function parseSqlCheck(raw: unknown): SqlCheckRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const count = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
  if (!parseIsoDate(r.checkedAt) || !count(r.passed) || !count(r.failed)) return null;
  if (typeof r.suite !== 'string' || typeof r.scope !== 'string') return null;
  // Un relevé sans aucun test réussi n'est pas une vérification.
  if ((r.passed as number) === 0) return null;
  return {
    checkedAt: r.checkedAt as string,
    passed: r.passed as number,
    failed: r.failed as number,
    suite: r.suite,
    scope: r.scope,
  };
}

/** Lit la ligne de synthèse de tests/sql/migrations.pglite.mjs : « 46 réussis, 0 échoués ». */
export function parseSqlSummary(output: string): { passed: number; failed: number } | null {
  const m = /(\d+)\s+réussis,\s+(\d+)\s+échoués/.exec(output);
  if (!m) return null;
  return { passed: Number(m[1]), failed: Number(m[2]) };
}

// ── Connexion de la page (constat du navigateur) ──

export type ConnectionState = 'https' | 'local' | 'insecure';

export function classifyConnection(protocol: string, hostname: string): ConnectionState {
  if (protocol === 'https:') return 'https';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return 'local';
  return 'insecure';
}

// ── Dates affichées (fuseau fixe : identique quel que soit le poste) ──

export function formatFrDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(d);
}
