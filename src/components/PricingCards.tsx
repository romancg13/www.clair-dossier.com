import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { plans } from '../data/site';
import type { BillingPeriod } from '../lib/stripe';
import { isPlanCheckoutAvailable, redirectToCheckout } from '../lib/stripe';

const POPULAR_PLAN = 'business';
const yearlyDiscountPercent = 15;

function formatEuro(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getDisplayedPrice(monthlyPrice: number | null, billingPeriod: BillingPeriod) {
  if (monthlyPrice === null) return { main: 'Sur devis', detail: 'Abonnement personnalisé' };
  if (billingPeriod === 'monthly') return { main: `${formatEuro(monthlyPrice)} / mois`, detail: null };
  const yearlyPrice = monthlyPrice * 12 * (1 - yearlyDiscountPercent / 100);
  const monthlyEquivalent = monthlyPrice * (1 - yearlyDiscountPercent / 100);
  return {
    main: `${formatEuro(yearlyPrice)} / an`,
    detail: `${formatEuro(monthlyEquivalent)} / mois équivalent`,
  };
}

export function PricingCards() {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [message, setMessage] = useState<string>('');
  const [loadingPlan, setLoadingPlan] = useState<string>('');

  async function choosePlan(planId: string) {
    setMessage('');
    if (planId === 'discovery') {
      navigate('/creer-dossier');
      return;
    }
    setLoadingPlan(planId);
    try {
      await redirectToCheckout(planId, billingPeriod);
    } catch (error) {
      console.error('Paiement Stripe indisponible', error);
      setMessage(error instanceof Error ? error.message : 'Le paiement sera disponible après configuration Stripe.');
    } finally {
      setLoadingPlan('');
    }
  }

  return (
    <>
      <div className="billing-toggle" aria-label="Choix de périodicité">
        <button className={billingPeriod === 'monthly' ? 'active' : ''} type="button" onClick={() => setBillingPeriod('monthly')}>Mensuel</button>
        <button className={billingPeriod === 'yearly' ? 'active' : ''} type="button" onClick={() => setBillingPeriod('yearly')}>
          Annuel <span>Économisez 15 %</span>
        </button>
      </div>
      {billingPeriod === 'yearly' && <p className="notice centered">Vous bénéficiez de 15 % de réduction avec le paiement annuel.</p>}
      {message && <p className="form-message error centered">{message}</p>}
      <div className="pricing-grid">
        {plans.map((plan) => {
          const price = getDisplayedPrice(plan.monthlyPrice, billingPeriod);
          const checkoutAvailable = isPlanCheckoutAvailable(plan.id, billingPeriod);
          const isPaidPlan = plan.id !== 'discovery';
          return (
            <article key={plan.id} className={`price-card${plan.id === POPULAR_PLAN ? ' popular' : ''}`}>
              {plan.id === POPULAR_PLAN && <span className="popular-badge">Populaire</span>}
              <p className="eyebrow">{plan.audience}</p>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <p className="price">{price.main}</p>
              {price.detail && <p className="price-detail">{price.detail}</p>}
              {billingPeriod === 'yearly' && plan.monthlyPrice !== null && plan.monthlyPrice > 0 && <span className="discount-badge">Économisez 15 %</span>}
              <ul>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              {isPaidPlan && !checkoutAvailable && <p className="payment-note">Le paiement sera activé dès que Stripe sera configuré.</p>}
              <button className="primary-button full" type="button" onClick={() => choosePlan(plan.id)} disabled={loadingPlan === plan.id || (isPaidPlan && !checkoutAvailable)}>
                {loadingPlan === plan.id ? 'Préparation…' : plan.id === 'discovery' ? 'Commencer gratuitement' : 'Choisir cette formule'}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
