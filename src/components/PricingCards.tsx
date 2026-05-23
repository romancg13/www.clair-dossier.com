import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { annualDiscountPercent, plans } from '../data/site';
import type { BillingPeriod } from '../lib/stripe';
import { CheckoutAuthRequiredError, isPlanCheckoutAvailable, redirectToCheckout } from '../lib/stripe';

const POPULAR_PLAN = 'business';

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
  if (monthlyPrice === 0) return { main: billingPeriod === 'monthly' ? '0 € / mois' : '0 € / an', detail: null };
  if (billingPeriod === 'monthly') return { main: `${formatEuro(monthlyPrice)} / mois`, detail: null };
  const yearlyPrice = monthlyPrice * 12 * (1 - annualDiscountPercent / 100);
  const monthlyEquivalent = monthlyPrice * (1 - annualDiscountPercent / 100);
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
    if (planId === 'cabinet-premium') {
      navigate('/contact');
      return;
    }
    if (!isPlanCheckoutAvailable(planId, billingPeriod)) {
      setMessage('Paiement bientôt disponible : configurez le backend Stripe et les identifiants de prix avant de lancer ce checkout.');
      return;
    }
    setLoadingPlan(planId);
    try {
      await redirectToCheckout(planId, billingPeriod);
    } catch (error) {
      console.error('Paiement Stripe indisponible', error);
      if (error instanceof CheckoutAuthRequiredError) {
        navigate('/inscription?redirect=/tarifs');
        return;
      }
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
          Annuel <span>Économisez 10 %</span>
        </button>
      </div>
      {billingPeriod === 'yearly' && <p className="notice centered">Vous bénéficiez de 10 % de réduction avec le paiement annuel.</p>}
      {message && <p className="form-message error centered">{message}</p>}
      <div className="pricing-grid">
        {plans.map((plan) => {
          const price = getDisplayedPrice(plan.monthlyPrice, billingPeriod);
          const checkoutAvailable = isPlanCheckoutAvailable(plan.id, billingPeriod);
          const isPaidPlan = plan.id !== 'discovery';
          const isQuotePlan = plan.monthlyPrice === null;
          return (
            <article key={plan.id} className={`price-card${plan.id === POPULAR_PLAN ? ' popular' : ''}`}>
              {plan.id === POPULAR_PLAN && <span className="popular-badge">Populaire</span>}
              <p className="eyebrow">{plan.audience}</p>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <p className="price">{price.main}</p>
              {price.detail && <p className="price-detail">{price.detail}</p>}
              {billingPeriod === 'yearly' && plan.monthlyPrice !== null && plan.monthlyPrice > 0 && <span className="discount-badge">Économisez 10 %</span>}
              {isPaidPlan && (
                <div className="payment-methods" aria-label="Moyens de paiement acceptés">
                  <span>Carte</span>
                  <span>Apple Pay</span>
                  <span>PayPal</span>
                </div>
              )}
              <ul>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              {isQuotePlan && <p className="payment-note">Cette formule avancée nécessite un devis personnalisé.</p>}
              <button className="primary-button full" type="button" onClick={() => choosePlan(plan.id)} disabled={loadingPlan === plan.id}>
                {loadingPlan === plan.id
                  ? 'Préparation…'
                  : plan.id === 'discovery'
                    ? 'Commencer gratuitement'
                    : isQuotePlan
                      ? 'Demander un devis'
                      : checkoutAvailable
                        ? 'Choisir cette formule'
                        : 'Paiement bientôt disponible'}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
