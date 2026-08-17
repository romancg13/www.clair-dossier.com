/**
 * LDI — Module 5 : note stratégique.
 *
 * ┌─ PAS DE PRONOSTIC CHIFFRÉ ──────────────────────────────────────────────┐
 * │ Le cahier des charges initial prévoyait un champ « chance_succes : 72 % ».│
 * │ Ce module ne le produit pas, et ce refus est un choix de conception.     │
 * │                                                                          │
 * │ Un tel pourcentage supposerait une base de décisions comparables,        │
 * │ appariées sur la juridiction, la formation, la qualification et le       │
 * │ profil du prévenu. Cette base n'existe pas en accès ouvert : Judilibre   │
 * │ ne publie pas l'intégralité des décisions du fond, et la jurisprudence   │
 * │ des cours d'appel y est incomplète. Un chiffre produit sans elle serait  │
 * │ une opinion déguisée en statistique — et le premier contradicteur        │
 * │ demanderait la méthode.                                                 │
 * │                                                                          │
 * │ À la place : une échelle ordinale de trois niveaux, dont la règle        │
 * │ d'attribution est explicite et jointe à chaque axe.                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { CPP_171, CPP_173, CPP_174, CPP_802 } from '../corpus/references';
import type {
  AnalyseDossier,
  AnalyseTextuelle,
  AxeDefense,
  NoteStrategique,
  PointControle,
  RapportNullites,
  Solidite,
} from '../types';

/** Règles d'attribution du niveau de solidité, citées telles quelles dans la note. */
export const REGLES_SOLIDITE: Record<Solidite, string> = {
  etayee:
    "Une pièce ou une heure du dossier établit positivement l'irrégularité alléguée ; il reste à démontrer le grief (art. 171 et 802 CPP).",
  plausible:
    "Le dossier révèle une incohérence sérieuse, mais l'irrégularité suppose une vérification documentaire non encore faite.",
  exploratoire:
    "Aucun élément du dossier n'établit l'irrégularité : l'axe repose sur une pièce manquante qu'il faut d'abord réclamer.",
};

function axeDepuisAnomalie(point: PointControle): AxeDefense {
  return {
    intitule: `${point.intitule} — irrégularité relevée`,
    solidite: 'etayee',
    justificationSolidite: REGLES_SOLIDITE.etayee,
    fondements: [point.fondement, CPP_171, CPP_802, CPP_174],
    appuis: [point.constat],
    contreArguments: [
      point.contreArgument ??
        "Le ministère public opposera l'absence de grief : préparer la démonstration de l'atteinte concrète aux intérêts du mis en cause.",
    ],
    actes: [
      point.actionSuggeree,
      "Formaliser le grief : en quoi l'irrégularité a privé la défense d'un droit effectif, et non seulement d'une formalité.",
    ],
  };
}

function axeDepuisNonEtabli(points: PointControle[]): AxeDefense | null {
  const critiques = points.filter((p) => p.severite === 'critique');
  if (critiques.length === 0) return null;

  return {
    intitule: "Demande d'actes — pièces manquantes au dossier",
    solidite: 'exploratoire',
    justificationSolidite: REGLES_SOLIDITE.exploratoire,
    fondements: [CPP_173],
    appuis: critiques.map((p) => `${p.id} — ${p.constat}`),
    contreArguments: [
      "L'absence d'une pièce au dossier de la défense ne signifie pas son absence à la procédure : vérifier d'abord l'inventaire complet.",
    ],
    actes: [
      ...new Set(critiques.map((p) => p.actionSuggeree)),
      "Solliciter la communication de l'entier dossier et le registre de garde à vue avant de figer les moyens.",
    ],
  };
}

function axeForceProbante(analyse: AnalyseDossier): AxeDefense | null {
  const pertinentes = analyse.contradictions.filter(
    (c) =>
      c.severite === 'critique' &&
      (c.type === 'presence-simultanee' || c.type === 'anteriorite-piece' || c.type === 'chronologie')
  );
  if (pertinentes.length === 0) return null;

  return {
    intitule: 'Force probante des pièces — contradictions internes au dossier',
    solidite: 'plausible',
    justificationSolidite: REGLES_SOLIDITE.plausible,
    fondements: [],
    appuis: pertinentes.map((c) => c.constat),
    contreArguments: [
      "Une contradiction d'heures se règle souvent par une erreur matérielle assumée à l'audience : anticiper la rectification et préparer la question qui la rend coûteuse.",
    ],
    actes: [
      ...new Set(pertinentes.map((c) => c.verificationSuggeree)),
      "Ce terrain relève du débat sur la valeur probante, pas de la nullité : il se plaide au fond, devant la juridiction de jugement.",
    ],
  };
}

