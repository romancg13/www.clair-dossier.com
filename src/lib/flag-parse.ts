/**
 * Lecture d'un flag booléen depuis une variable d'environnement — fonction
 * pure, sans dépendance à Vite, partagée par vite.config.ts (injection à la
 * compilation) et par les tests.
 *
 * « 0 », « false », « off », « no » (insensibles à la casse) désactivent ;
 * toute autre valeur active ; l'absence de variable applique la valeur par
 * défaut.
 */
export function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const value = raw.trim();
  if (value === '') return fallback;
  return !/^(0|false|off|no)$/i.test(value);
}
