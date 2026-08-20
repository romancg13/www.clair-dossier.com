/**
 * DEFENSE OS — M5 / P4 : qualification et requalification.
 *
 * ┌─ DES INTITULÉS FONCTIONNELS, PAS DES ARTICLES ──────────────────────────┐
 * │ Chaque qualification est décomposée en éléments constitutifs exprimés    │
 * │ en TERMES FONCTIONNELS — « remise du produit à un tiers », « élément     │
 * │ intentionnel » — jamais en numéros d'articles (B2). Le fondement textuel │
 * │ est résolu en P6, contre les sources récupérées.                         │
 * │                                                                          │
 * │ Chaque élément est relié à une cote ou devient un Manque (§7.5) : un     │
 * │ élément constitutif « présent » sans appui n'existe pas.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { DossierPenal, Manque, NatureContentieux, QualificationEnvisagee } from './modele';
import { MOTEUR_DETERMINISTE, scellerSortie, type SortiePasse } from './passes';

/** Éléments constitutifs attendus, par nature de contentieux, en clair. */
export const ELEMENTS_ATTENDUS: Record<NatureContentieux, string[]> = {
  usage: [
    "Consommation ou détention pour consommation personnelle d'un produit classé",
    'Caractère stupéfiant du produit, établi par analyse',
    'Élément intentionnel',
  ],
  cession: [
    "Remise du produit à un tiers, identifiée dans le temps et l'espace",
    'Caractère stupéfiant du produit remis',
    "Rôle personnel du client dans la remise — pas seulement sa présence",
    'Élément intentionnel',
  ],
  'detention-transport': [
    'Détention matérielle ou transport du produit',
    'Caractère stupéfiant et quantité, établis par analyse et pesée',
    'Connaissance de la nature du produit détenu ou transporté',
    "Maîtrise effective — distinguer détention et simple proximité",
  ],
  importation: [
    "Franchissement d'une frontière par le produit",
    'Participation personnelle au franchissement ou à son organisation',
    'Connaissance de la nature du chargement',
  ],
  'trafic-aggrave': [
    "Les éléments de l'infraction de base, chacun établi",
    "La circonstance aggravante alléguée, établie SPÉCIFIQUEMENT — la bande organisée exige une structure, une préméditation et une répartition des rôles, pas une simple pluralité d'auteurs",
  ],
  'association-malfaiteurs': [
    'Un groupement ou une entente établie',
    "Une résolution d'agir concertée, matérialisée par un ou plusieurs faits",
    "L'adhésion PERSONNELLE et consciente du client au projet — pas sa seule fréquentation des membres",
  ],
  blanchiment: [
    "Une opération de placement, dissimulation ou conversion identifiée",
    "L'origine des fonds rattachée à une infraction déterminée",
    'La connaissance de cette origine par le client',
  ],
  'volet-patrimonial': [
    "L'identification des biens visés et de leur titulaire réel",
    'Le lien allégué entre chaque bien et les faits poursuivis',
  ],
  'volet-douanier': [
    "La matérialité de l'opération douanière reprochée",
    "Le rôle personnel du client dans l'opération",
    'La valeur retenue pour le calcul des pénalités, justifiée',
  ],
};

/** Pistes de requalification favorables, discutées quand la nature s'y prête. */
const REQUALIFICATIONS: Partial<Record<NatureContentieux, string>> = {
  cession:
    "Discuter la requalification vers l'usage ou la détention simple si la remise à un tiers n'est pas établie par un fait daté et coté.",
  'detention-transport':
    "Discuter la part destinée à l'usage personnel : la quantité seule ne fait pas la destination commerciale.",
  'trafic-aggrave':
    "Contester la circonstance aggravante avant l'infraction de base : une bande organisée non structurée retombe sur l'infraction simple.",
  'association-malfaiteurs':
    "Distinguer la participation aux faits de l'adhésion au groupement : la première n'emporte pas la seconde.",
  importation:
    'Discuter la contrebande simple ou la détention selon le rôle réellement établi dans le franchissement.',
};

export type AnalyseQualification = {
  qualification: QualificationEnvisagee;
  manques: Manque[];
  requalification: string | null;
};

/**
 * Complète une qualification envisagée : les éléments attendus manquants
 * deviennent des Manques nommés, les éléments « présents » sans appui sont
 * requalifiés en manquants — un élément sans cote n'existe pas.
 */
