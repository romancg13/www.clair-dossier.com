import { LEVEL_LABEL, NATURE_LABEL, type AttentionItem, type AttentionLevel, type AttentionResult, type ChangeSummary } from "../../../supabase/functions/_shared/attention.ts";

type Props = {
  attention: AttentionResult;
  /** « Ce qui a changé depuis votre dernière visite » — absent ou première visite : bloc non affiché. */
  changes?: ChangeSummary | null;
  /** Précision affichée à côté de la date de dernière visite (ex. « visite simulée »). */
  sinceNote?: string;
};

const LEVEL_STYLE: Record<AttentionLevel, { badge: string; edge: string }> = {
  urgent: { badge: "bg-red-50 text-red-800 border-red-200", edge: "border-l-red-500" },
  important: { badge: "bg-amber-50 text-amber-800 border-amber-200", edge: "border-l-gold-500" },
  a_confirmer: { badge: "bg-cream-100 text-slate-600 border-transparent", edge: "border-l-slate-300" },
};

function Item({ item }: { item: AttentionItem }) {
  const s = LEVEL_STYLE[item.level];
  return (
    <li className={`rounded-xl border hairline border-l-4 ${s.edge} bg-white p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide ${s.badge}`}>{LEVEL_LABEL[item.level]}</span>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">{NATURE_LABEL[item.nature]}</span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-navy-900">{item.title}</p>
      <dl className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
        <div className="sm:flex sm:gap-2">
          <dt className="shrink-0 font-semibold text-slate-500 sm:w-28">Source</dt>
          <dd className="min-w-0 break-words">{item.source}</dd>
        </div>
        <div className="sm:flex sm:gap-2">
          <dt className="shrink-0 font-semibold text-slate-500 sm:w-28">Conséquence</dt>
          <dd className="min-w-0">{item.consequence}</dd>
        </div>
        <div className="sm:flex sm:gap-2">
          <dt className="shrink-0 font-semibold text-gold-700 sm:w-28">Prochaine action</dt>
          <dd className="min-w-0 font-medium text-navy-900">{item.action}</dd>
        </div>
      </dl>
    </li>
  );
}

/**
 * Boîte d'attention : les seules décisions réellement nécessaires, triées et
 * plafonnées (le reste est replié), et ce qui a changé depuis la dernière
 * visite. Composant de présentation pur : toutes les règles vivent dans
 * supabase/functions/_shared/attention.ts (déterministes, sans IA).
 */
export function AttentionBox({ attention, changes, sinceNote }: Props) {
  const { items, more, total } = attention;
  const since = changes && !changes.firstVisit ? changes.since : null;
  return (
    <section aria-labelledby="attention-title" className="rounded-2xl border hairline bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">À traiter en priorité</p>
          <h2 id="attention-title" className="mt-1 font-display text-xl text-navy-900">
            {total === 0 ? "Aucune décision en attente" : `${total} point${total > 1 ? "s" : ""} d’attention`}
          </h2>
        </div>
        {more.length > 0 && <p className="text-xs text-slate-500">Les {items.length} plus pressants sont affichés</p>}
      </div>

      {changes && since && (
        <div className="mt-4 rounded-xl border hairline-gold bg-gold-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
            Depuis votre dernière visite du {new Date(since).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            {sinceNote ? ` (${sinceNote})` : ""}
          </p>
          {changes.entries.length === 0 ? (
            <p className="mt-1.5 text-sm text-navy-900">Rien de nouveau dans ce dossier.</p>
          ) : (
            <ul className="mt-1.5 space-y-1 text-sm text-navy-900">
              {changes.entries.map((e) => (
                <li key={e.kind}>
                  <span className="font-semibold">{e.label}</span>
                  {e.details.length > 0 && <span className="block break-words text-xs text-slate-600">{e.details.join(" · ")}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {total === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-slate-600">D’après les pièces analysées, rien ne demande de décision de votre part pour le moment.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((it) => (
            <Item key={it.id} item={it} />
          ))}
        </ul>
      )}

      {more.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold text-navy-900 hover:text-gold-700">
            Voir {more.length === 1 ? "l’autre point, moins pressant" : `les ${more.length} autres points, moins pressants`}
          </summary>
          <ul className="mt-2 space-y-3">
            {more.map((it) => (
              <Item key={it.id} item={it} />
            ))}
          </ul>
        </details>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Points établis par des règles fixes à partir de vos pièces et de vos échéances, à vérifier ; ils ne constituent pas un conseil juridique.
      </p>
    </section>
  );
}
