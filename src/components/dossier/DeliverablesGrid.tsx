import { DELIVERABLE_CATALOG, type DeliverableKey } from "../../../supabase/functions/_shared/analysis-model.ts";

export type DeliverableFile = {
  id?: string;
  key: DeliverableKey | null;
  name: string;
  open: () => void | Promise<void>;
  download: () => void | Promise<void>;
};

type Props = {
  files: DeliverableFile[];
  caption?: string | null;
  emptyLabel: string;
  busy?: boolean;
  onDownloadAll?: () => void;
};

const groups = [
  ...DELIVERABLE_CATALOG.map(d => ({ key: d.key, label: d.key === 'dashboard' ? 'Tableau de bord' : d.label })),
  { key: null, label: "Autres documents" },
];

export function DeliverablesGrid({ files, caption, emptyLabel, busy, onDownloadAll }: Props) {
  return (
    <section aria-labelledby="livrables-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="livrables-title" className="font-display text-2xl font-semibold text-navy-900">Vos résultats</h3>
          {caption && <p className="mt-1 text-xs text-slate-600">{caption}</p>}
        </div>
        {files.length > 0 && onDownloadAll && (
          <button type="button" onClick={onDownloadAll} disabled={busy}
            className="rounded-full border hairline-strong px-4 py-2 text-sm font-medium text-navy-900 hover:bg-cream-100 disabled:opacity-60">
            {busy ? "Préparation…" : "Tout télécharger (.zip)"}
          </button>
        )}
      </div>
      {files.length === 0 && <p className="mt-4 text-sm text-slate-600">{emptyLabel}</p>}
      {groups.map(group => {
        const own = files.filter(f => f.key === group.key);
        if (!own.length) return null;
        // Les sources sont ordonnées par date de publication, de la plus ancienne à la plus récente.
        const preferred = [...own].reverse().find(f => /\.pdf$/i.test(f.name)) ?? own[own.length - 1];
        return (
          <div key={group.key ?? 'autres'} className="mt-4 rounded-xl border hairline bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-navy-900">{group.label}</h4>
              <button type="button" onClick={() => void preferred.open()}
                aria-label={`Ouvrir ${preferred.name}`} className="min-h-10 rounded-full bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800">
                Ouvrir
              </button>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer py-2 text-sm text-slate-700">Fichiers et téléchargements ({own.length})</summary>
              <ul className="divide-y divide-slate-200">
              {own.map((f, index) => (
                <li key={f.id ?? `${f.name}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 py-1 text-sm">
                  <button type="button" onClick={() => void f.open()} className="min-h-10 min-w-0 break-all text-left text-slate-700 hover:underline">{f.name}</button>
                  <button type="button" onClick={() => void f.download()} aria-label={`Télécharger ${f.name}`}
                    className="min-h-10 font-medium text-navy-900 underline decoration-gold-500 underline-offset-4">Télécharger</button>
                </li>
              ))}
              </ul>
            </details>
          </div>
        );
      })}
    </section>
  );
}
