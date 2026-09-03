/**
 * Pièces d'un dossier : empreinte, nommage, libellés d'ingestion.
 *
 * Module sans dépendance au navigateur (WebCrypto est disponible dans le
 * navigateur et dans Node ≥ 20) : il est testé unitairement et partagé avec le
 * pipeline serveur.
 */

/** Empreinte SHA-256 hexadécimale (minuscules) d'un contenu. */
export async function sha256Hex(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const source: BufferSource =
    data instanceof Blob ? await data.arrayBuffer() : (data as BufferSource);
  const digest = await crypto.subtle.digest("SHA-256", source);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Nom de fichier sûr pour un chemin de stockage (inchangé depuis le tunnel historique). */
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

/**
 * Métadonnées calculées côté client au dépôt d'une pièce. Le serveur recalcule
 * l'empreinte lors de l'ingestion et fait foi (`hash_verifie_le`).
 */
export async function pieceMetadata(
  file: File,
): Promise<{ hash_sha256?: string; mime?: string }> {
  const meta: { hash_sha256?: string; mime?: string } = {};
  try {
    meta.hash_sha256 = await sha256Hex(file);
  } catch {
    // Contexte sans WebCrypto (très ancien navigateur) : le serveur calculera.
  }
  if (file.type) meta.mime = file.type;
  return meta;
}

/**
 * Le client peut être déployé avant que la migration correspondante soit appliquée
 * (GitHub Pages sur push, migration appliquée à la main). PostgREST répond alors
 * PGRST204 (colonne inconnue à l'insertion) ou 42703 (colonne inconnue en lecture).
 * Les appels concernés retombent sur le comportement historique.
 */
export function isUnknownColumnError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "PGRST204" || code === "42703";
}

/** Libellés utilisateur des statuts d'ingestion (colonne `statut_ingestion`). */
export const INGESTION_LABELS: Record<string, string> = {
  recu: "Reçue",
  doublon: "Doublon",
  extraction: "Lecture en cours",
  qualite_insuffisante: "Illisible",
  decoupe: "Analyse en cours",
  vectorise: "Analyse en cours",
  analyse: "Analyse en cours",
  termine: "Analysée",
  echec: "Erreur de traitement",
};
