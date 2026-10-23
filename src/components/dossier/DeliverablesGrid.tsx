import { DELIVERABLE_CATALOG, type DeliverableKey } from "../../../supabase/functions/_shared/deliverables.ts";

/** Fichier d'un livrable, quelle que soit sa source (stockage Supabase ou génération locale de démonstration). */
export type DeliverableFile = {
  key: DeliverableKey;
  name: string;
  open: () => void | Promise<void>;
  download: () => void | Promise<void>;
};

type Props = {
  files: DeliverableFile[];
  /** Mention de version/couverture (« révision 3 — analyse complète »). */
  caption?: string | null;
  /** Message quand aucun livrable n'est encore prêt. */
  emptyLabel: string;
  busy?: boolean;
  onDownloadAll?: () => void;
};

const VIEW_ORDER = ["pdf", "csv", "ics"];
const ext = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";

/** Les six livrables ClairDossier : Visualiser, Télécharger chaque format, Tout télécharger. */
export function DeliverablesGrid({ files, caption, emptyLabel, busy, onDownloadAll }: Props) {
  const ready = files.length > 0;
  return (
    <section aria-labelledby="livrables-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="livrables-title" className="font-display text-xl text-navy-900">
            Livrables ClairDossier
          </h3>
          {caption && <p className="mt-1 text-xs text-slate-500">{caption}</p>}
        </div>
        {ready && onDownloadAll && (
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={busy}
            className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
          >
            {busy ? "Préparation…" : "Tout télécharger (.zip)"}
          </button>
        )}
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DELIVERABLE_CATALOG.map((d, i) => {
          const own = files.filter((f) => f.key === d.key).sort((a, b) => ext(a.name).localeCompare(ext(b.name)));
          const viewable = VIEW_ORDER.map((e) => own.find((f) => ext(f.name) === e)).find(Boolean);
          return (
            <li
              key={d.key}
              className={`group flex flex-col rounded-2xl border p-5 transition-shadow ${own.length ? "hairline bg-white shadow-card hover:shadow-card-hover" : "border-dashed hairline bg-cream-50/60"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-semibold ${own.length ? "bg-navy-900 text-gold-400" : "bg-cream-100 text-slate-400"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{d.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{d.description}</p>
                </div>
              </div>
              {own.length ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t hairline pt-4">
                  {viewable && (
                    <button type="button" onClick={() => void viewable.open()} className="rounded-full bg-gold-500 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none">
                      Visualiser
                    </button>
                  )}
                  {own.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => void f.download()}
                      aria-label={`Télécharger ${d.label} au format ${ext(f.name).toUpperCase()}`}
                      className="rounded-full border hairline-strong px-3 py-1.5 font-mono text-[0.68rem] font-semibold uppercase tracking-wide text-navy-900 transition-colors hover:bg-cream-100"
                    >
                      {ext(f.name)} ↓
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border-t border-dashed hairline pt-4 text-xs text-slate-500">{emptyLabel}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
