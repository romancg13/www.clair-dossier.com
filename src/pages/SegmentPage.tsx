import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal, Stagger, StaggerItem } from '../components/primitives/Reveal';
import { getSegmentPage, segmentPages, type SegmentPageData } from '../data/segments';
import { ArrowRightIcon, CheckIcon } from '../components/icons';

// Wrappers nommés pour le chargement paresseux du routeur (src/App.tsx).
export function CabinetsAvocats() {
  return <SegmentPage data={getSegmentPage('cabinets-avocats')!} />;
}
export function ExpertsComptables() {
  return <SegmentPage data={getSegmentPage('experts-comptables')!} />;
}
export function GrandsComptes() {
  return <SegmentPage data={getSegmentPage('grands-comptes')!} />;
}

/**
 * Page de parcours métier (Vague 1 — 5.1). Même système graphique que le
 * reste du site, sobriété identique. Preuves vérifiables uniquement, un seul
 * appel à l'action : la démonstration.
 */
export function SegmentPage({ data }: { data: SegmentPageData }) {
  const others = segmentPages.filter((s) => s.slug !== data.slug);
  const rdvHref = `/rendez-vous?segment=${data.segmentId}`;

  return (
    <>
      <Seo
        title={data.metaTitle}
        description={data.metaDescription}
        path={`/${data.slug}`}
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: data.navLabel, path: `/${data.slug}` },
        ])}
      />

      {/* Fil d'ariane */}
      <nav aria-label="Fil d'ariane" className="border-b hairline bg-cream-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-3 text-xs text-slate-500 sm:px-8 lg:px-12">
          <Link to="/" className="hover:text-navy-900">Accueil</Link>
          <span className="text-slate-300">/</span>
          <span className="text-navy-900">{data.navLabel}</span>
        </div>
      </nav>

      {/* En-tête — éléments critiques lisibles sans JavaScript */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-12 sm:pt-16 lg:pt-24 sm:px-8 lg:px-12">
          <div className="rise-in max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              {data.surtitre}
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              {data.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
              {data.promesse}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={rdvHref}
                className="sheen group inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold-strong"
              >
                Réserver une démonstration
                <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/etat-du-produit"
                className="text-sm font-medium text-navy-900 border-b hairline-gold hover:text-gold-700"
              >
                Voir l'état réel du produit
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Points de friction du métier */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Ce qui coûte du temps aujourd'hui
          </p>
          <Stagger inView className="mt-8 grid gap-4 sm:grid-cols-3">
            {data.frictions.map((f) => (
              <StaggerItem key={f.title}>
                <div className="flex h-full flex-col rounded-2xl border hairline bg-white p-6">
                  <h2 className="font-display text-xl font-semibold leading-snug text-navy-900">
                    {f.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{f.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>

      {/* Preuves vérifiables — et où les vérifier */}
      <Reveal as="section" className="premium-tech-section bg-navy-900 text-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Preuves vérifiables — pas de promesses
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Chaque garantie indique où elle se vérifie.
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {data.proofs.map((p) => (
              <div key={p.title} className="rounded-2xl border border-cream-50/15 bg-navy-800/60 p-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-500">
                    <CheckIcon width={13} height={13} strokeWidth={2.4} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold leading-snug">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-cream-50/80">{p.body}</p>
                    <p className="mt-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-gold-500/90">
                      {p.verification}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* CTA final + autres parcours */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 sm:px-8 lg:px-12">
          <div className="rounded-2xl border hairline bg-white p-8 sm:p-10">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
                  Une démonstration sur vos cas réels, pas un argumentaire.
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                  30 minutes, en visio ou par téléphone : vous amenez un cas type,
                  on montre exactement ce que le produit fait — et ce qu'il ne fait pas encore.
                </p>
              </div>
              <Link
                to={rdvHref}
                className="sheen inline-flex shrink-0 items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5"
              >
                Réserver une démonstration
                <ArrowRightIcon width={14} height={14} strokeWidth={2} />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t hairline pt-6 text-sm">
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                Autres parcours
              </span>
              {others.map((o) => (
                <Link
                  key={o.slug}
                  to={`/${o.slug}`}
                  className="font-medium text-navy-900 border-b hairline-gold hover:text-gold-700"
                >
                  {o.navLabel}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </>
  );
}