function axeExpertise(analyses: AnalyseTextuelle[]): AxeDefense | null {
  const suspectes = analyses.filter((a) => a.fiable && a.signauxDeclenches >= 3);
  if (suspectes.length === 0) return null;

  return {
    intitule: 'Contestation documentaire des pièces rédigées',
    solidite: 'exploratoire',
    justificationSolidite: REGLES_SOLIDITE.exploratoire,
    fondements: [],
    appuis: suspectes.map(
      (a) => `Pièce ${a.pieceId} : ${a.signauxDeclenches} signaux relevés sur ${a.signaux.length}.`
    ),
    contreArguments: [
      "Les mesures statistiques employées ne prouvent rien sur l'auteur d'un texte et ne sont pas opposables comme telles. Fonder la demande sur le besoin de vérification documentaire, jamais sur une prétendue « détection d'IA » : l'argument se retournerait.",
    ],
    actes: [
      "Demander le fichier natif et ses métadonnées (auteur, logiciel, dates de création et de modification).",
      "Vérifier la qualification du rédacteur et le respect du contradictoire dans les opérations d'expertise.",
      'Contester le rapport sur sa méthode et ses conclusions plutôt que sur son style.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Entrée du module
// ---------------------------------------------------------------------------

export function construireStrategie(
  analyse: AnalyseDossier,
  nullites: RapportNullites,
  analysesTextuelles: AnalyseTextuelle[] = []
): NoteStrategique {
  const axes: AxeDefense[] = [
    ...nullites.anomalies.map(axeDepuisAnomalie),
    axeForceProbante(analyse),
    axeExpertise(analysesTextuelles),
    axeDepuisNonEtabli(nullites.nonEtablis),
  ].filter((a): a is AxeDefense => a !== null);

  // Du plus solide au plus exploratoire — l'ordre de la note est l'ordre de plaidoirie.
  const rang: Record<Solidite, number> = { etayee: 0, plausible: 1, exploratoire: 2 };
  axes.sort((a, b) => rang[a.solidite] - rang[b.solidite]);

  const risques: string[] = [
    "L'annulation d'un acte n'entraîne pas mécaniquement celle des actes subséquents : l'étendue doit être expressément demandée (art. 174 CPP).",
    "Devant la chambre de l'instruction saisie sur le fondement de l'art. 173 CPP, tout moyen de nullité non soulevé est purgé. Un moyen gardé en réserve est un moyen perdu.",
  ];

  if (analyse.evenementsNonSources.length > 0) {
    risques.push(
      `${analyse.evenementsNonSources.length} événement(s) de la chronologie ne sont rattachés à aucune pièce : ils ne sont pas opposables en l'état et fragilisent tout moyen qui s'y appuierait.`
    );
  }
  if (analyse.qualifications.length > 1) {
    risques.push(
      "Plusieurs qualifications sont poursuivies : vérifier le risque de requalification plus sévère à l'audience, y compris à l'initiative de la juridiction."
    );
  }
  if (axes.every((a) => a.solidite === 'exploratoire')) {
    risques.push(
      "Aucun axe étayé à ce stade : le dossier transmis ne permet pas de fonder une requête. Compléter avant de s'engager sur des moyens de nullité."
    );
  }

  const zonesIncertitude: string[] = [
    ...nullites.nonEtablis.map((p) => `${p.id} — ${p.intitule} : ${p.constat}`),
  ];
  if (analyse.piecesOrphelines.length > 0) {
    zonesIncertitude.push(
      `Pièces non exploitées par la chronologie : ${analyse.piecesOrphelines.join(', ')}. Les lire avant de conclure.`
    );
  }

  return {
    reference: analyse.reference,
    axes,
    risques,
    zonesIncertitude,
    echeances: [
      "Déterminer immédiatement le stade de la procédure et la fenêtre de dépôt des moyens de nullité qui s'y attache : ces délais sont brefs et leur expiration est irrémédiable.",
      "Si une information judiciaire est ouverte : requête déposée au greffe de la chambre de l'instruction, à peine d'irrecevabilité (art. 173 CPP), et exhaustive.",
      "Si le dossier est appelé devant la juridiction de jugement : les exceptions de nullité obéissent à un régime de forclusion propre — le vérifier avant l'audience, pas à la barre.",
    ],
  };
}
