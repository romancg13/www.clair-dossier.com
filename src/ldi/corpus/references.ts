/**
 * LDI — index des références légales utilisées par les modules.
 *
 * ┌─ POLITIQUE DE SOURÇAGE ────────────────────────────────────────────────┐
 * │ Ce fichier est un INDEX, pas une source. Il associe une référence       │
 * │ normalisée à l'URL Légifrance correspondante et à un énoncé court de    │
 * │ la règle.                                                               │
 * │                                                                         │
 * │ Toutes les entrées naissent au statut `a-verifier`. Seul le résolveur   │
 * │ d'exécution (`modules/recherche.ts`), après avoir lu le texte sur       │
 * │ Légifrance, peut faire passer une entrée à `verifie`. Un rapport produit │
 * │ sans accès à Légifrance affiche donc « à vérifier » partout — c'est le  │
 * │ comportement voulu, pas une dégradation.                                 │
 * │                                                                         │
 * │ Raison d'être de cette règle : le code pénal et le CPP bougent. Au      │
 * │ moment de la rédaction, Légifrance expose des versions 2026 des art.    │
 * │ 63-1 et 63-2 CPP. Un énoncé figé dans un fichier TypeScript est périmé  │
 * │ par construction.                                                       │
 * │                                                                         │
 * │ `controleManuel` indique la date à laquelle l'énoncé a été confronté à  │
 * │ la fiche Légifrance lors de l'écriture du module. C'est une indication  │
 * │ de sérieux, pas une garantie de version en vigueur.                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import type { EnonceJuridique } from '../types';

const LEGIFRANCE = 'Légifrance';

/** Date du contrôle manuel des énoncés ci-dessous (ISO-8601). */
export const CONTROLE_MANUEL = '2026-08-17';

type EntreeCorpus = EnonceJuridique & {
  /** Date du dernier contrôle manuel, ou `null` si l'énoncé n'a pas été relu. */
  controleManuel: string | null;
};

function entree(
  reference: string,
  enonce: string,
  url: string,
  options: { note?: string; controleManuel?: string | null } = {}
): EntreeCorpus {
  return {
    reference,
    enonce,
    // Statut initial systématique : rien n'est « vérifié » avant lecture de la source.
    statut: 'a-verifier',
    source: { editeur: LEGIFRANCE, url, consulteLe: options.controleManuel ?? CONTROLE_MANUEL },
    note: options.note,
    controleManuel: options.controleManuel === undefined ? CONTROLE_MANUEL : options.controleManuel,
  };
}

// ---------------------------------------------------------------------------
// Code de procédure pénale — garde à vue
// ---------------------------------------------------------------------------

export const CPP_62_2 = entree(
  'CPP, art. 62-2',
  "La garde à vue est une mesure de contrainte visant une personne à l'encontre de laquelle il existe une ou plusieurs raisons plausibles de soupçonner qu'elle a commis ou tenté de commettre un crime ou un délit puni d'emprisonnement ; elle doit constituer l'unique moyen de parvenir à l'un au moins des six objectifs énumérés par l'article.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000023865405',
  {
    note: "Double condition cumulative : raisons plausibles + nécessité au regard d'au moins un des six objectifs. L'absence de motivation sur l'un des six objectifs est un angle d'attaque classique.",
  }
);

export const CPP_63 = entree(
  'CPP, art. 63',
  "La garde à vue ne peut excéder vingt-quatre heures. Elle peut être prolongée une fois pour vingt-quatre heures au plus, sur autorisation écrite et motivée du procureur de la République, si l'infraction est un crime ou un délit puni d'au moins un an d'emprisonnement et si la prolongation est l'unique moyen d'atteindre l'un des objectifs de l'article 62-2.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038311888',
  {
    note: "Point de départ : l'heure de la privation de liberté effective, et non celle du placement formel. Les gardes à vue antérieures pour les mêmes faits s'imputent sur la durée totale.",
  }
);

