import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal, Stagger, StaggerItem } from '../components/primitives/Reveal';
import { Accordion } from '../components/ui/Accordion';
import {
  plans,
  formatEuro,
  COMPARISON_FEATURES,
  TRUST_PILLARS,
  type Plan,
  type FeatureStatus,
} from '../data/pricing';
import {
  ArrowRightIcon,
  CheckIcon,
  CrossIcon,
  InfoIcon,
  LockIcon,
  FilePagesIcon,
  UsersIcon,
  HeadsetIcon,
} from '../components/icons';

const PRICING_FAQ = [
  {
    id: 'engagement',
    question: "Y a-t-il un engagement de durée ?",
    answer:
      "Aucun. Tous les plans payants sont sans engagement, résiliables à tout moment depuis l'espace facturation. Le remboursement au prorata est appliqué automatiquement.",
  },
  {
    id: 'changement',
    question: "Puis-je changer de plan en cours de mois ?",
    answer:
      "Oui, à la hausse comme à la baisse. La facturation est ajustée au prorata des jours restants.",
  },
  {
    id: 'tva',
    question: "Les prix affichés sont-ils HT ou TTC ?",
    answer:
      "HT. La TVA française à 20 % s'applique pour les clients établis en France. Les clients UE B2B avec numéro de TVA intracommunautaire valide sont autoliquidés.",
  },
  {
    id: 'essai',
    question: "Comment fonctionne l'essai gratuit 14 jours ?",
    answer:
      "Vous accédez à toutes les fonctionnalités du plan choisi pendant 14 jours, sans carte requise. À la fin de l'essai, vous pouvez continuer en payant, basculer sur le plan Découverte, ou supprimer votre compte.",
  },
];

const TRUST_ICONS = {
  'donnees-chiffrees': LockIcon,
  'ia-supervisee': CheckIcon,
  'sans-engagement': CrossIcon,
} as const;

