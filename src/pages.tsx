import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { NewsletterForm } from './components/NewsletterForm';
import { PricingCards } from './components/PricingCards';
import { Seo } from './components/Seo';
import { blogPosts, categories, caseStatuses, featureCards, infoPages, legalPages, plans, site, warnings } from './data/site';
import { insertPublicRecord, supabase, supabaseConfigurationMessage } from './lib/supabase';
import { getSafeRedirect, isHoneypotFilled, isValidEmail, sanitizeText, validatePassword } from './lib/security';
import { redirectToCustomerPortal } from './lib/stripe';
import type { PublicFormTable } from './lib/security';
import type { AuthError } from '@supabase/supabase-js';

type FormState = { type: 'idle' | 'loading' | 'success' | 'error'; message: string };

type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number' | 'datetime-local';
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

type CaseRow = {
  id: string;
  title: string;
  status: string;
  legal_domain: string | null;
  urgency: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  case_id: string | null;
};

type SubscriptionRow = {
  plan_id: string;
  billing_period: 'monthly' | 'yearly';
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  amount_total: number | null;
  currency: string | null;
  status: string;
  created_at: string;
};

function formatPlanPreviewPrice(monthlyPrice: number | null) {
  if (monthlyPrice === null) return 'Sur devis';
  if (monthlyPrice === 0) return '0 €';
  return `${monthlyPrice} € / mois`;
}

