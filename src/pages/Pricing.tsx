import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal, Stagger, StaggerItem } from '../components/primitives/Reveal';
import { Accordion } from '../components/ui/Accordion';
import {
  plans,
  formatEuro,
  yearlyMonthlyEquivalent,
  yearlyTotal,
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
  WhatsAppIcon,
} from '../components/icons';
import { WHATSAPP_DISPLAY, buildWhatsAppUrl } from '../lib/whatsapp';

const DEVIS_CAPABILITIES = [
  {
    title: 'Marque blanche complète',
    body: "Logo, palette, domaine, exports : votre identité, votre clientèle ne saura pas qu'il s'agit de ClairDossier.",
  },
  {
    title: 'API et webhooks dédiés',
    body: "Intégration avec votre CRM, votre outil de gestion ou votre stack maison. SDK Node et Python disponibles.",
  },
  {
    title: 'SSO et audit renforcé',
    body: "SAML 2.0, OIDC, journalisation détaillée, DPA personnalisé négocié avec votre DPO.",
  },
  {
    title: 'Onboarding sur site',
    body: "Deux jours dans vos locaux, reprise de vos dossiers existants, formation de l'équipe entière.",
  },
];

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
    question: 'Faut-il payer pour créer un compte ?',
    answer:
      "Non. La création de compte est gratuite et vous pouvez constituer vos dossiers immédiatement. Un abonnement n'est nécessaire que pour débloquer plus de dossiers, d'utilisateurs et les fonctions IA avancées. Sans engagement, résiliable à tout moment.",
  },
  {
    id: 'annuel',
    question: "Comment fonctionne la facturation annuelle ?",
    answer:
      "L'abonnement annuel est facturé en une fois et bénéficie de 10 % de réduction par rapport au cumul mensuel. Il reste sans engagement : en cas de résiliation en cours d'année, le solde non consommé est remboursé au prorata, comme pour le mensuel.",
  },
];

type Billing = 'monthly' | 'yearly';

const TRUST_ICONS = {
  'donnees-chiffrees': LockIcon,
  'ia-supervisee': CheckIcon,
  'sans-engagement': CrossIcon,
} as const;

