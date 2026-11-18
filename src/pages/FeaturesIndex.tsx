import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { featuresByGroup } from '../data/features';
import { ArrowRightIcon } from '../components/icons';

const results = [
  { title: 'Retrouver la pièce utile', detail: 'Ouvrez le dossier pour retrouver une facture, un courrier ou un justificatif parmi les pièces déposées.', slug: 'depot-de-pieces', link: 'Le dépôt des pièces' },
  { title: 'Repérer la prochaine date', detail: 'Consultez l’échéance renseignée dans le dossier pour préparer le prochain rendez-vous ou suivre un paiement.', slug: 'calendrier-relances', link: 'Le suivi des échéances' },
  { title: 'Préparer une transmission', detail: 'Relisez le récapitulatif, puis choisissez les pièces à remettre à votre interlocuteur.', slug: 'recapitulatif-transmission', link: 'Le récapitulatif' },
];

export function FeaturesIndex() {
  return (
    <>
      <Seo title="Pièces, échéances et transmission du dossier" description="Retrouvez vos pièces, suivez une échéance et préparez votre transmission. Explorez les fonctionnalités de l’espace ClairDossier." path="/fonctionnalites" jsonLd={breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: 'Fonctionnalités', path: '/fonctionnalites' }])} />
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <header>
          <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.03] text-navy-900 sm:text-6xl">Ce que votre dossier vous permet de faire.</h1>
        </header>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {results.map((result) => (
            <section key={result.slug} className="flex flex-col border-t-2 border-gold-500 bg-white p-6 shadow-card">
              <h2 className="font-display text-3xl leading-tight text-navy-900">{result.title}</h2>
              <p className="mb-6 mt-3 text-sm leading-relaxed text-slate-500">{result.detail}</p>
              <Link to={`/fonctionnalites/${result.slug}`} className="mt-auto inline-flex min-h-11 items-center gap-2 text-sm font-medium text-navy-900 underline decoration-gold-500 underline-offset-4">{result.link} <ArrowRightIcon width={14} height={14} /></Link>
            </section>
          ))}
        </div>
        <section className="mt-12 max-w-3xl" aria-labelledby="guides">
          <h2 id="guides" className="font-display text-3xl text-navy-900">Guides par besoin</h2>
          <div className="mt-4 border-t hairline">
            {featuresByGroup().map((group) => (
              <details key={group.id} id={`groupe-${group.id}`} className="scroll-mt-24 border-b hairline">
                <summary className="cursor-pointer py-4 font-medium text-navy-900">{group.title}</summary>
                <ul className="mb-3 pl-4">
                  {group.features.map((feature) => <li key={feature.slug}><Link className="inline-flex min-h-11 items-center text-sm text-navy-900 underline decoration-gold-500 underline-offset-4" to={`/fonctionnalites/${feature.slug}`}>{feature.title}</Link></li>)}
                </ul>
              </details>
            ))}
          </div>
        </section>
        <nav aria-label="Pour aller plus loin" className="mt-8 flex flex-wrap items-center gap-x-5 text-sm font-medium text-navy-900 underline decoration-gold-500 underline-offset-4">
          <Link to="/tarifs" className="inline-flex min-h-11 items-center">Choisir une formule</Link>
          <Link to="/etat-du-produit" className="inline-flex min-h-11 items-center">Consulter l’état du produit</Link>
          <Link to="/rendez-vous" className="inline-flex min-h-11 items-center">Demander une démonstration</Link>
        </nav>
      </div>
    </>
  );
}
