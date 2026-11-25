import type { ReactNode } from "react";
import { DELIVERABLE_CATALOG, type DeliverableKey } from "../../../supabase/functions/_shared/analysis-model.ts";

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
  /** Faux : ne pas annoncer les six documents du catalogue (traitement automatique non activé). */
  catalogHint?: boolean;
  /** Actions placées à droite du titre (ex. bouton ClairDossier IA). */
  actions?: ReactNode;
};

const VIEW_ORDER = ["pdf", "csv", "ics"];
const ext = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";

/** Les six résultats ClairDossier : Voir, Télécharger, autres formats au clic, un seul ZIP. */
export function DeliverablesGrid({ files, caption, emptyLabel, busy, onDownloadAll, actions, catalogHint = true }: Props) {
  const ready = files.length > 0;
  const missing = DELIVERABLE_CATALOG.filter((d) => !files.some((f) => f.key === d.key));
  return (
    <section aria-labelledby="livrables-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="livrables-title" className="font-display text-xl text-navy-900">
            Vos résultats
          </h3>
          {caption && <p className="mt-0.5 text-xs text-slate-500">{caption}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
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
      </div>

      {!ready ? (
        // Aucun document encore publié : une seule ligne au lieu de six cartes vides identiques.
        <p className="mt-4 rounded-2xl border border-dashed hairline bg-cream-50/60 p-4 text-sm leading-relaxed text-slate-500">
          {emptyLabel}
          {catalogHint && ` Vos six documents (${DELIVERABLE_CATALOG.map((d) => d.label).join(", ")}) apparaîtront ici dès leur publication.`}
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-slate-200/70 border-y hairline">
            {DELIVERABLE_CATALOG.filter((d) => files.some((f) => f.key === d.key)).map((d) => {
              const own = files.filter((f) => f.key === d.key).sort((a, b) => ext(a.name).localeCompare(ext(b.name)));
              const viewable = VIEW_ORDER.map((e) => own.find((f) => ext(f.name) === e)).find(Boolean);
              // Format principal : le PDF quand il existe (lisible partout), sinon le premier format.
              const main = own.find((f) => ext(f.name) === "pdf") ?? own[0];
              const others = own.filter((f) => f !== main);
              return (
                <li key={d.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <p className="min-w-0 flex-1 basis-40 text-sm font-semibold text-navy-900" title={d.description}>
                    {d.label}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {viewable && (
                      <button type="button" onClick={() => void viewable.open()} aria-label={`Voir ${d.label}`} className="rounded-full bg-gold-500 px-3.5 py-1.5 text-xs font-semibold text-navy-900 hover:bg-gold-400">
                        Voir
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void main.download()}
                      aria-label={`Télécharger ${d.label} au format ${ext(main.name).toUpperCase()}`}
                      className="rounded-full border hairline-strong px-3.5 py-1.5 text-xs font-semibold text-navy-900 hover:bg-cream-100"
                    >
                      Télécharger
                    </button>
                    <details className="relative text-xs">
                      <summary className="cursor-pointer rounded-full px-2 py-1.5 font-medium text-slate-500 hover:text-navy-900" aria-label={`Détails et autres formats — ${d.label}`}>
                        Détails
                      </summary>
                      <div className="mt-2 w-full max-w-sm rounded-xl bg-cream-50 p-3 text-slate-600 sm:absolute sm:right-0 sm:z-10 sm:w-72 sm:shadow-card">
                        <p className="leading-relaxed">{d.description}</p>
                        {others.length > 0 && (
                          <p className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span>Autres formats :</span>
                            {others.map((f) => (
                              <button
                                key={f.name}
                                type="button"
                                onClick={() => void f.download()}
                                aria-label={`Télécharger ${d.label} au format ${ext(f.name).toUpperCase()}`}
                                className="rounded-full border hairline-strong bg-white px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase text-navy-900 hover:bg-cream-100"
                              >
                                {ext(f.name)}
                              </button>
                            ))}
                          </p>
                        )}
                      </div>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
          {missing.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {missing.length === 1 ? "Document pas encore publié" : "Documents pas encore publiés"} : {missing.map((d) => d.label).join(" · ")}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
