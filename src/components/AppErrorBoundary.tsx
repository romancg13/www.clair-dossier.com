import { Component, type ReactNode } from 'react';

/**
 * Frontière d'erreur applicative : une exception de rendu dans une page ne
 * doit jamais laisser un écran blanc. Montée autour de <Outlet /> dans
 * Layout (avec key={pathname} pour se réarmer à chaque navigation), elle
 * conserve la navigation et le pied de page visibles.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    if (import.meta.env.DEV) console.error('[app]', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-14 text-center sm:px-8 lg:px-12">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Erreur</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-navy-900 sm:text-5xl">
          Une erreur inattendue s'est produite.
        </h1>
        <p className="mt-4 text-slate-500">
          Vos données enregistrées n'ont pas été perdues. Rechargez la page ou revenez à l'accueil.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="sheen rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
          >
            Recharger la page
          </button>
          {/* Lien natif (pas <Link>) : un rechargement complet repart d'un état sain. */}
          <a href="/" className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 hover:bg-cream-200">
            Retour à l'accueil
          </a>
        </div>
      </section>
    );
  }
}
