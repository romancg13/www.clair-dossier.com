import { Link } from 'react-router-dom';
import { Seo } from '../lib/seo';

// Servie par GitHub Pages via dist/404.html (statut HTTP 404 réel, voir
// scripts/prerender.ts) : noindex, sans canonique (géré par <Seo>).
export function NotFound() {
  return (
    <>
      <Seo
        title="Page introuvable"
        description="La page demandée n'existe pas ou a été déplacée. Retrouvez l'accueil, les fonctionnalités, les tarifs ou le journal ClairDossier."
        noindex
      />
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-14 sm:py-20 lg:py-24 text-center sm:px-8 lg:px-12">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Erreur 404</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-navy-900 sm:text-6xl">
          Cette page n'existe pas.
        </h1>
        <p className="mt-4 text-slate-500">
          Le lien est peut-être obsolète ou mal recopié. Revenez à l'accueil ou ouvrez le journal.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="sheen rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
          >
            Retour à l'accueil
          </Link>
          <Link to="/blog" className="rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 hover:bg-cream-200">
            Lire le journal
          </Link>
        </div>
        <nav aria-label="Pages utiles" className="mt-8">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
            <li>
              <Link to="/fonctionnalites" className="underline decoration-gold-500/60 underline-offset-2 hover:text-navy-900">
                Voir les fonctionnalités
              </Link>
            </li>
            <li>
              <Link to="/tarifs" className="underline decoration-gold-500/60 underline-offset-2 hover:text-navy-900">
                Consulter les tarifs
              </Link>
            </li>
            <li>
              <Link to="/contact" className="underline decoration-gold-500/60 underline-offset-2 hover:text-navy-900">
                Contacter l'équipe
              </Link>
            </li>
          </ul>
        </nav>
      </section>
    </>
  );
}