export const CPP_63_1 = entree(
  'CPP, art. 63-1',
  "La personne placée en garde à vue est immédiatement informée par un officier de police judiciaire, dans une langue qu'elle comprend, de son placement, de la qualification et de la date présumée de l'infraction, ainsi que de ses droits (médecin, avocat, interprète, avis à un proche, déclarations/silence).",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032655471',
  {
    note: "Le texte connaît une version 2026 sur Légifrance : vérifier la rédaction applicable à la date des faits du dossier.",
  }
);

export const CPP_63_3 = entree(
  'CPP, art. 63-3',
  "Toute personne placée en garde à vue peut, à sa demande, être examinée par un médecin ; l'examen est de droit si un membre de la famille le demande, et peut être ordonné d'office par l'officier de police judiciaire ou le procureur.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049461469/2024-07-08'
);

export const CPP_63_3_1 = entree(
  'CPP, art. 63-3-1',
  "Dès le début de la garde à vue et à tout moment, la personne peut demander à être assistée par un avocat, choisi ou commis d'office. Si l'avocat choisi ne peut être contacté ou déclare ne pouvoir se déplacer dans un délai de deux heures, l'officier de police judiciaire saisit le bâtonnier aux fins de commission d'office.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049461462'
);

export const CPP_63_4_2 = entree(
  'CPP, art. 63-4-2',
  "La personne gardée à vue peut demander que l'avocat assiste à ses auditions et confrontations. Sauf lorsqu'elle porte uniquement sur les éléments d'identité, la première audition ne peut débuter, hors présence de l'avocat, avant l'expiration d'un délai de deux heures suivant l'avis adressé à celui-ci ; le report de l'intervention de l'avocat ne peut être décidé que dans les conditions et pour les motifs prévus par le texte.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049461450',
  {
    note: "Contrôle de première importance : une audition ouverte avant l'expiration du délai de deux heures, sans avocat et sans décision de report régulière, est un grief caractérisé.",
  }
);

export const CPP_706_88 = entree(
  'CPP, art. 706-88',
  "Pour les infractions relevant de l'article 706-73, la garde à vue peut faire l'objet de deux prolongations supplémentaires de vingt-quatre heures chacune (ou d'une prolongation unique de quarante-huit heures), portant la durée maximale à quatre-vingt-seize heures, sur décision écrite et motivée du juge des libertés et de la détention ou du juge d'instruction.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047860863',
  {
    note: "Régime dérogatoire d'interprétation stricte : il suppose que les faits entrent effectivement dans le champ de l'art. 706-73. Contester la qualification, c'est contester la durée.",
  }
);

export const CPP_706_88_1 = entree(
  'CPP, art. 706-88-1',
  "En matière de terrorisme, une prolongation supplémentaire à titre exceptionnel peut être autorisée par le juge des libertés et de la détention dans les conditions et limites fixées par le texte.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000023865495',
  { controleManuel: null }
);

// ---------------------------------------------------------------------------
// Code de procédure pénale — contrôles, perquisitions
// ---------------------------------------------------------------------------

export const CPP_78_2 = entree(
  'CPP, art. 78-2',
  "L'identité d'une personne peut être contrôlée s'il existe une ou plusieurs raisons plausibles de soupçonner qu'elle a commis ou tenté de commettre une infraction, qu'elle se prépare à commettre un crime ou un délit, qu'elle est susceptible de fournir des renseignements utiles à une enquête, ou qu'elle fait l'objet de recherches ordonnées par une autorité judiciaire. Le contrôle peut aussi être opéré sur réquisitions écrites du procureur, dans les lieux et pour la période qu'il détermine.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037399447',
  {
    note: "ATTENTION — le texte précise que la découverte, à l'occasion d'un contrôle, d'infractions autres que celles visées dans les réquisitions ne constitue pas une cause de nullité. Un moyen fondé sur le seul décalage entre l'infraction visée par les réquisitions et celle finalement poursuivie est donc voué à l'échec : il faut attaquer l'existence ou la régularité des réquisitions elles-mêmes, ou l'absence de raisons plausibles.",
  }
);

export const CPP_76 = entree(
  'CPP, art. 76',
  "En enquête préliminaire, les perquisitions, visites domiciliaires et saisies ne peuvent être effectuées sans l'assentiment exprès de la personne chez laquelle l'opération a lieu ; cet assentiment fait l'objet d'une déclaration écrite de sa main ou, si elle ne sait écrire, est mentionné au procès-verbal. Le juge des libertés et de la détention peut toutefois autoriser l'opération sans assentiment, par décision écrite et motivée, dans les cas prévus par le texte.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039279525'
);

