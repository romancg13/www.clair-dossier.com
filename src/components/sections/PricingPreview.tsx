import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { plans, formatEuro, type Plan } from '../../data/pricing';
import { ArrowRightIcon, FilePagesIcon, UsersIcon, HeadsetIcon } from '../icons';

// 3 plans à mettre en avant sur la home : entrée gratuite, populaire, recommandé.
const PREVIEW_IDS = ['client-essentiel', 'business-pme', 'cabinet-solo'] as const;
const previewPlans = PREVIEW_IDS
  .map((id) => plans.find((p) => p.id === id))
  .filter((p): p is Plan => Boolean(p));

export function PricingPreview() {
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Tarifs
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Une formule par usage. Pas de surprise.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Six niveaux couvrent du particulier au cabinet multi-sites. Essai gratuit 14 jours,
            sans engagement.
          </p>
        </div>

        <Stagger inView className="mt-14 grid items-stretch gap-5 sm:gap-6 md:grid-cols-3">
          {previewPlans.map((plan) => (
            <StaggerItem key={plan.id}>
              <CompactPlanCard plan={plan} />
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-10 text-center">
          <Link
            to="/tarifs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-500"
          >
            Voir les 6 plans et le détail
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

function CompactPlanCard({ plan }: { plan: Plan }) {
  const isDark = plan.variant === 'dark';
  const cardSkin = isDark
    ? 'border-navy-900 bg-navy-900 text-cream-50'
    : 'hairline bg-white text-navy-900 shadow-card';
  const eyebrow = isDark ? 'text-cream-50/60' : 'text-slate-500';
  const description = isDark ? 'text-cream-50/75' : 'text-slate-500';
  const hairlineClass = isDark ? 'border-cream-50/15' : 'border-[rgba(13,27,61,0.08)]';
  const specIconClass = isDark ? 'text-cream-50/65' : 'text-slate-300';
  const specLabel = isDark ? 'text-cream-50/90' : 'text-navy-900';
  const ctaClass = isDark
    ? 'border border-cream-50/25 bg-transparent text-cream-50 hover:border-cream-50/55 hover:bg-cream-50/5'
    : 'border hairline bg-white text-navy-900 hover:border-navy-900 hover:bg-cream-100/60';

  return (
    <article className={`relative flex h-full flex-col rounded-2xl border p-6 sm:p-7 ${cardSkin}`}>
      {plan.badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${
            plan.badge.tone === 'gratuit'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-cream-100 text-navy-900'
          }`}
        >
          {plan.badge.label}
        </span>
      )}

      <p className={`font-mono text-[0.7rem] uppercase tracking-[0.18em] ${eyebrow}`}>
        {plan.audience}
      </p>
      <h3 className={`mt-3 font-display text-2xl font-semibold leading-tight sm:text-3xl ${isDark ? 'text-cream-50' : 'text-navy-900'}`}>
        {plan.name}
      </h3>
      <p className={`mt-2 text-sm leading-relaxed ${description}`}>{plan.description}</p>

      <div className={`mt-5 border-t ${hairlineClass} pt-5`}>
        {plan.priceMonthly === 0 ? (
          <p className="font-display text-4xl font-semibold leading-none">Gratuit</p>
        ) : plan.priceMonthly === null ? (
          <p className="font-display text-4xl font-semibold leading-none">Sur devis</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-semibold leading-none">
              {formatEuro(plan.priceMonthly)}
            </span>
            <span className={`text-sm ${description}`}>/mois</span>
          </div>
        )}
      </div>

      <ul className={`mt-5 flex-1 space-y-2.5 border-t ${hairlineClass} pt-5 text-sm ${specLabel}`}>
        <li className="flex items-center gap-2.5">
          <FilePagesIcon width={16} height={16} className={specIconClass} />
          {plan.specs.dossiers}
        </li>
        <li className="flex items-center gap-2.5">
          <UsersIcon width={16} height={16} className={specIconClass} />
          {plan.specs.users}
        </li>
        <li className="flex items-center gap-2.5">
          <HeadsetIcon width={16} height={16} className={specIconClass} />
          {plan.specs.support}
        </li>
      </ul>

      <Link
        to={plan.ctaHref}
        className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-sm font-medium transition-colors ${ctaClass}`}
      >
        {plan.ctaLabel}
      </Link>
    </article>
  );
}
