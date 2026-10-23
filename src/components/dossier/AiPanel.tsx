import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Traitement automatique d'un dossier (moteur documentaire IA, migration
 * 20261023120000). Monté dans l'onglet « DashBoard ClairDossier » :
 *   - activation explicite et traçable par le titulaire (RPC enable_ai_processing),
 *   - état lisible Réception → Lecture → Analyse → Préparation → Disponible,
 *     progression calculée sur les pièces réellement lues,
 *   - dernière analyse avec ses sources (pièce + page), couverture explicite.
 * Tout est lu par RLS (titulaire ou administration) ; aucune écriture directe.
 * Si la migration n'est pas appliquée, le panneau ne s'affiche pas.
 */

/** Version des conditions acceptées à l'activation (journalisée en base). */
export const AI_TERMS_VERSION = "ia-2026-10";

type Props = {
  dossierId: string;
  canManage: boolean;
  isAdmin: boolean;
  pieceCount: number;
  documentNames: Record<string, string>;
  onPublished?: () => void;
};

type Settings = { enabled_at: string | null; terms_version: string | null };
type JobRow = { id: string; kind: "extract" | "consolidate"; status: string; last_error: string | null };
type Evidence = { document_id: string; page: number | null; quote: string };
type Sourced = { evidence: Evidence[]; unverified?: boolean };
type Analysis = {
  summary_short?: string;
  attention_points?: string[];
  missing_items?: { text: string; why: string }[];
  contradictions?: ({ text: string } & Sourced)[];
  deadlines?: ({ title: string; date: string | null; kind: "mentioned" | "computed" | "hypothesis"; basis: string } & Sourced)[];
  next_actions?: string[];
};
type AnalysisRow = {
  revision: number;
  created_at: string;
  cost_cents: number | string;
  coverage: { total?: number; extracted?: number; unsupported?: number; failed?: number; complete?: boolean; note?: string };
  data: Analysis;
};

type Stage = "reception" | "lecture" | "analyse" | "disponible" | "pause" | "erreur";
const STAGES: { id: Stage; label: string }[] = [
  { id: "reception", label: "Réception" },
  { id: "lecture", label: "Lecture" },
  { id: "analyse", label: "Analyse & préparation" },
  { id: "disponible", label: "Disponible" },
];
const DEADLINE_KIND: Record<string, string> = {
  mentioned: "date mentionnée dans une pièce",
  computed: "date calculée",
  hypothesis: "hypothèse à confirmer",
};
const ERRORS: Record<string, string> = {
  SUBSCRIPTION_REQUIRED: "Un abonnement actif est nécessaire pour activer le traitement automatique.",
  FORBIDDEN: "Seul le titulaire du dossier peut activer ce traitement.",
  AUTH_REQUIRED: "Connectez-vous pour continuer.",
};

function stageOf(settings: Settings | null, jobs: JobRow[], extracted: number, analysis: AnalysisRow | null): Stage | null {
  if (!settings?.enabled_at) return null;
  const open = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const failed = jobs.filter((j) => j.status === "failed");
  if (failed.some((j) => (j.last_error ?? "").startsWith("BUDGET"))) return "pause";
  if (open.some((j) => j.kind === "extract")) return extracted > 0 || analysis ? "lecture" : "reception";
  if (open.some((j) => j.kind === "consolidate")) return "analyse";
  if (analysis) return "disponible";
  if (failed.length) return "erreur";
  return "reception";
}

