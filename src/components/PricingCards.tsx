import { useState } from 'react';
import { plans } from '../data/site';
import { isStripeConfigured, redirectToCheckout } from '../lib/stripe';

const POPULAR_PLAN = 'business';

export function PricingCards() {
  const [message, setMessage] = useState<string>('');
  const [loadingPlan, setLoadingPlan] = useState<string>('');

  async function choosePlan(planId: string) {
    setMessage('');
    setLoadingPlan(planId);
    try {
      await redirectToCheckout(planId);
    } catch (error) {
      console.error('Paiement Stripe indisponible', error);
      setMessage(error instanceof Error ? error.message : 'Paiement bientôt disponible.');
    } finally {
      setLoadingPlan('');
    }
  }

  return (
    <>
      {!isStripeConfigured && (
        <p className="notice" style={{ marginBottom: '1.5rem' }}>
          Le paiement Stripe sera activé dès que les clés et Price IDs seront configurés côté serveur.
          En attendant, vous pouvez consulter les formules disponibles.
        </p>
      )}
      {message && <p className="form-message error centered">{message}</p>}
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.id} className={`price-card${plan.id === POPULAR_PLAN ? ' popular' : ''}`}>
            {plan.id === POPULAR_PLAN && <span className="popular-badge">Populaire</span>}
            <p className="eyebrow">{plan.audience}</p>
            <h3>{plan.name}</h3>
            <p className="price">{plan.price}</p>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <button
              className="primary-button full"
              type="button"
              onClick={() => choosePlan(plan.id)}
              disabled={loadingPlan === plan.id}
            >
              {loadingPlan === plan.id ? 'Préparation…' : plan.price === '0 €' ? 'Commencer gratuitement' : plan.price === 'Sur devis' ? 'Nous contacter' : 'Choisir cette formule'}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
