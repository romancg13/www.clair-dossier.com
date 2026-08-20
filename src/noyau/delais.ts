/**
 * DEFENSE OS — moteur de délais (M2).
 *
 * ┌─ RÈGLE D'ACCEPTATION DU MODULE ─────────────────────────────────────────┐
 * │ Tout délai affiché expose SA MÉTHODE DE CALCUL et SES DONNÉES D'ENTRÉE,  │
 * │ et aucun délai n'est affirmé sans le texte qui le fonde. Tant que ce     │
 * │ texte n'a pas été récupéré d'une source officielle pendant l'exécution,  │
 * │ le fondement porte « à vérifier » — c'est un état, pas une excuse.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Ce module ne connaît pas l'heure : elle lui est passée. Un moteur de délais
 * qui lit l'horloge lui-même est intestable, et un délai intestable est un
 * délai faux un jour d'audience.
 */
import { DUREE_MAX_GAV_HEURES } from '../ldi/corpus/references';
import type { RegimeProcedural } from '../ldi/types';
import type { Echeance, Urgence } from './modele';

export type CalculDelai = {
  intitule: string;
  /** La méthode, écrite pour être relue : ce qui est ajouté à quoi. */
  methode: string;
  /** Les données d'entrée, nommées — pour refaire le calcul à la main. */
  entrees: { nom: string; valeur: string }[];
  /** Résultat ISO, ou null si une entrée manque. */
  resultat: string | null;
  /** Référence du texte qui fonde le calcul, avec son statut de vérification. */
  fondement: { reference: string; statut: string } | null;
  avertissement: string;
};

const AVERTISSEMENT_FONDEMENT =
  'Fondement à vérifier auprès de la source officielle avant toute citation dans un acte.';

/**
 * Terme maximal d'une garde à vue, depuis son début et son régime.
 *
 * La durée vient de l'index du corpus, qui porte sa référence et son statut :
 * ce module n'écrit aucun nombre d'heures de lui-même.
 */
export function termeGardeAVue(debutIso: string | null, regime: RegimeProcedural): CalculDelai {
  const borne = DUREE_MAX_GAV_HEURES[regime];

  const base: Omit<CalculDelai, 'resultat'> = {
    intitule: 'Terme maximal de la garde à vue',
    methode: `Heure de début + ${borne.heures} heures (durée maximale du régime « ${regime} », prolongations comprises).`,
    entrees: [
      { nom: 'début de la mesure', valeur: debutIso ?? '[INFORMATION MANQUANTE]' },
      { nom: 'durée maximale du régime', valeur: `${borne.heures} h` },
    ],
    fondement: { reference: borne.fondement.reference, statut: borne.fondement.statut },
    avertissement:
      borne.fondement.statut === 'verifie'
        ? ''
        : AVERTISSEMENT_FONDEMENT,
  };

  if (!debutIso) {
    return { ...base, resultat: null, avertissement: `${base.avertissement} Le début de la mesure n'est pas daté : le terme ne peut pas être calculé.`.trim() };
  }

  const debut = new Date(debutIso);
  if (Number.isNaN(debut.getTime())) {
    return { ...base, resultat: null, avertissement: `${base.avertissement} Horodatage de début illisible : « ${debutIso} ».`.trim() };
  }

  const terme = new Date(debut.getTime() + borne.heures * 3_600_000);
  return { ...base, resultat: terme.toISOString() };
}

/**
 * Jours francs restants avant une échéance, à la date donnée.
 * Négatif quand l'échéance est dépassée.
 */
export function joursRestants(echeance: Echeance, maintenantIso: string): number {
  const cible = new Date(echeance.date.length === 10 ? `${echeance.date}T23:59:59` : echeance.date);
  const maintenant = new Date(maintenantIso);
  return Math.floor((cible.getTime() - maintenant.getTime()) / 86_400_000);
}

/**
 * Axe « urgence » de la taxonomie, CALCULÉ depuis les échéances ouvertes.
 *
 * Une échéance dépassée mais toujours ouverte compte comme « sous 48 h » : la
 * pire lecture serait de la faire disparaître du haut de la pile parce
 * qu'elle est déjà derrière.
 */
export function urgenceDe(echeances: Echeance[], maintenantIso: string): Urgence {
  const ouvertes = echeances.filter((e) => e.etat === 'ouverte');
  if (ouvertes.length === 0) return 'sans-echeance-courte';

  const minimum = Math.min(...ouvertes.map((e) => joursRestants(e, maintenantIso)));
  if (minimum <= 2) return 'sous-48h';
  if (minimum <= 7) return 'sous-7j';
  if (minimum <= 30) return 'sous-30j';
  return 'sans-echeance-courte';
}

/** Tri du bandeau « qu'est-ce qui brûle ? » : date croissante, ouvertes d'abord. */
export function trierEcheances<T extends Echeance>(echeances: T[]): T[] {
  return [...echeances].sort((a, b) => {
    if ((a.etat === 'ouverte') !== (b.etat === 'ouverte')) return a.etat === 'ouverte' ? -1 : 1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}