export function AiPanel({ dossierId, canManage, isAdmin, pieceCount, documentNames, onPublished }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [extracted, setExtracted] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [seenRevision, setSeenRevision] = useState<number | null>(null);

  const load = useCallback(async () => {
    const s = await supabase.from("dossier_ai_settings").select("enabled_at,terms_version").eq("dossier_id", dossierId).maybeSingle();
    if (s.error) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    setSettings((s.data as Settings | null) ?? { enabled_at: null, terms_version: null });
    const [j, x, a] = await Promise.all([
      supabase.from("ai_jobs").select("id,kind,status,last_error").eq("dossier_id", dossierId).order("created_at", { ascending: false }).limit(50),
      supabase.from("ai_extractions").select("id", { count: "exact", head: true }).eq("dossier_id", dossierId).eq("status", "ok"),
      supabase.from("ai_analyses").select("revision,created_at,cost_cents,coverage,data").eq("dossier_id", dossierId).order("revision", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setJobs((j.data as JobRow[] | null) ?? []);
    setExtracted(x.count ?? 0);
    setAnalysis((a.data as AnalysisRow | null) ?? null);
  }, [dossierId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Suivi en direct tant que des travaux sont ouverts (reprend après fermeture du navigateur : l'état vit en base).
  const hasOpen = jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!hasOpen) return;
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, [hasOpen, load]);

  useEffect(() => {
    if (!analysis) return;
    if (seenRevision !== null && analysis.revision !== seenRevision) onPublished?.();
    setSeenRevision(analysis.revision);
  }, [analysis, seenRevision, onPublished]);

  const toggle = async (enable: boolean) => {
    setBusy(true);
    setError(null);
    const { error: e } = enable
      ? await supabase.rpc("enable_ai_processing", { p_dossier: dossierId, p_terms_version: AI_TERMS_VERSION })
      : await supabase.rpc("disable_ai_processing", { p_dossier: dossierId });
    if (e) {
      const code = Object.keys(ERRORS).find((k) => e.message.includes(k));
      setError(code ? ERRORS[code] : "L'opération n'a pas abouti. Réessayez dans un instant.");
    }
    await load();
    setBusy(false);
  };

  if (available !== true) return null;
  const stage = stageOf(settings, jobs, extracted, analysis);
  const stageIndex = stage ? STAGES.findIndex((s) => s.id === stage) : -1;
  const sources = (ev: Evidence[]) =>
    ev.length ? ev.map((e) => `${documentNames[e.document_id] ?? "pièce"}${e.page ? ` p.${e.page}` : ""}`).join(" · ") : "non sourcé";
  const cov = analysis?.coverage ?? {};

  return (
    <section aria-labelledby="ai-panel-title" className="mt-6 rounded-2xl border hairline bg-cream-50/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="ai-panel-title" className="font-display text-lg text-navy-900">
            Traitement automatique
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {settings?.enabled_at
              ? "Vos pièces sont lues et consolidées automatiquement ; les documents de travail paraissent ici dès qu'ils sont prêts."
              : "Sur activation, ClairDossier lit vos pièces et prépare résumé, chronologie, échéances et projets de relance."}
          </p>
        </div>
        {canManage && settings?.enabled_at && (
          <button type="button" onClick={() => void toggle(false)} disabled={busy} className="rounded-full border hairline px-4 py-2 text-xs font-semibold text-navy-900 transition-colors hover:bg-white disabled:opacity-60">
            Désactiver
          </button>
        )}
      </div>

      {!settings?.enabled_at && canManage && (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Je demande le traitement automatique de ce dossier : le contenu des pièces déposées est transmis à notre
              prestataire d'intelligence artificielle (sous-traitant) pour produire des documents de travail. Ces documents
              sont générés automatiquement, doivent être vérifiés et ne constituent pas un conseil juridique. Je peux
              désactiver ce traitement à tout moment ; les pièces ajoutées ensuite ne seront plus lues.
            </span>
          </label>
          <button type="button" onClick={() => void toggle(true)} disabled={!consent || busy} className="rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-50">
            {busy ? "Activation…" : "Activer le traitement automatique"}
          </button>
        </div>
      )}
      {!settings?.enabled_at && !canManage && (
        <p className="mt-3 text-sm text-slate-500">Le traitement automatique n'est pas activé sur ce dossier.</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {stage && (
        <>
          <ol className="mt-5 flex flex-wrap gap-2" aria-label="Avancement du traitement">
            {STAGES.map((s, i) => {
              const done = stageIndex > i || stage === "disponible";
              const current = stageIndex === i && stage !== "disponible";
              return (
                <li key={s.id} aria-current={current ? "step" : undefined} className={`rounded-full px-3 py-1 text-xs font-semibold ${done ? "bg-navy-900 text-cream-50" : current ? "bg-gold-500 text-navy-900" : "border hairline text-slate-500"}`}>
                  {s.label}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-sm text-slate-600">
            {pieceCount > 0 ? `${Math.min(extracted, pieceCount)}/${pieceCount} pièce${pieceCount > 1 ? "s" : ""} lue${extracted > 1 ? "s" : ""}.` : "Déposez des pièces pour lancer la lecture."}
            {stage === "pause" && " Traitement en pause : plafond mensuel atteint — il reprendra au mois suivant ou sur relèvement du plafond."}
            {stage === "erreur" && " Une étape a échoué à plusieurs reprises ; l'équipe ClairDossier en est informée."}
            {stage === "lecture" && " Lecture en cours — la consolidation suit automatiquement."}
            {stage === "analyse" && " Consolidation et préparation des documents en cours."}
          </p>
        </>
      )}

      {analysis && analysis.data?.summary_short && (
        <div className="mt-5 space-y-4 border-t hairline pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
              Analyse — révision {analysis.revision} · {new Date(analysis.created_at).toLocaleDateString("fr-FR")}
            </p>
            <p className={`text-xs ${cov.complete ? "text-slate-500" : "font-semibold text-amber-700"}`}>
              {cov.complete ? `Analyse complète (${cov.extracted ?? 0} pièces)` : `Analyse partielle : ${cov.extracted ?? 0}/${cov.total ?? pieceCount} pièces exploitées${cov.unsupported ? `, ${cov.unsupported} non prise(s) en charge` : ""}`}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-navy-900">{analysis.data.summary_short}</p>
          {!!analysis.data.attention_points?.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Points d'attention</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.data.attention_points.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {!!analysis.data.deadlines?.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Échéances repérées</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {analysis.data.deadlines.map((d, i) => (
                  <li key={i}>
                    <span className="font-semibold text-navy-900">{d.date ?? "date à déterminer"}</span> — {d.title}{" "}
                    <span className="text-slate-500">({DEADLINE_KIND[d.kind] ?? d.kind} · sources : {sources(d.evidence)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!analysis.data.contradictions?.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contradictions entre pièces</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.data.contradictions.map((c, i) => <li key={i}>{c.text} <span className="text-slate-500">({sources(c.evidence)})</span></li>)}
              </ul>
            </div>
          )}
          {!!analysis.data.missing_items?.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pièces ou informations manquantes</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.data.missing_items.map((m, i) => <li key={i}>{m.text} <span className="text-slate-500">— {m.why}</span></li>)}
              </ul>
            </div>
          )}
          <p className="text-xs leading-relaxed text-slate-500">
            Documents générés automatiquement à partir de vos pièces, à vérifier ; ils ne constituent pas un conseil juridique.
            {isAdmin && ` Coût estimé de cette révision : ${(Number(analysis.cost_cents) / 100).toFixed(2)} €.`}
          </p>
        </div>
      )}
      {isAdmin && jobs.some((j) => j.status === "failed") && (
        <details className="mt-4 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">Diagnostic (administration)</summary>
          <ul className="mt-2 space-y-1">
            {jobs.filter((j) => j.status === "failed").map((j) => <li key={j.id}>{j.kind} — {j.last_error ?? "erreur inconnue"}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
