// Console IA privée — logique PURE (aucune dépendance Supabase/React), testée
// sous Node (tests/ai-admin.test.ts). Dérive l'état d'un dossier dans le flux
// RECEIVED → QUEUED → PROCESSING → QUALITY_CHECK → READY_FOR_REVIEW → APPROVED
// → PUBLISHED | FAILED à partir des compteurs renvoyés par la RPC
// `ai_admin_overview` (migration 20261102120000).

export type AiOverviewRow = {
  dossier_id: string;
  user_id: string;
  title: string | null;
  typology: string | null;
  dossier_status: string | null;
  closed: boolean;
  enabled_at: string | null;
  review_mode: "manual" | "auto";
  pieces: number;
  extracted: number;
  unsupported: number;
  jobs_open: number;
  jobs_failed: number;
  jobs_failed_budget: number;
  last_revision: number | null;
  last_review_status: "pending" | "approved" | "published" | "rejected" | null;
  last_analysis_at: string | null;
  last_coverage: { complete?: boolean; usable?: number; total?: number; stripped_references?: number } | null;
  last_cost_cents: number | string | null;
  pending_revision: number | null;
  month_cost_cents: number | string | null;
};

export type AiState =
  | "OFF"
  | "RECEIVED"
  | "QUEUED"
  | "PROCESSING"
  | "QUALITY_CHECK"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "PAUSED"
  | "FAILED";

export const AI_STATE_LABELS: Record<AiState, string> = {
  OFF: "Non activé",
  RECEIVED: "Reçu — en attente de pièces",
  QUEUED: "En file",
  PROCESSING: "Lecture des pièces",
  QUALITY_CHECK: "Analyse et vérification",
  READY_FOR_REVIEW: "À valider",
  APPROVED: "Approuvé — publication en cours",
  PUBLISHED: "Publié",
  REJECTED: "Rejeté",
  PAUSED: "En pause (budget)",
  FAILED: "Échec",
};

/** États qui réclament une décision ou une action de l'administrateur. */
export const AI_STATES_NEEDING_ADMIN: ReadonlySet<AiState> = new Set(["READY_FOR_REVIEW", "FAILED", "PAUSED"]);

export function deriveAiState(r: AiOverviewRow): AiState {
  if (!r.enabled_at) return r.last_review_status === "published" ? "PUBLISHED" : "OFF";
  if (r.jobs_open > 0) {
    if (r.last_review_status === "approved") return "APPROVED";
    if (r.extracted + r.unsupported < r.pieces) return "PROCESSING";
    return "QUALITY_CHECK";
  }
  if (r.jobs_failed_budget > 0) return "PAUSED";
  if (r.jobs_failed > 0) return "FAILED";
  if (r.pending_revision !== null) return "READY_FOR_REVIEW";
  if (r.last_review_status === "approved") return "APPROVED";
  if (r.last_review_status === "published") return "PUBLISHED";
  if (r.last_review_status === "rejected") return "REJECTED";
  return r.pieces > 0 ? "QUEUED" : "RECEIVED";
}

export function needsAdmin(r: AiOverviewRow): boolean {
  return AI_STATES_NEEDING_ADMIN.has(deriveAiState(r));
}

/** Centimes (numeric Postgres → string) → « 1,23 € ». */
export function formatCents(cents: number | string | null | undefined): string {
  const n = Number(cents ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${(n / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function coverageSummary(c: AiOverviewRow["last_coverage"]): string {
  if (!c) return "—";
  if (c.complete) return "complète";
  if (typeof c.usable === "number" && typeof c.total === "number") return `partielle ${c.usable}/${c.total}`;
  return "partielle";
}

/** Tri : d'abord ce qui attend l'administrateur, puis les plus récents. */
export function sortForAdmin(rows: AiOverviewRow[]): AiOverviewRow[] {
  const ts = (r: AiOverviewRow) => (r.last_analysis_at ? Date.parse(r.last_analysis_at) : 0);
  return [...rows].sort((a, b) => Number(needsAdmin(b)) - Number(needsAdmin(a)) || ts(b) - ts(a));
}

export type AiAdminCounters = { total: number; toReview: number; failed: number; paused: number; processing: number; published: number };

export function counters(rows: AiOverviewRow[]): AiAdminCounters {
  const states = rows.map(deriveAiState);
  const count = (...s: AiState[]) => states.filter((x) => s.includes(x)).length;
  return {
    total: rows.length,
    toReview: count("READY_FOR_REVIEW"),
    failed: count("FAILED"),
    paused: count("PAUSED"),
    processing: count("QUEUED", "PROCESSING", "QUALITY_CHECK", "APPROVED"),
    published: count("PUBLISHED"),
  };
}

/** Taux d'automatisation : dossiers arrivés au bout sans intervention humaine nécessaire. */
export function automationRate(rows: AiOverviewRow[]): number | null {
  const done = rows.filter((r) => ["PUBLISHED", "READY_FOR_REVIEW", "FAILED", "PAUSED", "REJECTED"].includes(deriveAiState(r)));
  if (!done.length) return null;
  const auto = done.filter((r) => deriveAiState(r) === "PUBLISHED").length;
  return Math.round((auto / done.length) * 1000) / 10;
}

/** Messages lisibles pour les codes d'erreur des RPC d'administration. */
export const AI_ADMIN_ERRORS: Record<string, string> = {
  FORBIDDEN: "Action réservée à l'administration.",
  AUTH_REQUIRED: "Session expirée : reconnectez-vous.",
  MOTIF_REQUIS: "Indiquez un motif (3 caractères minimum).",
  REVISION_INTROUVABLE: "Révision introuvable.",
  DEJA_PUBLIEE: "Cette révision est déjà publiée : elle ne peut plus être rejetée.",
  TRAVAIL_INTROUVABLE: "Travail introuvable.",
  TRAVAIL_NON_ECHOUE: "Seul un travail en échec peut être relancé.",
  TRAVAIL_DEJA_EN_FILE: "Un travail équivalent est déjà en file.",
  MODE_INVALIDE: "Mode de relecture invalide.",
  DOSSIER_INTROUVABLE: "Dossier introuvable.",
  DOSSIER_CLOTURE: "Dossier clôturé : rouvrez-le avant d'activer le traitement.",
  SUBSCRIPTION_REQUIRED: "Le titulaire n'a pas d'abonnement actif.",
  CONSENTEMENT_REQUIS: "Indiquez la référence de l'accord écrit du client (10 caractères minimum).",
  TERMS_VERSION_REQUIRED: "Version des conditions manquante.",
};

export function adminErrorMessage(message: string | undefined | null): string {
  const code = Object.keys(AI_ADMIN_ERRORS).find((k) => (message ?? "").includes(k));
  return code ? AI_ADMIN_ERRORS[code] : "L'opération n'a pas abouti. Réessayez dans un instant.";
}
