/**
 * LDI — contrats de l'ingestion documentaire.
 *
 * ┌─ LE PRINCIPE QUI COMMANDE CES TYPES ────────────────────────────────────┐
 * │ Une extraction n'est jamais un fait : c'est une LECTURE, faite par une   │
 * │ machine, sur un document qu'elle n'a pas rédigé. Chaque champ produit    │
 * │ ici porte donc sa confiance et son origine, et rien n'entre dans         │
 * │ l'analyse sans que l'avocat puisse savoir d'où cela vient.               │
 * │                                                                          │
 * │ C'est pourquoi il n'existe pas de type « TexteExtrait: string ». Le      │
 * │ texte vient toujours avec sa page, sa méthode et sa confiance.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Familles de format reconnues. `inconnu` n'est pas une erreur, c'est un fait. */
export type FormatFichier =
  | 'pdf'
  | 'docx'
  | 'tableur'
  | 'csv'
  | 'courriel'
  | 'texte'
  | 'image'
  | 'archive'
  | 'inconnu';

/**
 * Comment le texte a été obtenu. Un extrait cité dans des conclusions doit
 * pouvoir dire s'il provient d'une couche texte ou d'une reconnaissance
 * optique non relue.
 */
export type MethodeExtraction =
  | 'couche-texte'
  | 'xml-bureautique'
  | 'texte-brut'
  | 'mime'
  | 'ocr'
  | 'aucune';

export type PageExtraite = {
  /** Numéro de page, 1-indexé. Vaut 1 pour les formats sans pagination. */
  page: number;
  texte: string;
  methode: MethodeExtraction;
  /**
   * Confiance dans l'extraction, de 0 à 1.
   *
   * Ce n'est PAS un score de qualité du document ni une probabilité : c'est
   * une mesure de ce que l'extracteur a pu lire. Une page dont la couche
   * texte est complète vaut 1 ; une page d'image sans couche texte vaut 0.
   */
  confiance: number;
  /** Vrai quand la page attend une saisie ou une relecture humaine. */
  quarantaine: boolean;
  /** Ce qui a motivé la mise en quarantaine, vide sinon. */
  motifQuarantaine: string;
};

export type PieceIngeree = {
  /** Empreinte du CONTENU du fichier. Deux copies donnent la même. */
  empreinte: string;
  /** Nom d'origine, conservé tel quel — il porte souvent la cote. */
  nomFichier: string;
  /** Chemin dans l'archive ou le répertoire déposé, vide à la racine. */
  chemin: string;
  format: FormatFichier;
  octets: number;
  pages: PageExtraite[];
  /**
   * Pièces produites par celle-ci — typiquement les pièces jointes d'un
   * courriel, qui sont des pièces à part entière et non des annexes.
   */
  derivees: PieceIngeree[];
  /** Ce que l'extracteur n'a pas su faire, dit en clair. */
  avertissements: string[];
};

export type Quarantaine = {
  pieces: number;
  pagesTotal: number;
  pagesEnQuarantaine: number;
  pagesCorrigees: number;
};

/**
 * Un fichier écarté, désigné assez précisément pour être retrouvé.
 *
 * Le chemin n'est pas décoratif : deux `vide.txt`, l'un déposé et l'autre au
 * fond d'une archive, sont deux pièces manquantes distinctes. Sans lui, la
 * liste des écartés est un relevé que personne ne peut vérifier.
 */
export type Ecarte = {
  nomFichier: string;
  /** Arborescence d'origine, archives comprises. Vide à la racine du dépôt. */
  chemin: string;
};

export type ResultatIngestion = {
  pieces: PieceIngeree[];
  /** Fichiers écartés comme doublons exacts, avec l'empreinte partagée. */
  doublons: (Ecarte & {
    empreinte: string;
    /** Désignation complète de l'exemplaire CONSERVÉ, chemin compris. */
    identiqueA: string;
  })[];
  /** Fichiers refusés avant toute lecture, avec le motif. */
  refuses: (Ecarte & { motif: string })[];
  compteurs: Quarantaine;
};

/** Un fichier à ingérer, indépendant de l'API `File` du navigateur. */
export type FichierEntrant = {
  nom: string;
  chemin: string;
  octets: Uint8Array;
};

/**
 * Bornes d'ingestion. Elles existent pour que l'échec soit propre plutôt que
 * fatal : un fichier hors bornes est refusé et nommé, il ne fait pas tomber
 * l'ingestion des autres.
 */
export type BornesIngestion = {
  /** Taille maximale d'un fichier, en octets. */
  tailleMaxFichier: number;
  /** Taille cumulée maximale après décompression — contre les bombes zip. */
  tailleMaxDecompressee: number;
  /** Profondeur maximale d'archives imbriquées. */
  profondeurMaxArchive: number;
  /** Nombre maximal d'entrées extraites d'une archive. */
  entreesMaxArchive: number;
  /** En deçà, une page part en quarantaine. */
  seuilConfiance: number;
};

export const BORNES_DEFAUT: BornesIngestion = {
  tailleMaxFichier: 100 * 1024 * 1024,
  tailleMaxDecompressee: 500 * 1024 * 1024,
  profondeurMaxArchive: 3,
  entreesMaxArchive: 2000,
  seuilConfiance: 0.6,
};
