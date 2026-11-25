// Ports du moteur : ce que l'exécuteur attend d'un stockage durable. Le worker
// Supabase (SQL) et l'adaptateur de recette (Vercel Blob) en fournissent chacun
// une mise en œuvre ; le cœur ne connaît ni base ni fournisseur.
import type { AnalysisOutput } from './schemas.ts';
import type { StoredExtraction } from './verify.ts';
import type { ChronoEvent, DeliverableKey, EventOverride, DeadlineRow } from '../analysis-model.ts';

export type JobKind = 'extract' | 'consolidate' | 'render';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  /**
   * Clé d'idempotence : x:<pièce>, c:<dossier>, r:<dossier> (une seule clé par pièce, quel que soit l'appelant) ;
   * n:<dossier>:<lot> = rendu différé qui clôt un lot dont l'envoi s'est interrompu (aucun traitement de pièce) ;
   * cr:<dossier> = reprise différée d'une consolidation rendue par les règles faute de budget IA ;
   * xr:<pièce> = relecture automatique différée d'une pièce en échec définitif (créée une fois le travail x: terminé).
   */
  key: string;
  kind: JobKind;
  user_id: string;
  dossier_id: string;
  piece_id: string | null;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  lease_until: string | null;
  locked_by: string | null;
  /** Réarmé pendant l'exécution (nouveau dépôt) : relancer après la fin. */
  rerun: boolean;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DossierState {
  id: string;
  user_id: string;
  title: string;
  typology: string | null;
  objective: string | null;
  deleted: boolean;
  closed: boolean;
  /** Mode de publication : 'auto' = livré au client sans geste ; 'manual' = circuit de validation. */
  review_mode: 'auto' | 'manual';
  /** Dossier sensible (circuit de validation professionnelle). */
  sensitive: boolean;
}

export interface PieceRec {
  id: string;
  dossier_id: string;
  user_id: string;
  lot_id: string;
  file_name: string;
  mime: string | null;
  size_bytes: number;
  sha256: string;
  duplicate_of: string | null;
  created_at: string;
  deleted_at: string | null;
}

/** Plafond de dépense IA atteint : compte (mois), service (mois) ou dépôt. */
export type BudgetScope = 'user' | 'global' | 'lot';

export interface ExtractionRec {
  piece_id: string;
  dossier_id: string;
  user_id: string;
  sha256: string;
  status: 'ok' | 'unsupported' | 'error';
  reason: string | null;
  /** Lecture reportée (lecture visuelle indisponible, budget du lot) : ce n'est pas au client d'agir. */
  deferred?: boolean;
  /** Pièce lue par les règles déterministes faute de budget IA (résultat partiel) ; la lecture IA reprend au cycle suivant. */
  /** Repli budget, ou 'progressif' : lecture par règles publiée en premiers résultats, remplacée par la lecture IA. */
  fallback?: BudgetScope | 'progressif';
  /** Relectures automatiques déjà tentées après un échec définitif (plafonnées, attente croissante). */
  rereads?: number;
  data: StoredExtraction | null;
  vision: boolean;
  provider: string;
  model: string | null;
  reused_from: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  created_at: string;
}

export type AnalysisData3 = AnalysisOutput & { events: ChronoEvent[]; guard?: { stripped: number; notes: string[] } };

export interface CoverageRec {
  total: number;
  extracted: number;
  unsupported: number;
  failed: number;
  pending: number;
  /** Pièces dont la lecture est reportée (service), sans action du client. */
  deferred: number;
  duplicates: number;
  /** Pièces lues par les règles seules faute de budget IA (comptées dans `extracted`). */
  fallback?: number;
  /** Motif lisible d'un résultat partiel pour cause de budget IA (pièces ou consolidation en repli). */
  partial_reason?: string;
  /** Premiers résultats (règles) publiés pendant que la lecture approfondie se poursuit. */
  provisional?: boolean;
  complete: boolean;
}

export type PieceState = 'ok' | 'unsupported' | 'error' | 'deferred';

export interface AnalysisRec {
  dossier_id: string;
  user_id: string;
  revision: number;
  input_fingerprint: string;
  lots: string[];
  /** État de chaque pièce principale prise en compte par cette révision (absent sur les révisions antérieures). */
  pieces?: Record<string, PieceState>;
  data: AnalysisData3;
  coverage: CoverageRec;
  provider: string;
  model: string | null;
  status: 'pending' | 'published';
  /** Consolidation rendue par les règles faute de budget IA : recalculée par l'IA dès que le budget le permet. */
  budget_fallback?: BudgetScope;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  created_at: string;
}

export interface OutFileLite {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface PublishedCategory {
  category: DeliverableKey;
  revision: number;
  data_hash: string;
  status: 'approved' | 'pending';
  files: { name: string; mime: string; size_bytes: number; path: string }[];
  published_at: string;
  /** Versions précédentes conservées (chemins), la plus récente en tête. */
  previous: { revision: number; data_hash: string; files: { name: string; path: string }[]; published_at: string }[];
}

export interface Costs {
  userMonth: number;
  globalMonth: number;
  lot: number;
}

export interface EngineStore {
  getDossier(id: string): Promise<DossierState | null>;
  /** Droits revérifiés côté serveur (abonnement actif ou résilié non échu). */
  entitlementActive(userId: string): Promise<boolean>;
  listPieces(dossierId: string): Promise<PieceRec[]>;
  /**
   * Facultatif : la pièce et celles du dossier de MÊME empreinte (elle comprise), triées par dépôt, sans lire les
   * autres fiches. Absent : le moteur lit toutes les pièces du dossier (listPieces).
   */
  piecesOfSameContent?(dossierId: string, pieceId: string): Promise<{ piece: PieceRec | null; same: PieceRec[] }>;
  getPiece(id: string): Promise<PieceRec | null>;
  readPieceBytes(piece: PieceRec): Promise<Uint8Array>;
  /** Rattache une pièce à son original ; null la rend de nouveau principale. */
  markDuplicate(pieceId: string, ofId: string | null): Promise<void>;

