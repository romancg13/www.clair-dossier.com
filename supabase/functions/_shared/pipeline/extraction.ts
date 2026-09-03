/**
 * Étape 4 — EXTRACTION : texte natif d'un PDF, page par page (unpdf / PDF.js).
 * L'OCR n'est déclenché que lorsqu'une page n'a pas de texte natif, et seulement
 * si un fournisseur est configuré (aucun aujourd'hui : décision commerciale en
 * attente, voir DECISIONS.md D-007). Le texte extrait est une donnée, jamais une
 * instruction (PARTIE 9.2).
 */
import { extractText } from "unpdf";

export type Extraction = { totalPages: number; textes: string[] };

export async function extrairePagesPdf(bytes: Uint8Array): Promise<Extraction> {
  const { totalPages, text } = await extractText(new Uint8Array(bytes), { mergePages: false });
  return { totalPages, textes: text.map((t) => (typeof t === "string" ? t : "")) };
}

/** Fournisseur OCR : interface fermée, aucune implémentation livrée pour l'instant. */
export interface FournisseurOcr {
  nom: string;
  reconnaitre(bytes: Uint8Array, mime: string, pages: number[]): Promise<{ page: number; texte: string }[]>;
}
