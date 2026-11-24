import { STATUS_HINT, STATUS_LABEL, type Status } from "../../demo/construction/dossier.ts";

// Trois statuts, distingués par la forme ET le libellé (jamais par la seule couleur).
const STYLE: Record<Status, string> = {
  etabli: "bg-navy-900 text-cream-50 border-navy-900",
  declaration: "bg-white text-navy-900 border-slate-500",
  a_verifier: "bg-gold-300 text-navy-900 border-gold-700",
};

function Glyph({ status }: { status: Status }) {
  if (status === "etabli") return <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5"><circle cx="5" cy="5" r="4.5" fill="currentColor" /></svg>;
  if (status === "declaration") return <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5"><circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5"><path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="currentColor" /></svg>;
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-semibold ${STYLE[status]}`}>
      <Glyph status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatusLegend({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-gold-700">Légende des statuts</h2>
      <dl className="mt-3 space-y-3">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <div key={s} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt>
              <StatusBadge status={s} />
            </dt>
            <dd className="text-sm text-slate-500">{STATUS_HINT[s]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
