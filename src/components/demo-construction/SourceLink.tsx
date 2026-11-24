import { DOSSIER, sourceLabel, type SourceRef } from "../../demo/construction/dossier.ts";

/** Ouvre la visionneuse sur `group[index]` ; `group` = sources liées (navigation entre elles). */
export type OpenSource = (group: SourceRef[], index: number, trigger: HTMLElement) => void;

/** Sources liées à un clic : celle cliquée, puis les autres du même constat (sans doublon). */
export function sourceGroup(clicked: SourceRef, others: readonly SourceRef[]): SourceRef[] {
  const same = (a: SourceRef, b: SourceRef) => a.pieceId === b.pieceId && a.page === b.page && a.passage === b.passage;
  return [clicked, ...others.filter((o) => !same(o, clicked))];
}

/** Début du passage cité (6 mots), pour distinguer deux sources d'une même page. */
export function excerpt(passage: string, words = 6): string {
  const w = passage.split(/\s+/);
  return w.length > words ? `${w.slice(0, words).join(" ")}…` : passage;
}

export function DocIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M4 1.5h5.5L13 5v9.5H4z" strokeLinejoin="round" />
      <path d="M9.5 1.5V5H13M6.5 8.5h4M6.5 11h4" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  source: SourceRef;
  /** Autres sources du même constat (ex. l'autre version d'une contradiction). */
  related?: readonly SourceRef[];
  onOpen: OpenSource;
};

export function SourceLink({ source, related = [], onOpen }: Props) {
  const label = sourceLabel(DOSSIER, source);
  return (
    <button
      type="button"
      data-testid="source-link"
      data-piece={source.pieceId}
      data-page={source.page}
      data-passage={source.passage}
      onClick={(e) => onOpen(sourceGroup(source, related), 0, e.currentTarget)}
      aria-label={`Ouvrir ${label.replace(", p. ", ", page ")}, au passage cité`}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border hairline-strong bg-white px-3 text-left text-sm font-medium text-navy-900 transition-colors xl:text-base hover:border-gold-500 hover:bg-cream-100"
    >
      <DocIcon className="size-4 shrink-0 text-gold-700" />
      <span className="py-1.5 leading-snug">
        {label}
        <span className="block font-normal text-slate-500">« {excerpt(source.passage)} »</span>
      </span>
    </button>
  );
}

export function SourceList({ sources, related, onOpen }: { sources: readonly SourceRef[]; related?: readonly SourceRef[]; onOpen: OpenSource }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Sources">
      {sources.map((s) => (
        <li key={`${s.pieceId}-${s.page}-${s.passage}`}>
          <SourceLink source={s} related={related ?? sources} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
