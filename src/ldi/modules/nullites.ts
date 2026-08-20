/**
 * LDI — Module 3 : détection des irrégularités procédurales.
 *
 * Chaque point de contrôle part de `non-etabli`. Le dossier doit apporter la
 * preuve positive de la régularité pour qu'un point passe à `conforme` ; à
 * défaut, le point reste ouvert et devient une pièce à réclamer. Cette
 * asymétrie est délibérée : un dossier silencieux n'est pas un dossier
 * régulier, et c'est précisément le silence qui se plaide.
 *
 * Le module signale des ANOMALIES, jamais des nullités acquises. La nullité
 * suppose une formalité substantielle ET un grief (art. 171 et 802 CPP) ;
 * cette qualification appartient à l'avocat, puis au juge.
 */
import {
  CPP_62_2,
  CPP_63,
  CPP_63_1,
  CPP_63_3,
  CPP_63_3_1,
  CPP_63_4_2,
  CPP_7,
  CPP_76,
  CPP_78_2,
  CPP_8,
  CPP_9_1,
  CPP_171,
  CPP_802,
  DUREE_MAX_GAV_HEURES,
} from '../corpus/references';
import type {
  AnalyseDossier,
  Dossier,
  Evenement,
  PointControle,
  RapportNullites,
} from '../types';
import { parseHorodatage, SEUILS } from './chronologie';

type Contexte = { dossier: Dossier; analyse: AnalyseDossier };

type Definition = Omit<PointControle, 'resultat' | 'constat'> & {
  evaluer: (ctx: Contexte) => Pick<PointControle, 'resultat' | 'constat'>;
};

const has = (ctx: Contexte, nature: Evenement['nature']): Evenement | undefined =>
  ctx.analyse.chronologie.find((e) => e.nature === nature);

const contradictionsDeType = (ctx: Contexte, ...types: string[]) =>
  ctx.analyse.contradictions.filter((c) => types.includes(c.type));

/** Une pièce du dossier étaye-t-elle l'événement ? */
function estSource(ctx: Contexte, evenement: Evenement | undefined): boolean {
  if (!evenement?.sourcePieceId) return false;
  return ctx.dossier.pieces.some((p) => p.id === evenement.sourcePieceId);
}

// ---------------------------------------------------------------------------
// Points de contrôle
// ---------------------------------------------------------------------------

