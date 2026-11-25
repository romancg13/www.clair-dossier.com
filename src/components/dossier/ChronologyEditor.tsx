import { useMemo, useState } from "react";
import { frDate, type EventOverride, type RetainedEvent } from "../../../supabase/functions/_shared/analysis-model.ts";

type Props = {
  events: RetainedEvent[];
  history: EventOverride[];
  documentNames: Record<string, string>;
  canEdit: boolean;
  onSave: (eventKey: string, change: { retained_date: string | null; hidden: boolean; reason: string }) => Promise<void>;
};

type Filter = "tous" | "evenements" | "documents" | "corrigees";
const ESSENTIAL = 5;

/**
 * Chronologie éditable et tracée : chaque correction (date retenue, masquage)
 * exige un motif, s'ajoute à l'historique (jamais d'écrasement) et prévaut sur
 * la date extraite lors des réanalyses.
 */
export function ChronologyEditor({ events, history, documentNames, canEdit, onSave }: Props) {
  const [filter, setFilter] = useState<Filter>("tous");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [hidden, setHidden] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Premier niveau : les jalons essentiels. Recherche, filtres et corrections au second niveau.
  const [full, setFull] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (filter === "tous" || (filter === "evenements" && e.kind === "event_date") || (filter === "documents" && e.kind === "document_date") || (filter === "corrigees" && e.edited)) &&
        (!q || e.retained_label.toLowerCase().includes(q)),
    );
  }, [events, filter, query]);
  // Jalons essentiels : les événements (pas les simples dates d'édition des documents), les 5 plus récents.
  const essential = useMemo(() => {
    const visible = events.filter((e) => !e.hidden);
    const facts = visible.filter((e) => e.kind === "event_date");
    return (facts.length >= 3 ? facts : visible).slice(-ESSENTIAL);
  }, [events]);
  const list = full ? shown : essential;

  const start = (e: RetainedEvent) => {
    setEditing(e.key);
    setDate(/^\d{4}-\d{2}-\d{2}$/.test(e.retained_date) ? e.retained_date : "");
    setHidden(e.hidden);
    setReason("");
    setError(null);
  };
  const save = async (e: RetainedEvent) => {
    if (reason.trim().length < 3) return setError("Indiquez le motif de la correction (3 caractères au moins).");
    setSaving(true);
    setError(null);
    try {
      await onSave(e.key, { retained_date: date || null, hidden, reason: reason.trim() });
      setEditing(null);
    } catch {
      setError("La correction n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setSaving(false);
    }
  };
  const src = (e: RetainedEvent) => e.evidence.map((v) => `${documentNames[v.document_id] ?? "pièce"}${v.page ? ` p.${v.page}` : ""}`).join(" · ") || "non sourcé";

  return (
    <section aria-labelledby="chrono-title" className="rounded-2xl border hairline bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="chrono-title" className="font-display text-xl text-navy-900">
            Chronologie
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {full ? `${events.length} événement${events.length > 1 ? "s" : ""} daté${events.length > 1 ? "s" : ""} et sourcé${events.length > 1 ? "s" : ""} · ${events.filter((e) => e.edited).length} corrigé(s)` : `Les ${essential.length} jalons essentiels`}
          </p>
        </div>
        {full && (
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="chrono-q">Rechercher un événement</label>
            <input id="chrono-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="w-40 rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs text-navy-900" />
            <label className="sr-only" htmlFor="chrono-f">Filtrer</label>
            <select id="chrono-f" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs text-navy-900">
              <option value="tous">Tous</option>
              <option value="evenements">Événements</option>
              <option value="documents">Dates des documents</option>
              <option value="corrigees">Corrigés</option>
            </select>
          </div>
        )}
      </div>

      <ol className="mt-4 divide-y divide-slate-200/70 border-y hairline">
        {list.map((e) => {
          const past = history.filter((h) => h.event_key === e.key);
          return (
            <li key={e.key} className={`py-2.5 ${e.hidden ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                <div className="w-28 shrink-0">
                  <p className="font-mono text-sm font-semibold text-navy-900">{frDate(e.retained_date)}</p>
                  {e.edited && e.retained_date !== e.date && <p className="font-mono text-[0.68rem] text-slate-400 line-through">{frDate(e.date)}</p>}
                  {e.precision !== "day" && <p className="text-[0.68rem] text-slate-500">date approximative</p>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-navy-900">
                    {e.retained_label}
                    {full && e.kind === "document_date" && <span className="ml-2 rounded-full bg-cream-100 px-2 py-0.5 text-[0.65rem] text-slate-600">date du document</span>}
                    {e.edited && <span className="ml-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-gold-700">{e.hidden ? "masqué" : "corrigé"}</span>}
                  </p>
                  <p className="text-xs text-slate-500">{src(e)}</p>
                </div>
                {full && canEdit && editing !== e.key && (
                  <button type="button" onClick={() => start(e)} className="rounded-full border hairline-strong px-3 py-1 text-xs font-semibold text-navy-900 hover:bg-cream-100">
                    Corriger
                  </button>
                )}
              </div>

              {editing === e.key && (
                <div className="mt-3 grid gap-2 rounded-xl bg-cream-50 p-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
                  <label className="text-xs text-slate-600">
                    Date retenue
                    <input type="date" value={date} onChange={(v) => setDate(v.target.value)} className="mt-1 block rounded-lg border hairline-strong bg-white px-2 py-1.5 text-sm text-navy-900" />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 sm:pb-2">
                    <input type="checkbox" checked={hidden} onChange={(v) => setHidden(v.target.checked)} /> Masquer
                  </label>
                  <label className="text-xs text-slate-600">
                    Motif (obligatoire)
                    <input value={reason} onChange={(v) => setReason(v.target.value)} maxLength={500} placeholder="Ex. date de réception du courrier recommandé" className="mt-1 block w-full rounded-lg border hairline-strong bg-white px-2 py-1.5 text-sm text-navy-900" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void save(e)} disabled={saving} className="rounded-full bg-navy-900 px-3.5 py-1.5 text-xs font-semibold text-cream-50 disabled:opacity-60">
                      {saving ? "…" : "Enregistrer"}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-full px-3 py-1.5 text-xs text-slate-600 hover:bg-white">
                      Annuler
                    </button>
                  </div>
                  {error && <p role="alert" className="text-xs text-red-700 sm:col-span-4">{error}</p>}
                </div>
              )}

              {past.length > 0 && (
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer">Historique ({past.length})</summary>
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {past.map((h, i) => (
                      <li key={i}>
                        {new Date(h.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} — {h.author} : {h.hidden ? "masqué" : `date retenue ${frDate(h.retained_date)}`} — « {h.reason} »
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
        {list.length === 0 && <li className="py-3 text-sm text-slate-500">{full ? "Aucun événement pour ce filtre." : "Aucun événement daté pour le moment."}</li>}
      </ol>
      {events.length > 0 && (
        <button type="button" onClick={() => setFull((v) => !v)} aria-expanded={full} className="mt-3 rounded-full border hairline-strong px-4 py-1.5 text-xs font-semibold text-navy-900 hover:bg-cream-100">
          {full ? "Revenir aux jalons essentiels" : `Voir toute la chronologie (${events.length})${canEdit ? " et corriger une date" : ""}`}
        </button>
      )}
    </section>
  );
}
