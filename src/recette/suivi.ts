// Cadence de consultation d'un dossier en cours de lecture (DossierPage) : rapprochée au début, quand le premier
// résultat d'un petit dépôt est attendu en quelques secondes, puis espacée pour un gros lot (chaque consultation
// lit le stockage). Fonction pure, partagée avec la mesure de latence (scripts/recette/latence.ts).
export const SONDAGE = { rapideMs: 2000, rapideJusquA: 30_000, moyenMs: 4000, moyenJusquA: 120_000, lentMs: 8000 };

/** Délai avant la prochaine consultation, selon le temps écoulé depuis le début du suivi (ms). */
export function delaiSondage(ecouleMs: number): number {
  if (ecouleMs < SONDAGE.rapideJusquA) return SONDAGE.rapideMs;
  if (ecouleMs < SONDAGE.moyenJusquA) return SONDAGE.moyenMs;
  return SONDAGE.lentMs;
}