export function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <>
      <Seo
        title="Tarifs"
        description="Sept formules ClairDossier, de l'indépendant à l'entreprise : Essentiel, Entrepreneur, Business PME 20/50, Pro, Premium et offre sur-mesure. Compte gratuit, sans engagement. −10 % en annuel."
        path="/tarifs"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Tarifs', path: '/tarifs' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ClairDossier',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Plateforme de gestion de dossiers administratifs et juridiques pour PME, artisans, indépendants et professions libérales.',
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'EUR',
              lowPrice: '19',
              highPrice: '299',
              offerCount: String(
                plans.filter((p) => p.priceMonthly !== null && p.priceMonthly > 0).length
              ),
              availability: 'https://schema.org/InStock',
            },
          },
        ]}
      />

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-12 sm:pt-16 lg:pt-20 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Tarifs
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl lg:text-6xl">
              Une formule par usage. Pas de surprise.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500">
              De l'indépendant à l'entreprise — sept niveaux de service couvrent tous les usages.
              Compte gratuit, abonnement sans engagement.
            </p>

            {/* Toggle Mensuel / Annuel */}
            <div
              role="group"
              aria-label="Période de facturation"
              className="mt-8 inline-flex rounded-full border hairline bg-white p-1 shadow-card"
            >
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                aria-pressed={billing === 'monthly'}
                className={`relative min-h-[40px] rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  billing === 'monthly' ? 'text-navy-900' : 'text-slate-500 hover:text-navy-900'
                }`}
              >
                {billing === 'monthly' && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 rounded-full bg-cream-100"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">Mensuel</span>
              </button>
              <button
                type="button"
                onClick={() => setBilling('yearly')}
                aria-pressed={billing === 'yearly'}
                className={`relative min-h-[40px] rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  billing === 'yearly' ? 'text-navy-900' : 'text-slate-500 hover:text-navy-900'
                }`}
              >
                {billing === 'yearly' && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 rounded-full bg-cream-100"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  Annuel
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-emerald-700">
                    −10 %
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6 plans en grille 2 colonnes (desktop) */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12">
          <Stagger inView className="grid items-stretch gap-6 sm:gap-7 lg:grid-cols-2">
            {plans.map((plan) => (
              <StaggerItem key={plan.id}>
                <PlanCard plan={plan} billing={billing} />
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

      {/* Devis sur-mesure */}
      <Reveal as="section" className="premium-tech-section bg-navy-900 text-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            {/* Left — copy + capabilities */}
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
                Devis sur-mesure
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl lg:text-5xl">
                Au-delà du plan Premium ?
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-cream-50/75">
                Pour les structures avec exigences de marque blanche, intégration API,
                conformité interne ou volumétrie au-dessus du Premium, on construit une offre
                sur-mesure avec proposition chiffrée sous 48 h.
              </p>

              <ul className="mt-9 grid gap-4 sm:grid-cols-2">
                {DEVIS_CAPABILITIES.map((cap) => (
                  <li key={cap.title} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500"
                    />
                    <div>
                      <h3 className="font-display text-lg font-semibold leading-tight text-cream-50">
                        {cap.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-cream-50/70">{cap.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — contact card */}
            <div className="rounded-2xl border border-cream-50/15 bg-navy-800/60 p-7 backdrop-blur sm:p-9">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
                Trois chemins pour démarrer
              </p>
              <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-cream-50 sm:text-3xl">
                Décrivez votre besoin, on chiffre.
              </h3>

              <div className="mt-8 space-y-3">
                {/* WhatsApp */}
                <a
                  href={buildWhatsAppUrl(
                    "Bonjour ClairDossier, je souhaite un devis sur-mesure (marque blanche / API / SSO / autre). Pouvons-nous échanger ?"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-4 rounded-xl border border-cream-50/15 bg-cream-50/5 p-5 transition-colors hover:border-cream-50/35 hover:bg-cream-50/10"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#25D366]/15 text-[#25D366]">
                      <WhatsAppIcon width={22} height={22} />
                    </span>
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-cream-50/70">
                        WhatsApp · réponse sous 1 h
                      </p>
                      <p className="mt-0.5 font-medium text-cream-50">{WHATSAPP_DISPLAY}</p>
                    </div>
                  </div>
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    strokeWidth={2}
                    className="text-cream-50/70 transition-transform group-hover:translate-x-0.5"
                  />
                </a>

                {/* Email */}
                <a
                  href="mailto:contact.clairdossier@icloud.com?subject=Demande%20de%20devis%20sur-mesure&body=Bonjour%2C%0A%0AJe%20souhaite%20un%20devis%20sur-mesure%20pour%20%3A%0A-%20Marque%20blanche%20%3F%0A-%20API%20%2F%20int%C3%A9gration%20%3F%0A-%20SSO%20%2F%20audit%20%3F%0A-%20Volum%C3%A9trie%20attendue%20%3A%0A%0AMerci."
                  className="group flex items-center justify-between gap-4 rounded-xl border border-cream-50/15 bg-cream-50/5 p-5 transition-colors hover:border-cream-50/35 hover:bg-cream-50/10"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gold-500/15 text-gold-500">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 7 9-7" />
                      </svg>
                    </span>
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-cream-50/70">
                        Email · réponse sous 24 h ouvrées
                      </p>
                      <p className="mt-0.5 font-medium text-cream-50">contact.clairdossier@icloud.com</p>
                    </div>
                  </div>
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    strokeWidth={2}
                    className="text-cream-50/70 transition-transform group-hover:translate-x-0.5"
                  />
                </a>

                {/* Form */}
                <Link
                  to="/contact?topic=commercial"
                  className="group flex items-center justify-between gap-4 rounded-xl border border-cream-50/15 bg-cream-50/5 p-5 transition-colors hover:border-cream-50/35 hover:bg-cream-50/10"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cream-50/10 text-cream-50">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="7" y1="9" x2="17" y2="9" />
                        <line x1="7" y1="13" x2="17" y2="13" />
                        <line x1="7" y1="17" x2="12" y2="17" />
                      </svg>
                    </span>
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-cream-50/70">
                        Formulaire détaillé
                      </p>
                      <p className="mt-0.5 font-medium text-cream-50">Décrire le contexte complet</p>
                    </div>
                  </div>
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    strokeWidth={2}
                    className="text-cream-50/70 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>

              <p className="mt-7 border-t border-cream-50/15 pt-5 text-xs leading-relaxed text-cream-50/70">
                Engagement ClairDossier : proposition chiffrée écrite sous 48 h ouvrées, sans
                ré-engagement après échange initial. Vos données restent en France.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* FAQ tarifs */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
          <div className="text-center">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
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
      <Reveal as="section" className="premium-tech-section bg-navy-900 text-cream-50">
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
              to="/inscription"
              className="inline-flex items-center gap-2 rounded-full border border-cream-50/20 px-6 py-3.5 text-sm font-medium text-cream-50 hover:border-cream-50/50"
            >
              Créer un compte gratuit
            </Link>
          </div>
        </div>
      </Reveal>
    </>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const isDark = plan.variant === 'dark';
  const isYearly = billing === 'yearly';

  const cardBase = 'relative flex h-full flex-col rounded-2xl border p-7 transition-colors duration-300 sm:p-8';
  const cardSkin = isDark
    ? 'border-navy-900 bg-navy-900 text-cream-50'
    : 'hairline bg-white text-navy-900 shadow-card';
  const eyebrow = isDark ? 'text-cream-50/60' : 'text-slate-500';
  const description = isDark ? 'text-cream-50/75' : 'text-slate-500';
  const hairlineClass = isDark ? 'border-cream-50/15' : 'border-[rgba(13,27,61,0.08)]';
  const specsLabel = isDark ? 'text-cream-50/90' : 'text-navy-900';
  const featureMuted = isDark ? 'text-cream-50/60' : 'text-slate-300';
  const featureOn = isDark ? 'text-cream-50' : 'text-navy-900';
  const ctaClass = isDark
    ? 'border border-cream-50/25 bg-transparent text-cream-50 hover:border-cream-50/55 hover:bg-cream-50/5'
    : 'border hairline bg-white text-navy-900 hover:border-navy-900 hover:bg-cream-100/60';

  return (
    <article className={`premium-card ${isDark ? 'premium-recommended-plan' : ''} ${cardBase} ${cardSkin}`}>
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
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-semibold leading-none">
                {formatEuro(isYearly ? yearlyMonthlyEquivalent(plan.priceMonthly) : plan.priceMonthly)}
              </span>
              <span className={`text-sm ${description}`}>/mois</span>
            </div>
            {isYearly && (
              <p className={`mt-2 text-xs leading-relaxed ${description}`}>
                Facturé {formatEuro(yearlyTotal(plan.priceMonthly))} par an — économie de 10 %
                sur le tarif mensuel.
              </p>
            )}
          </>
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
        to={isYearly && plan.ctaHrefYearly ? plan.ctaHrefYearly : plan.ctaHref}
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
        <span className={isDark ? 'text-cream-50/70' : 'text-slate-500'}>(limité)</span>
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
          <InfoIcon width={14} height={14} strokeWidth={2} className="text-gold-700" />
        )}
      </span>
      <span>{labelText}</span>
    </li>
  );
}
