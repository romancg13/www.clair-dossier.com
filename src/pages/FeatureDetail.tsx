import { Link, useParams } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal } from '../components/primitives/Reveal';
import { features, getFeatureBySlug } from '../data/features';
import { FEATURE_ICONS, ArrowRightIcon, CheckIcon } from '../components/icons';
import { NotFound } from './NotFound';

export function FeatureDetail() {
  const { slug } = useParams();
  const feature = getFeatureBySlug(slug);

  if (!feature) return <NotFound />;

  const Icon = FEATURE_ICONS[feature.icon];
  const related = features.filter((f) => f.slug !== feature.slug).slice(0, 3);

  return (
    <>
      <Seo
        title={feature.title}
        description={feature.blurb}
        path={`/fonctionnalites/${feature.slug}`}
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Fonctionnalités', path: '/fonctionnalites' },
            { name: feature.shortTitle, path: `/fonctionnalites/${feature.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: feature.title,
            name: feature.title,
            description: feature.blurb,
            provider: { '@type': 'Organization', name: 'ClairDossier' },
          },
        ]}
      />

      {/* Breadcrumb */}
      <nav aria-label="Fil d'ariane" className="border-b hairline bg-cream-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-3 text-xs text-slate-500 sm:px-8 lg:px-12">
          <Link to="/" className="hover:text-navy-900">Accueil</Link>
          <span className="text-slate-300">/</span>
          <Link to="/fonctionnalites" className="hover:text-navy-900">Fonctionnalités</Link>
          <span className="text-slate-300">/</span>
          <span className="text-navy-900">{feature.shortTitle}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-5xl px-5 pb-12 pt-16 sm:px-8 lg:px-12">
          <Reveal>
            <span className="inline-grid h-12 w-12 place-items-center rounded-lg bg-cream-100 text-navy-900">
              <Icon width={26} height={26} />
            </span>
            <p className="mt-6 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Fonctionnalité · {feature.shortTitle}
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              {feature.title}
            </h1>
            <p className="mt-5 max-w-3xl font-display text-xl italic leading-relaxed text-navy-700 sm:text-2xl">
              {feature.hero}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Body */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto grid max-w-5xl gap-12 px-5 pb-24 sm:px-8 lg:grid-cols-[1fr_280px] lg:px-12">
          <article className="space-y-5 text-base leading-relaxed text-slate-500 sm:text-[1.05rem]">
            {feature.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
          <aside className="rounded-2xl border hairline bg-white p-6">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
              Concrètement
            </p>
            <ul className="mt-4 space-y-3">
              {feature.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-sm text-navy-900">
                  <CheckIcon width={14} height={14} strokeWidth={2.2} className="mt-1 shrink-0 text-gold-500" />
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/dossier/nouveau"
              className="mt-7 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-navy-900 px-5 py-3 text-sm font-medium text-cream-50 hover:bg-navy-800"
            >
              Essayer maintenant
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
          </aside>
        </div>
      </Reveal>

      {/* Related features */}
      <Reveal as="section" className="border-t hairline bg-cream-100/40">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold text-navy-900 sm:text-4xl">
              Autres briques utiles.
            </h2>
            <Link to="/fonctionnalites" className="text-sm font-medium text-navy-900 border-b hairline-gold hover:text-gold-500">
              Toutes les fonctionnalités
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {related.map((f) => {
              const RIcon = FEATURE_ICONS[f.icon];
              return (
                <Link
                  key={f.slug}
                  to={`/fonctionnalites/${f.slug}`}
                  className="group flex h-full flex-col rounded-xl border hairline bg-white p-6 transition-colors duration-300 hover:border-gold-500"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-cream-100 text-navy-900 group-hover:bg-gold-500/15 group-hover:text-gold-500">
                    <RIcon />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold leading-snug text-navy-900">
                    {f.shortTitle}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{f.blurb}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </Reveal>
    </>
  );
}
