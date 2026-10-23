import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { applyOverrides, type AnalysisData, type CoverageInfo, type EventOverride } from "../../../supabase/functions/_shared/deliverables.ts";
import { AnalysisView } from "./AnalysisView";
import { ChronologyEditor } from "./ChronologyEditor";

/**
 * Traitement automatique d'un dossier (moteur documentaire IA, migration
 * 20261023120000) — conteneur branché sur Supabase (RLS titulaire / admin) :
 *   - activation explicite et traçable par le titulaire (RPC enable_ai_processing),
 *   - état réel (pièces lues / total, consolidation, pause, erreur),
 *   - dashboard interactif sourcé et chronologie éditable (corrections append-only).
 * Si la migration n'est pas appliquée, le panneau ne s'affiche pas.
 */

/** Version des conditions acceptées à l'activation (journalisée en base). */
export const AI_TERMS_VERSION = "ia-2026-10";

export type AiProgress = { processing: boolean; detail: string | null; enabled: boolean };

type Props = {
  dossierId: string;
  ownerId: string;
  canManage: boolean;
  isAdmin: boolean;
  closed: boolean;
  pieceCount: number;
  documentNames: Record<string, string>;
  onProgress?: (p: AiProgress) => void;
  onPublished?: () => void;
};

type Settings = { enabled_at: string | null; terms_version: string | null };
type JobRow = { id: string; kind: "extract" | "consolidate" | "render"; status: string; last_error: string | null };
type AnalysisRow = { revision: number; created_at: string; cost_cents: number | string; coverage: CoverageInfo; data: AnalysisData };
type OverrideRow = Omit<EventOverride, "author"> & { author_role: "titulaire" | "equipe" };

const ERRORS: Record<string, string> = {
  SUBSCRIPTION_REQUIRED: "Un abonnement actif est nécessaire pour activer le traitement automatique.",
  FORBIDDEN: "Seul le titulaire du dossier peut activer ce traitement.",
  DOSSIER_CLOTURE: "Le dossier est clôturé : rouvrez-le pour activer le traitement.",
  AUTH_REQUIRED: "Connectez-vous pour continuer.",
};