export function analyserQualification(
  q: QualificationEnvisagee,
  nature: NatureContentieux | null
): AnalyseQualification {
  const attendus = q.elementsAttendus.length > 0 ? q.elementsAttendus : nature ? ELEMENTS_ATTENDUS[nature] : [];

  const presentsAppuyes = q.elementsPresents.filter((e) => e.appuis.length > 0);
  const presentsSansAppui = q.elementsPresents.filter((e) => e.appuis.length === 0);
  const couverts = new Set(presentsAppuyes.map((e) => e.element));

  const manquants = [
    ...attendus.filter((e) => !couverts.has(e)),
    ...q.elementsManquants.filter((e) => !couverts.has(e)),
  ];

  const manques: Manque[] = [
    ...manquants.map((element, i) => ({
      id: `${q.id}-mq${i + 1}`,
      nature: `Élément constitutif non couvert : ${element}`,
      criticite: 'bloquant' as const,
      necessairePour: `la qualification « ${q.intituleFonctionnel} »`,
      action: 'Identifier la cote qui l’établirait, ou en tirer le moyen : un élément constitutif absent est un axe de relaxe.',
    })),
    ...presentsSansAppui.map((e, i) => ({
      id: `${q.id}-sa${i + 1}`,
      nature: `Élément déclaré présent sans appui : ${e.element}`,
      criticite: 'important' as const,
      necessairePour: `la qualification « ${q.intituleFonctionnel} »`,
      action: 'Relier cet élément à une cote, ou le reclasser comme manquant.',
    })),
  ];

  return {
    qualification: {
      ...q,
      elementsAttendus: attendus,
      elementsPresents: presentsAppuyes,
      elementsManquants: [...new Set(manquants)],
    },
    manques,
    requalification: nature ? (REQUALIFICATIONS[nature] ?? null) : null,
  };
}

/** Rapproche une qualification saisie d'une nature de la taxonomie. */
export function natureDe(q: QualificationEnvisagee, natures: NatureContentieux[]): NatureContentieux | null {
  const texte = q.intituleFonctionnel.toLowerCase();
  const MOTIFS: [RegExp, NatureContentieux][] = [
    [/import/, 'importation'],
    [/association|entente|groupement/, 'association-malfaiteurs'],
    [/blanchi/, 'blanchiment'],
    [/aggrav|bande organis/, 'trafic-aggrave'],
    [/cession|offre|vente/, 'cession'],
    [/d[eé]tention|transport|acquisition/, 'detention-transport'],
    [/usage|consommation/, 'usage'],
    [/douan/, 'volet-douanier'],
    [/patrimoi|saisie|confiscation/, 'volet-patrimonial'],
  ];
  for (const [motif, nature] of MOTIFS) {
    if (motif.test(texte)) return nature;
  }
  return natures[0] ?? null;
}

/** P4 sur tout le dossier, scellée. */
export function executerP4(dossier: DossierPenal, horodatage?: string): {
  analyses: AnalyseQualification[];
  sortie: SortiePasse;
} {
  const analyses = dossier.qualificationsEnvisagees.map((q) =>
    analyserQualification(q, natureDe(q, dossier.natures))
  );

  const sortie = scellerSortie(
    'P4',
    dossier,
    analyses.flatMap((a) => [
      ...a.qualification.elementsPresents.map((e) => ({
        enonce: `[${a.qualification.id}] Élément couvert : ${e.element}`,
        appuis: e.appuis,
      })),
      ...(a.requalification
        ? [{
            enonce: `[${a.qualification.id}] Piste de requalification : ${a.requalification}`,
            appuis: [a.qualification.id],
          }]
        : []),
    ]),
    {
      moteur: MOTEUR_DETERMINISTE,
      traite: analyses.map((a) => a.qualification.id),
      identifiantsSupplementaires: dossier.qualificationsEnvisagees.map((q) => q.id),
      manques: analyses.flatMap((a) =>
        a.manques.map((m) => ({ quoi: m.nature, necessairePour: m.necessairePour, action: m.action }))
      ),
      ouvert:
        dossier.qualificationsEnvisagees.length === 0
          ? ['Aucune qualification envisagée saisie : P4 attend au moins la qualification poursuivie.']
          : [],
      horodatage,
    }
  );

  return { analyses, sortie };
}
