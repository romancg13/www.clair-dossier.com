/**
 * Étape 2 — EMPREINTE : SHA-256 hexadécimal minuscule, calculé côté serveur sur les
 * octets réellement stockés. Même algorithme que `src/lib/documents.ts` (client) ;
 * dupliqué volontairement : le code serveur ne dépend pas du bundle client.
 */
export async function empreinteSha256(bytes: Uint8Array): Promise<string> {
  const copie = new Uint8Array(bytes); // tampon propre, indépendant du runtime appelant
  const digest = await crypto.subtle.digest("SHA-256", copie);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
