/**
 * DEFENSE OS — M4 / P3 : analyse de la preuve à charge.
 *
 * ┌─ CE QUE CE MODULE NE CONCLUT JAMAIS ────────────────────────────────────┐
 * │ Rien sur les faits, rien sur la culpabilité (B15). Il dissèque : ce que  │
 * │ l'élément établit, ce qu'il n'établit PAS, l'écart avec l'imputation     │
 * │ personnelle au client, les faiblesses de méthode, et les hypothèses      │
 * │ alternatives compatibles avec le même élément.                           │
 * │                                                                          │
 * │ Les axes d'analyse sont des GRILLES DE LECTURE fixées par type            │
 * │ d'élément — pas des règles de droit, et aucun texte n'y est cité (B2).   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { DossierPenal, ElementPreuve } from './modele';
import { MOTEUR_DETERMINISTE, scellerSortie, type SortiePasse } from './passes';

export type AnalysePreuve = {
  elementId: string;
  type: string;
  /** Ce que l'élément établit — au plus près de sa matérialité. */
  etablit: string;
  /** Ce qu'il n'établit pas — l'écart avec ce que l'accusation en tire. */
  netablitPas: string;
  /** L'écart avec l'imputation PERSONNELLE au client. */
  ecartImputation: string;
  faiblesses: string[];
  hypothesesAlternatives: string[];
  appuis: string[];
};

/**
 * Grilles de lecture par type d'élément (axes de §7.4). La première dont le
 * motif reconnaît le type s'applique ; la dernière est le filet générique.
 */
const GRILLES: {
  motif: RegExp;
  etablit: string;
  netablitPas: string;
  ecart: string;
  faiblesses: string[];
  hypotheses: string[];
}[] = [
  {
    motif: /t[eé]l[eé]phon|ligne|born|imei|imsi/i,
    etablit: "La présence d'un appareil (ou d'une ligne) dans une zone de couverture, à certains horaires.",
    netablitPas: "Ni qui tenait l'appareil, ni le contenu des échanges quand seuls les métadonnées sont exploitées, ni la position précise — une borne couvre un secteur, pas une adresse.",
    ecart: "L'attribution de la ligne au client est le maillon à contrôler : abonnement, usage exclusif, prêts de l'appareil, période retenue.",
    faiblesses: [
      "L'attribution repose souvent sur des déclarations ou un abonnement, pas sur une constatation directe.",
      "La couverture d'une borne varie selon la charge du réseau : le secteur n'est pas un point.",
    ],
    hypotheses: [
      "Appareil prêté, partagé ou revendu sur la période.",
      "Présence dans le secteur pour un motif étranger aux faits.",
    ],
  },
  {
    motif: /d[eé]claration|co[- ]?mis|d[eé]nonciation|t[eé]moignage/i,
    etablit: "Qu'une personne a tenu ces propos, à cette date, dans ce cadre.",
    netablitPas: "Ni leur exactitude, ni leur spontanéité : une déclaration n'est pas un fait, c'est un récit.",
    ecart: "Ce que la déclaration impute NOMMÉMENT au client, distingué de ce qu'elle décrit en général.",
    faiblesses: [
      "Intérêt du déclarant à minorer son rôle ou à charger autrui — situation procédurale à vérifier.",
      "Conditions du recueil : durée de la mesure, heure, assistance effective.",
      "Variations entre auditions successives, à confronter ligne à ligne.",
    ],
    hypotheses: [
      'Report de responsabilité par un co-mis en cause en quête de clémence.',
      "Connaissance des faits par ouï-dire plutôt que par participation.",
    ],
  },
  {
    motif: /aveu|reconnaissance des faits/i,
    etablit: "Que des propos d'admission ont été actés, dans un certain contexte de contrainte.",
    netablitPas: "Ni leur portée exacte (admettre une présence n'est pas admettre un rôle), ni leur liberté si le contexte les a arrachés.",
    ecart: "Ce qui est précisément admis, mot à mot, rapporté à chaque élément de la qualification.",
    faiblesses: [
      "Contexte du recueil : fatigue, durée de la mesure, promesse implicite, absence de conseil.",
      'Formulation par question fermée reprise au procès-verbal comme récit spontané.',
    ],
    hypotheses: ["Admission partielle sur-interprétée ; rétractation à examiner à l'aune du contexte."],
  },
  {
    motif: /surveillance|filature|observation/i,
    etablit: "Ce que les enquêteurs disent avoir vu, aux moments qu'ils indiquent.",
    netablitPas: "L'interprétation des gestes observés — une remise de main à main décrite n'est pas une transaction qualifiée.",
    ecart: "L'identification du client dans l'observation : distance, luminosité, continuité de la surveillance.",
    faiblesses: [
      'Conditions matérielles d’observation rarement précisées (distance, angle, obstacles).',
      "Continuité de la filature : les interruptions créent des trous d'identification.",
    ],
    hypotheses: ['Confusion de personnes ; geste anodin lu à travers l’hypothèse d’enquête.'],
  },
  {
    motif: /trace|adn|empreinte|papillaire|stup[eé]fiant sur|pr[eé]l[eè]vement/i,
    etablit: "La présence d'un matériel biologique ou d'une trace à un endroit donné.",
    netablitPas: "Ni le moment du dépôt, ni son contexte : une trace date rarement son propre dépôt.",
    ecart: 'Le lien entre la trace et un ACTE du client, pas seulement sa présence passée.',
    faiblesses: [
      'Transfert secondaire possible ; contamination de prélèvement à examiner via la chaîne des scellés.',
      "Valeur statistique de la correspondance à demander en clair, avec sa méthode.",
    ],
    hypotheses: ['Dépôt antérieur aux faits ; objet manipulé dans un autre contexte.'],
  },
  {
    motif: /financ|esp[eè]ce|train de vie|virement|compte/i,
    etablit: 'Des mouvements ou des détentions de fonds, à des dates données.',
    netablitPas: "Leur origine : un flux n'étiquette pas sa provenance.",
    ecart: "Le rattachement de CHAQUE somme au trafic reproché, pas une impression d'ensemble.",
    faiblesses: [
      "Période d'analyse choisie par l'enquête, à confronter aux revenus licites documentables.",
      'Espèces : la détention ne dit ni origine ni destination.',
    ],
    hypotheses: ['Revenus licites non déclarés mais étrangers aux faits ; solidarités familiales.'],
  },
  {
    motif: /quantit|pes[eé]e|grammage|produit/i,
    etablit: 'Une masse de produit, telle que pesée, sur les scellés désignés.',
    netablitPas: "Ni la destination (usage, partage, commerce), ni la propriété de l'ensemble en cas de pluralité d'occupants.",
    ecart: "L'imputation de la quantité TOTALE au client quand les lieux ou les scellés sont partagés.",
    faiblesses: [
      'Pesée avec ou sans emballage, taux de pureté, méthode : à demander en clair.',
      "Chaîne des scellés entre saisie et pesée.",
    ],
    hypotheses: ['Détention pour partie destinée à un usage personnel ; pluralité de détenteurs.'],
  },
  {
    // Filet générique : tout élément reçoit une analyse — jamais un silence.
    motif: /./,
    etablit: "Ce que l'élément constate matériellement, dans les limites de son support.",
    netablitPas: "Les inférences que l'accusation en tire au-delà de sa matérialité.",
    ecart: "Le rattachement personnel au client, à articuler pièce par pièce.",
    faiblesses: ['Méthode de recueil et traçabilité à vérifier sur les cotes citées.'],
    hypotheses: ['Lecture alternative compatible avec la même matérialité, à construire sur pièces.'],
  },
];

