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

/** Nombre de priorités visibles d'emblée : au-delà, le client ne lit plus. */
const VISIBLE = 3;

/** Un point = un titre, UNE action concrète ; conséquence et source au clic. */
function Item({ item }: { item: AttentionItem }) {
  const s = LEVEL_STYLE[item.level];
  return (
    <li className={`rounded-xl border hairline border-l-4 ${s.edge} bg-white px-4 py-3`}>
      <p className="text-sm font-semibold leading-snug text-navy-900">
        {item.level !== "a_confirmer" && <span className={`mr-2 rounded-full border px-2 py-0.5 align-middle text-[0.62rem] font-semibold uppercase tracking-wide ${s.badge}`}>{LEVEL_LABEL[item.level]}</span>}
        {item.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.action}</p>
      <details className="mt-1 text-xs leading-relaxed text-slate-600">
        <summary className="cursor-pointer rounded py-0.5 font-medium text-slate-500 hover:text-navy-900">Pourquoi, et d’où vient l’information</summary>
        <p className="mt-1">{item.consequence}</p>
        <p className="mt-1 break-words">
          <span className="font-semibold text-slate-500">{NATURE_LABEL[item.nature]} — source : </span>
          {item.source}
        </p>
      </details>
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
  const all = [...attention.items, ...attention.more];
  const items = all.slice(0, VISIBLE);
  const more = all.slice(VISIBLE);
  const total = attention.total;
  const since = changes && !changes.firstVisit ? changes.since : null;
  return (
    <section aria-labelledby="attention-title" className="rounded-2xl border hairline bg-white p-5 shadow-card sm:p-6">
      <h2 id="attention-title" className="font-display text-xl text-navy-900">
        {total === 0 ? "Rien à faire pour le moment" : total === 1 ? "1 point demande votre attention" : `À faire — ${Math.min(total, VISIBLE)} priorité${Math.min(total, VISIBLE) > 1 ? "s" : ""}`}
      </h2>

      {total === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">D’après les pièces analysées, rien ne demande de décision de votre part.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <Item key={it.id} item={it} />
          ))}
        </ul>
      )}

      {more.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer rounded-lg py-1.5 text-sm font-medium text-slate-600 hover:text-navy-900">
            {more.length === 1 ? "1 autre point, moins pressant" : `${more.length} autres points, moins pressants`}
          </summary>
          <ul className="mt-2 space-y-2">
            {more.map((it) => (
              <Item key={it.id} item={it} />
            ))}
          </ul>
        </details>
      )}

      {changes && since && changes.entries.length > 0 && (
        <details className="mt-2 text-sm text-slate-700">
          <summary className="cursor-pointer rounded-lg py-1.5 font-medium text-slate-600 hover:text-navy-900">
            Depuis votre dernière visite du {new Date(since).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}
            {sinceNote ? ` (${sinceNote})` : ""} : {changes.entries.map((e) => e.label.toLowerCase()).join(", ")}
          </summary>
          <ul className="mt-1 space-y-1 text-xs text-slate-600">
            {changes.entries.filter((e) => e.details.length > 0).map((e) => (
              <li key={e.kind} className="break-words">
                <span className="font-semibold text-navy-900">{e.label}</span> — {e.details.join(" · ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 text-xs leading-relaxed text-slate-500">Points établis à partir de vos pièces, à vérifier ; ils ne constituent pas un conseil juridique.</p>
    </section>
  );
}
