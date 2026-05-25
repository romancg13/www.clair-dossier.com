import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal, Stagger, StaggerItem } from '../components/primitives/Reveal';
import { Accordion } from '../components/ui/Accordion';
import {
  plans,
  addOns,
  comparisonMatrix,
  formatEuro,
  YEARLY_DISCOUNT,
  type BillingPeriod,
  type Plan,
} from '../data/pricing';
import { ArrowRightIcon, CheckIcon, CrossIcon } from '../components/icons';

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
      "Oui, à la hausse comme à la baisse. La facturation est ajustée au prorata des jours restants. Le passage Professionnel → Entreprise est immédiat ; le passage en sens inverse prend effet au début du cycle suivant pour éviter toute perte de données.",
  },
  {
    id: 'tva',
    question: "Les prix affichés sont-ils HT ou TTC ?",
    answer:
      "HT. La TVA française à 20 % s'applique pour les clients établis en France. Les clients UE B2B avec numéro de TVA intracommunautaire valide sont autoliquidés. Hors UE, sur demande.",
  },
  {
    id: 'devis',
    question: "Quand le plan Entreprise est-il pertinent ?",
    answer:
      "Au-delà de 10 utilisateurs, ou si vous avez des exigences de SSO, d'audit dédié, ou un DPA personnalisé. Notre équipe répond aux demandes de devis sous 48 heures avec une proposition chiffrée.",
  },
];

export function Pricing() {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <>
      <Seo
        title="Tarifs"
        description="Particulier gratuit, Professionnel à 49 €/mois HT, Entreprise sur devis. Paiement annuel à −15 %. Sans engagement, résiliable à tout moment."
        path="/tarifs"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Tarifs', path: '/tarifs' },
          ]),
          ...plans
            .filter((p) => p.priceMonthly !== null)
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
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-24 text-center sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Tarifs
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
            Choisissez votre formule. Changez quand vous voulez.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500">
            Particulier gratuit jusqu'à un dossier actif. Professionnel pour les cabinets jusqu'à
            cinq utilisateurs. Entreprise pour les structures qui ont besoin de SSO, d'audit
            dédié, ou d'un DPA renforcé.
          </p>

          {/* Billing toggle */}
          <div className="mx-auto mt-10 inline-flex rounded-full border hairline bg-white p-1 shadow-card">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
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
              className={`relative inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
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
              <span className="relative z-10">
                Annuel
                <span className="ml-2 inline-flex items-center rounded-full bg-gold-500/15 px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-gold-500">
                  −15 %
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans grid */}
      <section className="bg-cream-50 pb-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <Stagger inView className="grid items-stretch gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <StaggerItem key={plan.id}>
                <PlanCard plan={plan} billing={billing} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Matrice comparative */}
      <Reveal as="section" className="border-y hairline bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Comparatif
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
              Matrice détaillée des fonctionnalités.
            </h2>
          </div>

          {/* Scroll horizontal sur mobile avec fade aux bords */}
          <div className="relative mt-10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b hairline-strong">
                    <th className="py-4 pr-4 text-left font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-slate-400">
                      Fonctionnalité
                    </th>
                    <th className="py-4 px-3 text-left font-display text-base font-semibold text-navy-900">
                      Particulier
                    </th>
                    <th className="py-4 px-3 text-left font-display text-base font-semibold text-navy-900">
                      Professionnel
                    </th>
                    <th className="py-4 px-3 text-left font-display text-base font-semibold text-navy-900">
                      Entreprise
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y hairline">
                  {comparisonMatrix.map((row) => (
                    <tr key={row.feature}>
                      <th className="py-4 pr-4 text-left text-sm font-medium text-navy-900">
                        {row.feature}
                      </th>
                      <MatrixCell value={row.particulier} />
                      <MatrixCell value={row.professionnel} />
                      <MatrixCell value={row.entreprise} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Add-ons */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Add-ons
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
              Trois services qui s'ajoutent quand le besoin se présente.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {addOns.map((a) => (
              <article
                key={a.id}
                className="flex h-full flex-col rounded-2xl border hairline bg-white p-7"
              >
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                  Option
                </p>
                <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-navy-900">
                  {a.name}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">{a.blurb}</p>
                <p className="mt-5 font-mono text-sm text-navy-900">{a.pricing}</p>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      {/* FAQ tarifs */}
      <Reveal as="section" className="border-t hairline bg-cream-100/40">
        <div className="mx-auto max-w-4xl px-5 py-24 sm:px-8 lg:px-12">
          <div className="text-center">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Questions tarifs
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
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

      {/* CTA */}
      <Reveal as="section" className="bg-navy-900 text-cream-50">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 lg:px-12">
          <h2 className="font-display text-4xl font-semibold leading-tight text-cream-50 sm:text-5xl">
            Une dernière question avant de signer ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-cream-50/75">
            Notre équipe répond aux questions tarifs sous 24 h ouvrées. Démo possible la
            même semaine.
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

function PlanCard({ plan, billing }: { plan: Plan; billing: BillingPeriod }) {
  const isPopular = Boolean(plan.popular);
  const displayPrice =
    plan.priceMonthly === null
      ? null
      : billing === 'yearly' && plan.priceMonthly > 0
      ? plan.priceMonthly * (1 - YEARLY_DISCOUNT)
      : plan.priceMonthly;

  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl border p-7 transition-colors duration-300 sm:p-8 ${
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
      <p className="mt-3 text-sm leading-relaxed text-slate-500">{plan.description}</p>

      <div className="mt-7">
        {displayPrice === null ? (
          <p className="font-display text-4xl font-semibold text-navy-900">Sur devis</p>
        ) : displayPrice === 0 ? (
          <p className="font-display text-4xl font-semibold text-navy-900">Gratuit</p>
        ) : (
          <>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={billing}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex items-baseline gap-2"
              >
                <span className="font-display text-4xl font-semibold text-navy-900">
                  {formatEuro(Math.round(displayPrice))}
                </span>
                <span className="text-sm text-slate-500">/ mois HT</span>
              </motion.div>
            </AnimatePresence>
            {billing === 'yearly' && (
              <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-gold-500">
                Soit {formatEuro(Math.round(displayPrice * 12))} / an HT · économie 15 %
              </p>
            )}
          </>
        )}
      </div>

      <ul className="mt-7 flex-1 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5 text-sm text-navy-900">
            <CheckIcon width={14} height={14} strokeWidth={2.2} className="mt-1 shrink-0 text-gold-500" />
            <span className="leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        to={plan.ctaHref}
        className={`mt-8 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 ${
          isPopular
            ? 'sheen bg-gold-500 text-navy-900 shadow-gold hover:-translate-y-0.5'
            : 'bg-navy-900 text-cream-50 hover:bg-navy-800'
        }`}
      >
        {plan.ctaLabel}
        <ArrowRightIcon width={14} height={14} strokeWidth={2} />
      </Link>
    </article>
  );
}

function MatrixCell({ value }: { value: boolean | string }) {
  return (
    <td className="py-4 px-3 text-sm">
      {value === true ? (
        <CheckIcon width={16} height={16} strokeWidth={2.2} className="text-gold-500" />
      ) : value === false ? (
        <CrossIcon width={16} height={16} className="text-slate-300" />
      ) : (
        <span className="text-navy-900">{value}</span>
      )}
    </td>
  );
}