// ---------------------------------------------------------------------------
// Code de procédure pénale — nullités
// ---------------------------------------------------------------------------

export const CPP_171 = entree(
  'CPP, art. 171',
  "Il y a nullité lorsque la méconnaissance d'une formalité substantielle prévue par une disposition du code de procédure pénale ou par toute autre disposition de procédure pénale a porté atteinte aux intérêts de la partie qu'elle concerne.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006575770',
  {
    note: "La démonstration du grief est le cœur de la requête : identifier la formalité, puis l'atteinte concrète aux intérêts du mis en cause.",
  }
);

export const CPP_802 = entree(
  'CPP, art. 802',
  "En cas de violation des formes prescrites par la loi à peine de nullité ou d'inobservation des formalités substantielles, la juridiction saisie ne peut prononcer la nullité que lorsque l'irrégularité a eu pour effet de porter atteinte aux intérêts de la partie qu'elle concerne.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006578401/1993-03-01',
  {
    note: "URL pointant sur une version datée : à re-résoudre sur la version en vigueur avant toute citation dans un acte.",
  }
);

export const CPP_173 = entree(
  'CPP, art. 173',
  "La requête en nullité est, à peine d'irrecevabilité, déposée au greffe de la chambre de l'instruction, où elle est enregistrée et datée. Lorsque la chambre de l'instruction est saisie sur ce fondement, tous les moyens de nullité doivent lui être proposés : à défaut, les parties ne sont plus recevables à les soulever, sauf celles qu'elles n'auraient pu connaître. Le président dispose d'un délai pour déclarer la requête irrecevable.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038312041',
  {
    note: "Conséquence pratique décisive : la requête doit être EXHAUSTIVE. Un moyen omis est un moyen perdu. C'est la raison d'être du module 3 — balayer tous les points de contrôle avant dépôt, pas seulement les plus visibles.",
  }
);

export const CPP_174 = entree(
  'CPP, art. 174',
  "La chambre de l'instruction décide si l'annulation doit être limitée à tout ou partie des actes ou pièces viciés ou s'étendre à tout ou partie de la procédure ultérieure. Les actes ou pièces annulés sont retirés du dossier. Les moyens pris de la nullité des actes annulés ne peuvent plus être soulevés par la suite.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006575784',
  {
    note: "L'étendue de l'annulation est un enjeu à part entière : obtenir la nullité d'un acte ne suffit pas si les actes subséquents qui en découlent sont maintenus. Le moyen doit viser explicitement l'extension.",
  }
);

// ---------------------------------------------------------------------------
// Code de procédure pénale — prescription
// ---------------------------------------------------------------------------

export const CPP_7 = entree(
  'CPP, art. 7',
  "L'action publique des crimes se prescrit par vingt années révolues à compter du jour de l'infraction ; trente années pour les crimes énumérés par le texte ; certains crimes contre l'humanité sont imprescriptibles.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043409351',
  { note: 'Rédaction issue de la loi n° 2017-242 du 27 février 2017.' }
);

export const CPP_8 = entree(
  'CPP, art. 8',
  "L'action publique des délits se prescrit par six années révolues à compter du jour de l'infraction, sous réserve des règles particulières prévues par le texte.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049531911',
  { note: 'Rédaction issue de la loi n° 2017-242 du 27 février 2017.' }
);

export const CPP_9_1 = entree(
  'CPP, art. 9-1',
  "Pour les infractions occultes ou dissimulées, le délai de prescription court à compter du jour où l'infraction est apparue et a pu être constatée dans des conditions permettant l'exercice de l'action publique, sans que le délai puisse excéder douze années pour les délits et trente années pour les crimes à compter du jour de l'infraction.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000034098591/2018-04-02'
);

// ---------------------------------------------------------------------------
// Code pénal — infractions visées par le cahier des charges
// ---------------------------------------------------------------------------

