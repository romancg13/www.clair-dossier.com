import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal, Stagger, StaggerItem } from '../components/primitives/Reveal';
import { features } from '../data/features';
import { FEATURE_ICONS, ArrowRightIcon } from '../components/icons';

const serviceSchemas = features.map((f) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: f.title,
  name: f.title,
  description: f.blurb,
  provider: { '@type': 'Organization', name: 'ClairDossier' },
}));

export function FeaturesIndex() {
  return (
    <>
      <Seo
        title="Fonctionnalités"
        description="Les huit fonctionnalités ClairDossier — création guidée, OCR, chronologie, brief IA, validation avocat, suivi 6 statuts, messagerie sécurisée, coffre-fort RGPD."
        path="/fonctionnalites"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Fonctionnalités', path: '/fonctionnalites' },
          ]),
          ...serviceSchemas,
        ]}
      />

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Fonctionnalités
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              Huit briques, un dossier juridique propre.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Chaque fonctionnalité a été conçue pour traiter un point de friction identifié dans
              des dossiers réels — pas pour cocher une case dans un comparatif. Vous pouvez les
              découvrir dans l'ordre ou attaquer celle qui vous parle d'abord.
            </p>
          </div>
        </div>
      </section>

      {/* Grid 4×2 */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
          <Stagger inView className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = FEATURE_ICONS[f.icon];
              return (
                <StaggerItem key={f.slug}>
                  <Link
                    to={`/fonctionnalites/${f.slug}`}
                    className="group flex h-full flex-col rounded-2xl border hairline bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-gold-500 hover:shadow-card-hover"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-cream-100 text-navy-900 transition-colors group-hover:bg-gold-500/15 group-hover:text-gold-500">
                      <Icon width={26} height={26} />
                    </span>
                    <h2 className="mt-5 font-display text-2xl font-semibold leading-tight text-navy-900">
                      {f.title}
                    </h2>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">
                      {f.blurb}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900">
                      Lire la fiche
                      <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </Reveal>

      {/* CTA bas */}
      <Reveal as="section" className="border-t hairline bg-navy-900 text-cream-50">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 lg:px-12">
          <h2 className="font-display text-4xl font-semibold leading-tight text-cream-50 sm:text-5xl">
            Plutôt voir en pratique ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-cream-50/75">
            Trente minutes de démo. Pas de slide marketing — on ouvre directement un dossier
            type avec vous.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/contact"
              className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold hover:-translate-y-0.5"
            >
              Demander une démo
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
            <Link
              to="/dossier/nouveau"
              className="inline-flex items-center gap-2 rounded-full border border-cream-50/20 px-6 py-3.5 text-sm font-medium text-cream-50 hover:border-cream-50/50"
            >
              Créer un dossier maintenant
            </Link>
          </div>
        </div>
      </Reveal>
    </>
  );
}
