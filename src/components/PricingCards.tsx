import { useState } from 'react';
import { plans } from '../data/site';
import { redirectToCheckout } from '../lib/stripe';

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
      {message && <p className="form-message error centered">{message}</p>}
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.id} className="price-card">
            <p className="eyebrow">{plan.audience}</p>
            <h3>{plan.name}</h3>
            <p className="price">{plan.price}</p>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <button className="primary-button full" type="button" onClick={() => choosePlan(plan.id)} disabled={loadingPlan === plan.id}>
              {loadingPlan === plan.id ? 'Préparation…' : 'Choisir cette formule'}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