export const CP_222_37 = entree(
  'CP, art. 222-37',
  "Le transport, la détention, l'offre, la cession, l'acquisition ou l'emploi illicites de stupéfiants sont punis de dix ans d'emprisonnement et de 7 500 000 euros d'amende.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417724',
  {
    note: "Délit : prescription de six ans (art. 8 CPP), et non dix ans. Vérifier l'articulation avec les art. 222-34 et suivants (direction/organisation, importation) qui sont, eux, de nature criminelle.",
  }
);

export const CP_313_1 = entree(
  'CP, art. 313-1',
  "L'escroquerie est punie de cinq ans d'emprisonnement et de 375 000 euros d'amende.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006418192',
  { note: "Peines aggravées notamment lorsque les faits sont commis par une personne dépositaire de l'autorité publique (art. 313-2)." }
);

export const CP_324_1 = entree(
  'CP, art. 324-1',
  "Le blanchiment est puni de cinq ans d'emprisonnement et de 375 000 euros d'amende.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006418330',
  { note: "L'amende peut être élevée jusqu'à la moitié de la valeur des biens ou fonds concernés (art. 324-3)." }
);

export const CP_432_11 = entree(
  'CP, art. 432-11',
  "La corruption passive et le trafic d'influence commis par une personne dépositaire de l'autorité publique, chargée d'une mission de service public ou investie d'un mandat électif public sont réprimés par cet article.",
  'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006418517',
  {
    note: "Ne pas confondre avec la corruption active de l'art. 433-1, qui vise le corrupteur. Le cahier des charges initial renvoyait à « art. 432+ » sans distinguer les deux.",
  }
);

// ---------------------------------------------------------------------------
// Convention européenne des droits de l'homme
// ---------------------------------------------------------------------------

export const CEDH_6 = entree(
  'CEDH, art. 6',
  "Droit à un procès équitable : cause entendue équitablement, publiquement et dans un délai raisonnable, par un tribunal indépendant et impartial ; présomption d'innocence ; droits de la défense, dont l'assistance d'un défenseur.",
  'https://www.echr.coe.int/documents/d/echr/convention_FRA',
  { controleManuel: null }
);

export const CEDH_8 = entree(
  'CEDH, art. 8',
  "Droit au respect de la vie privée et familiale, du domicile et de la correspondance ; toute ingérence doit être prévue par la loi, poursuivre un but légitime et être nécessaire dans une société démocratique.",
  'https://www.echr.coe.int/documents/d/echr/convention_FRA',
  { controleManuel: null }
);

// ---------------------------------------------------------------------------
// Registre
// ---------------------------------------------------------------------------

export const CORPUS: EntreeCorpus[] = [
  CPP_62_2,
  CPP_63,
  CPP_63_1,
  CPP_63_3,
  CPP_63_3_1,
  CPP_63_4_2,
  CPP_706_88,
  CPP_706_88_1,
  CPP_78_2,
  CPP_76,
  CPP_171,
  CPP_173,
  CPP_174,
  CPP_802,
  CPP_7,
  CPP_8,
  CPP_9_1,
  CP_222_37,
  CP_313_1,
  CP_324_1,
  CP_432_11,
  CEDH_6,
  CEDH_8,
];

/** Retrouve une entrée par sa référence normalisée (« CPP, art. 63 »). */
export function trouverReference(reference: string): EntreeCorpus | undefined {
  const cible = reference.trim().toLowerCase();
  return CORPUS.find((e) => e.reference.toLowerCase() === cible);
}

/**
 * Durées maximales de garde à vue par régime, en heures.
 * Le cahier des charges initial indiquait « 72h max » : cette valeur ne
 * correspond à aucun régime du CPP et n'est pas reprise ici.
 */
export const DUREE_MAX_GAV_HEURES: Record<
  string,
  { heures: number; fondement: EnonceJuridique; note?: string }
> = {
  'droit-commun': { heures: 48, fondement: CPP_63 },
  'criminalite-organisee': { heures: 96, fondement: CPP_706_88 },
  terrorisme: {
    heures: 144,
    fondement: CPP_706_88_1,
    note: "Valeur non contrôlée manuellement sur Légifrance lors de l'écriture du module : à confirmer article en main avant tout usage dans un acte.",
  },
};