export function AiPanel({ dossierId, ownerId, canManage, isAdmin, closed, pieceCount, documentNames, onProgress, onPublished }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [extracted, setExtracted] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
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
    const [j, x, a, o] = await Promise.all([
      supabase.from("ai_jobs").select("id,kind,status,last_error").eq("dossier_id", dossierId).order("created_at", { ascending: false }).limit(400),
      supabase.from("ai_extractions").select("id", { count: "exact", head: true }).eq("dossier_id", dossierId).in("status", ["ok", "unsupported"]),
      supabase.from("ai_analyses").select("revision,created_at,cost_cents,coverage,data").eq("dossier_id", dossierId).order("revision", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ai_event_overrides").select("event_key,retained_date,label,hidden,reason,author_role,created_at").eq("dossier_id", dossierId).order("created_at"),
    ]);
    setJobs((j.data as JobRow[] | null) ?? []);
    setExtracted(x.count ?? 0);
    setAnalysis((a.data as AnalysisRow | null) ?? null);
    setOverrides((o.data as OverrideRow[] | null) ?? []);
  }, [dossierId]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const hasOpen = open.length > 0;
  // Suivi en direct tant que des travaux sont ouverts ; l'état vit en base (reprise après fermeture du navigateur).
  useEffect(() => {
    if (!hasOpen) return;
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [hasOpen, load]);

  const budgetPaused = jobs.some((j) => j.status === "failed" && (j.last_error ?? "").startsWith("BUDGET"));
  const failed = jobs.filter((j) => j.status === "failed" && !(j.last_error ?? "").startsWith("BUDGET"));
  const reading = open.some((j) => j.kind === "extract");
  const detail = !settings?.enabled_at
    ? null
    : budgetPaused
      ? "Traitement en pause : plafond mensuel atteint."
      : reading
        ? `${Math.min(extracted, pieceCount)}/${pieceCount} pièce${pieceCount > 1 ? "s" : ""} lue${pieceCount > 1 ? "s" : ""} — consolidation à suivre`
        : hasOpen
          ? "Consolidation et préparation des livrables en cours."
          : null;

  useEffect(() => {
    onProgress?.({ processing: Boolean(settings?.enabled_at) && hasOpen, detail, enabled: Boolean(settings?.enabled_at) });
  }, [settings, hasOpen, detail, onProgress]);

  useEffect(() => {
    if (!analysis) return;
    if (seenRevision !== null && analysis.revision !== seenRevision) onPublished?.();
    setSeenRevision(analysis.revision);
  }, [analysis, seenRevision, onPublished]);

  const history: EventOverride[] = useMemo(
    () => overrides.map((o) => ({ ...o, author: o.author_role === "equipe" ? "Équipe ClairDossier" : "Titulaire du dossier" })),
    [overrides],
  );
  const events = useMemo(() => applyOverrides(analysis?.data?.events ?? [], history), [analysis, history]);

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

  const saveOverride = async (eventKey: string, change: { retained_date: string | null; hidden: boolean; reason: string }) => {
    const { error: e } = await supabase.from("ai_event_overrides").insert({ dossier_id: dossierId, user_id: ownerId, event_key: eventKey, ...change });
    if (e) throw e;
    await load();
  };

  if (available !== true) return null;

  return (
    <div className="space-y-5">
      <section aria-labelledby="ai-panel-title" className="rounded-2xl border hairline bg-cream-50/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="ai-panel-title" className="font-display text-lg text-navy-900">
              Traitement automatique
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {settings?.enabled_at
                ? "Vos pièces sont lues et consolidées automatiquement ; les livrables paraissent ici dès qu'ils sont prêts et sont actualisés à chaque nouvelle pièce."
                : "Sur activation, ClairDossier lit vos pièces et prépare les six livrables : résumé, dashboard, chronologie, dates, échéances et projets de relance."}
            </p>
            {detail && <p className="mt-2 font-mono text-xs text-gold-700">{detail}</p>}
          </div>
          {canManage && settings?.enabled_at && (
            <button type="button" onClick={() => void toggle(false)} disabled={busy} className="rounded-full border hairline px-4 py-2 text-xs font-semibold text-navy-900 transition-colors hover:bg-white disabled:opacity-60">
              Désactiver
            </button>
          )}
        </div>

        {!settings?.enabled_at && canManage && !closed && (
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Je demande le traitement automatique de ce dossier : le contenu des pièces déposées est transmis à notre prestataire
                d'intelligence artificielle (sous-traitant) pour produire des documents de travail. Ces documents sont générés
                automatiquement, doivent être vérifiés et ne constituent pas un conseil juridique. Je peux désactiver ce traitement à
                tout moment ; les pièces ajoutées ensuite ne seront plus lues.
              </span>
            </label>
            <button type="button" onClick={() => void toggle(true)} disabled={!consent || busy} className="rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-50">
              {busy ? "Activation…" : "Activer le traitement automatique"}
            </button>
          </div>
        )}
        {!settings?.enabled_at && (!canManage || closed) && (
          <p className="mt-3 text-sm text-slate-500">{closed ? "Dossier clôturé : aucun traitement." : "Le traitement automatique n'est pas activé sur ce dossier."}</p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {failed.length > 0 && !hasOpen && (
          <p className="mt-3 text-sm text-amber-800">
            {failed.length} étape{failed.length > 1 ? "s" : ""} n'{failed.length > 1 ? "ont" : "a"} pas pu aboutir après plusieurs tentatives ; les résultats déjà fiables restent disponibles et l'équipe ClairDossier est informée.
          </p>
        )}
        {isAdmin && failed.length > 0 && (
          <details className="mt-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">Diagnostic (administration)</summary>
            <ul className="mt-2 space-y-1">
              {failed.map((j) => (
                <li key={j.id}>
                  {j.kind} — {j.last_error ?? "erreur inconnue"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {analysis?.data?.summary_short && (
        <section className="rounded-2xl border hairline bg-white p-5 shadow-card sm:p-6">
          <AnalysisView
            analysis={analysis.data}
            coverage={analysis.coverage}
            revision={analysis.revision}
            createdAt={analysis.created_at}
            documentNames={documentNames}
            costLabel={isAdmin ? `Coût estimé de cette révision : ${(Number(analysis.cost_cents) / 100).toFixed(2)} €.` : null}
          />
        </section>
      )}
      {events.length > 0 && <ChronologyEditor events={events} history={history} documentNames={documentNames} canEdit={canManage && !closed} onSave={saveOverride} />}
    </div>
  );
}