/** Analyse un élément à charge selon sa grille de lecture. */
export function analyserElement(element: ElementPreuve): AnalysePreuve {
  const grille = GRILLES.find((g) => g.motif.test(element.type)) ?? GRILLES[GRILLES.length - 1];

  return {
    elementId: element.id,
    type: element.type,
    etablit: grille.etablit,
    netablitPas: grille.netablitPas,
    ecartImputation: `${grille.ecart} Rattachement allégué au dossier : ${element.rattachementClient || '[INFORMATION MANQUANTE]'}.`,
    faiblesses: [...grille.faiblesses, ...element.faiblesses],
    hypothesesAlternatives: grille.hypotheses,
    appuis: [element.id, ...element.cotes],
  };
}

/** P3 sur tout le dossier, scellée. */
export function executerP3(dossier: DossierPenal, horodatage?: string): {
  analyses: AnalysePreuve[];
  sortie: SortiePasse;
} {
  const analyses = dossier.preuves.map(analyserElement);

  const sortie = scellerSortie(
    'P3',
    dossier,
    analyses.flatMap((a) => [
      { enonce: `[${a.elementId}] Établit : ${a.etablit}`, appuis: a.appuis },
      { enonce: `[${a.elementId}] N'établit pas : ${a.netablitPas}`, appuis: a.appuis },
      { enonce: `[${a.elementId}] Écart d'imputation : ${a.ecartImputation}`, appuis: a.appuis },
    ]),
    {
      moteur: MOTEUR_DETERMINISTE,
      traite: analyses.map((a) => a.elementId),
      manques: dossier.preuves
        .filter((p) => !p.rattachementClient.trim())
        .map((p) => ({
          quoi: `Rattachement au client de l'élément « ${p.type} » (${p.id})`,
          necessairePour: "l'analyse de l'imputation personnelle",
          action: 'Identifier dans les cotes comment l’accusation rattache cet élément au client.',
        })),
      ouvert:
        dossier.preuves.length === 0
          ? ["Aucun élément de preuve saisi : l'analyse P3 attend la saisie des éléments à charge."]
          : [],
      horodatage,
    }
  );

  return { analyses, sortie };
}
