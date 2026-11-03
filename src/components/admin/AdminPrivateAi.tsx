import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { AI_TERMS_VERSION } from "../dossier/AiPanel";
import {
  AI_STATE_LABELS,
  adminErrorMessage,
  automationRate,
  counters,
  coverageSummary,
  deriveAiState,
  formatCents,
  needsAdmin,
  sortForAdmin,
  type AiOverviewRow,
  type AiState,
} from "../../lib/ai-admin";

/**
 * Console : « ClairDossier Private AI » — pilotage du moteur documentaire,
 * réservé à l'administration (RPC de la migration 20261102120000, is_admin()
 * contrôlé côté base). Le client n'accède jamais à cet écran ni au moteur :
 * il ne voit que les livrables publiés.
 *   - file et états par dossier (RECEIVED … PUBLISHED / FAILED),
 *   - validation : approuver (publication par le worker), rejeter (motif), relancer,
 *   - mode de relecture par dossier (manuel par défaut / automatique),
 *   - coûts API du mois, incidents.
 * Si la migration n'est pas appliquée, la section l'indique sans rien casser.
 */

type FailedJob = {
  id: string;
  dossier_id: string;
  kind: string;
  last_error: string | null;
  attempts: number;
  updated_at: string;
};
type MonthCost = { extraction_cents: number | string; analysis_cents: number | string; extractions: number; analyses: number; accounts: number };