const DEFINITIONS: Definition[] = [
  {
    id: 'GAV-01',
    intitule: 'Conditions du placement en garde à vue',
    fondement: CPP_62_2,
    severite: 'critique',
    actionSuggeree:
      "Réclamer le procès-verbal de placement et vérifier qu'il énonce les raisons plausibles de soupçonner ET celui des six objectifs de l'art. 62-2 CPP que la mesure poursuit.",
    contreArgument:
      "Le parquet soutiendra que la motivation résulte implicitement des nécessités de l'enquête. La jurisprudence exige toutefois que l'objectif poursuivi soit identifiable.",
    evaluer: (ctx) => {
      const debut = has(ctx, 'debut-garde-a-vue');
      if (!debut) {
        return { resultat: 'non-etabli', constat: "Aucune garde à vue n'est renseignée dans la chronologie." };
      }
      if (!estSource(ctx, debut)) {
        return {
          resultat: 'non-etabli',
          constat: "Le placement en garde à vue n'est rattaché à aucune pièce du dossier : sa motivation ne peut pas être contrôlée.",
        };
      }
      return {
        resultat: 'non-etabli',
        constat:
          "Le placement est rattaché à une pièce, mais la motivation elle-même n'est pas analysable automatiquement : lecture du procès-verbal requise.",
      };
    },
  },
  {
    id: 'GAV-02',
    intitule: 'Notification immédiate des droits',
    fondement: CPP_63_1,
    severite: 'critique',
    actionSuggeree:
      "Vérifier au procès-verbal l'heure de notification, la langue employée et l'exhaustivité des droits notifiés (médecin, avocat, interprète, avis à un proche, droit de se taire).",
    contreArgument:
      "L'accusation invoquera fréquemment une circonstance insurmontable pour justifier le délai. Cette circonstance doit être caractérisée au dossier, pas alléguée.",
    evaluer: (ctx) => {
      const debut = has(ctx, 'debut-garde-a-vue');
      if (!debut) return { resultat: 'non-etabli', constat: 'Sans objet : aucune garde à vue renseignée.' };

      const notification = has(ctx, 'notification-droits');
      if (!notification) {
        return {
          resultat: 'anomalie',
          constat: "Aucune notification des droits n'apparaît dans la chronologie de la mesure.",
        };
      }

      const iDebut = parseHorodatage(debut.horodatage);
      const iNotif = parseHorodatage(notification.horodatage);
      if (!iDebut?.avecHeure || !iNotif?.avecHeure) {
        return { resultat: 'non-etabli', constat: "Les heures manquent pour contrôler l'immédiateté de la notification." };
      }

      const ecart = iNotif.minutes - iDebut.minutes;
      if (ecart < 0) {
        return {
          resultat: 'anomalie',
          constat: `Les droits sont notifiés ${-ecart} minutes AVANT le placement acté : l'heure de départ de la mesure est à vérifier.`,
        };
      }
      if (ecart > SEUILS.notificationDroitsMinutes) {
        return {
          resultat: 'anomalie',
          constat: `Un délai de ${ecart} minutes sépare le placement de la notification des droits.`,
        };
      }
      return {
        resultat: 'conforme',
        constat: `Notification intervenue ${ecart} minute(s) après le placement — le délai n'appelle pas d'observation, sous réserve du contenu notifié.`,
      };
    },
  },
  {
    id: 'GAV-03',
    intitule: "Suite donnée à la demande d'avocat",
    fondement: CPP_63_3_1,
    severite: 'critique',
    actionSuggeree:
      "Vérifier l'heure de la demande, l'heure de l'avis à l'avocat choisi ou au bâtonnier, et la diligence de l'officier de police judiciaire entre les deux.",
    evaluer: (ctx) => {
      const demande = has(ctx, 'demande-avocat');
      if (!demande) {
        return {
          resultat: 'non-etabli',
          constat: "Aucune demande d'avocat n'est renseignée : vérifier si la personne y a renoncé et dans quelles conditions.",
        };
      }
      const avis = has(ctx, 'avis-avocat');
      if (!avis) {
        return {
          resultat: 'anomalie',
          constat: "Une demande d'avocat est actée sans que l'avis correspondant apparaisse au dossier.",
        };
      }
      const iDemande = parseHorodatage(demande.horodatage);
      const iAvis = parseHorodatage(avis.horodatage);
      if (iDemande?.avecHeure && iAvis?.avecHeure) {
        const ecart = iAvis.minutes - iDemande.minutes;
        if (ecart < 0) {
          return {
            resultat: 'anomalie',
            constat: `L'avis à avocat est daté ${-ecart} minutes AVANT la demande qu'il est censé suivre.`,
          };
        }
        if (ecart > 60) {
          return { resultat: 'anomalie', constat: `${ecart} minutes séparent la demande d'avocat de l'avis donné.` };
        }
        return { resultat: 'conforme', constat: `Avis donné ${ecart} minute(s) après la demande.` };
      }
      return { resultat: 'non-etabli', constat: 'Heures incomplètes : diligence non contrôlable.' };
    },
  },
  {
    id: 'GAV-04',
    intitule: "Délai de deux heures avant la première audition",
    fondement: CPP_63_4_2,
    severite: 'critique',
    actionSuggeree:
      "Comparer l'heure de l'avis à avocat et l'heure d'ouverture de la première audition. Rechercher toute décision de report de l'intervention de l'avocat et son auteur.",
    contreArgument:
      "Le parquet peut soutenir que l'audition ne portait que sur les éléments d'identité, hypothèse expressément réservée par le texte.",
    evaluer: (ctx) => {
      const anomalies = ctx.analyse.contradictions.filter(
        (c) => c.regle === 'carence-avocat-63-4-2'
      );
      if (anomalies.length > 0) {
        return { resultat: 'anomalie', constat: anomalies[0].constat };
      }
      const avis = has(ctx, 'avis-avocat') ?? has(ctx, 'demande-avocat');
      const audition = ctx.analyse.chronologie.find((e) => e.nature === 'audition');
      if (!avis || !audition) {
        return { resultat: 'non-etabli', constat: "Avis à avocat ou première audition non renseignés." };
      }
      // Sans les deux heures, le délai n'a pas été mesuré : ne pas conclure.
      const iAvis = parseHorodatage(avis.horodatage);
      const iAudition = parseHorodatage(audition.horodatage);
      if (!iAvis?.avecHeure || !iAudition?.avecHeure) {
        return {
          resultat: 'non-etabli',
          constat: "L'heure de l'avis à avocat ou celle de la première audition manque : le délai de deux heures n'est pas contrôlable.",
        };
      }
      return { resultat: 'conforme', constat: "Le délai de deux heures n'apparaît pas méconnu au vu des heures renseignées." };
    },
  },
  {
    id: 'GAV-05',
    intitule: 'Durée de la mesure et régularité des prolongations',
    fondement: CPP_63,
    severite: 'critique',
    actionSuggeree:
      "Vérifier l'heure de départ retenue (privation de liberté effective), l'existence d'une autorisation écrite et motivée pour chaque prolongation, et l'autorité qui l'a délivrée.",
    evaluer: (ctx) => {
      const anomalies = contradictionsDeType(ctx, 'duree-legale');
      if (anomalies.length > 0) {
        return { resultat: 'anomalie', constat: anomalies.map((a) => a.constat).join(' ') };
      }
      const debut = has(ctx, 'debut-garde-a-vue');
      if (!debut) return { resultat: 'non-etabli', constat: 'Sans objet : aucune garde à vue renseignée.' };

      const regime = DUREE_MAX_GAV_HEURES[ctx.analyse.regime];
      const fin = has(ctx, 'fin-garde-a-vue') ?? has(ctx, 'presentation-magistrat');
      if (!fin) {
        return { resultat: 'non-etabli', constat: "La fin de la mesure n'est pas renseignée : durée non contrôlable." };
      }
      const iDebut = parseHorodatage(debut.horodatage);
      const iFin = parseHorodatage(fin.horodatage);
      if (!iDebut?.avecHeure || !iFin?.avecHeure) {
        return {
          resultat: 'non-etabli',
          constat: "L'heure de début ou de fin de la mesure manque : la durée n'a pas pu être mesurée.",
        };
      }

      // Fin antérieure au début. Le détecteur de chronologie le relève déjà,
      // mais sous le type `chronologie` : ce point ne lisait que les
      // contradictions `duree-legale` et concluait « durée compatible » sur une
      // durée négative. Un même dossier portait donc une contradiction critique
      // et un point de contrôle conforme. La durée est désormais mesurée ici.
      if (iFin.minutes < iDebut.minutes) {
        return {
          resultat: 'anomalie',
          constat: `La fin de la mesure (${fin.horodatage}) est antérieure à son début (${debut.horodatage}) : la durée ne peut pas être appréciée et l'ordre des actes est lui-même en cause.`,
        };
      }

      return {
        resultat: 'conforme',
        constat: `Durée compatible avec le régime « ${ctx.analyse.regime} » (plafond ${regime?.heures ?? '?'} h) et les prolongations actées.`,
      };
    },
  },
  {
    id: 'GAV-06',
    intitule: 'Examen médical',
    fondement: CPP_63_3,
    severite: 'majeure',
    actionSuggeree:
      "Vérifier si un examen a été demandé, par qui, et si le certificat figure au dossier. Un certificat mentionnant des lésions ouvre un angle distinct.",
    evaluer: (ctx) => {
      const examen = has(ctx, 'examen-medical');
      if (!examen) {
        return {
          resultat: 'non-etabli',
          constat: "Aucun examen médical n'est renseigné : vérifier si la personne l'a demandé et quelle suite a été donnée.",
        };
      }
      return estSource(ctx, examen)
        ? { resultat: 'conforme', constat: 'Examen médical acté et rattaché à une pièce du dossier.' }
        : { resultat: 'non-etabli', constat: "Examen médical mentionné mais aucun certificat n'est rattaché." };
    },
  },
  {
    id: 'CTRL-01',
    intitule: "Fondement du contrôle d'identité",
    fondement: CPP_78_2,
    severite: 'majeure',
    actionSuggeree:
      "Réclamer les réquisitions écrites du procureur si le contrôle s'en réclame, et vérifier leur périmètre géographique et temporel. À défaut de réquisitions, rechercher les raisons plausibles de soupçonner, telles qu'énoncées au procès-verbal.",
    contreArgument:
      "Le texte prévoit expressément que la découverte, à l'occasion d'un contrôle, d'infractions autres que celles visées par les réquisitions n'est pas une cause de nullité. Le moyen doit donc viser l'absence ou l'irrégularité des réquisitions, ou l'absence de raisons plausibles — pas le simple décalage entre l'infraction recherchée et celle constatée.",
    evaluer: (ctx) => {
      const controle = has(ctx, 'controle-identite');
      if (!controle) return { resultat: 'non-etabli', constat: "Aucun contrôle d'identité renseigné." };
      if (!estSource(ctx, controle)) {
        return {
          resultat: 'anomalie',
          constat: "Le contrôle d'identité n'est rattaché à aucune pièce : son fondement n'est pas vérifiable en l'état.",
        };
      }
      return {
        resultat: 'non-etabli',
        constat: "Contrôle rattaché à une pièce ; le fondement invoqué doit être lu au procès-verbal.",
      };
    },
  },
  {
    id: 'PERQ-01',
    intitule: 'Assentiment exprès en enquête préliminaire',
    fondement: CPP_76,
    severite: 'critique',
    actionSuggeree:
      "Vérifier l'existence d'une déclaration d'assentiment écrite de la main de l'intéressé, ou de l'autorisation écrite et motivée du juge des libertés et de la détention.",
    evaluer: (ctx) => {
      const perquisition = has(ctx, 'perquisition');
      if (!perquisition) return { resultat: 'non-etabli', constat: 'Aucune perquisition renseignée.' };
      if (!estSource(ctx, perquisition)) {
        return {
          resultat: 'anomalie',
          constat: "Une perquisition est actée sans pièce justificative rattachée : ni assentiment ni autorisation ne sont vérifiables.",
        };
      }
      return {
        resultat: 'non-etabli',
        constat: "Perquisition rattachée à une pièce ; l'assentiment ou l'autorisation doit être vérifié sur le document.",
      };
    },
  },
  {
    id: 'PREUVE-01',
    intitule: 'Traçabilité des scellés et des supports saisis',
    fondement: CPP_171,
    severite: 'majeure',
    actionSuggeree:
      "Reconstituer la chaîne : saisie, mise sous scellé, transport, ouverture, expertise, re-scellement. Toute rupture non documentée affecte la force probante avant même la régularité.",
    evaluer: (ctx) => {
      const saisie = has(ctx, 'saisie');
      const expertise = has(ctx, 'expertise');
      if (!saisie && !expertise) return { resultat: 'non-etabli', constat: 'Aucune saisie ni expertise renseignée.' };
      if (saisie && expertise) {
        const iSaisie = parseHorodatage(saisie.horodatage);
        const iExpertise = parseHorodatage(expertise.horodatage);
        if (iSaisie && iExpertise && iExpertise.minutes < iSaisie.minutes) {
          return {
            resultat: 'anomalie',
            constat: `L'expertise (${expertise.horodatage}) est datée avant la saisie de l'objet expertisé (${saisie.horodatage}).`,
          };
        }
      }
      return {
        resultat: 'non-etabli',
        constat: "La continuité des scellés ne se déduit pas de la chronologie : contrôle documentaire nécessaire.",
      };
    },
  },
  {
    id: 'PRESC-01',
    intitule: "Prescription de l'action publique",
    fondement: CPP_8,
    severite: 'critique',
    actionSuggeree:
      "Déterminer la nature (crime ou délit) de chaque qualification, la date de commission, et l'existence d'actes interruptifs. Vérifier l'application éventuelle de l'art. 9-1 CPP (infractions occultes ou dissimulées).",
    evaluer: (ctx) => {
      const dates = ctx.analyse.chronologie
        .map((e) => parseHorodatage(e.horodatage))
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .map((i) => i.minutes);
      if (dates.length === 0) {
        return { resultat: 'non-etabli', constat: 'Aucune date exploitable dans la chronologie.' };
      }
      // Pas d'horloge murale ici : le pipeline garantit qu'une même entrée
      // produit une même sortie. Un « il y a 0,4 an » changerait de valeur à
      // chaque exécution et ferait diverger un rapport archivé de sa relecture.
      // Le calcul du délai écoulé appartient à l'avocat, à la date de dépôt.
      const plusAncien = Math.min(...dates);
      const datePlusAncienne = new Date(plusAncien * 60_000).toISOString().slice(0, 10);
      return {
        resultat: 'non-etabli',
        constat: `Le fait le plus ancien de la chronologie est daté du ${datePlusAncienne}. Délais de droit commun : six ans pour les délits (art. 8 CPP), vingt ans pour les crimes (art. 7 CPP), sous réserve des actes interruptifs et de l'art. 9-1 CPP. Le calcul du délai écoulé se fait à la date de dépôt.`,
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Entrée du module
// ---------------------------------------------------------------------------

export function detecterIrregularites(dossier: Dossier, analyse: AnalyseDossier): RapportNullites {
  const ctx: Contexte = { dossier, analyse };

  const points: PointControle[] = DEFINITIONS.map((def) => {
    const { evaluer, ...reste } = def;
    const { resultat, constat } = evaluer(ctx);
    return { ...reste, resultat, constat };
  });

  return {
    points,
    anomalies: points.filter((p) => p.resultat === 'anomalie'),
    nonEtablis: points.filter((p) => p.resultat === 'non-etabli'),
    regimeNullite: [CPP_171, CPP_802],
    referencesComplementaires: [CPP_7, CPP_9_1],
  };
}
