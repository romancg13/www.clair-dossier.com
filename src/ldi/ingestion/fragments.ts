/**
 * DEFENSE OS — fragments et index local (P0, étapes 3 et 6 du pipeline §7.11).
 *
 * ┌─ LE FRAGMENT EST L'UNITÉ D'ANCRAGE ─────────────────────────────────────┐
 * │ Toute phrase générée par la couche IA doit pouvoir remonter au fragment  │
 * │ exact qui la fonde (B20). Le fragment conserve donc son TEXTE SOURCE     │
 * │ INTACT, sa position, et son empreinte : reformuler, résumer ou nettoyer  │
 * │ ici détruirait la possibilité même de vérifier.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Découpage : par cote quand une numérotation « D12 », « D 12/1 », « Cote     
 * D12 » ouvre un bloc ; sinon par bloc de paragraphes. Le rattachement à une
 * cote est PROPOSÉ, jamais imposé — l'avocat valide ou corrige (P0-4).
 */
import { empreinte } from '../journal';
import type { PieceIngeree } from './types';

export type Fragment = {
  id: string;
  /** Empreinte du document parent. */
  documentId: string;
  /** Page d'origine (1-indexée) et position du premier caractère dans la page. */
  page: number;
  position: number;
  /** Texte source, INTACT — c'est la matière opposable. */
  texte: string;
  /** Cote détectée en tête de bloc — proposition, à valider. */
  coteProposee: string | null;
  empreinte: string;
};

/** Une cote de dossier pénal : D suivi d'un numéro, variantes usuelles. */
const MOTIF_COTE = /^\s*(?:cote\s+)?(D\s?\d+(?:[/.-]\d+)?)\b/imu;

/**
 * Découpe les pages d'une pièce en fragments.
 *
 * Deux passes : d'abord un découpage par en-têtes de cote quand il y en a,
 * sinon par blocs séparés d'une ligne vide. Un bloc vide ne produit rien.
 */
export function fragmenter(piece: PieceIngeree): Fragment[] {
  const fragments: Fragment[] = [];
  let compteur = 0;

  for (const page of piece.pages) {
    if (!page.texte.trim()) continue;

    for (const bloc of decouperPage(page.texte)) {
      compteur += 1;
      const coteDetectee = MOTIF_COTE.exec(bloc.texte);
      fragments.push({
        id: `${piece.empreinte.slice(0, 8)}-f${compteur}`,
        documentId: piece.empreinte,
        page: page.page,
        position: bloc.position,
        texte: bloc.texte,
        coteProposee: coteDetectee ? coteDetectee[1].replace(/\s+/g, '') : null,
        empreinte: empreinte(bloc.texte),
      });
    }
  }

  return fragments;
}

function decouperPage(texte: string): { position: number; texte: string }[] {
  // Découpe par cote si au moins deux en-têtes de cote structurent la page :
  // une seule occurrence est plus probablement une mention qu'un plan.
  const enTetes = [...texte.matchAll(new RegExp(MOTIF_COTE.source, 'gimu'))];
  if (enTetes.length >= 2) {
    const blocs: { position: number; texte: string }[] = [];
    for (const [i, m] of enTetes.entries()) {
      const debut = m.index ?? 0;
      const fin = i + 1 < enTetes.length ? (enTetes[i + 1].index ?? texte.length) : texte.length;
      const bloc = texte.slice(debut, fin);
      if (bloc.trim()) blocs.push({ position: debut, texte: bloc });
    }
    // Le préambule avant la première cote reste un fragment : le perdre
    // amputerait le document.
    const premier = enTetes[0].index ?? 0;
    if (texte.slice(0, premier).trim()) blocs.unshift({ position: 0, texte: texte.slice(0, premier) });
    return blocs;
  }

  // Sinon : blocs séparés par ligne vide.
  const blocs: { position: number; texte: string }[] = [];
  let position = 0;
  for (const morceau of texte.split(/\n{2,}/)) {
    if (morceau.trim()) blocs.push({ position, texte: morceau });
    position += morceau.length + 2;
  }
  return blocs;
}

// ---------------------------------------------------------------------------
// Index plein texte local
// ---------------------------------------------------------------------------

export type Occurrence = {
  fragmentId: string;
  /** Position du terme DANS le fragment — pour le surlignage. */
  position: number;
};

export type ResultatRecherche = {
  fragmentId: string;
  documentId: string;
  page: number;
  /** Extrait autour de la première occurrence, terme au centre. */
  extrait: string;
  positions: number[];
};

/**
 * Index inversé, en mémoire, reconstruit à l'ingestion. Rien n'est écrit sur
 * disque : l'index vit et meurt avec la session, comme le reste (B9).
 */
export type IndexLocal = {
  ajouter(fragments: Fragment[]): void;
  chercher(requete: string): ResultatRecherche[];
  taille(): number;
};

/** Découpe en termes : lettres et chiffres Unicode, minuscules, ≥ 2 caractères. */
function termesDe(texte: string): { terme: string; position: number }[] {
  const resultat: { terme: string; position: number }[] = [];
  for (const m of texte.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)) {
    const terme = m[0].toLowerCase();
    if (terme.length >= 2) resultat.push({ terme, position: m.index ?? 0 });
  }
  return resultat;
}

export function creerIndexLocal(): IndexLocal {
  const occurrences = new Map<string, Occurrence[]>();
  const fragments = new Map<string, Fragment>();

  return {
    ajouter(nouveaux) {
      for (const fragment of nouveaux) {
        fragments.set(fragment.id, fragment);
        for (const { terme, position } of termesDe(fragment.texte)) {
          const liste = occurrences.get(terme) ?? [];
          liste.push({ fragmentId: fragment.id, position });
          occurrences.set(terme, liste);
        }
      }
    },

    chercher(requete) {
      const termes = termesDe(requete).map((t) => t.terme);
      if (termes.length === 0) return [];

      // Intersection : un fragment doit porter TOUS les termes de la requête.
      let candidats: Map<string, number[]> | null = null;
      for (const terme of termes) {
        const trouvees = occurrences.get(terme) ?? [];
        const parFragment = new Map<string, number[]>();
        for (const o of trouvees) {
          const liste = parFragment.get(o.fragmentId) ?? [];
          liste.push(o.position);
          parFragment.set(o.fragmentId, liste);
        }
        if (candidats === null) {
          candidats = parFragment;
        } else {
          for (const id of [...candidats.keys()]) {
            const positions = parFragment.get(id);
            if (!positions) candidats.delete(id);
            else candidats.set(id, [...candidats.get(id)!, ...positions]);
          }
        }
      }

      const resultats: ResultatRecherche[] = [];
      for (const [fragmentId, positions] of candidats ?? []) {
        const fragment = fragments.get(fragmentId);
        if (!fragment) continue;
        const premiere = Math.min(...positions);
        const debut = Math.max(0, premiere - 60);
        const fin = Math.min(fragment.texte.length, premiere + 90);
        resultats.push({
          fragmentId,
          documentId: fragment.documentId,
          page: fragment.page,
          extrait: `${debut > 0 ? '…' : ''}${fragment.texte.slice(debut, fin).replace(/\s+/g, ' ').trim()}${fin < fragment.texte.length ? '…' : ''}`,
          positions: positions.sort((a, b) => a - b),
        });
      }
      return resultats.sort((a, b) => (a.fragmentId < b.fragmentId ? -1 : 1));
    },

    taille: () => fragments.size,
  };
}
