import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DOSSIER, frLongDate, pieceById, sourceLabel, type SourceRef } from "../../demo/construction/dossier.ts";
import { excerpt } from "./SourceLink";

type Props = {
  /** Sources liées (navigation entre elles) ; la visionneuse s'ouvre sur `sources[index]`. */
  sources: SourceRef[];
  index: number;
  onClose: () => void;
};

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Paragraphe de page ; le passage cité est surligné (<mark>) s'il s'y trouve. */
function PageParagraph({ text, passage, first }: { text: string; passage: string; first: boolean }) {
  const at = passage ? text.indexOf(passage) : -1;
  const body: ReactNode =
    at < 0 ? (
      text
    ) : (
      <>
        {text.slice(0, at)}
        <mark data-testid="passage-highlight" className="scroll-my-24 rounded-sm bg-gold-300 px-0.5 text-navy-900 ring-2 ring-gold-500">
          {passage}
        </mark>
        {text.slice(at + passage.length)}
      </>
    );
  return first ? (
    <p className="font-mono text-sm font-medium uppercase tracking-[0.08em] text-gold-700">{body}</p>
  ) : (
    <p className="whitespace-pre-line leading-relaxed">{body}</p>
  );
}

/**
 * Visionneuse de pièce (dialogue modal natif) : plein écran sur mobile, panneau latéral
 * à partir de 1024 px. Échap ferme ; le parent rend le focus au déclencheur.
 */
export function PieceViewer({ sources, index: initialIndex, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const active = sources[index];
  const [page, setPage] = useState(active.page);
  const piece = pieceById(DOSSIER, active.pieceId)!;
  const total = piece.pages.length;
  const showPassage = page === active.page ? active.passage : "";
  const prevButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const turned = useRef<"prev" | "next" | null>(null);

  useEffect(() => {
    const d = dialog.current!;
    if (!d.open) d.showModal();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
      if (d.open) d.close();
    };
  }, []);

  // Amène le passage à l'écran (ou le haut de la page) à chaque changement de source ou de page.
  useEffect(() => {
    const mark = scroller.current?.querySelector("mark");
    if (mark) mark.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    else scroller.current?.scrollTo({ top: 0 });
  }, [index, page]);

  // Bouton de page désactivé en bout de pièce alors qu'il avait le focus : le focus passe à l'autre.
  useLayoutEffect(() => {
    if (turned.current === "next" && page >= total) prevButton.current?.focus();
    if (turned.current === "prev" && page <= 1) nextButton.current?.focus();
    turned.current = null;
  }, [page, total]);
  const turn = (dir: "prev" | "next") => {
    turned.current = dir;
    setPage((p) => p + (dir === "next" ? 1 : -1));
  };

  const goTo = (i: number) => {
    setIndex(i);
    setPage(sources[i].page);
  };

  return (
    <dialog
      ref={dialog}
      data-testid="piece-viewer"
      aria-labelledby="piece-viewer-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="fixed inset-0 m-0 ml-auto h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-cream-50 p-0 text-base text-ink lining-nums xl:text-lg shadow-card-hover backdrop:bg-navy-900/50 lg:w-[min(54rem,62vw)] lg:border-l lg:border-gold-500/40"
    >
      <div className="flex h-full flex-col">
        <header className="border-b hairline-strong bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="piece-viewer-title" className="font-display text-xl font-semibold leading-tight text-navy-900 sm:text-2xl xl:text-3xl">
                <span data-testid="piece-title">
                  Pièce {piece.numero} — {piece.typeLabel}
                </span>{" "}
                — <span data-testid="piece-page-indicator">page {page} / {total}</span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {piece.title} · {frLongDate(piece.date)}
                <span className="hidden sm:inline"> · {piece.author}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-testid="viewer-close"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border hairline-strong bg-white px-4 text-sm font-semibold text-navy-900 hover:bg-cream-100"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
              Fermer
            </button>
          </div>

          {sources.length > 1 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-navy-900">Sources de ce constat</p>
              <div className="-mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
                {sources.map((s, i) => (
                  <button
                    key={`${s.pieceId}-${s.page}-${i}`}
                    type="button"
                    data-testid="viewer-source"
                    aria-pressed={i === index}
                    onClick={() => goTo(i)}
                    className={`inline-flex min-h-11 shrink-0 flex-col items-start justify-center whitespace-nowrap rounded-lg border px-3 py-1 text-left text-sm font-medium leading-snug transition-colors xl:text-base ${i === index ? "border-navy-900 bg-navy-900 text-cream-50" : "hairline-strong bg-white text-navy-900 hover:bg-cream-100"}`}
                  >
                    <span className="sm:hidden">
                      Pièce {pieceById(DOSSIER, s.pieceId)?.numero}, p. {s.page}
                    </span>
                    <span className="hidden sm:inline">{sourceLabel(DOSSIER, s)}</span>
                    {s.passage && <span className="font-normal">« {excerpt(s.passage, 4)} »</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {active.passage && (
            <p className="mb-4 rounded-lg border-l-4 border-gold-500 bg-white px-4 py-3 text-sm leading-relaxed text-navy-900">
              <span className="font-semibold">Passage cité</span> (page {active.page}) : « {active.passage} »
              {page !== active.page && (
                <button type="button" onClick={() => setPage(active.page)} className="ml-2 inline-flex min-h-11 items-center font-semibold text-gold-700 underline underline-offset-4">
                  Revenir à la page {active.page}
                </button>
              )}
            </p>
          )}
          <article
            aria-label={`Texte de la pièce ${piece.numero}, page ${page}`}
            className="mx-auto max-w-2xl space-y-4 rounded-md border hairline-strong bg-white px-5 py-6 text-navy-900 shadow-card sm:px-8 sm:py-8"
          >
            {piece.pages[page - 1].split("\n\n").map((t, i) => (
              <PageParagraph key={i} text={t} passage={showPassage} first={i === 0} />
            ))}
            <p className="border-t hairline pt-3 text-right font-mono text-sm text-slate-500">
              Pièce {piece.numero} · page {page} / {total} · document fictif
            </p>
          </article>
        </div>

        <p aria-live="polite" className="sr-only">
          Page {page} sur {total}
        </p>
        <nav aria-label="Pages de la pièce" className="flex items-center justify-between gap-3 border-t hairline-strong bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 sm:px-6">
          <button
            ref={prevButton}
            type="button"
            aria-label="Page précédente"
            disabled={page <= 1}
            onClick={() => turn("prev")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border hairline-strong bg-white px-4 text-sm font-semibold text-navy-900 hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← <span className="sm:hidden">Précédente</span>
            <span className="hidden sm:inline">Page précédente</span>
          </button>
          <span className="whitespace-nowrap font-mono text-sm text-slate-500" aria-hidden="true">
            {page} / {total}
          </span>
          <button
            ref={nextButton}
            type="button"
            aria-label="Page suivante"
            disabled={page >= total}
            onClick={() => turn("next")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border hairline-strong bg-white px-4 text-sm font-semibold text-navy-900 hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="sm:hidden">Suivante</span>
            <span className="hidden sm:inline">Page suivante</span> →
          </button>
        </nav>
      </div>
    </dialog>
  );
}
