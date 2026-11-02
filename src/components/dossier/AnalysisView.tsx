import { coverageLabel, frDate, type AnalysisData, type CoverageInfo } from "../../../supabase/functions/_shared/analysis-model.ts";

type Props = {
  analysis: AnalysisData;
  coverage: CoverageInfo;
  revision: number;
  createdAt: string;
  documentNames: Record<string, string>;
  /** Coût de la révision (administration uniquement). */
  costLabel?: string | null;
};

const KIND = { mentioned: "date mentionnée", computed: "date calculée", hypothesis: "hypothèse à confirmer" } as const;

/** Dashboard interactif : synthèse sourcée, échéances, contradictions et manques. */
export function AnalysisView({ analysis: a, coverage, revision, createdAt, documentNames, costLabel }: Props) {
  const src = (ev: { document_id: string; page: number | null }[]) => ev.map((e) => `${documentNames[e.document_id] ?? "pièce"}${e.page ? ` p.${e.page}` : ""}`).join(" · ") || "non sourcé";
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = a.deadlines.filter((d) => d.date && d.date >= today);
  const kpis = [
    { v: `${coverage.extracted}/${coverage.total}`, l: "pièces exploitées" },
    { v: String(upcoming.length), l: "échéances à venir" },
    { v: String(a.contradictions.length), l: "contradictions" },
    { v: String(a.missing_items.length), l: "éléments manquants" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
          Analyse — révision {revision} · {new Date(createdAt).toLocaleDateString("fr-FR")}
        </p>
        <p className={`rounded-full px-2.5 py-1 text-xs ${coverage.complete ? "bg-cream-100 text-slate-600" : "bg-amber-100 font-semibold text-amber-800"}`}>{coverageLabel(coverage)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.l} className="rounded-xl border hairline bg-cream-50 p-3">
            <dt className="text-[0.68rem] uppercase tracking-wide text-slate-500">{k.l}</dt>
            <dd className="mt-1 font-display text-2xl text-navy-900">{k.v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-sm leading-relaxed text-navy-900">{a.summary_short}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prochaines échéances</p>
            <ul className="mt-1.5 space-y-1.5 text-sm text-slate-700">
              {upcoming.slice(0, 6).map((d, i) => (
                <li key={i}>
                  <span className="font-semibold text-navy-900">{frDate(d.date)}</span> — {d.title}
                  <span className="block text-xs text-slate-500">{KIND[d.kind]} · {src(d.evidence)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.attention_points.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Points d'attention</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {a.attention_points.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
        {a.contradictions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contradictions entre pièces</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {a.contradictions.map((c, i) => <li key={i}>{c.text} <span className="text-xs text-slate-500">({src(c.evidence)})</span></li>)}
            </ul>
          </div>
        )}
        {a.missing_items.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pièces ou informations manquantes</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {a.missing_items.map((m, i) => <li key={i}>{m.text} <span className="text-xs text-slate-500">— {m.why}</span></li>)}
            </ul>
          </div>
        )}
      </div>

      {a.next_actions.length > 0 && (
        <div className="rounded-xl border hairline-gold bg-gold-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">Prochaines actions proposées</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-navy-900">
            {a.next_actions.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
      <p className="text-xs leading-relaxed text-slate-500">
        Documents générés automatiquement à partir de vos pièces, à vérifier ; ils ne constituent pas un conseil juridique.
        {costLabel ? ` ${costLabel}` : ""}
      </p>
    </div>
  );
}
