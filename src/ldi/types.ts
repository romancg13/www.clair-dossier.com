/**
 * LDI — Legal Defense Intelligence OS
 * Schémas typés d'entrée/sortie de tous les modules.
 *
 * Principe directeur : aucune affirmation juridique ne circule dans le système
 * sans son statut de vérification. Un `EnonceJuridique` non sourcé est une
 * hypothèse de travail, jamais un fait — le type le rend impossible à oublier.
 */

// ---------------------------------------------------------------------------
// Sourcing — le socle anti-hallucination
// ---------------------------------------------------------------------------

/**
 * Statut de vérification d'un énoncé juridique.
 *
 * - `verifie`      : texte relu sur une source officielle (URL + date de consultation).
 * - `a-verifier`   : référence plausible mais non confrontée à la source dans ce run
 *                    (typiquement : API Légifrance/Judilibre non configurée).
 * - `non-verifiable`: la source officielle n'a pas pu être atteinte, ou la
 *                    référence n'existe pas telle que citée.
 */
export type StatutVerification = 'verifie' | 'a-verifier' | 'non-verifiable';

export type SourceOfficielle = {
  /** Ex. « Légifrance », « Judilibre », « Cour de cassation ». */
  editeur: string;
  url: string;
  /**
   * ISO-8601 (YYYY-MM-DD) — date à laquelle le texte a été effectivement relu.
   * ABSENT tant que personne ne l'a lu : affirmer une date de consultation pour
   * un texte jamais ouvert, c'est fabriquer la provenance qu'on prétend garantir.
   */
  consulteLe?: string;
};

/**
 * Un énoncé juridique et sa preuve de provenance. Tout ce qui est présenté à
 * l'avocat comme du droit passe par cette structure.
 */
export type EnonceJuridique = {
  /** Référence normalisée : « CPP, art. 63 », « CP, art. 222-37 ». */
  reference: string;
  /** Formulation courte de la règle. Jamais une citation intégrale reconstituée de mémoire. */
  enonce: string;
  statut: StatutVerification;
  source?: SourceOfficielle;
  /** Précisions, exceptions, renvois. */
  note?: string;
};

// ---------------------------------------------------------------------------
// Module 1 — Dossier
// ---------------------------------------------------------------------------

export type NatureEvenement =
  | 'interpellation'
  | 'controle-identite'
  | 'debut-garde-a-vue'
  | 'fin-garde-a-vue'
  | 'prolongation-garde-a-vue'
  | 'notification-droits'
  | 'demande-avocat'
  | 'avis-avocat'
  | 'arrivee-avocat'
  | 'entretien-avocat'
  | 'audition'
  | 'confrontation'
  | 'examen-medical'
  | 'perquisition'
  | 'saisie'
  | 'expertise'
  | 'presentation-magistrat'
  | 'autre';

export type Evenement = {
  id: string;
  /** ISO-8601 avec heure quand elle est connue : « 2026-03-14T08:20 ». */
  horodatage: string;
  nature: NatureEvenement;
  /** Description factuelle, telle qu'elle ressort de la pièce. */
  description: string;
  /** Identifiant de la pièce du dossier qui établit l'événement. */
  sourcePieceId?: string;
  /** Personne concernée (pseudonymisée : « MIS_EN_CAUSE », « TEMOIN_1»…). */
  personne?: string;
  /** Lieu déclaré, utile aux tests de présence simultanée. */
  lieu?: string;
  /** Durée en minutes quand la pièce l'indique. */
  dureeMinutes?: number;
};

export type NaturePiece =
  | 'proces-verbal'
  | 'audition'
  | 'expertise'
  | 'temoignage'
  | 'piece-technique'
  | 'photographie'
  | 'video'
  | 'ecoute'
  | 'autre';

export type Piece = {
  id: string;
  nature: NaturePiece;
  intitule: string;
  /** Date de la pièce (ISO-8601). */
  date?: string;
  /** Rédacteur/auteur déclaré. */
  auteur?: string;
  /** Texte intégral quand il est disponible (alimente le module 4). */
  texte?: string;
  /** Cotation au dossier (D1, D42…). */
  cote?: string;
};

export type Dossier = {
  /** Référence interne au cabinet. */
  reference: string;
  /** Qualifications retenues par l'accusation, en références normalisées. */
  qualifications: string[];
  /** Régime procédural — conditionne les durées applicables. */
  regime?: RegimeProcedural;
  evenements: Evenement[];
  pieces: Piece[];
  /** Notes libres de l'avocat, reprises telles quelles dans les rapports. */
  observations?: string[];
};

/**
 * Régime procédural applicable. Détermine notamment la durée maximale de
 * garde à vue et le report éventuel de l'intervention de l'avocat.
 */
export type RegimeProcedural =
  | 'droit-commun'
  | 'criminalite-organisee' // art. 706-73 CPP → art. 706-88 CPP
  | 'terrorisme'; // art. 706-88-1 CPP

export type Severite = 'critique' | 'majeure' | 'mineure';

