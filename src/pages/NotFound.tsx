import { Link } from 'react-router-dom';
import { Seo } from '../lib/seo';

export function NotFound() {
  return (
    <>
      <Seo title="Page introuvable" description="La page demandée n'existe pas." path="/" />
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8 lg:px-12">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">Erreur 404</p>
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
      </section>
    </>
  );
}