  getExtraction(pieceId: string): Promise<ExtractionRec | null>;
  putExtraction(rec: ExtractionRec): Promise<void>;
  /** Extraction réutilisable du MÊME titulaire pour la même empreinte (jamais entre titulaires). */
  findReusableExtraction(userId: string, sha256: string): Promise<ExtractionRec | null>;

  lastAnalysis(dossierId: string): Promise<AnalysisRec | null>;
  /** Numéro de la dernière révision, sans charger son contenu (facultatif : à défaut, lastAnalysis). */
  lastRevision?(dossierId: string): Promise<number | null>;
  /** Crée la révision ; refuse si elle existe déjà (retourne false). */
  insertAnalysis(rec: AnalysisRec): Promise<boolean>;
  setAnalysisStatus(dossierId: string, revision: number, status: AnalysisRec['status']): Promise<void>;

  listOverrides(dossierId: string): Promise<EventOverride[]>;
  listDeadlines(dossierId: string): Promise<DeadlineRow[]>;
  /** Synchronise les échéances détectées sans écraser les corrections humaines. */
  syncDeadlines(dossierId: string, userId: string, rows: DeadlineRow[]): Promise<void>;

  getPublished(dossierId: string): Promise<Partial<Record<DeliverableKey, PublishedCategory>>>;
  /** Publication ATOMIQUE d'une catégorie : fichiers écrits, puis bascule du pointeur ; anciennes versions conservées. */
  publishCategory(dossierId: string, userId: string, category: DeliverableKey, revision: number, dataHash: string, files: OutFileLite[], status: 'approved' | 'pending'): Promise<void>;
  /**
   * Facultatif : publication groupée de plusieurs catégories (fichiers écrits de front, pointeurs basculés ensemble),
   * mêmes garanties que publishCategory pour chacune. Absent : une publication par catégorie.
   */
  publishCategories?(dossierId: string, userId: string, revision: number, items: { category: DeliverableKey; dataHash: string; files: OutFileLite[] }[], status: 'approved' | 'pending'): Promise<void>;
  /** Jeu de données d'affichage (web) de la révision publiée. */
  putView(dossierId: string, revision: number, view: unknown, status: 'approved' | 'pending'): Promise<void>;

  /** keepFailed : le travail en échec que celui-ci remplace reste signalé (relecture automatique d'une pièce illisible). */
  enqueue(job: Pick<Job, 'key' | 'kind' | 'user_id' | 'dossier_id' | 'piece_id'> & { delayMs?: number; keepFailed?: boolean }): Promise<'created' | 'rearmed' | 'exists'>;
  /**
   * Prend un travail prêt. Équité attendue de toute mise en œuvre : à tour de rôle entre les comptes (un travail
   * par compte et par tour), nombre de travaux simultanés borné par compte.
   */
  claim(workerId: string, leaseMs: number): Promise<Job | null>;
  complete(job: Job, outcome: { status: 'done' | 'failed' | 'cancelled'; error?: string | null } | { status: 'queued'; delayMs: number; countAttempt: boolean; error?: string | null }): Promise<void>;
  openJobs(dossierId: string): Promise<Job[]>;

  costs(userId: string, lotIds: string[]): Promise<Costs>;
  addCost(userId: string, lotId: string | null, cents: number): Promise<void>;

  addEvent(dossierId: string, userId: string, type: string, label: string): Promise<void>;
  /**
   * Vrai une seule fois par (dossier, lot), et seulement quand le lot est complet (pièces annoncées reçues ou envoi
   * clos), que chacune de ses pièces principales figure dans la révision publiée (`covered`) et qu'au moins l'une
   * n'est pas reportée.
   */
  claimNotification(dossierId: string, lotId: string, covered?: Record<string, PieceState>): Promise<boolean>;
  notify(userId: string, message: { subject: string; text: string; link: string }): Promise<void>;
  notificationsAllowed(userId: string): Promise<boolean>;
  /** Alerte technique : identifiants et compteurs UNIQUEMENT, jamais de contenu. */
  alert(code: string, meta: Record<string, string | number | boolean | null>): Promise<void>;
}

export interface EngineConfig {
  budgetCentsPerUserMonth: number;
  budgetCentsGlobalMonth: number;
  budgetCentsPerLot: number;
  paused: boolean;
  maxAttempts: number;
  leaseMs: number;
  consolidateDelayMs: number;
  /** Attente avant de retenter une consolidation dont des lectures sont encore en cours (défaut 20 s). */
  extractionWaitMs?: number;
  /** Analyse progressive : premiers résultats par règles publiés aussitôt, puis remplacés par l'analyse IA. */
  progressive?: boolean;
  /** Attente avant la lecture IA qui suit les premiers résultats (laisse passer la première synthèse). */
  progressiveDelayMs?: number;
  now: () => Date;
  workerId: string;
  /** Attentes successives avant relecture automatique d'une pièce en échec définitif (défaut : 1 h, 6 h, 24 h ; [] = aucune). */
  rereadDelaysMs?: number[];
  /** Lien vers l'espace du dossier (notification). */
  dossierLink: (dossierId: string) => string;
}
