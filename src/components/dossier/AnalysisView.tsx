import { coverageLabel, frDate, type AnalysisData, type CoverageInfo } from "../../../supabase/functions/_shared/analysis-model.ts";

type Props = {
  analysis: AnalysisData;
  coverage: CoverageInfo;
  revision: number;
  createdAt: string;
  documentNames: Record<string, string>;
  /** Coût de la révision (administration uniquement). */
  costLabel?: string | null;
  /** Date de référence des calculs (AAAA-MM-JJ). Par défaut : la date de l'analyse. */
  today?: string;
};

const KIND = { mentioned: "date mentionnée", computed: "date calculée", hypothesis: "hypothèse à confirmer" } as const;

/**
 * Tableau de bord : la situation, la prochaine échéance réelle et la prochaine
 * action. Les listes complètes (échéances, écarts, éléments manquants) restent
 * accessibles au clic — rien n'est retiré, seul l'ordre de lecture change. Les
 * points à traiter sont portés par la boîte d'attention, pas répétés ici.
 */
export function AnalysisView({ analysis: a, coverage, revision, createdAt, documentNames, costLabel, today }: Props) {
  const src = (ev: { document_id: string; page: number | null }[]) => ev.map((e) => `${documentNames[e.document_id] ?? "pièce"}${e.page ? ` p.${e.page}` : ""}`).join(" · ") || "non sourcé";
  const ref = today ?? createdAt.slice(0, 10);
  const dated = a.deadlines.filter((d) => d.date).sort((x, y) => (x.date! < y.date! ? -1 : 1));
  const upcoming = dated.filter((d) => d.date! >= ref);
  const past = dated.filter((d) => d.date! < ref);
  const next = upcoming[0];
  const details = upcoming.length + past.length + a.contradictions.length + a.missing_items.length + a.attention_points.length + a.next_actions.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-navy-900">La situation</h2>
        <p className={`rounded-full px-2.5 py-1 text-xs ${coverage.complete ? "bg-cream-100 text-slate-600" : "bg-amber-100 font-semibold text-amber-800"}`}>{coverageLabel(coverage)}</p>
      </div>

      <p className="text-[0.95rem] leading-relaxed text-navy-900">{a.summary_short}</p>

      {(next || a.next_actions.length > 0) && (
        <dl className="grid gap-3 border-t hairline pt-4 sm:grid-cols-2">
          {next && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prochaine échéance</dt>
              <dd className="mt-1 text-sm text-navy-900">
                <strong className="font-semibold">{frDate(next.date)}</strong> — {next.title}
                <span className="block text-xs text-slate-500">{KIND[next.kind]}</span>
              </dd>
            </div>
          )}
          {a.next_actions.length > 0 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prochaine action</dt>
              <dd className="mt-1 text-sm text-navy-900">{a.next_actions[0]}</dd>
            </div>
          )}
        </dl>
      )}

      {details > 0 && (
        <details className="border-t hairline pt-3 text-sm text-slate-700">
          <summary className="cursor-pointer rounded py-1 font-medium text-slate-600 hover:text-navy-900">Voir le détail de l’analyse</summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Échéances à venir</p>
                <ul className="mt-1.5 space-y-1.5">
                  {upcoming.map((d, i) => (
                    <li key={i}>
                      <span className="font-semibold text-navy-900">{frDate(d.date)}</span> — {d.title}
                      <span className="block text-xs text-slate-500">{KIND[d.kind]} · {src(d.evidence)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dates passées</p>
                <ul className="mt-1.5 space-y-1.5">
                  {past.map((d, i) => (
                    <li key={i}>
                      <span className="font-semibold text-navy-900">{frDate(d.date)}</span> — {d.title}
                      <span className="block text-xs text-slate-500">{KIND[d.kind]} · {src(d.evidence)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.next_actions.length > 1 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions proposées ensuite</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {a.next_actions.slice(1).map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
            {a.attention_points.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">À retenir</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {a.attention_points.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
            {a.contradictions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Écarts relevés entre pièces</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {a.contradictions.map((c, i) => <li key={i}>{c.text} <span className="text-xs text-slate-500">({src(c.evidence)})</span></li>)}
                </ul>
              </div>
            )}
            {a.missing_items.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pièces ou informations manquantes</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {a.missing_items.map((m, i) => <li key={i}>{m.text} <span className="text-xs text-slate-500">— {m.why}</span></li>)}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Révision {revision} · calculé au {frDate(ref)} · généré automatiquement à partir de vos pièces, à vérifier ; ne constitue pas un conseil juridique.
        {costLabel ? ` ${costLabel}` : ""}
      </p>
    </div>
  );
}
