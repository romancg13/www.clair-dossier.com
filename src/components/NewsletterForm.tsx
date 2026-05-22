import { FormEvent, useState } from 'react';
import { insertPublicRecord } from '../lib/supabase';

type FormState = { type: 'idle' | 'success' | 'error'; message: string };

export function NewsletterForm() {
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const consent = data.get('consent') === 'on';

    if (!email || !consent) {
      setState({ type: 'error', message: 'Indiquez votre email et acceptez le consentement RGPD.' });
      return;
    }

    const result = await insertPublicRecord('newsletter_subscribers', {
      email,
      consent_given: consent,
      source: 'site_public',
    });
    setState({ type: result.ok ? 'success' : 'error', message: result.message });
    if (result.ok) form.reset();
  }

  return (
    <form className="inline-form" onSubmit={onSubmit} noValidate>
      <label>
        <span>Email</span>
        <input name="email" type="email" placeholder="vous@exemple.fr" required />
      </label>
      <label className="checkbox-line">
        <input name="consent" type="checkbox" required />
        <span>J’accepte de recevoir les actualités ClairDossier et comprends pouvoir me désinscrire.</span>
      </label>
      <button className="primary-button" type="submit">S’inscrire</button>
      {state.message && <p className={`form-message ${state.type}`}>{state.message}</p>}
    </form>
  );
}
