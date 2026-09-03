/**
 * Types du pipeline d'ingestion (PARTIE 7.1, étapes 1 à 5).
 *
 * Code serveur partagé : exécuté par l'Edge Function `ingest-document` (Deno) et
 * par les tests d'intégration (Node, base Postgres locale). Aucune dépendance à un
 * runtime particulier : Web Crypto, Uint8Array, fetch.
 */

export type Travail = {
  id: number;
  tenant_id: string;
  dossier_id: string | null;
  document_id: string | null;
  type: string;
  charge: Record<string, unknown>;
  priorite: number;
  tentatives: number;
  max_tentatives: number;
  trace_id: string;
};

export type DocumentIngestion = {
  id: string;
  tenant_id: string;
  dossier_id: string;
  file_path: string;
  file_name: string;
  size_bytes: number | null;
  mime: string | null;
  hash_sha256: string | null;
  kind: string;
  statut_ingestion: string;
  doublon_de_id: string | null;
  supprime_le: string | null;
};

export type MethodePage = "natif" | "ocr" | "ocr_requis";

export type PageExtraite = {
  page: number;
  texte: string;
  methode: MethodePage;
  score_qualite: number | null;
};

/** Codes d'escalade fermés (PARTIE 5.2). Aucun autre code n'existe. */
export type CodeEscalade = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8" | "E9";

export type Escalade = {
  code: CodeEscalade;
  motif: string;
  destinataire: "utilisateur" | "ECHO" | "CLAIR-OS" | "journal";
};

export type Incertitude = {
  objet: string;
  impact: "faible" | "moyen" | "fort";
  /** Code d'escalade associé, ou "aucune". */
  action: CodeEscalade | "aucune";
};

export type StatutSortie = "ok" | "partiel" | "escalade" | "echec";

/** Contrôles de l'étape 1 (RÉCEPTION). "non_disponible" est dit, jamais masqué. */
export type Controles = {
  quota: "ok" | string;
  type: "ok" | string;
  taille: "ok" | string;
  antivirus: "ok" | "non_disponible";
};

/** Sortie d'une exécution, alignée sur le schéma universel (PARTIE 6). */
export type SortieIngestion = {
  agent: "INGESTION";
  version: string;
  dossier_id: string;
  trace_id: string;
  horodatage: string;
  statut: StatutSortie;
  confiance_globale: number;
  resultat: {
    document_id: string;
    statut_ingestion: string;
    erreur: string | null;
    hash_sha256: string | null;
    mime: string | null;
    pages: number;
    pages_sans_texte: number[];
    pages_sous_seuil: number[];
    score_qualite: number | null;
    doublon_de_id: string | null;
    controles: Controles;
  };
  assertions: never[];
  incertitudes: Incertitude[];
  escalades: Escalade[];
  donnees_sensibles_detectees: string[];
  cout: { modele: string | null; tokens_entree: number; tokens_sortie: number };
  duree_ms: number;
};

export type Quota = {
  ok: boolean;
  motif?: string;
  limite?: number;
  valeur?: number;
  max_pages_par_piece?: number | null;
};

export type PageTexte = { page: number; texte: string; methode: MethodePage };

/** Chunk d'une page : offsets dans le texte de la page, embedding sérialisé pgvector. */
export type Chunk = {
  page: number;
  offset_debut: number;
  offset_fin: number;
  texte: string;
  embedding?: string;
  embedding_modele?: string;
};

export type ResultatRecherche = {
  chunk_id: string;
  document_id: string;
  file_name: string;
  page: number;
  offset_debut: number;
  offset_fin: number;
  texte: string;
  rang_lexical: number | null;
  rang_vectoriel: number | null;
  score_fusion: number;
  couverture_termes?: number;
};

/** Sortie du travail d'indexation (schéma universel, sans assertion). */
export type SortieIndexation = {
  agent: "INDEXATION";
  version: string;
  dossier_id: string;
  trace_id: string;
  horodatage: string;
  statut: StatutSortie;
  confiance_globale: number;
  resultat: {
    document_id: string;
    statut_ingestion: string;
    pages_indexees: number[];
    pages_ignorees: number[];
    nb_chunks: number;
    nb_chunks_vectorises: number;
    embedding_modele: string;
    dimension: number;
  };
  assertions: never[];
  incertitudes: Incertitude[];
  escalades: Escalade[];
  donnees_sensibles_detectees: string[];
  cout: { modele: string | null; tokens_entree: number; tokens_sortie: number };
  duree_ms: number;
};

/** Persistance : implémentée par Supabase (service role) en production, par pg dans les tests. */
export interface Store {
  prendreTravail(types: string[], executant: string): Promise<Travail | null>;
  terminerTravail(id: number, resultat: unknown): Promise<void>;
  echouerTravail(id: number, erreur: string, definitif?: boolean): Promise<void>;
  lireDocument(id: string): Promise<DocumentIngestion | null>;
  verifierQuota(documentId: string): Promise<Quota>;
  enregistrerEmpreinte(documentId: string, hash: string, mime: string | null, taille: number, pages?: number | null): Promise<void>;
  enregistrerPages(documentId: string, pages: PageExtraite[]): Promise<void>;
  marquerIngestion(documentId: string, statut: string, erreur: string | null, pages: number | null, traceId: string): Promise<void>;
  demarrerRun(agent: string, tenantId: string, dossierId: string | null, traceId: string, entreeHash: string, modele: string | null, version: string): Promise<string>;
  terminerRun(runId: string, statut: StatutSortie, sortie: unknown, confiance: number | null, dureeMs: number, erreur: string | null, tokensEntree?: number | null, tokensSortie?: number | null): Promise<void>;
  lireDocumentPages(documentId: string): Promise<PageTexte[]>;
  enregistrerChunks(documentId: string, chunks: Chunk[]): Promise<void>;
  rechercherChunks(tenantId: string, dossierId: string, requete: string, embedding: string | null, limite: number): Promise<ResultatRecherche[]>;
  lireChunks(documentId: string): Promise<(Chunk & { id: string })[]>;
  enregistrerEntites(dossierId: string, entites: unknown[]): Promise<{ entite_id: string; verrouillee: boolean; creee: boolean }[]>;
  enregistrerEvenements(dossierId: string, evenements: unknown[]): Promise<{ evenement_id: string; verrouillee: boolean; creee: boolean }[]>;
  /** Pièces d'un dossier (métadonnées, sans texte), par ordre de dépôt. */
  lireDocumentsDossier(dossierId: string): Promise<DocumentResume[]>;
  enregistrerClassification(
    documentId: string, categorie: string, confiance: number, nomNormalise: string | null,
    quasiDoublonDeId: string | null, similarite: number | null, traceId: string,
  ): Promise<{ categorie_appliquee: boolean; categorie_humaine: boolean }>;
}

export type DocumentResume = {
  id: string;
  file_name: string;
  kind: string;
  statut_ingestion: string;
  categorie: string | null;
  confiance_classification: number | null;
  pages: number | null;
  supprime_le: string | null;
  created_at: string;
};

/** Accès aux octets d'une pièce (bucket privé en production, fichiers du jeu d'essai en test). */
export interface Stockage {
  telecharger(filePath: string): Promise<Uint8Array>;
}

/** Erreur qui ne justifie aucune nouvelle tentative (donnée absente, entrée invalide). */
export class ErreurDefinitive extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurDefinitive";
  }
}