export function HomePage() {
  return (
    <>
      <Seo title="ClairDossier - LegalTech pour dossiers juridiques" description="ClairDossier structure les dossiers juridiques, facilite le suivi client-avocat et prépare une base SaaS LegalTech sécurisée." />
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">LegalTech pour clients, PME et cabinets</p>
          <h1>{site.slogan}</h1>
          <p className="lead">Transformez les demandes juridiques en dossiers lisibles, suivis et prêts à être validés par un professionnel habilité.</p>
          <div className="hero-actions">
            <Link className="primary-button" to="/creer-dossier">Créer un dossier</Link>
            <Link className="secondary-button" to="/demo">Demander une démo</Link>
          </div>
          <div className="metrics-row">
            <span><strong>6</strong> statuts dossier</span>
            <span><strong>3</strong> espaces dédiés</span>
            <span><strong>100%</strong> liens footer actifs</span>
          </div>
        </div>
        <div className="hero-panel" aria-label="Aperçu dossier ClairDossier">
          <span className="status-pill">En attente validation avocat</span>
          <h2>Dossier prud'homal - synthèse</h2>
          <ul className="timeline-list">
            <li>Chronologie client complétée</li>
            <li>4 documents à vérifier</li>
            <li>Question IA préparatoire générée</li>
            <li>Validation professionnelle requise</li>
          </ul>
        </div>
      </section>

      <section className="section-block">
        <p className="eyebrow">Fonctionnalités</p>
        <h2>Une structure claire pour chaque acteur du dossier</h2>
        <div className="card-grid">
          {featureCards.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <p className="eyebrow">Tarifs</p>
        <h2>Des formules pour chaque profil</h2>
        <div className="card-grid">
          {plans.slice(0, 4).map((plan) => (
            <article className="feature-card" key={plan.id}>
              <h3>{plan.name} — {formatPlanPreviewPrice(plan.monthlyPrice)}</h3>
              <p>{plan.audience}</p>
              <Link className="text-link" to="/tarifs">Voir les détails</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section">
        <div>
          <p className="eyebrow">SEO / GEO</p>
          <h2>Des contenus utiles aux utilisateurs et compréhensibles par les moteurs IA</h2>
          <p>Le blog combine définitions courtes, FAQ, sections à retenir, maillage interne et avertissement juridique afin de rester utile sans promettre de conseil personnalisé automatisé.</p>
          <Link className="text-link" to="/blog">Lire le blog juridique</Link>
        </div>
        <div className="newsletter-card">
          <h3>Recevoir les ressources ClairDossier</h3>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}

export function InfoPage({ pageKey }: { pageKey: keyof typeof infoPages }) {
  const page = infoPages[pageKey];
  return (
    <>
      <Seo title={page.title} description={page.description} path={`/${pageKey}`} />
      <PageHero title={page.title} description={page.description} />
      <section className="section-block grid-two">
        {page.sections.map((section) => (
          <article className="feature-card" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function LegalPage({ pageKey }: { pageKey: keyof typeof legalPages }) {
  const page = legalPages[pageKey];
  return (
    <>
      <Seo title={page.title} description={page.description} path={`/${pageKey}`} />
      <PageHero title={page.title} description={page.description} />
      <section className="legal-layout">
        {page.sections.map((section) => (
          <article key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
        {pageKey === 'cookies' && (
          <button className="secondary-button" type="button" onClick={() => {
            try { localStorage.removeItem('cd_cookie_consent'); } catch { /* noop */ }
            window.alert('Préférence cookies réinitialisée. Rechargez la page pour voir la bannière de consentement.');
          }}>
            Gérer mes préférences cookies
          </button>
        )}
      </section>
    </>
  );
}

export function PricingPage() {
  return (
    <>
      <Seo title="Tarifs" description="Formules ClairDossier pour particuliers, PME et cabinets d'avocats avec Stripe Checkout sécurisé." path="/tarifs" />
      <PageHero title="Tarifs" description="Choisissez une formule adaptée à votre profil. Les abonnements mensuels et annuels sont gérés via Stripe Checkout sécurisé." />
      <PricingCards />
    </>
  );
}

export function ContactPage() {
  return (
    <>
      <Seo title="Contact" description="Contacter ClairDossier pour une question, un partenariat ou une demande LegalTech." path="/contact" />
      <FormPage
        title="Contacter ClairDossier"
        description="Votre demande sera transmise de façon sécurisée lorsque Supabase est configuré."
        table="contact_requests"
        fields={[
          { name: 'name', label: 'Nom', required: true, placeholder: 'Votre nom complet' },
          { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'vous@exemple.fr' },
          { name: 'phone', label: 'Téléphone', type: 'tel', placeholder: '+33 6 00 00 00 00' },
          { name: 'request_type', label: 'Type de demande', type: 'select', required: true, options: ['Particulier', 'PME', 'Avocat', 'Cabinet', 'Partenariat', 'Support'] },
          { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Décrivez votre demande...' },
        ]}
        consentLabel="J'accepte que ClairDossier traite ma demande conformément à la politique de confidentialité."
      />
    </>
  );
}

export function DemoPage() {
  return (
    <>
      <Seo title="Demander une démo" description="Planifier une démo ClairDossier pour cabinet, entreprise ou équipe juridique." path="/demo" />
      <FormPage
        title="Demander une démo"
        description="Présentez votre structure et le créneau souhaité."
        table="demo_requests"
        fields={[
          { name: 'name', label: 'Nom', required: true, placeholder: 'Votre nom complet' },
          { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'vous@exemple.fr' },
          { name: 'organization', label: 'Cabinet ou entreprise', required: true, placeholder: 'Nom de votre structure' },
          { name: 'users_count', label: "Nombre d'utilisateurs", type: 'number', required: true, placeholder: '5' },
          { name: 'preferred_slot', label: 'Créneau souhaité', type: 'datetime-local', required: true },
          { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Questions ou précisions...' },
        ]}
        consentLabel="J'accepte d'être recontacté au sujet de la démo."
      />
    </>
  );
}

export function CreateCasePage() {
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });
  const [createdCaseId, setCreatedCaseId] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.type === 'loading') return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const required = ['client_type', 'legal_domain', 'problem_description', 'urgency'];
    const missing = required.some((key) => !sanitizeText(data.get(key), 2000));
    const accepted = data.get('terms_accepted') === 'on';
    if (missing || !accepted) {
      setState({ type: 'error', message: 'Complétez les champs obligatoires et acceptez les conditions.' });
      setCreatedCaseId('');
      return;
    }
    const problemDescription = sanitizeText(data.get('problem_description'), 3000);
    const documentsAvailable = sanitizeText(data.get('documents_available'), 1200);
    if (problemDescription.length < 20) {
      setState({ type: 'error', message: 'Décrivez votre situation en quelques phrases avant de créer le dossier.' });
      setCreatedCaseId('');
      return;
    }
    if (!supabase) {
      setState({ type: 'error', message: 'Créez votre compte pour commencer votre dossier.' });
      setCreatedCaseId('');
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('Session Supabase absente pour création dossier', userError);
      setState({ type: 'error', message: 'Créez votre compte pour commencer votre dossier.' });
      setCreatedCaseId('');
      return;
    }

    setState({ type: 'loading', message: '' });

    const caseId = crypto.randomUUID();
    const { error: caseError } = await supabase.from('cases').insert({
      id: caseId,
      created_by: userData.user.id,
      title: `Dossier ${sanitizeText(data.get('legal_domain'), 80)}`,
      client_type: sanitizeText(data.get('client_type'), 80),
      legal_domain: sanitizeText(data.get('legal_domain'), 80),
      description: problemDescription,
      urgency: sanitizeText(data.get('urgency'), 80),
      status: 'reçu',
      terms_accepted: accepted,
    });

    if (caseError) {
      console.error('Erreur Supabase (cases)', caseError);
      setState({ type: 'error', message: getCasePersistenceMessage(caseError) });
      setCreatedCaseId('');
      return;
    }

    const { error: answerError } = await supabase.from('case_intake_answers').insert({
      case_id: caseId,
      answers: {
        client_type: sanitizeText(data.get('client_type'), 80),
        legal_domain: sanitizeText(data.get('legal_domain'), 80),
        problem_description: problemDescription,
        urgency: sanitizeText(data.get('urgency'), 80),
        documents_available: documentsAvailable,
      },
      consent_given: accepted,
    });
    if (answerError) {
      console.error('Erreur Supabase (case_intake_answers)', answerError);
      setState({ type: 'error', message: getCasePersistenceMessage(answerError) });
      setCreatedCaseId('');
      return;
    }

    setCreatedCaseId(caseId);
    setState({ type: 'success', message: 'Votre dossier a été créé. Vous pouvez maintenant suivre son avancement.' });
    form.reset();
  }

  return (
    <>
      <Seo title="Créer un dossier" description="Créer un premier dossier juridique structuré dans ClairDossier." path="/creer-dossier" />
      <PageHero title="Créer un dossier" description="Décrivez votre situation. Le dossier sera ensuite à compléter et à faire valider par un professionnel habilité." />
      <section className="form-shell">
        <form className="stacked-form" onSubmit={onSubmit} noValidate>
          <SelectField name="client_type" label="Type de client" options={['Particulier', 'PME', 'Association', 'Cabinet']} required />
          <SelectField name="legal_domain" label="Domaine juridique" options={['Droit du travail', 'Recouvrement', 'Bail et immobilier', 'Contrats', 'Droit des sociétés', 'RGPD', 'Autre']} required />
          <label><span>Description du problème *</span><textarea name="problem_description" required rows={6} maxLength={3000} placeholder="Décrivez les faits, le contexte et les documents disponibles..." /></label>
          <SelectField name="urgency" label="Urgence" options={['Faible', 'Normale', 'Élevée', 'Délai judiciaire proche']} required />
          <label><span>Documents disponibles</span><textarea name="documents_available" rows={4} maxLength={1200} placeholder="Contrat, emails, facture, courrier..." /></label>
          <p className="notice mini">Les informations transmises servent à préparer votre dossier. Aucun conseil juridique personnalisé n’est fourni sans validation par un professionnel habilité.</p>
          <label className="checkbox-line"><input name="terms_accepted" type="checkbox" required /><span>J'accepte les <Link to="/conditions-utilisation">conditions d'utilisation</Link> et comprends que l'IA ne remplace pas l'avocat.</span></label>
          <button className="primary-button" type="submit" disabled={state.type === 'loading'}>{state.type === 'loading' ? 'Envoi en cours…' : 'Créer le dossier'}</button>
          {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
          {createdCaseId && <Link className="text-link" to={`/dossier/${createdCaseId}`}>Ouvrir le dossier créé</Link>}
        </form>
        <StatusPanel />
      </section>
    </>
  );
}

export function BlogIndexPage() {
  const published = blogPosts.filter((post) => post.status === 'publié');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog juridique ClairDossier',
    url: `${site.url}/blog`,
  };
  return (
    <>
      <Seo title="Blog juridique" description="Articles SEO/GEO sur dossiers juridiques, RGPD, IA et pratiques LegalTech." path="/blog" jsonLd={jsonLd} />
      <PageHero title="Blog juridique" description="Contenus informatifs, structurés pour les lecteurs non juristes et les moteurs de recherche génératifs." />
      <p className="notice">Les contenus du blog sont informatifs et ne constituent pas un conseil juridique personnalisé.</p>
      <section className="category-row">
        {categories.map((category) => <Link key={category.slug} to={`/blog/categorie/${category.slug}`}>{category.name}</Link>)}
      </section>
      <section className="blog-grid">
        {published.map((post) => <BlogCard key={post.slug} post={post} />)}
      </section>
    </>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const post = blogPosts.find((candidate) => candidate.slug === slug && candidate.status === 'publié');
  if (!post) return <NotFoundPage />;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.summary,
      author: { '@type': 'Organization', name: post.author },
      datePublished: post.date,
      mainEntityOfPage: `${site.url}/blog/${post.slug}`,
      keywords: post.keywords.join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
  return (
    <>
      <Seo title={post.metaTitle} description={post.metaDescription} path={`/blog/${post.slug}`} type="article" jsonLd={jsonLd} />
      <article className="article-page">
        <Link className="text-link" to="/blog">← Retour au blog</Link>
        <p className="eyebrow">{post.category} · {new Date(post.date).toLocaleDateString('fr-FR')}</p>
        <h1>{post.title}</h1>
        <p className="lead">{post.summary}</p>
        <div className="takeaways"><h2>À retenir</h2><ul>{post.takeaways.map((item) => <li key={item}>{item}</li>)}</ul></div>
        {post.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div className="info-table" role="table" aria-label="Résumé GEO">
          <div role="row"><strong role="cell">Question</strong><span role="cell">Réponse courte</span></div>
          <div role="row"><strong role="cell">Pour qui ?</strong><span role="cell">Clients, PME, avocats et cabinets.</span></div>
          <div role="row"><strong role="cell">Limite</strong><span role="cell">Aucun conseil personnalisé sans validation professionnelle.</span></div>
        </div>
        <section className="faq-section"><h2>FAQ</h2>{post.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>
        <section className="internal-links"><h2>Liens utiles</h2>{post.internalLinks.map((link) => <Link key={link.path} to={link.path}>{link.label}</Link>)}</section>
        <p className="notice">Les contenus du blog sont informatifs et ne constituent pas un conseil juridique personnalisé.</p>
      </article>
    </>
  );
}

export function BlogCategoryPage() {
  const { slug } = useParams();
  const category = categories.find((candidate) => candidate.slug === slug);
  if (!category) return <NotFoundPage />;
  const posts = blogPosts.filter((post) => post.category === category.name && post.status === 'publié');
  return (
    <>
      <Seo title={`Blog ${category.name}`} description={`Articles ClairDossier sur ${category.name}.`} path={`/blog/categorie/${category.slug}`} />
      <PageHero title={category.name} description="Articles informatifs avec définitions, FAQ et maillage interne." />
      {posts.length > 0 ? (
        <section className="blog-grid">{posts.map((post) => <BlogCard key={post.slug} post={post} />)}</section>
      ) : (
        <section className="section-block centered">
          <p>Aucun article publié dans cette catégorie pour le moment.</p>
          <Link className="text-link" to="/blog">Voir tous les articles</Link>
        </section>
      )}
    </>
  );
}

export function AuthPage({ mode }: { mode: 'connexion' | 'inscription' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === 'inscription';
  const rawRedirect = new URLSearchParams(location.search).get('redirect');
  const redirectTo = getSafeRedirect(rawRedirect, '/dashboard');
  const redirectQuery = rawRedirect ? `?redirect=${encodeURIComponent(redirectTo)}` : '';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.type === 'loading') return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = sanitizeText(data.get('email'), 254).toLowerCase();
    const password = String(data.get('password') || '');
    const passwordConfirm = String(data.get('password_confirm') || '');
    if (!email || !password) {
      setState({ type: 'error', message: 'Email et mot de passe sont obligatoires.' });
      return;
    }
    if (!isValidEmail(email)) {
      setState({ type: 'error', message: 'Adresse email invalide.' });
      return;
    }
    const passwordError = isSignup ? validatePassword(password) : '';
    if (passwordError) {
      setState({ type: 'error', message: passwordError });
      return;
    }
    if (isSignup && password !== passwordConfirm) {
      setState({ type: 'error', message: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (isSignup && data.get('terms_accepted') !== 'on') {
      setState({ type: 'error', message: 'Vous devez accepter les conditions pour créer un compte.' });
      return;
    }
    const fullName = sanitizeText(data.get('full_name'), 120);
    const accountType = sanitizeText(data.get('account_type'), 40);
    if (isSignup && (!fullName || !accountType)) {
      setState({ type: 'error', message: 'Complétez les informations de compte obligatoires.' });
      return;
    }
    if (!supabase) {
      setState({ type: 'error', message: supabaseConfigurationMessage });
      return;
    }
    setState({ type: 'loading', message: '' });
    const response = isSignup
      ? await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
          data: {
            full_name: fullName,
            account_type: accountType,
          },
        },
      })
      : await supabase.auth.signInWithPassword({ email, password });
    if (response.error) {
      console.error('Erreur auth Supabase', response.error);
      setState({ type: 'error', message: getAuthErrorMessage(response.error, isSignup) });
      return;
    }
    if (isSignup && response.data.user?.identities && response.data.user.identities.length === 0) {
      setState({ type: 'error', message: "Un compte existe déjà avec cet email. Connectez-vous ou utilisez la réinitialisation du mot de passe." });
      return;
    }
    if (response.data.session) {
      setState({ type: 'success', message: isSignup ? 'Votre compte a été créé avec succès.' : 'Connexion réussie.' });
      navigate(redirectTo, { replace: true });
      return;
    }
    setState({ type: 'success', message: 'Votre compte a été créé avec succès. Confirmez votre email pour continuer.' });
  }

  return (
    <>
      <Seo title={isSignup ? 'Inscription' : 'Connexion'} description="Accéder à votre espace ClairDossier." path={`/${mode}`} />
      <PageHero title={isSignup ? 'Créer un compte' : 'Connexion'} description={rawRedirect === '/creer-dossier' ? 'Créez votre compte pour commencer votre dossier.' : 'Accédez à votre espace sécurisé avec une session Supabase persistante.'} />
      <section className="form-shell single">
        <form className="stacked-form" onSubmit={onSubmit} noValidate>
          {isSignup && <label><span>Nom complet</span><input name="full_name" type="text" autoComplete="name" maxLength={120} required placeholder="Votre nom complet" /></label>}
          <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="vous@exemple.fr" /></label>
          <label>
            <span>Mot de passe</span>
            <div className="password-wrapper">
              <input name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 12 : 1} required placeholder={isSignup ? 'Minimum 12 caractères' : 'Votre mot de passe'} />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </label>
          {isSignup && <label><span>Confirmation du mot de passe</span><input name="password_confirm" type="password" autoComplete="new-password" minLength={12} required placeholder="Répétez le mot de passe" /></label>}
          {isSignup && <SelectField name="account_type" label="Type de compte" options={['client_particulier', 'client_entreprise']} required />}
          {isSignup && <p className="notice mini">Les accès avocat et cabinet sont attribués après vérification par l'administration.</p>}
          {isSignup && <label className="checkbox-line"><input name="terms_accepted" type="checkbox" required /><span>J'accepte les <Link to="/conditions-utilisation">conditions d'utilisation</Link> et la <Link to="/politique-confidentialite">politique de confidentialité</Link>.</span></label>}
          <button className="primary-button" type="submit" disabled={state.type === 'loading'}>
            {state.type === 'loading' ? (isSignup ? 'Création du compte…' : 'Connexion…') : isSignup ? 'Créer un compte' : 'Me connecter'}
          </button>
          {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
          <Link className="text-link" to={`${isSignup ? '/connexion' : '/inscription'}${redirectQuery}`}>{isSignup ? "J'ai déjà un compte" : 'Créer un compte'}</Link>
        </form>
      </section>
    </>
  );
}

export function WorkspacePage({ title, audience }: { title: string; audience: 'client' | 'cabinet' }) {
  const isClient = audience === 'client';
  const [privateData, setPrivateData] = useState<{
    loading: boolean;
    message: string;
    cases: CaseRow[];
    documents: DocumentRow[];
    subscription: SubscriptionRow | null;
    payments: PaymentRow[];
  }>({ loading: true, message: '', cases: [], documents: [], subscription: null, payments: [] });
  const [portalState, setPortalState] = useState<FormState>({ type: 'idle', message: '' });

  useEffect(() => {
    let isMounted = true;
    async function loadPrivateData() {
      if (!supabase) {
        setPrivateData({ loading: false, message: 'Configuration Supabase manquante.', cases: [], documents: [], subscription: null, payments: [] });
        return;
      }

      const [casesResult, documentsResult, subscriptionResult, paymentsResult] = await Promise.all([
        supabase.from('cases').select('id,title,status,legal_domain,urgency,created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('documents').select('id,file_name,status,created_at,case_id').order('created_at', { ascending: false }).limit(10),
        supabase.from('subscriptions').select('plan_id,billing_period,status,current_period_end,cancel_at_period_end,stripe_customer_id,updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('payments').select('id,amount_total,currency,status,created_at').order('created_at', { ascending: false }).limit(5),
      ]);
      if (!isMounted) return;
      const errors = [casesResult.error, documentsResult.error, subscriptionResult.error, paymentsResult.error].filter(Boolean);
      errors.forEach((error) => console.error('Erreur chargement espace privé', error));
      setPrivateData({
        loading: false,
        message: errors.length ? 'Certaines données privées n’ont pas pu être chargées.' : '',
        cases: (casesResult.data || []) as CaseRow[],
        documents: (documentsResult.data || []) as DocumentRow[],
        subscription: (subscriptionResult.data || null) as SubscriptionRow | null,
        payments: (paymentsResult.data || []) as PaymentRow[],
      });
    }

    void loadPrivateData();
    return () => { isMounted = false; };
  }, [audience]);

  async function openCustomerPortal() {
    setPortalState({ type: 'loading', message: '' });
    try {
      await redirectToCustomerPortal();
    } catch (error) {
      console.error('Portail Stripe indisponible', error);
      setPortalState({ type: 'error', message: error instanceof Error ? error.message : 'Portail client indisponible temporairement.' });
    }
  }

  const subscriptionLabel = privateData.subscription ? formatSubscriptionStatus(privateData.subscription.status) : 'Aucun';
  const activeCases = privateData.cases.filter((caseItem) => caseItem.status !== 'clôturé').length;

  return (
    <>
      <Seo title={title} description={`Espace ${audience} ClairDossier connecté aux données privées Supabase protégées par RLS.`} />
      <PageHero title={title} description={`Page privée ${audience} alimentée par vos dossiers, documents, paiements et abonnements Supabase.`} />

      <section className="stat-row" style={{ width: 'min(1180px, calc(100% - 2rem))', margin: '0 auto' }}>
        {isClient ? (
          <>
            <div className="stat-card"><span className="stat-value">{activeCases}</span><span className="stat-label">Dossiers actifs</span></div>
            <div className="stat-card"><span className="stat-value">{privateData.documents.length}</span><span className="stat-label">Documents</span></div>
            <div className="stat-card"><span className="stat-value">{privateData.payments.length}</span><span className="stat-label">Paiements récents</span></div>
            <div className="stat-card"><span className="stat-value">{subscriptionLabel}</span><span className="stat-label">Abonnement</span></div>
          </>
        ) : (
          <>
            <div className="stat-card"><span className="stat-value">{privateData.cases.length}</span><span className="stat-label">Dossiers reçus</span></div>
            <div className="stat-card"><span className="stat-value">{privateData.documents.length}</span><span className="stat-label">Documents</span></div>
            <div className="stat-card"><span className="stat-value">{subscriptionLabel}</span><span className="stat-label">Abonnement</span></div>
            <div className="stat-card"><span className="stat-value">{privateData.payments.length}</span><span className="stat-label">Paiements</span></div>
          </>
        )}
      </section>

      {privateData.loading && <section className="section-block centered"><p className="notice">Chargement des données privées...</p></section>}
      {privateData.message && <section className="section-block centered"><p className="form-message error">{privateData.message}</p></section>}

      <section className="dashboard-grid">
        <article className="feature-card">
          <h2>Dossiers récents</h2>
          {privateData.cases.length > 0 ? (
            <ul>{privateData.cases.map((caseItem) => (
              <li key={caseItem.id}>
                <Link className="text-link" to={`/dossier/${caseItem.id}`}>{caseItem.title}</Link>
                <span className="list-meta">{caseItem.status} · {caseItem.legal_domain || 'Domaine non renseigné'} · {formatDate(caseItem.created_at)}</span>
              </li>
            ))}</ul>
          ) : (
            <p>Aucun dossier visible avec votre rôle actuel.</p>
          )}
          {isClient && <Link className="primary-button" to="/creer-dossier">Créer un dossier</Link>}
        </article>
        <article className="feature-card">
          <h2>Abonnement</h2>
          {privateData.subscription ? (
            <>
              <p><strong>{getPlanName(privateData.subscription.plan_id)}</strong> · {privateData.subscription.billing_period === 'yearly' ? 'Annuel' : 'Mensuel'} · {formatSubscriptionStatus(privateData.subscription.status)}</p>
              {privateData.subscription.current_period_end && <p>Renouvellement ou fin de période : {formatDate(privateData.subscription.current_period_end)}</p>}
              {privateData.subscription.cancel_at_period_end && <p className="notice mini">Résiliation programmée en fin de période.</p>}
              {privateData.subscription.stripe_customer_id && <button className="secondary-button" type="button" onClick={openCustomerPortal} disabled={portalState.type === 'loading'}>{portalState.type === 'loading' ? 'Ouverture...' : 'Gérer dans Stripe'}</button>}
              {portalState.message && <p className="form-message error">{portalState.message}</p>}
            </>
          ) : (
            <>
              <p>Aucun abonnement confirmé par webhook Stripe pour ce compte.</p>
              <Link className="primary-button" to="/tarifs">Choisir une formule</Link>
            </>
          )}
        </article>
        <article className="feature-card">
          <h2>Documents récents</h2>
          {privateData.documents.length > 0 ? (
            <ul>{privateData.documents.map((document) => (
              <li key={document.id}>{document.file_name}<span className="list-meta">{document.status} · {formatDate(document.created_at)}</span></li>
            ))}</ul>
          ) : (
            <p>Aucun document rattaché aux dossiers visibles.</p>
          )}
        </article>
        <article className="feature-card">
          <h2>Sécurité et statuts</h2>
          <p>Données filtrées côté Supabase avec Auth et règles RLS. Les rôles élevés restent attribués côté administration.</p>
          <ul>{caseStatuses.map((status) => <li key={status}>{status}</li>)}</ul>
        </article>
      </section>
    </>
  );
}

export function PaymentStatusPage({ status }: { status: 'success' | 'cancel' }) {
  const success = status === 'success';
  return (
    <>
      <Seo title={success ? 'Paiement en cours de confirmation' : 'Paiement annulé'} description="Retour Stripe Checkout ClairDossier." path={success ? '/success' : '/cancel'} />
      <PageHero title={success ? 'Paiement en cours de confirmation' : 'Paiement annulé'} description={success ? "Stripe a redirigé vers cette page. L'abonnement n'est validé qu'après confirmation fiable du webhook Stripe." : "Le paiement a été annulé ou interrompu. Aucun abonnement n'a été activé."} />
      <section className="section-block centered"><Link className="primary-button" to={success ? '/abonnement' : '/tarifs'}>{success ? 'Voir mon abonnement' : 'Retour aux tarifs'}</Link></section>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <Seo title="Page introuvable" description="La page demandée n'existe pas." />
      <PageHero title="Page introuvable" description="Cette route n'existe pas encore ou l'URL est incorrecte." />
      <section className="section-block centered">
        <Link className="primary-button" to="/">Retour à l'accueil</Link>
      </section>
    </>
  );
}

/* ─── Internal components ─── */

function FormPage({ title, description, table, fields, consentLabel }: { title: string; description: string; table: PublicFormTable; fields: FieldDef[]; consentLabel: string }) {
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
    const missing = fields.some((field) => field.required && !sanitizeText(data.get(field.name), 2000));
    const consent = data.get('consent') === 'on';
    if (missing || !consent) {
      setState({ type: 'error', message: 'Complétez les champs obligatoires et cochez le consentement RGPD.' });
      return;
    }
    const email = sanitizeText(data.get('email'), 254).toLowerCase();
    if (!isValidEmail(email)) {
      setState({ type: 'error', message: 'Adresse email invalide.' });
      return;
    }
    setState({ type: 'loading', message: '' });
    const payload = Object.fromEntries(fields.map((field) => {
      const maxLength = field.type === 'textarea' ? 2000 : 254;
      const value = field.name === 'email' ? email : sanitizeText(data.get(field.name), maxLength);
      return [field.name, value];
    }));
    const result = await insertPublicRecord(table, { ...payload, consent_given: consent });
    setState({ type: result.ok ? 'success' : 'error', message: result.message });
    if (result.ok) form.reset();
  }

  return (
    <>
      <PageHero title={title} description={description} />
      <section className="form-shell single">
        <form className="stacked-form" onSubmit={onSubmit} noValidate>
          <label className="visually-hidden" aria-hidden="true">
            <span>Site web</span>
            <input name="company_website" type="text" tabIndex={-1} autoComplete="off" />
          </label>
          {fields.map((field) => <RenderField key={field.name} field={field} />)}
          <label className="checkbox-line"><input name="consent" type="checkbox" required /><span>{consentLabel}</span></label>
          <button className="primary-button" type="submit" disabled={state.type === 'loading'}>
            {state.type === 'loading' ? 'Envoi en cours…' : 'Envoyer'}
          </button>
          {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
        </form>
      </section>
    </>
  );
}

function RenderField({ field }: { field: FieldDef }) {
  if (field.type === 'textarea') return <label><span>{field.label}{field.required ? ' *' : ''}</span><textarea name={field.name} required={field.required} rows={5} maxLength={2000} placeholder={field.placeholder} /></label>;
  if (field.type === 'select') return <SelectField name={field.name} label={field.label} options={field.options || []} required={field.required} />;
  return <label><span>{field.label}{field.required ? ' *' : ''}</span><input name={field.name} type={field.type || 'text'} required={field.required} maxLength={field.type === 'email' ? 254 : 160} placeholder={field.placeholder} /></label>;
}

function SelectField({ name, label, options, required }: { name: string; label: string; options: string[]; required?: boolean }) {
  return (
    <label>
      <span>{label}{required ? ' *' : ''}</span>
      <select name={name} required={required} defaultValue="">
        <option value="" disabled>Choisir</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function getAuthErrorMessage(error: AuthError, isSignup: boolean) {
  const code = String(error.code || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();

  if (isWeakPasswordError(code, message)) {
    return 'Le mot de passe ne respecte pas les règles de sécurité : utilisez au moins 12 caractères, une minuscule, une majuscule et un chiffre.';
  }
  if (isSignup && isDuplicateEmailError(code, message)) {
    return "Un compte existe déjà avec cet email. Connectez-vous ou utilisez la réinitialisation du mot de passe.";
  }
  if (isSignup && (code.includes('signup_disabled') || message.includes('signups not allowed'))) {
    return "La création de compte est désactivée côté service d'authentification. Contactez le support.";
  }
  if (code.includes('email') && (message.includes('invalid') || message.includes('not valid'))) {
    return 'Adresse email invalide.';
  }
  if (code.includes('over_email_send_rate_limit') || message.includes('rate limit')) {
    return 'Trop de tentatives ont été effectuées. Patientez quelques minutes avant de réessayer.';
  }
  if (!isSignup && (code.includes('invalid_credentials') || message.includes('invalid login credentials'))) {
    return 'Impossible de vous connecter. Vérifiez votre email et votre mot de passe.';
  }
  if (message.includes('database') || message.includes('saving new user')) {
    return isSignup
      ? "Le compte n'a pas pu être créé à cause d'un problème serveur. Réessayez ou contactez le support si le problème persiste."
      : 'Connexion indisponible à cause d’un problème serveur. Veuillez réessayer.';
  }

  return isSignup
    ? 'Impossible de créer le compte pour le moment. Veuillez réessayer.'
    : 'Impossible de vous connecter. Vérifiez vos informations.';
}

function isWeakPasswordError(code: string, message: string) {
  return code.includes('weak_password')
    || message.includes('weak password')
    || message.includes('password should')
    || message.includes('password must')
    || message.includes('password')
      && (message.includes('characters') || message.includes('uppercase') || message.includes('lowercase') || message.includes('digit'));
}

function isDuplicateEmailError(code: string, message: string) {
  return code.includes('user_already_exists')
    || code.includes('email_exists')
    || message.includes('already registered')
    || message.includes('already exists')
    || message.includes('user already');
}

function getCasePersistenceMessage(error: { code?: string; message?: string }) {
  const message = String(error.message || '').toLowerCase();
  if (error.code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return "Votre session ne permet pas encore de créer ce dossier. Reconnectez-vous puis réessayez.";
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Connexion au serveur indisponible. Vérifiez votre réseau puis réessayez.';
  }
  return 'Impossible de créer le dossier pour le moment. Veuillez réessayer.';
}

function getPlanName(planId: string) {
  return plans.find((plan) => plan.id === planId)?.name || planId;
}

function formatSubscriptionStatus(status: string) {
  const labels: Record<string, string> = {
    active: 'Actif',
    canceled: 'Résilié',
    incomplete: 'Incomplet',
    past_due: 'En retard',
  };
  return labels[status] || status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function PageHero({ title, description }: { title: string; description: string }) {
  return <section className="page-hero"><p className="eyebrow">ClairDossier</p><h1>{title}</h1><p>{description}</p></section>;
}

function StatusPanel() {
  return (
    <aside className="feature-card">
      <h2>Statuts prévus</h2>
      <ul>{caseStatuses.map((status) => <li key={status}>{status}</li>)}</ul>
      <h3>Avertissements IA</h3>
      {warnings.map((warning) => <p key={warning} className="notice mini">{warning}</p>)}
    </aside>
  );
}

function BlogCard({ post }: { post: (typeof blogPosts)[number] }) {
  return (
    <article className="blog-card">
      <p className="eyebrow">{post.category}</p>
      <h2>{post.title}</h2>
      <p>{post.summary}</p>
      <div className="keyword-row">{post.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
      <Link className="text-link" to={`/blog/${post.slug}`}>Lire l'article</Link>
    </article>
  );
}
