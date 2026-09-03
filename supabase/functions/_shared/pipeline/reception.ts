/**
 * Étape 1 — RÉCEPTION : type réel du fichier (signature binaire, jamais la seule
 * déclaration du client), types pris en charge, taille, antivirus, quota.
 *
 * Déterministe, sans modèle. Le contenu d'un document est une donnée : rien n'est
 * interprété ici, on ne lit que les premiers octets.
 */
import type { Controles, DocumentIngestion, Quota } from "./types.ts";

/** Types acceptés par le pipeline aujourd'hui. Tout autre type est refusé, pas « tenté ». */
export const TYPES_ACCEPTES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type TypeAccepte = (typeof TYPES_ACCEPTES)[number];

/** Type réel d'après la signature binaire ; null si inconnue. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf"; // %PDF-
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export type Reception =
  | { ok: true; mime: TypeAccepte; controles: Controles }
  | { ok: false; erreur: string; mime: string | null; controles: Controles };

/**
 * Contrôles de réception. Le quota a été évalué côté base (I7) et est passé ici
 * pour figurer dans le compte rendu. L'antivirus n'est pas disponible dans cet
 * environnement : c'est dit dans `controles.antivirus`, jamais présenté comme fait.
 */
export function controlerReception(doc: DocumentIngestion, bytes: Uint8Array, quota: Quota): Reception {
  const controles: Controles = { quota: "ok", type: "ok", taille: "ok", antivirus: "non_disponible" };
  if (!quota.ok) {
    controles.quota = quota.motif ?? "QUOTA_REFUSE";
    return { ok: false, erreur: `QUOTA:${controles.quota}`, mime: doc.mime, controles };
  }
  if (bytes.length === 0) {
    controles.taille = "FICHIER_VIDE";
    return { ok: false, erreur: "FICHIER_VIDE", mime: doc.mime, controles };
  }
  const reel = sniffMime(bytes);
  if (reel === null) {
    controles.type = "TYPE_NON_PRIS_EN_CHARGE";
    return { ok: false, erreur: "TYPE_NON_PRIS_EN_CHARGE", mime: doc.mime, controles };
  }
  if (doc.mime && doc.mime !== reel) {
    controles.type = "MIME_INCOHERENT";
    return { ok: false, erreur: `MIME_INCOHERENT:${doc.mime}!=${reel}`, mime: reel, controles };
  }
  if (!(TYPES_ACCEPTES as readonly string[]).includes(reel)) {
    controles.type = "TYPE_NON_PRIS_EN_CHARGE";
    return { ok: false, erreur: "TYPE_NON_PRIS_EN_CHARGE", mime: reel, controles };
  }
  if (doc.size_bytes !== null && doc.size_bytes !== bytes.length) {
    // Taille déclarée par le client ≠ taille réelle : corrigée par l'empreinte serveur, signalé.
    controles.taille = `TAILLE_DECLAREE_DIFFERENTE:${doc.size_bytes}!=${bytes.length}`;
  }
  return { ok: true, mime: reel as TypeAccepte, controles };
}
