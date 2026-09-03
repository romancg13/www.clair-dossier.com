/**
 * Quasi-doublons : similarité de Jaccard entre ensembles de « shingles » (suites de
 * 5 mots normalisés) des textes complets de deux pièces. Déterministe, symétrique,
 * sans modèle. Un doublon strict est établi par empreinte (étape 5) ; ici, on
 * rapproche des pièces au contenu presque identique (nouvelle numérisation, copie
 * ré-enregistrée, version avec un en-tête différent).
 */
import { normaliserPourEmbedding } from "../pipeline/embedding.ts";

export const TAILLE_SHINGLE = 5;
/** Au-delà, deux pièces sont considérées quasi-doublons. */
export const SEUIL_QUASI_DOUBLON = 0.85;

export function shingles(texte: string, taille = TAILLE_SHINGLE): Set<string> {
  const mots = normaliserPourEmbedding(texte);
  const s = new Set<string>();
  if (mots.length === 0) return s;
  if (mots.length < taille) {
    s.add(mots.join(" "));
    return s;
  }
  for (let i = 0; i + taille <= mots.length; i++) s.add(mots.slice(i, i + taille).join(" "));
  return s;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : Math.round((inter / union) * 1000) / 1000;
}

export function similariteTextes(a: string, b: string): number {
  return jaccard(shingles(a), shingles(b));
}