export type Contradiction = {
  type:
    | 'chronologie'
    | 'duree-legale'
    | 'presence-simultanee'
    | 'anteriorite-piece'
    | 'sequence-procedurale';
  /**
   * Identifiant stable du détecteur qui a produit le constat. Les modules
   * consommateurs s'y réfèrent au lieu de reconnaître un libellé : une
   * reformulation ne doit pas désactiver silencieusement un point de contrôle.
   */
  regle?: string;
  severite: Severite;
  /** Ce qui est incohérent, en une phrase. */
  constat: string;
  /** Événements ou pièces concernés. */
  elements: string[];
  /** Ce que l'avocat doit vérifier au dossier pour confirmer ou écarter. */
  verificationSuggeree: string;
};

export type AnalyseDossier = {
  reference: string;
  qualifications: string[];
  regime: RegimeProcedural;
  chronologie: Evenement[];
  contradictions: Contradiction[];
  /** Nombre total de pièces versées au dossier. */
  piecesTotal: number;
  /** Événements sans pièce de rattachement : rien ne les établit. */
  evenementsNonSources: string[];
  /** Pièces jamais invoquées par un événement de la chronologie. */
  piecesOrphelines: string[];
};

// ---------------------------------------------------------------------------
// Module 2 — Recherche juridique
// ---------------------------------------------------------------------------

export type DecisionJurisprudentielle = {
  juridiction: string;
  /** ISO-8601. */
  date: string;
  /** Numéro de pourvoi. */
  numero: string;
  /** Solution retenue, en une phrase. */
  solution: string;
  statut: StatutVerification;
  source?: SourceOfficielle;
};

export type ResultatRecherche = {
  reference: string;
  texte?: EnonceJuridique;
  decisions: DecisionJurisprudentielle[];
  /** Renseigné quand aucune source n'a pu être interrogée. */
  avertissement?: string;
};

// ---------------------------------------------------------------------------
// Module 3 — Nullités
// ---------------------------------------------------------------------------

/**
 * Résultat d'un point de contrôle procédural.
 *
 * `non-etabli` est distinct de `conforme` : le dossier fourni ne permet pas de
 * conclure. C'est l'état par défaut — l'absence d'information n'est jamais
 * traitée comme une conformité.
 */
export type ResultatControle = 'conforme' | 'anomalie' | 'non-etabli';

export type PointControle = {
  id: string;
  intitule: string;
  fondement: EnonceJuridique;
  resultat: ResultatControle;
  severite: Severite;
  /** Ce qui a été constaté dans le dossier. */
  constat: string;
  /** Pièces à réclamer ou à vérifier. */
  actionSuggeree: string;
  /** Objections prévisibles du parquet, à anticiper. */
  contreArgument?: string;
};

export type RapportNullites = {
  points: PointControle[];
  anomalies: PointControle[];
  nonEtablis: PointControle[];
  /** Rappel du régime de la nullité : art. 171 et 802 CPP (grief). */
  regimeNullite: EnonceJuridique[];
  /** Textes cités dans les constats sans être le fondement d'un point (prescription…). */
  referencesComplementaires: EnonceJuridique[];
};

// ---------------------------------------------------------------------------
// Module 4 — Stratégie
// ---------------------------------------------------------------------------

/**
 * Solidité d'un axe de défense. Échelle ordinale documentée — le système
 * n'exprime pas de pourcentage de succès (cf. docs/LDI.md, § « Pas de
 * pronostic chiffré »).
 */
export type Solidite = 'etayee' | 'plausible' | 'exploratoire';

export type AxeDefense = {
  intitule: string;
  solidite: Solidite;
  /** Pourquoi ce niveau et pas un autre — la règle appliquée est explicite. */
  justificationSolidite: string;
  fondements: EnonceJuridique[];
  /** Constats du dossier qui portent l'axe. */
  appuis: string[];
  contreArguments: string[];
  /** Actes à accomplir pour consolider l'axe. */
  actes: string[];
};

export type NoteStrategique = {
  reference: string;
  axes: AxeDefense[];
  /** Risques pour le client, y compris ceux qu'on préférerait ne pas voir. */
  risques: string[];
  /** Ce qui manque au dossier pour trancher. */
  zonesIncertitude: string[];
  /** Échéances procédurales à ne pas manquer. */
  echeances: string[];
};

// ---------------------------------------------------------------------------
// Module 6 — Documents
// ---------------------------------------------------------------------------

export type TypeDocument =
  | 'requete-nullite'
  | 'memoire-defense'
  | 'demande-mise-en-liberte'
  | 'memoire-appel';

export type DocumentJuridique = {
  type: TypeDocument;
  titre: string;
  /** Corps du document en markdown, avec les emplacements à compléter balisés. */
  corps: string;
  /** Emplacements laissés à l'avocat : « [À COMPLÉTER : …] ». */
  aCompleter: string[];
  /** Références citées dans le corps, avec leur statut de vérification. */
  referencesCitees: EnonceJuridique[];
  /** Résultat du contrôle de citations exécuté après génération. */
  verification: {
    conforme: boolean;
    citationsNonVerifiees: string[];
    rapport: string;
  };
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export type RapportLdi = {
  /** Version du moteur, reportée dans les documents générés. */
  version: string;
  genereLe: string;
  dossier: AnalyseDossier;
  nullites: RapportNullites;
  strategie: NoteStrategique;
  /** Limites applicables à ce rapport précis. */
  limites: string[];
};
