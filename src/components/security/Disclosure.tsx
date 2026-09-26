import type { ReactNode } from 'react';

/**
 * Détails repliables natifs (<details>/<summary>) : clavier et lecteurs
 * d'écran pris en charge par le navigateur, contenu présent dans le HTML
 * pré-rendu (recherche dans la page, moteurs), fonctionne sans JavaScript.
 * L'état ouvert/fermé n'est pas piloté par React (aucun `open` contrôlé).
 */
export function Disclosure({
  id,
  summary,
  children,
}: {
  id?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <details id={id} className="group scroll-mt-24 rounded-xl border hairline bg-cream-50/70">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-navy-900 transition-colors hover:text-gold-700 [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border hairline transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
        </span>
      </summary>
      <div className="space-y-4 px-4 pb-5 pt-1 text-sm leading-relaxed text-slate-500">{children}</div>
    </details>
  );
}

/**
 * Ouvre le <details> qui contient l'ancre ciblée (#dpa, #sous-traitants…)
 * lors d'une navigation par lien, puis y fait défiler la page. À appeler dans
 * un useEffect (jamais pendant le rendu).
 */
export function revealHashTarget(hash: string): void {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  let node: HTMLElement | null = target;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
