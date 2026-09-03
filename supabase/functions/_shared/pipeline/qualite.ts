/**
 * Étape 5 — QUALITÉ : score de lisibilité d'un texte extrait, déterministe et
 * explicable. Sous le seuil, la pièce n'est pas traitée « en dégradé » : elle est
 * marquée illisible et escaladée (E4). Aucun modèle n'intervient.
 *
 * Le score combine trois observations sur le texte d'une page :
 *   - la part de caractères de remplacement (U+FFFD), signe d'un encodage cassé ;
 *   - la part de lettres et chiffres parmi les caractères non blancs ;
 *   - la part de « mots plausibles » (lettres/chiffres, ponctuation usuelle, ≤ 30 signes).
 * score = (1 − 3 × remplacement) × √(lettres_chiffres × mots_plausibles), borné à [0, 1].
 */
import type { PageExtraite } from "./types.ts";

/** Valeur de référence, à calibrer sur le dossier étalon (PARTIE 10). */
export const SEUIL_QUALITE = 0.6;
/** En dessous, une page est considérée sans texte exploitable. */
export const MIN_CARACTERES_PAGE = 20;

/** Un mot plausible : commence par une lettre ou un chiffre (ponctuation ouvrante tolérée), ≤ 30 signes usuels. */
const MOT_PLAUSIBLE = /^[(«"'’[]?[\p{L}\p{N}][\p{L}\p{N}'’.,;:()€%/°«»"\]-]{0,29}$/u;
const CARACTERE_REMPLACEMENT = "�";

/** Retire les césures conditionnelles, replie les blancs, conserve les sauts de ligne. */
export function normaliserTexte(texte: string): string {
  return texte
    .replace(/­/g, "")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Score de lisibilité dans [0, 1], arrondi au millième. */
export function scorerTexte(texte: string): number {
  const t = normaliserTexte(texte).replace(/\s+/g, " ");
  if (t.length < MIN_CARACTERES_PAGE) return 0;
  const chars = Array.from(t.replace(/ /g, ""));
  const n = chars.length;
  if (n === 0) return 0;
  const remplacement = chars.filter((c) => c === CARACTERE_REMPLACEMENT).length / n;
  const lettresChiffres = chars.filter((c) => /[\p{L}\p{N}]/u.test(c)).length / n;
  // Seuls les jetons portant au moins une lettre ou un chiffre comptent comme mots.
  const mots = t.split(" ").filter((m) => /[\p{L}\p{N}]/u.test(m));
  const plausibles = mots.length === 0 ? 0 : mots.filter((m) => MOT_PLAUSIBLE.test(m)).length / mots.length;
  // Moyenne géométrique : un seul mot correct au milieu du bruit ne « sauve » pas la page.
  const score = Math.max(0, 1 - 3 * remplacement) * Math.sqrt(lettresChiffres * plausibles);
  return Math.round(Math.min(1, score) * 1000) / 1000;
}

export type Evaluation = {
  /** Moyenne des scores des pages avec texte, pondérée par leur longueur ; null si aucune. */
  score_document: number | null;
  pages_sans_texte: number[];
  pages_sous_seuil: number[];
  pages: PageExtraite[];
};

/** Attribue un score à chaque page et qualifie le document. */
export function evaluerQualite(textes: string[]): Evaluation {
  const pages: PageExtraite[] = [];
  const pages_sans_texte: number[] = [];
  const pages_sous_seuil: number[] = [];
  let somme = 0;
  let poids = 0;
  textes.forEach((brut, i) => {
    const page = i + 1;
    const texte = normaliserTexte(brut);
    if (texte.length < MIN_CARACTERES_PAGE) {
      pages_sans_texte.push(page);
      pages.push({ page, texte, methode: "ocr_requis", score_qualite: null });
      return;
    }
    const score = scorerTexte(texte);
    if (score < SEUIL_QUALITE) pages_sous_seuil.push(page);
    somme += score * texte.length;
    poids += texte.length;
    pages.push({ page, texte, methode: "natif", score_qualite: score });
  });
  const score_document = poids > 0 ? Math.round((somme / poids) * 1000) / 1000 : null;
  return { score_document, pages_sans_texte, pages_sous_seuil, pages };
}
