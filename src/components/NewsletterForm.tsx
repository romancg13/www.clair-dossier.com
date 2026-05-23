import { FormEvent, useState } from 'react';
import { insertPublicRecord } from '../lib/supabase';
import { isHoneypotFilled, isValidEmail, sanitizeText } from '../lib/security';

type FormState = { type: 'idle' | 'loading' | 'success' | 'error'; message: string };

export function NewsletterForm() {
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.type === 'loading') return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (isHoneypotFilled(data)) {
      setState({ type: 'success', message: 'Votre demande a bien été enregistrée.' });
      form.reset();
      return;
    }
    const email = sanitizeText(data.get('email'), 254).toLowerCase();
    const consent = data.get('consent') === 'on';

    if (!isValidEmail(email) || !consent) {
      setState({ type: 'error', message: 'Indiquez votre email et acceptez le consentement RGPD.' });
      return;
    }

    setState({ type: 'loading', message: '' });
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
      <label className="visually-hidden" aria-hidden="true">
        <span>Site web</span>
        <input name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label>
        <span>Email</span>
        <input name="email" type="email" maxLength={254} placeholder="vous@exemple.fr" required />
      </label>
      <label className="checkbox-line">
        <input name="consent" type="checkbox" required />
        <span>J’accepte de recevoir les actualités ClairDossier et comprends pouvoir me désinscrire.</span>
      </label>
      <button className="primary-button" type="submit" disabled={state.type === 'loading'}>{state.type === 'loading' ? 'Envoi…' : 'S’inscrire'}</button>
      {state.message && <p className={`form-message ${state.type}`}>{state.message}</p>}
    </form>
  );
}