const STATE_TONE: Record<AiState, string> = {
  OFF: "bg-cream-100 text-slate-600",
  RECEIVED: "bg-cream-100 text-slate-700",
  QUEUED: "bg-cream-100 text-navy-900",
  PROCESSING: "bg-gold-500/15 text-gold-700",
  QUALITY_CHECK: "bg-gold-500/15 text-gold-700",
  READY_FOR_REVIEW: "bg-navy-900 text-cream-50",
  APPROVED: "bg-gold-500/15 text-gold-700",
  PUBLISHED: "bg-emerald-50 text-emerald-800",
  REJECTED: "bg-cream-100 text-slate-600",
  PAUSED: "bg-amber-50 text-amber-800",
  FAILED: "bg-red-50 text-red-700",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value, warn = false }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-xl border hairline bg-white p-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-semibold ${warn ? "text-red-600" : "text-navy-900"}`}>{value}</p>
    </div>
  );
}

type Props = { emails: Record<string, string>; onError: (message: string | null) => void };

export function AdminPrivateAi({ emails, onError }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AiOverviewRow[]>([]);
  const [failed, setFailed] = useState<FailedJob[]>([]);
  const [cost, setCost] = useState<MonthCost | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"attention" | "tous">("attention");

  const load = useCallback(async () => {
    const probe = await supabase.rpc("ai_private_console_enabled");
    if (probe.error) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    const [ov, fj, mc] = await Promise.all([
      supabase.rpc("ai_admin_overview"),
      supabase.from("ai_jobs").select("id,dossier_id,kind,last_error,attempts,updated_at").eq("status", "failed").order("updated_at", { ascending: false }).limit(50),
      supabase.rpc("ai_admin_month_cost"),
    ]);
    if (ov.error) onError(adminErrorMessage(ov.error.message));
    setRows(((ov.data as AiOverviewRow[] | null) ?? []).map((r) => ({ ...r, review_mode: r.review_mode === "auto" ? "auto" : "manual" })));
    setFailed((fj.data as FailedJob[] | null) ?? []);
    const costRow = Array.isArray(mc.data) ? (mc.data[0] as MonthCost | undefined) : (mc.data as MonthCost | null);
    setCost(costRow ?? null);
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  // Suivi en direct tant que des travaux sont ouverts.
  const anyOpen = rows.some((r) => r.jobs_open > 0);
  useEffect(() => {
    if (!anyOpen) return;
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, [anyOpen, load]);

  const sorted = useMemo(() => sortForAdmin(rows), [rows]);
  const shown = filter === "attention" ? sorted.filter(needsAdmin) : sorted;
  const c = counters(rows);
  const rate = automationRate(rows);

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(key);
    onError(null);
    const { error } = await fn();
    if (error) onError(adminErrorMessage(error.message));
    await load();
    setBusy(null);
  };

  if (available === null) return <p className="mt-8 text-sm text-slate-500">Chargement du moteur…</p>;
  if (available === false) {
    return (
      <div className="mt-8 rounded-2xl border hairline bg-white p-6 shadow-card">
        <p className="font-display text-lg text-navy-900">ClairDossier Private AI</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          La console du moteur documentaire n'est pas disponible : la migration <code className="font-mono text-xs">20261102120000_ia_console_privee.sql</code>{" "}
          (et la 20261023120000 qui la précède) n'est pas appliquée au projet Supabase. Procédure : <code className="font-mono text-xs">docs/MOTEUR_IA.md</code>.
          Rien n'est traité et rien n'est montré aux clients tant que ce n'est pas fait.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">ClairDossier Private AI</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Les pièces d'un dossier activé sont lues puis consolidées automatiquement ; par défaut, rien n'est montré au client avant votre validation.
            Chaque action ci-dessous est journalisée.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border hairline bg-white p-1 text-xs">
          {(["attention", "tous"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 font-medium ${filter === f ? "bg-navy-900 text-cream-50" : "text-navy-900 hover:bg-cream-100"}`}>
              {f === "attention" ? `À traiter (${c.toReview + c.failed + c.paused})` : `Tous (${c.total})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="À valider" value={c.toReview} warn={c.toReview > 0} />
        <Stat label="En traitement" value={c.processing} />
        <Stat label="Publiés" value={c.published} />
        <Stat label="Incidents" value={c.failed + c.paused} warn={c.failed + c.paused > 0} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Coût API du mois" value={cost ? formatCents(Number(cost.extraction_cents) + Number(cost.analysis_cents)) : "—"} />
        <Stat label="Extractions / analyses (mois)" value={cost ? `${cost.extractions} / ${cost.analyses}` : "—"} />
        <Stat label="Comptes servis (mois)" value={cost?.accounts ?? "—"} />
        <Stat label="Taux d'automatisation" value={rate === null ? "—" : `${rate.toLocaleString("fr-FR")} %`} />
      </div>

      <div className="rounded-2xl border hairline bg-white shadow-card">
        {shown.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{filter === "attention" ? "Aucune décision en attente." : "Aucun dossier concerné par le moteur."}</p>
        ) : (
          <ul className="divide-y hairline">
            {shown.map((r) => {
              const state = deriveAiState(r);
              const key = r.dossier_id;
              const note = notes[key] ?? "";
              return (
                <li key={key} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/compte/dossier/${r.dossier_id}`} className="font-medium text-navy-900 hover:text-gold-700">
                        {r.title || r.typology || "Dossier"}
                      </Link>
                      <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                        {emails[r.user_id] ?? r.user_id.slice(0, 8)} · {r.pieces} pièce{r.pieces > 1 ? "s" : ""} · lues {r.extracted + r.unsupported}/{r.pieces}
                        {r.unsupported > 0 ? ` (${r.unsupported} non prise${r.unsupported > 1 ? "s" : ""} en charge)` : ""}
                        {r.last_revision !== null ? ` · révision ${r.last_revision} (${coverageSummary(r.last_coverage)}) · ${fmtDate(r.last_analysis_at)}` : ""}
                        {" · mois : "}
                        {formatCents(r.month_cost_cents)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] ${STATE_TONE[state]}`}>{AI_STATE_LABELS[state]}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-2 text-slate-600">
                      Relecture
                      <select
                        value={r.review_mode}
                        disabled={busy !== null}
                        onChange={(e) => void run(key, () => supabase.rpc("ai_set_review_mode", { p_dossier: r.dossier_id, p_mode: e.target.value }))}
                        className="rounded-lg border hairline bg-white px-2 py-1 text-xs"
                      >
                        <option value="manual">manuelle (validation avant publication)</option>
                        <option value="auto">automatique (publication immédiate)</option>
                      </select>
                    </label>
                    {r.enabled_at ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void run(key, () => supabase.rpc("disable_ai_processing", { p_dossier: r.dossier_id }))}
                        className="rounded-full border hairline px-3 py-1 font-medium text-navy-900 hover:bg-cream-100 disabled:opacity-50"
                      >
                        Désactiver le traitement
                      </button>
                    ) : (
                      !r.closed && (
                        <span className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={note}
                            onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                            placeholder="Référence de l'accord écrit du client (courriel du…, avenant…)"
                            className="min-w-[18rem] rounded-lg border hairline bg-white px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            disabled={busy !== null || note.trim().length < 10}
                            onClick={() => void run(key, () => supabase.rpc("ai_admin_enable", { p_dossier: r.dossier_id, p_terms_version: AI_TERMS_VERSION, p_consent_reference: note }))}
                            className="rounded-full border hairline px-3 py-1 font-medium text-navy-900 hover:bg-cream-100 disabled:opacity-50"
                            title="Réservé aux dossiers pour lesquels le titulaire a donné un accord écrit ; la référence est conservée et journalisée."
                          >
                            Activer sur accord écrit
                          </button>
                        </span>
                      )
                    )}
                  </div>

                  {r.pending_revision !== null && (
                    <div className="rounded-xl border hairline bg-cream-50/60 p-4">
                      <p className="text-sm text-navy-900">
                        Révision {r.pending_revision} à valider — relisez les livrables depuis la fiche du dossier (visibles de l'administration seulement), puis :
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                          placeholder="Note (obligatoire pour un rejet)"
                          className="min-w-[14rem] flex-1 rounded-lg border hairline bg-white px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void run(key, () => supabase.rpc("ai_approve_revision", { p_dossier: r.dossier_id, p_revision: r.pending_revision, p_note: note || null }))}
                          className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-navy-800 disabled:opacity-50"
                        >
                          {busy === key ? "…" : "Approuver et publier"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null || note.trim().length < 3}
                          onClick={() => void run(key, () => supabase.rpc("ai_reject_revision", { p_dossier: r.dossier_id, p_revision: r.pending_revision, p_note: note }))}
                          className="rounded-full border hairline px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Rejeter
                        </button>
                      </div>
                    </div>
                  )}

                  {(state === "FAILED" || state === "PAUSED") && (
                    <ul className="space-y-1 text-xs text-slate-600">
                      {failed
                        .filter((j) => j.dossier_id === r.dossier_id)
                        .map((j) => (
                          <li key={j.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              <span className="font-mono">{j.kind}</span> — {j.last_error ?? "erreur inconnue"} ({j.attempts} tentative{j.attempts > 1 ? "s" : ""}, {fmtDate(j.updated_at)})
                            </span>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void run(key, () => supabase.rpc("ai_retry_job", { p_job: j.id }))}
                              className="rounded-full border hairline px-3 py-1 font-medium text-navy-900 hover:bg-cream-100 disabled:opacity-50"
                            >
                              Relancer
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Arrêt d'urgence du moteur : retirer le secret <code className="font-mono">ANTHROPIC_API_KEY</code> côté Supabase (le worker ne réclame plus rien) ou
        désactiver la tâche pg_cron <code className="font-mono">clairdossier-ai-worker</code>. Les livrables publiés restent dans l'espace du client ; les
        brouillons rejetés ne lui sont jamais montrés.
      </p>
    </div>
  );
}
