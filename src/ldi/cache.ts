/**
 * LDI — mémorisation des analyses.
 *
 * ┌─ POURQUOI ──────────────────────────────────────────────────────────────┐
 * │ `analyser()` déroule toute la chaîne déterministe. Avec un seul dossier  │
 * │ ouvert, le coût est invisible. Avec un atelier — tableau de bord,        │
 * │ classement par catégorie, filtres, totaux — le même dossier est analysé  │
 * │ à chaque frappe dans un champ de recherche, pour un résultat rigou-      │
 * │ reusement identique.                                                     │
 * │                                                                          │
 * │ La clé est l'empreinte du dossier, déjà utilisée par le journal. C'est   │
 * │ exactement la bonne clé : elle change si et seulement si le dossier      │
 * │ change, et le pipeline est déterministe par construction.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Conséquence assumée sur `genereLe` : un rapport servi depuis le cache porte
 * l'heure de sa PREMIÈRE production. C'est la lecture correcte — le rapport n'a
 * pas été refait, il a été retrouvé. Un dossier modifié produit une nouvelle
 * empreinte, donc une nouvelle analyse, donc une nouvelle heure.
 */
import { empreinte } from './journal';
import { analyser } from './pipeline';
import type { Dossier, RapportLdi } from './types';

export type CacheAnalyse = {
  /** Analyse le dossier, ou rend le rapport déjà produit pour cet état. */
  analyser(dossier: Dossier): RapportLdi;
  /** Empreinte d'un dossier, sans déclencher d'analyse. */
  empreinteDe(dossier: Dossier): string;
  /** Compteurs d'exploitation, pour mesurer plutôt que supposer. */
  statistiques(): { entrees: number; succes: number; defauts: number };
  vider(): void;
};

/** Au-delà, les entrées les plus anciennes sortent. */
const CAPACITE_DEFAUT = 32;

/**
 * Crée un cache borné, à éviction du plus ancien accès.
 *
 * Borné volontairement : un cache sans limite conserverait en mémoire tous les
 * états successifs de tous les dossiers ouverts dans la session — c'est-à-dire
 * des données de dossier, couvertes par le secret professionnel, bien après
 * qu'elles ont cessé d'être utiles.
 */
export function creerCacheAnalyse(capacite = CAPACITE_DEFAUT): CacheAnalyse {
  // Map préserve l'ordre d'insertion : re-insérer une clé la remet en queue,
  // ce qui suffit à implémenter l'éviction du moins récemment utilisé.
  const entrees = new Map<string, RapportLdi>();
  let succes = 0;
  let defauts = 0;

  return {
    empreinteDe: (dossier) => empreinte(dossier),

    analyser(dossier) {
      const cle = empreinte(dossier);
      const connu = entrees.get(cle);

      if (connu) {
        succes += 1;
        entrees.delete(cle);
        entrees.set(cle, connu);
        return connu;
      }

      defauts += 1;
      const rapport = analyser(dossier);
      entrees.set(cle, rapport);

      while (entrees.size > capacite) {
        const plusAncienne = entrees.keys().next().value;
        if (plusAncienne === undefined) break;
        entrees.delete(plusAncienne);
      }

      return rapport;
    },

    statistiques: () => ({ entrees: entrees.size, succes, defauts }),

    vider() {
      entrees.clear();
      succes = 0;
      defauts = 0;
    },
  };
}
