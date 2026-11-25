import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { readVisit, writeVisit } from "../../lib/last-visit";
import type { AnalysisData, CoverageInfo } from "../../../supabase/functions/_shared/analysis-model.ts";
import { buildAttention, visitMark, whatChanged, type AttentionDeadline, type DossierSnapshot, type VisitMark } from "../../../supabase/functions/_shared/attention.ts";
import { AttentionBox } from "./AttentionBox";

/**
 * Conteneur de la boîte d'attention dans l'espace client : lit la DERNIÈRE
 * analyse du dossier (table ai_analyses, RLS titulaire / admin) et n'affiche
 * rien tant qu'aucune analyse n'existe (ou si le moteur n'est pas installé).
 * Aucune écriture en base : la dernière visite est une commodité par appareil
 * (src/lib/last-visit.ts).
 */

type Props = {
  dossierId: string;
  /** Pièces et documents non supprimés du dossier. */
  documents: { id: string; file_name: string; created_at: string; kind?: string | null }[];
  /** Échéances enregistrées du dossier. */
  deadlines: AttentionDeadline[];
  /** Change à chaque nouvelle publication : relit l'analyse. */
  refreshKey?: unknown;
};

type AnalysisRow = { revision: number; created_at: string; coverage: CoverageInfo; data: AnalysisData };
type Correction = { event_key: string; created_at: string };

/** Date locale du jour au format AAAA-MM-JJ. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DossierAttention({ dossierId, documents, deadlines, refreshKey }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  // Repère de la visite PRÉCÉDENTE, lu une seule fois par dossier : il reste
  // la référence pendant toute la visite en cours.
  const [last, setLast] = useState<{ id: string; mark: VisitMark | null }>(() => ({ id: dossierId, mark: readVisit(dossierId) }));
  if (last.id !== dossierId) setLast({ id: dossierId, mark: readVisit(dossierId) });

  useEffect(() => {
    let live = true;
    void (async () => {
      const [a, o] = await Promise.all([
        supabase.from("ai_analyses").select("revision,created_at,coverage,data").eq("dossier_id", dossierId).order("revision", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("ai_event_overrides").select("event_key,created_at").eq("dossier_id", dossierId),
      ]);
      if (!live) return;
      setAnalysis(a.error ? null : ((a.data as AnalysisRow | null) ?? null));
      setCorrections(o.error ? [] : ((o.data as Correction[] | null) ?? []));
    })();
    return () => {
      live = false;
    };
  }, [dossierId, refreshKey]);

  const snapshot: DossierSnapshot = { documents, deadlines, corrections, revision: analysis ? { number: analysis.revision, created_at: analysis.created_at } : null };

  // Repère de la visite en cours, réécrit seulement quand l'état du dossier
  // change : il servira de point de comparaison à la prochaine visite.
  const state = analysis ? JSON.stringify([visitMark(snapshot, ""), documents.length, corrections.length]) : null;
  useEffect(() => {
    if (!state) return;
    const [mark] = JSON.parse(state) as [VisitMark];
    writeVisit(dossierId, { ...mark, at: new Date().toISOString() });
  }, [dossierId, state]);

  const names = documents.map((d) => `${d.id}\u0000${d.file_name}`).join("\u0001");
  const rows = JSON.stringify(deadlines.map((d) => [d.title, d.due_date, d.priority, d.done, d.ai_key ?? null]));
  const attention = useMemo(
    () =>
      analysis?.data?.summary_short
        ? buildAttention({
            analysis: analysis.data,
            coverage: analysis.coverage,
            deadlines: (JSON.parse(rows) as [string, string, AttentionDeadline["priority"], boolean, string | null][]).map(([title, due_date, priority, done, ai_key]) => ({ title, due_date, priority, done, ai_key })),
            today: localToday(),
            documentNames: Object.fromEntries(names ? names.split("\u0001").map((n) => n.split("\u0000") as [string, string]) : []),
          })
        : null,
    [analysis, rows, names],
  );
  if (!attention) return null;
  return <AttentionBox attention={attention} changes={whatChanged(snapshot, last.mark)} />;
}
