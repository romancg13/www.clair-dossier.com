/**
 * Premiers résultats : ce que la lecture pièce par pièce a déjà établi, affiché
 * pendant que la synthèse du dossier se prépare. Logique pure (aucun accès
 * réseau) : les lignes viennent de `ai_extractions`, dont le contenu est une
 * sortie de modèle — donc une donnée non fiable, validée champ par champ ici.
 */

export type ExtractionRow = {
  document_id: string;
  status: string;
  error: string | null;
  created_at: string;
  doc_type: string | null;
  summary: string | null;
  dates: unknown;
};

export type FirstResult = {
  id: string;
  name: string;
  type: string | null;
  summary: string | null;
  deadlines: { date: string; label: string }[];
};

export type UnreadPiece = { id: string; name: string; reason: string };

const SUMMARY_MAX = 320;
const DEADLINES_MAX = 3;

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function deadlinesOf(dates: unknown): FirstResult["deadlines"] {
  if (!Array.isArray(dates)) return [];
  return dates
    .flatMap((d) => {
      const row = d as { kind?: unknown; date?: unknown; label?: unknown } | null;
      const date = text(row?.date);
      const label = text(row?.label);
      return row?.kind === "deadline" && date && label ? [{ date, label }] : [];
    })
    .slice(0, DEADLINES_MAX);
}

/**
 * Pièces lues depuis `since` (date de la dernière analyse publiée, ou null si
 * aucune) : la synthèse en cours ne les a pas encore intégrées.
 */
export function firstResults(rows: ExtractionRow[], names: Record<string, string>, since: string | null): FirstResult[] {
  return rows
    .filter((r) => r.status === "ok" && (!since || r.created_at > since))
    .map((r) => {
      const summary = text(r.summary);
      return {
        id: r.document_id,
        name: names[r.document_id] ?? "Pièce",
        type: text(r.doc_type),
        summary: summary && summary.length > SUMMARY_MAX ? `${summary.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : summary,
        deadlines: deadlinesOf(r.dates),
      };
    });
}

/** Pièces que le moteur n'a pas pu lire, avec un motif sans détail technique. */
export function unreadPieces(rows: ExtractionRow[], names: Record<string, string>): UnreadPiece[] {
  return rows
    .filter((r) => r.status === "unsupported" && names[r.document_id])
    .map((r) => ({
      id: r.document_id,
      name: names[r.document_id],
      reason: (text(r.error) ?? "Pièce non lisible").split(" (")[0],
    }));
}