export function Pricing() {
  return (
    <>
      <Seo
        title="Tarifs"
        description="Six formules ClairDossier : Découverte gratuit, Client Essentiel, Business/PME, Cabinet Solo/Pro/Premium. Essai gratuit 14 jours, sans engagement."
        path="/tarifs"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Tarifs', path: '/tarifs' },
          ]),
          ...plans
            .filter((p) => p.priceMonthly !== null && p.priceMonthly > 0)
            .map((p) => ({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: `ClairDossier — ${p.name}`,
              description: p.description,
              offers: {
                '@type': 'Offer',
                price: String(p.priceMonthly ?? 0),
                priceCurrency: 'EUR',
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: String(p.priceMonthly ?? 0),
                  priceCurrency: 'EUR',
                  unitText: 'MON',
                },
                availability: 'https://schema.org/InStock',
              },
            })),
        ]}
      />

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-12 sm:pt-16 lg:pt-20 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Tarifs
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl lg:text-6xl">
              Une formule par usage. Pas de surprise.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500">
              Du particulier qui monte un dossier à la fois au cabinet multi-sites — six niveaux
              de service couvrent tous les usages. Essai gratuit 14 jours sur tous les plans payants.
            </p>
          </div>
        </div>
      </section>

      {/* 6 plans en grille 2 colonnes (desktop) */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12">
          <Stagger inView className="grid items-stretch gap-6 sm:gap-7 lg:grid-cols-2">
            {plans.map((plan) => (
              <StaggerItem key={plan.id}>
                <PlanCard plan={plan} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Trust pillars */}
      <Reveal as="section" className="border-t hairline bg-cream-100/40">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16 lg:py-20 sm:px-8 lg:px-12">
          <div className="grid gap-6 md:grid-cols-3">
            {TRUST_PILLARS.map((pillar) => {
              const Icon = TRUST_ICONS[pillar.id as keyof typeof TRUST_ICONS];
              return (
                <div key={pillar.id} className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-navy-900 text-cream-50">
                    <Icon width={20} height={20} strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold leading-tight text-navy-900">
                      {pillar.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{pillar.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* FAQ tarifs */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
          <div className="text-center">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Questions tarifs
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl lg:text-5xl">
              Avant de choisir.
            </h2>
          </div>
          <div className="mt-12">
            <Accordion
              items={PRICING_FAQ.map((e) => ({
                id: e.id,
                question: e.question,
                answer: <p>{e.answer}</p>,
              }))}
            />
          </div>
        </div>
      </Reveal>

      {/* CTA finale */}
      <Reveal as="section" className="bg-navy-900 text-cream-50">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl lg:text-5xl">
            Une dernière question avant de signer ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-cream-50/75">
            Notre équipe répond aux questions tarifs sous 1 h en journée via WhatsApp. Démo
            possible la même semaine.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/contact"
              className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold hover:-translate-y-0.5"
            >
              Demander un devis
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
            <Link
              to="/dossier/nouveau"
              className="inline-flex items-center gap-2 rounded-full border border-cream-50/20 px-6 py-3.5 text-sm font-medium text-cream-50 hover:border-cream-50/50"
            >
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </Reveal>
    </>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isDark = plan.variant === 'dark';

  const cardBase = 'relative flex h-full flex-col rounded-2xl border p-7 transition-colors duration-300 sm:p-8';
  const cardSkin = isDark
    ? 'border-navy-900 bg-navy-900 text-cream-50'
    : 'hairline bg-white text-navy-900 shadow-card';
  const eyebrow = isDark ? 'text-cream-50/60' : 'text-slate-400';
  const description = isDark ? 'text-cream-50/75' : 'text-slate-500';
  const hairlineClass = isDark ? 'border-cream-50/15' : 'border-[rgba(13,27,61,0.08)]';
  const specsLabel = isDark ? 'text-cream-50/90' : 'text-navy-900';
  const featureMuted = isDark ? 'text-cream-50/40' : 'text-slate-300';
  const featureOn = isDark ? 'text-cream-50' : 'text-navy-900';
  const ctaClass = isDark
    ? 'border border-cream-50/25 bg-transparent text-cream-50 hover:border-cream-50/55 hover:bg-cream-50/5'
    : 'border hairline bg-white text-navy-900 hover:border-navy-900 hover:bg-cream-100/60';

  return (
    <article className={`${cardBase} ${cardSkin}`}>
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

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className={`font-mono text-[0.7rem] uppercase tracking-[0.18em] ${eyebrow}`}>
            {plan.audience}
          </p>
          <h3
            className={`mt-3 font-display text-2xl font-semibold leading-tight sm:text-3xl ${
              isDark ? 'text-cream-50' : 'text-navy-900'
            }`}
          >
            {plan.name}
          </h3>
          <p className={`mt-3 text-sm leading-relaxed ${description}`}>{plan.description}</p>
        </div>
      </div>

      {/* Price */}
      <div className={`mt-6 border-t ${hairlineClass} pt-6`}>
        {plan.priceMonthly === null ? (
          <p className="font-display text-4xl font-semibold">Sur devis</p>
        ) : plan.priceMonthly === 0 ? (
          <p className="font-display text-5xl font-semibold leading-none">Gratuit</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold leading-none">
              {formatEuro(plan.priceMonthly)}
            </span>
            <span className={`text-sm ${description}`}>/mois</span>
          </div>
        )}
      </div>

      {/* Specs */}
      <ul className={`mt-6 space-y-2.5 border-t ${hairlineClass} pt-6 text-sm ${specsLabel}`}>
        <li className="flex items-center gap-2.5">
          <FilePagesIcon width={16} height={16} className={featureMuted} />
          {plan.specs.dossiers}
        </li>
        <li className="flex items-center gap-2.5">
          <UsersIcon width={16} height={16} className={featureMuted} />
          {plan.specs.users}
        </li>
        <li className="flex items-center gap-2.5">
          <HeadsetIcon width={16} height={16} className={featureMuted} />
          {plan.specs.support}
        </li>
      </ul>

      {/* Features comparison */}
      <ul className={`mt-5 flex-1 space-y-2.5 border-t ${hairlineClass} pt-5 text-sm`}>
        {COMPARISON_FEATURES.map((feat) => (
          <FeatureRow
            key={feat.id}
            label={feat.label}
            status={plan.features[feat.id] ?? 'no'}
            isDark={isDark}
            mutedClass={featureMuted}
            onClass={featureOn}
          />
        ))}
      </ul>

      <Link
        to={plan.ctaHref}
        className={`mt-7 inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-3.5 text-sm font-medium transition-colors ${ctaClass}`}
      >
        {plan.ctaLabel}
      </Link>
    </article>
  );
}

function FeatureRow({
  label,
  status,
  isDark,
  mutedClass,
  onClass,
}: {
  label: string;
  status: FeatureStatus;
  isDark: boolean;
  mutedClass: string;
  onClass: string;
}) {
  const labelClass = status === 'no' ? mutedClass : onClass;
  const labelWeight = status === 'no' ? 'font-normal' : 'font-medium';
  const labelText =
    status === 'limited' ? (
      <>
        {label}{' '}
        <span className={isDark ? 'text-cream-50/55' : 'text-slate-400'}>(limité)</span>
      </>
    ) : (
      label
    );

  return (
    <li className={`flex items-start gap-2.5 leading-tight ${labelClass} ${labelWeight}`}>
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
        {status === 'yes' && (
          <CheckIcon width={14} height={14} strokeWidth={2.2} className="text-emerald-500" />
        )}
        {status === 'no' && <CrossIcon width={14} height={14} className={mutedClass} />}
        {status === 'limited' && (
          <InfoIcon width={14} height={14} strokeWidth={2} className="text-gold-500" />
        )}
      </span>
      <span>{labelText}</span>
    </li>
  );
}
