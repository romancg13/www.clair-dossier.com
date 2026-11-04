export const NEW_DOSSIER_PATH = '/dossier/nouveau';

/**
 * Destination du CTA « Créer un dossier ». Le tunnel exige un compte
 * (RequireAuth) : un visiteur passe par l'inscription, qui le renvoie
 * ensuite dans le tunnel grâce à `next`.
 */
export function newDossierHref(signedIn: boolean): string {
  return signedIn ? NEW_DOSSIER_PATH : `/inscription?next=${encodeURIComponent(NEW_DOSSIER_PATH)}`;
}
