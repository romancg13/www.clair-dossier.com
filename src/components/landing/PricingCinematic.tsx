import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { formatEuro, plans, yearlyMonthlyEquivalent, yearlyTotal, type Plan } from '../../data/pricing';
import { ArrowRightIcon, FilePagesIcon, HeadsetIcon, UsersIcon } from '../icons';

/**
 * Tarifs — ENHANCE de PricingPreview : mêmes trois formules mises en avant,
 * mêmes liens de paiement Stripe (src/data/pricing.ts, jamais modifié), avec
 * le sélecteur mensuel / annuel déjà présent sur /tarifs (−10 %).
 */

type Billing = 'monthly' | 'yearly';

const PREVIEW_IDS = ['essentiel', 'business-pme-20', 'business-pme-pro'] as const;
const previewPlans = PREVIEW_IDS.map((id) => plans.find((p) => p.id === id)).filter((p): p is Plan => Boolean(p));

export function PricingCinematic() {
  const reduce = useReducedMotion();
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <Reveal as="section" id="tarifs" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">Tarifs</p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-navy-900">
              Une formule par usage. Pas de surprise.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
              Sept formules, de l'indépendant à l'entreprise. Compte gratuit, abonnement sans
              engagement — et 10 % de réduction en facturation annuelle.
            </p>
          </div>

          <div
            className="inline-flex items-center rounded-full border hairline bg-white p-1"
            role="group"
            aria-label="Périodicité de facturation"
          >
            {(['monthly', 'yearly'] as const).map((b) => {
              const isActive = billing === b;
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setBilling(b)}
                  className={`relative min-h-[40px] rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-navy-900' : 'text-slate-500 hover:text-navy-900'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="landing-billing-pill"
                      className="absolute inset-0 rounded-full bg-cream-100 ring-1 ring-gold-500/40"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">
                    {b === 'monthly' ? 'Mensuel' : 'Annuel'}
                    {b === 'yearly' && <span className="ml-1.5 font-mono text-[0.62rem] text-gold-700">−10 %</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Stagger inView className="mt-12 grid items-stretch gap-5 md:grid-cols-3">
          {previewPlans.map((plan) => (
            <StaggerItem key={plan.id}>
              <PlanCard plan={plan} billing={billing} />
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-10 text-center">
          <Link
            to="/tarifs"
            className="group inline-flex items-center gap-1.5 border-b hairline-gold pb-0.5 text-sm font-medium text-navy-900 transition-colors hover:text-gold-700"
          >
            Voir les 7 formules et le détail
            <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const recommended = plan.badge?.tone === 'recommended';
  const isYearly = billing === 'yearly';
  const price = plan.priceMonthly;
  const href = isYearly && plan.ctaHrefYearly ? plan.ctaHrefYearly : plan.ctaHref;
  const external = href.startsWith('http');

  const skin = recommended
    ? 'premium-recommended-plan border-navy-900 bg-navy-900 text-cream-50'
    : 'hairline bg-white text-navy-900 shadow-card';
  const muted = recommended ? 'text-cream-50/70' : 'text-slate-500';
  const hairline = recommended ? 'border-cream-50/15' : 'border-[rgba(13,27,61,0.08)]';
  const cta = recommended
    ? 'sheen cd-btn-primary bg-gold-500 text-navy-900 hover:-translate-y-0.5'
    : 'border hairline bg-white text-navy-900 hover:border-navy-900 hover:bg-cream-100/60';

  const ctaInner = (
    <>
      {plan.ctaLabel}
      <ArrowRightIcon width={14} height={14} strokeWidth={2} />
    </>
  );
  const ctaClass = `mt-6 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 ${cta}`;

  return (
    <article className={`relative flex h-full flex-col rounded-[1.5rem] border p-6 sm:p-7 ${skin}`}>
      {plan.badge && (
        <span
          className={`absolute -top-3 left-6 rounded-full px-3 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${
            recommended ? 'bg-gold-500 text-navy-900' : 'border hairline-gold bg-cream-100 text-navy-900'
          }`}
        >
          {plan.badge.label}
        </span>
      )}

      <p className={`font-mono text-[0.68rem] uppercase tracking-[0.18em] ${muted}`}>{plan.audience}</p>
      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight sm:text-3xl">{plan.name}</h3>
      <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{plan.description}</p>

      <div className={`mt-5 border-t ${hairline} pt-5`}>
        {price === null ? (
          <p className="font-display text-4xl font-semibold leading-none">Sur devis</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold leading-none">
                {formatEuro(isYearly ? yearlyMonthlyEquivalent(price) : price)}
              </span>
              <span className={`text-sm ${muted}`}>/mois HT</span>
            </div>
            <p className={`mt-1.5 min-h-[1.25rem] text-[0.74rem] ${muted}`}>
              {isYearly ? `Facturé ${formatEuro(yearlyTotal(price))} par an — économie de 10 %` : 'Sans engagement, résiliable à tout moment'}
            </p>
          </>
        )}
      </div>

      <ul className={`mt-5 flex-1 space-y-2.5 border-t ${hairline} pt-5 text-sm`}>
        <li className="flex items-center gap-2.5">
          <FilePagesIcon width={16} height={16} className={recommended ? 'text-cream-50/60' : 'text-slate-300'} />
          {plan.specs.dossiers}
        </li>
        <li className="flex items-center gap-2.5">
          <UsersIcon width={16} height={16} className={recommended ? 'text-cream-50/60' : 'text-slate-300'} />
          {plan.specs.users}
        </li>
        <li className="flex items-center gap-2.5">
          <HeadsetIcon width={16} height={16} className={recommended ? 'text-cream-50/60' : 'text-slate-300'} />
          {plan.specs.support}
        </li>
      </ul>

      {external ? (
        <a href={href} className={ctaClass}>
          {ctaInner}
        </a>
      ) : (
        <Link to={href} className={ctaClass}>
          {ctaInner}
        </Link>
      )}
    </article>
  );
}
