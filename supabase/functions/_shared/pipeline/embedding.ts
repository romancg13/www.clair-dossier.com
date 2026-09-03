/**
 * Étape 7 du pipeline — VECTORISATION.
 *
 * L'interface `FournisseurEmbedding` est le seul point de contact avec un modèle
 * d'embedding. Aucun fournisseur externe n'est configuré : le choix (fournisseur,
 * coût, localisation des données, contrat de sous-traitance — PARTIE 9.3/9.4) est
 * une décision humaine (DECISIONS.md D-008).
 *
 * En attendant, `embeddingLexicalHache` fournit une vectorisation LEXICALE
 * déterministe et sans dépendance (hachage de traits : unigrammes et bigrammes de
 * mots normalisés, projetés sur 1024 dimensions avec signe, norme L2 = 1). Ce
 * n'est pas un embedding sémantique neuronal et il n'est jamais présenté comme
 * tel : il rend la recherche hybride et son cloisonnement fonctionnels et testables
 * dès maintenant, avec la même dimension que les fournisseurs courants.
 */
export interface FournisseurEmbedding {
  nom: string;
  dimension: number;
  vectoriser(textes: string[]): Promise<(number[] | null)[]>;
}

export const DIMENSION_EMBEDDING = 1024;

/** Mots normalisés : minuscules, sans accents, chiffres groupés recollés (1 200 → 1200). */
export function normaliserPourEmbedding(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d)[\s  ](?=\d{3}\b)/g, "$1")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((m) => m.length >= 2);
}

/** FNV-1a 32 bits, déterministe sur toutes les plateformes. */
export function fnv1a32(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Vecteur haché normalisé ; null si le texte ne contient aucun mot. */
export function vectoriserHache(texte: string, dimension = DIMENSION_EMBEDDING): number[] | null {
  const mots = normaliserPourEmbedding(texte);
  if (mots.length === 0) return null;
  const v = new Array<number>(dimension).fill(0);
  const ajouter = (trait: string, poids: number) => {
    const h = fnv1a32(trait);
    const signe = (h & 0x80000000) === 0 ? 1 : -1;
    v[h % dimension] += signe * poids;
  };
  for (let i = 0; i < mots.length; i++) {
    ajouter(`u:${mots[i]}`, 1);
    if (i + 1 < mots.length) ajouter(`b:${mots[i]}_${mots[i + 1]}`, 0.5);
  }
  const norme = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norme === 0) return null;
  return v.map((x) => Math.round((x / norme) * 1e6) / 1e6);
}

export const embeddingLexicalHache: FournisseurEmbedding = {
  nom: "lexical-hache-fnv1a-1024",
  dimension: DIMENSION_EMBEDDING,
  vectoriser: async (textes) => textes.map((t) => vectoriserHache(t)),
};

/** Sérialisation pgvector : "[x1,x2,…]". */
export function versTextePgvector(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Similarité cosinus entre deux vecteurs normalisés (outil de test et de reclassement). */
export function cosinus(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
