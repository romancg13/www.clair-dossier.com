import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ArrowRightIcon } from '../icons';
import { DocumentGlyph } from './DocumentGlyph';

export function HeroCinematic() {
  const { session } = useAuth();

  return (
    <section className="bg-cream-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-14 lg:px-12 lg:py-20">
        <div>
          <h1 className="font-display text-[clamp(2.4rem,11vw,3.2rem)] sm:text-[clamp(3.3rem,5.8vw,5.6rem)] lg:max-w-[14ch] font-semibold leading-[0.99] tracking-[-0.035em] text-navy-900">
            Déposez vos pièces. <span className="text-gold-700">Sachez quoi faire ensuite.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-500 sm:text-lg">
            Un résumé, vos dates importantes et votre prochaine action, dans votre espace.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to={session ? '/compte' : '/tarifs'} className="sheen inline-flex min-h-11 items-center gap-2 rounded-full bg-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-700">
              {session ? 'Retrouver mes dossiers' : 'Choisir une formule'} <ArrowRightIcon width={15} height={15} />
            </Link>
            <a href="#comment-ca-fonctionne" className="inline-flex min-h-11 items-center text-sm font-medium text-navy-900 underline decoration-gold-500 underline-offset-4">
              Voir un exemple
            </a>
          </div>
        </div>

        <article id="comment-ca-fonctionne" aria-labelledby="exemple-dossier" tabIndex={-1} className="scroll-mt-24 rounded-2xl bg-navy-900 p-4 shadow-card sm:p-7">
          <p className="mb-4 text-xs font-medium tracking-wide text-cream-100">Exemple fictif · Dossier de facturation</p>
          <div className="overflow-hidden rounded-lg border-t-2 border-gold-500 bg-white px-5 py-6 text-navy-900 sm:px-7">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <DocumentGlyph type="facture" /> Avant · Une facture et un courrier à rapprocher
            </div>
            <div className="mt-5 border-t hairline pt-5">
              <p className="font-mono text-xs text-gold-700">Après · Votre synthèse</p>
              <h2 id="exemple-dossier" className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">Le solde du chantier</h2>
              <p className="mt-2 text-sm leading-relaxed">La facture indique un solde de 12 880 € TTC. Le client conteste la finition des travaux.</p>
              <dl className="mt-5 space-y-4 border-l-2 border-gold-500 pl-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Échéance inscrite sur la facture</dt>
                  <dd className="mt-0.5 font-semibold"><time dateTime="2026-09-30">30 septembre 2026</time></dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Votre prochaine action</dt>
                  <dd className="mt-0.5 font-semibold">Joindre la preuve d’envoi de la facture.</dd>
                </div>
              </dl>
              <details className="mt-4 border-t hairline pt-3 text-xs leading-relaxed text-slate-500">
                <summary className="cursor-pointer py-1 font-medium text-navy-900">Consulter les pièces citées</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Facture F-2026-077, p. 1. Solde et échéance de paiement.</li>
                  <li>Courrier du client du 29 septembre, p. 1. Contestation des finitions.</li>
                </ul>
              </details>
            </div>
          </div>
          {import.meta.env.VITE_DEMO === '1' && (
            <a href="/recette/" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-cream-50 underline decoration-gold-500 underline-offset-4">
              Ouvrir le dossier de recette <ArrowRightIcon width={14} height={14} />
            </a>
          )}
        </article>
      </div>
    </section>
  );
}
