import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { plans, formatEuro } from '../../data/pricing';
import { ArrowRightIcon, CheckIcon } from '../icons';

export function PricingPreview() {
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Tarifs
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Une formule par usage. Pas de surprise.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Particulier, cabinet en démarrage, ou structure multi-sites — la facturation est
            par utilisateur, les dossiers sont illimités, l'annuel est à −15 %.
          </p>
        </div>

        <Stagger inView className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const isPopular = Boolean(plan.popular);
            return (
              <StaggerItem key={plan.id}>
                <article
                  className={`relative flex h-full flex-col rounded-2xl border p-7 transition-colors duration-300 ${
                    isPopular
                      ? 'border-gold-500 bg-white shadow-card-hover lg:-mt-4 lg:mb-2'
                      : 'hairline bg-white shadow-card'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold-500 px-3 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-navy-900">
                      Le plus choisi
                    </span>
                  )}
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                    {plan.audience}
                  </p>
                  <h3 className="mt-3 font-display text-3xl font-semibold leading-tight text-navy-900">
                    {plan.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{plan.description}</p>

                  <div className="mt-6">
                    {plan.priceMonthly === null ? (
                      <p className="font-display text-4xl font-semibold text-navy-900">
                        Sur devis
                      </p>
                    ) : plan.priceMonthly === 0 ? (
                      <p className="font-display text-4xl font-semibold text-navy-900">
                        Gratuit
                      </p>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-4xl font-semibold text-navy-900">
                          {formatEuro(plan.priceMonthly)}
                        </span>
                        <span className="text-sm text-slate-500">/ mois HT</span>
                      </div>
                    )}
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.slice(0, 6).map((f) => (
                      <li key={f} className="flex gap-2.5 text-sm text-navy-900">
                        <CheckIcon width={14} height={14} strokeWidth={2.2} className="mt-1 shrink-0 text-gold-500" />
                        <span className="leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={plan.ctaHref}
                    className={`mt-7 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 ${
                      isPopular
                        ? 'sheen bg-gold-500 text-navy-900 shadow-gold hover:-translate-y-0.5'
                        : 'bg-navy-900 text-cream-50 hover:bg-navy-800'
                    }`}
                  >
                    {plan.ctaLabel}
                    <ArrowRightIcon width={14} height={14} strokeWidth={2} />
                  </Link>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>

        <div className="mt-10 text-center">
          <Link
            to="/tarifs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-500"
          >
            Voir tous les tarifs et la matrice détaillée
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
