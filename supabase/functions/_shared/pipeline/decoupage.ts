/**
 * Étape 6 du pipeline — DÉCOUPAGE : chunks « sémantiques » (paragraphes puis
 * phrases, regroupés jusqu'à une taille cible) avec conservation de la page et des
 * offsets dans le texte de la page : `texte_page.slice(offset_debut, offset_fin)`
 * redonne exactement le chunk. Déterministe, sans modèle.
 */
import type { Chunk } from "./types.ts";

/** Taille visée d'un chunk (caractères) et taille maximale avant coupe forcée. */
export const TAILLE_CIBLE = 700;
export const TAILLE_MAX = 1000;
/** En dessous, un fragment isolé est fusionné avec le précédent plutôt que d'exister seul. */
export const TAILLE_MIN = 40;

type Segment = { debut: number; fin: number };

/** Segments (phrases) d'une page : paragraphes → lignes → phrases, avec offsets absolus. */
export function segmenter(texte: string): Segment[] {
  const segments: Segment[] = [];
  for (const ligne of texte.matchAll(/[^\n]+/g)) {
    const base = ligne.index ?? 0;
    for (const phrase of ligne[0].matchAll(/[^.!?]+(?:[.!?]+|$)/g)) {
      const brut = phrase[0];
      const gauche = brut.length - brut.trimStart().length;
      const droite = brut.length - brut.trimEnd().length;
      const debut = base + (phrase.index ?? 0) + gauche;
      const fin = base + (phrase.index ?? 0) + brut.length - droite;
      if (fin > debut) segments.push({ debut, fin });
    }
  }
  return segments;
}

/** Coupe forcée d'un segment trop long, de préférence sur un blanc. */
function couper(texte: string, seg: Segment): Segment[] {
  const morceaux: Segment[] = [];
  let debut = seg.debut;
  while (seg.fin - debut > TAILLE_MAX) {
    let fin = debut + TAILLE_MAX;
    const espace = texte.lastIndexOf(" ", fin);
    if (espace > debut + TAILLE_MAX / 2) fin = espace;
    morceaux.push({ debut, fin });
    debut = fin;
    while (debut < seg.fin && texte[debut] === " ") debut++;
  }
  if (seg.fin > debut) morceaux.push({ debut, fin: seg.fin });
  return morceaux;
}

/** Découpe le texte d'une page en chunks ordonnés, contigus, sans chevauchement. */
export function decouperPage(texte: string, page: number): Chunk[] {
  const segments = segmenter(texte).flatMap((s) => (s.fin - s.debut > TAILLE_MAX ? couper(texte, s) : [s]));
  const chunks: Chunk[] = [];
  let courant: Segment | null = null;
  const clore = () => {
    if (courant) chunks.push({ page, offset_debut: courant.debut, offset_fin: courant.fin, texte: texte.slice(courant.debut, courant.fin) });
    courant = null;
  };
  for (const s of segments) {
    if (!courant) {
      courant = { ...s };
      continue;
    }
    if (s.fin - courant.debut <= TAILLE_CIBLE) {
      courant.fin = s.fin;
    } else {
      clore();
      courant = { ...s };
    }
  }
  clore();
  // Un dernier fragment trop court rejoint le chunk précédent si la taille max le permet.
  if (chunks.length >= 2) {
    const dernier = chunks[chunks.length - 1];
    const avant = chunks[chunks.length - 2];
    if (dernier.offset_fin - dernier.offset_debut < TAILLE_MIN && dernier.offset_fin - avant.offset_debut <= TAILLE_MAX) {
      chunks.pop();
      avant.offset_fin = dernier.offset_fin;
      avant.texte = texte.slice(avant.offset_debut, avant.offset_fin);
    }
  }
  return chunks;
}

/** Découpe toutes les pages lisibles d'un document. */
export function decouperDocument(pages: { page: number; texte: string }[]): Chunk[] {
  return pages.flatMap((p) => decouperPage(p.texte, p.page));
}
