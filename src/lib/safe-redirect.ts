const SAME_SITE = 'https://clairdossier.invalid';

/**
 * Paramètre `?next=` : uniquement un chemin absolu du site (« /… »), sinon
 * `fallback`. Refuse « //hôte », « /\hôte » et toute forme que le parseur
 * d'URL ramènerait vers un autre site (tabulation ou saut de ligne retirés :
 * « /%09/hôte » → « //hôte »).
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/compte'): string {
  if (!raw || raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return fallback;
  try {
    return new URL(raw, SAME_SITE).origin === SAME_SITE ? raw : fallback;
  } catch {
    return fallback;
  }
}
