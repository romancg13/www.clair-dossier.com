import type { ReactNode } from 'react';

/**
 * Tuile de comptage.
 *
 * `valeur` est toujours un entier : ce tableau de bord ne montre aucun ratio,
 * aucun pourcentage, aucun score. La nuance `precision` porte ce que le chiffre
 * ne dit pas — un compte sans sa réserve se lit comme une conclusion.
 */
export function Tuile({
  valeur,
  intitule,
  precision,
  ton = 'neutre',
}: {
  valeur: number;
  intitule: string;
  precision?: string;
  ton?: 'neutre' | 'alerte' | 'attente';
}) {
  const accent =
    ton === 'alerte'
      ? 'text-alerte-clair'
      : ton === 'attente'
        ? 'text-laiton-clair'
        : 'text-encre';

  return (
    <div className="rounded-xl border hairline bg-surface p-5 shadow-card">
      <p className={`font-display text-4xl font-semibold leading-none ${accent}`}>{valeur}</p>
      <p className="mt-2.5 text-sm font-medium text-encre">{intitule}</p>
      {precision && <p className="mt-1 text-xs leading-relaxed text-encre-2">{precision}</p>}
    </div>
  );
}

export function GrilleTuiles({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** Titre de section, repris dans toutes les vues de l'atelier. */
export function TitreSection({
  surtitre,
  titre,
  children,
}: {
  surtitre: string;
  titre: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-laiton-clair">
          {surtitre}
        </p>
        <h2 className="mt-1.5 font-display text-2xl font-semibold text-encre">{titre}</h2>
      </div>
      {children}
    </div>
  );
}

/** Encart de réserve — ce que la vue ne dit pas, à côté de ce qu'elle dit. */
export function Reserve({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border hairline bg-surface-2 p-4 text-xs leading-relaxed text-encre-2">
      {children}
    </p>
  );
}

/** État vide explicite : jamais un écran blanc, toujours une raison. */
export function Vide({ titre, explication }: { titre: string; explication: string }) {
  return (
    <div className="rounded-xl border hairline bg-surface p-8 text-center shadow-card">
      <p className="font-display text-xl font-semibold text-encre">{titre}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-encre-2">{explication}</p>
    </div>
  );
}

/**
 * Liste d'appuis (cotes, actes, événements) — cliquables quand `onAppui` est
 * fourni : le clic remonte à la pièce, recherche pré-remplie dans la vue
 * Documents (B20 : de toute phrase à sa cote, en un geste).
 */
export function Appuis({
  appuis,
  onAppui,
  vide = '—',
}: {
  appuis: string[];
  onAppui?: (appui: string) => void;
  vide?: string;
}) {
  if (appuis.length === 0) return <span className="font-mono text-[0.68rem] text-encre-3">{vide}</span>;
  if (!onAppui) return <span className="font-mono text-[0.68rem] text-encre-3">{appuis.join(', ')}</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      {appuis.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onAppui(a)}
          title={`Remonter à « ${a} » dans les pièces`}
          className="font-mono text-[0.68rem] text-laiton-clair underline decoration-laiton/40 underline-offset-2 transition-colors hover:text-laiton hover:decoration-laiton"
        >
          {a}
        </button>
      ))}
    </span>
  );
}
