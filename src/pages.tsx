import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { NewsletterForm } from './components/NewsletterForm';
import { PricingCards } from './components/PricingCards';
import { Seo } from './components/Seo';
import { blogPosts, categories, caseStatuses, featureCards, infoPages, legalPages, plans, site, warnings } from './data/site';
import { insertPublicRecord, supabase } from './lib/supabase';
import { openCustomerPortal } from './lib/stripe';

type FormState = { type: 'idle' | 'loading' | 'success' | 'error'; message: string };

type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number' | 'datetime-local';
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

function formatPlanPreviewPrice(monthlyPrice: number | null) {
  if (monthlyPrice === null) return 'Sur devis';
  if (monthlyPrice === 0) return '0 €';
  return `${monthlyPrice} € / mois`;
}

function formatMoneyFromCents(amount: number | null, currency = 'eur') {
  if (amount === null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

function formatBillingPeriod(value: string | null) {
  if (value === 'yearly') return 'Annuel';
  if (value === 'monthly') return 'Mensuel';
  return '—';
}

function formatSubscriptionStatus(value: string | null) {
  const labels: Record<string, string> = {
    active: 'Actif',
    canceled: 'Annulé',
    incomplete: 'Incomplet',
    past_due: 'Paiement en retard',
    expired: 'Expiré',
  };
  return value ? labels[value] || value : '—';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getNormalizedFieldValue(field: FieldDef, data: FormData) {
  const value = String(data.get(field.name) || '').trim();
  if (field.type === 'number') return value ? Number(value) : null;
  return value;
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
      <Seo title="Tarifs" description="Formules ClairDossier pour particuliers, PME et cabinets d'avocats avec Stripe Checkout prêt à connecter." path="/tarifs" />
      <PageHero title="Tarifs" description="Choisissez une formule adaptée à votre profil. Le paiement Stripe devient actif dès que les clés et Price IDs sont configurés côté serveur." />
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
        description="Votre demande sera enregistrée dans la table contact_requests lorsque Supabase est configuré."
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const required = ['client_type', 'legal_domain', 'problem_description', 'urgency'];
    const missing = required.some((key) => !String(data.get(key) || '').trim());
    const accepted = data.get('terms_accepted') === 'on';
    if (missing || !accepted) {
      setState({ type: 'error', message: 'Complétez les champs obligatoires et acceptez les conditions.' });
      return;
    }
    if (!supabase) {
      setState({ type: 'error', message: 'Créez votre compte pour commencer votre dossier.' });
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('Session Supabase absente pour création dossier', userError);
      setState({ type: 'error', message: 'Créez votre compte pour commencer votre dossier.' });
      return;
    }

    setState({ type: 'loading', message: '' });

    const caseId = crypto.randomUUID();
    const { error: caseError } = await supabase.from('cases').insert({
      id: caseId,
      created_by: userData.user.id,
      title: `Dossier ${String(data.get('legal_domain'))}`,
      client_type: data.get('client_type'),
      legal_domain: data.get('legal_domain'),
      description: data.get('problem_description'),
      urgency: data.get('urgency'),
      status: 'reçu',
      terms_accepted: accepted,
    });

    if (caseError) {
      console.error('Erreur Supabase (cases)', caseError);
      setState({ type: 'error', message: getCasePersistenceMessage(caseError) });
      return;
    }

    const { error: answerError } = await supabase.from('case_intake_answers').insert({
      case_id: caseId,
      answers: {
        client_type: data.get('client_type'),
        legal_domain: data.get('legal_domain'),
        problem_description: data.get('problem_description'),
        urgency: data.get('urgency'),
        documents_available: data.get('documents_available'),
      },
      consent_given: accepted,
    });
    if (answerError) {
      console.error('Erreur Supabase (case_intake_answers)', answerError);
      setState({ type: 'error', message: getCasePersistenceMessage(answerError) });
      return;
    }

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
          <label><span>Description du problème *</span><textarea name="problem_description" required rows={6} placeholder="Décrivez les faits, le contexte et les documents disponibles..." /></label>
          <SelectField name="urgency" label="Urgence" options={['Faible', 'Normale', 'Élevée', 'Délai judiciaire proche']} required />
          <label><span>Documents disponibles</span><textarea name="documents_available" rows={4} placeholder="Contrat, emails, facture, courrier..." /></label>
          <p className="notice mini">Les informations transmises servent à préparer votre dossier. Aucun conseil juridique personnalisé n’est fourni sans validation par un professionnel habilité.</p>
          <label className="checkbox-line"><input name="terms_accepted" type="checkbox" required /><span>J'accepte les <Link to="/conditions-utilisation">conditions d'utilisation</Link> et comprends que l'IA ne remplace pas l'avocat.</span></label>
          <button className="primary-button" type="submit" disabled={state.type === 'loading'}>{state.type === 'loading' ? 'Envoi en cours…' : 'Créer le dossier'}</button>
          {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
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
      <section className="section-block">
        <div className="newsletter-card">
          <h2>Recevoir les nouveaux guides juridiques</h2>
          <p>Inscription avec consentement RGPD, enregistrée dans newsletter_subscribers lorsque Supabase est configuré.</p>
          <NewsletterForm />
        </div>
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
      <section className="section-block">
        <div className="newsletter-card">
          <h2>Suivre cette thématique</h2>
          <p>Recevez les contenus ClairDossier utiles aux clients, PME, avocats et cabinets.</p>
          <NewsletterForm />
        </div>
      </section>
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
  const redirectTo = rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard';
  const redirectQuery = rawRedirect ? `?redirect=${encodeURIComponent(redirectTo)}` : '';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '').trim();
    const passwordConfirm = String(data.get('password_confirm') || '').trim();
    if (!email || !password) {
      setState({ type: 'error', message: 'Email et mot de passe sont obligatoires.' });
      return;
    }
    if (password.length < 8) {
      setState({ type: 'error', message: 'Le mot de passe doit contenir au moins 8 caractères.' });
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
    const fullName = String(data.get('full_name') || '').trim();
    const accountType = String(data.get('account_type') || '').trim();
    if (isSignup && (!fullName || !accountType)) {
      setState({ type: 'error', message: 'Complétez les informations de compte obligatoires.' });
      return;
    }
    if (!supabase) {
      setState({ type: 'error', message: 'Impossible de créer le compte pour le moment. Veuillez réessayer.' });
      return;
    }
    const role = accountType === 'cabinet' ? 'cabinet_admin' : 'client';
    setState({ type: 'loading', message: '' });
    const response = isSignup
      ? await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            account_type: accountType,
            role,
          },
        },
      })
      : await supabase.auth.signInWithPassword({ email, password });
    if (response.error) {
      console.error('Erreur auth Supabase', response.error);
      setState({ type: 'error', message: isSignup ? 'Impossible de créer le compte pour le moment. Veuillez réessayer.' : 'Impossible de vous connecter. Vérifiez vos informations.' });
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
      <PageHero title={isSignup ? 'Créer un compte' : 'Connexion'} description={rawRedirect === '/creer-dossier' ? 'Créez votre compte pour commencer votre dossier.' : 'Authentification Supabase prête à connecter pour session persistante et déconnexion.'} />
      <section className="form-shell single">
        <form className="stacked-form" onSubmit={onSubmit} noValidate>
          {isSignup && <label><span>Nom complet</span><input name="full_name" type="text" autoComplete="name" required placeholder="Votre nom complet" /></label>}
          <label><span>Email</span><input name="email" type="email" required placeholder="vous@exemple.fr" /></label>
          <label>
            <span>Mot de passe</span>
            <div className="password-wrapper">
              <input name="password" type={showPassword ? 'text' : 'password'} minLength={8} required placeholder="Minimum 8 caractères" />
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
          {isSignup && <label><span>Confirmation du mot de passe</span><input name="password_confirm" type="password" minLength={8} required placeholder="Répétez le mot de passe" /></label>}
          {isSignup && <SelectField name="account_type" label="Type de compte" options={['client', 'entreprise', 'cabinet']} required />}
          {isSignup && <label className="checkbox-line"><input name="terms_accepted" type="checkbox" required /><span>J'accepte les conditions d'utilisation et la politique de confidentialité.</span></label>}
          <button className="primary-button" type="submit" disabled={state.type === 'loading'}>
            {state.type === 'loading' ? 'Chargement…' : isSignup ? 'Créer mon compte' : 'Me connecter'}
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
  return (
    <>
      <Seo title={title} description={`Espace ${audience} ClairDossier prêt à connecter à Supabase Auth et RLS.`} />
      <PageHero title={title} description={`Page privée ${audience}. Les données réelles doivent être protégées par Supabase Auth et RLS avant production.`} />

      <section className="stat-row" style={{ width: 'min(1180px, calc(100% - 2rem))', margin: '0 auto' }}>
        {isClient ? (
          <>
            <div className="stat-card"><span className="stat-value">0</span><span className="stat-label">Dossiers actifs</span></div>
            <div className="stat-card"><span className="stat-value">0</span><span className="stat-label">Documents</span></div>
            <div className="stat-card"><span className="stat-value">0</span><span className="stat-label">Messages non lus</span></div>
            <div className="stat-card"><span className="stat-value">—</span><span className="stat-label">Abonnement</span></div>
          </>
        ) : (
          <>
            <div className="stat-card"><span className="stat-value">0</span><span className="stat-label">Dossiers reçus</span></div>
            <div className="stat-card"><span className="stat-value">0</span><span className="stat-label">Clients</span></div>
            <div className="stat-card"><span className="stat-value">0</span><span className="stat-label">Tâches en cours</span></div>
            <div className="stat-card"><span className="stat-value">0</span><span className="stat-label">Messages</span></div>
          </>
        )}
      </section>

      <section className="dashboard-grid">
        <article className="feature-card">
          <h2>Statuts dossier</h2>
          <ul>{caseStatuses.map((status) => <li key={status}>{status}</li>)}</ul>
        </article>
        <article className="feature-card">
          <h2>Modules prévus</h2>
          <p>{isClient
            ? 'Documents, messages, paiements, abonnement et paramètres sont structurés dans les routes et le schéma SQL.'
            : 'Dossiers, clients, messages, tâches, validations et facturation sont structurés dans les routes et le schéma SQL.'
          }</p>
        </article>
        <article className="feature-card">
          <h2>Sécurité</h2>
          <p>Ne pas exposer de données sensibles sans session active, règles RLS et vérification du rôle utilisateur.</p>
        </article>
        <article className="feature-card">
          <h2>Prochaines étapes</h2>
          <ul>
            <li>Configurer Supabase Auth</li>
            <li>Activer les règles RLS par rôle</li>
            <li>Connecter les données en temps réel</li>
            <li>Activer les notifications</li>
          </ul>
        </article>
      </section>
    </>
  );
}

type PaymentRecord = {
  id: string;
  amount_total: number | null;
  currency: string | null;
  status: string | null;
  plan_id: string | null;
  billing_period: string | null;
  created_at: string;
};

type SubscriptionRecord = {
  id: string;
  plan_id: string | null;
  billing_period: string | null;
  stripe_customer_id: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  updated_at: string | null;
};

export function PaiementsPage() {
  const [state, setState] = useState<FormState>({ type: 'loading', message: '' });
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadPayments() {
      if (!supabase) {
        setState({ type: 'error', message: 'Connectez Supabase pour consulter vos paiements.' });
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.error('Session Supabase absente pour paiements', userError);
        if (mounted) setState({ type: 'error', message: 'Connectez-vous pour consulter vos paiements.' });
        return;
      }

      const { data, error } = await supabase
        .from('payments')
        .select('id, amount_total, currency, status, plan_id, billing_period, created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (!mounted) return;
      if (error) {
        console.error('Erreur Supabase (payments)', error);
        setState({ type: 'error', message: "Impossible de charger vos paiements pour le moment." });
        return;
      }

      setPayments((data || []) as PaymentRecord[]);
      setState({ type: 'idle', message: '' });
    }

    void loadPayments();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <Seo title="Paiements" description="Historique des paiements Stripe enregistrés pour votre compte ClairDossier." path="/paiements" />
      <PageHero title="Paiements" description="Consultez les paiements synchronisés par le webhook Stripe. Aucun paiement n’est simulé dans cette interface." />
      <section className="section-block">
        {state.type === 'loading' && <p className="notice">Chargement des paiements...</p>}
        {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
        {state.type !== 'loading' && payments.length === 0 && (
          <article className="feature-card">
            <h2>Aucun paiement enregistré</h2>
            <p>Les paiements apparaîtront ici après un passage réussi par Stripe Checkout et réception du webhook.</p>
            <Link className="primary-button" to="/tarifs">Voir les formules</Link>
          </article>
        )}
        {payments.length > 0 && (
          <div className="responsive-table" role="table" aria-label="Historique des paiements">
            <div role="row">
              <strong role="columnheader">Date</strong>
              <strong role="columnheader">Formule</strong>
              <strong role="columnheader">Période</strong>
              <strong role="columnheader">Montant</strong>
              <strong role="columnheader">Statut</strong>
            </div>
            {payments.map((payment) => (
              <div role="row" key={payment.id}>
                <span role="cell">{formatDate(payment.created_at)}</span>
                <span role="cell">{plans.find((plan) => plan.id === payment.plan_id)?.name || payment.plan_id || '—'}</span>
                <span role="cell">{formatBillingPeriod(payment.billing_period)}</span>
                <span role="cell">{formatMoneyFromCents(payment.amount_total, payment.currency || 'eur')}</span>
                <span role="cell">{payment.status || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function AbonnementPage() {
  const [state, setState] = useState<FormState>({ type: 'loading', message: '' });
  const [portalState, setPortalState] = useState<FormState>({ type: 'idle', message: '' });
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      if (!supabase) {
        setState({ type: 'error', message: 'Connectez Supabase pour consulter votre abonnement.' });
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.error('Session Supabase absente pour abonnement', userError);
        if (mounted) setState({ type: 'error', message: 'Connectez-vous pour consulter votre abonnement.' });
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, plan_id, billing_period, stripe_customer_id, status, current_period_start, current_period_end, cancel_at_period_end, updated_at')
        .eq('user_id', userData.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        console.error('Erreur Supabase (subscriptions)', error);
        setState({ type: 'error', message: "Impossible de charger votre abonnement pour le moment." });
        return;
      }

      setSubscription((data as SubscriptionRecord | null) || null);
      setState({ type: 'idle', message: '' });
    }

    void loadSubscription();
    return () => { mounted = false; };
  }, []);

  async function onOpenPortal() {
    setPortalState({ type: 'loading', message: '' });
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Portail Stripe indisponible', error);
      setPortalState({ type: 'error', message: error instanceof Error ? error.message : "Le portail Stripe n'est pas disponible." });
    }
  }

  const currentPlan = plans.find((plan) => plan.id === subscription?.plan_id);

  return (
    <>
      <Seo title="Abonnement" description="Gestion de l'abonnement ClairDossier synchronisé avec Stripe." path="/abonnement" />
      <PageHero title="Abonnement" description="Votre abonnement est mis à jour par Stripe via webhook. Le portail Stripe s’ouvre uniquement lorsqu’un client Stripe existe." />
      <section className="section-block">
        {state.type === 'loading' && <p className="notice">Chargement de votre abonnement...</p>}
        {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
        {state.type !== 'loading' && !subscription && (
          <article className="feature-card">
            <h2>Aucun abonnement actif enregistré</h2>
            <p>Choisissez une formule lorsque Stripe est configuré. Aucun abonnement n’est créé sans paiement confirmé.</p>
            <Link className="primary-button" to="/tarifs">Choisir une formule</Link>
          </article>
        )}
        {subscription && (
          <div className="subscription-grid">
            <article className="feature-card">
              <h2>{currentPlan?.name || subscription.plan_id || 'Formule'}</h2>
              <p>{currentPlan?.description || 'Formule synchronisée depuis Stripe.'}</p>
              <div className="info-table" role="table" aria-label="Détails abonnement">
                <div role="row"><strong role="cell">Statut</strong><span role="cell">{formatSubscriptionStatus(subscription.status)}</span></div>
                <div role="row"><strong role="cell">Période</strong><span role="cell">{formatBillingPeriod(subscription.billing_period)}</span></div>
                <div role="row"><strong role="cell">Début</strong><span role="cell">{formatDate(subscription.current_period_start)}</span></div>
                <div role="row"><strong role="cell">Fin de période</strong><span role="cell">{formatDate(subscription.current_period_end)}</span></div>
                <div role="row"><strong role="cell">Annulation programmée</strong><span role="cell">{subscription.cancel_at_period_end ? 'Oui' : 'Non'}</span></div>
              </div>
              <button className="primary-button" type="button" onClick={onOpenPortal} disabled={portalState.type === 'loading' || !subscription.stripe_customer_id}>
                {portalState.type === 'loading' ? 'Ouverture…' : 'Gérer dans le portail Stripe'}
              </button>
              {!subscription.stripe_customer_id && <p className="payment-note">Le portail sera disponible après synchronisation du client Stripe.</p>}
              {portalState.message && <p className={`form-message ${portalState.type === 'success' ? 'success' : 'error'}`}>{portalState.message}</p>}
            </article>
            <article className="feature-card">
              <h2>Accès selon formule</h2>
              <ul>
                {(currentPlan?.features || ['Restrictions à définir selon la formule configurée']).map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <p className="notice mini">Les restrictions applicatives doivent être contrôlées côté serveur et par les règles RLS avant production.</p>
            </article>
          </div>
        )}
      </section>
    </>
  );
}

export function PaymentStatusPage({ status }: { status: 'success' | 'cancel' }) {
  const success = status === 'success';
  return (
    <>
      <Seo title={success ? 'Paiement confirmé' : 'Paiement annulé'} description="Retour Stripe Checkout ClairDossier." path={success ? '/success' : '/cancel'} />
      <PageHero title={success ? 'Paiement confirmé' : 'Paiement annulé'} description={success ? "Stripe a redirigé vers la page de succès. Le webhook doit maintenant synchroniser l'abonnement." : "Le paiement a été annulé ou interrompu. Aucun abonnement n'a été activé."} />
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

function FormPage({ title, description, table, fields, consentLabel }: { title: string; description: string; table: string; fields: FieldDef[]; consentLabel: string }) {
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const missing = fields.some((field) => field.required && !String(data.get(field.name) || '').trim());
    const invalidEmail = fields.some((field) => field.type === 'email' && !isValidEmail(String(data.get(field.name) || '').trim()));
    const consent = data.get('consent') === 'on';
    if (missing || invalidEmail || !consent) {
      setState({ type: 'error', message: 'Complétez les champs obligatoires et cochez le consentement RGPD.' });
      return;
    }
    setState({ type: 'loading', message: '' });
    const payload = Object.fromEntries(fields.map((field) => [field.name, getNormalizedFieldValue(field, data)]));
    const result = await insertPublicRecord(table, { ...payload, consent_given: consent });
    setState({ type: result.ok ? 'success' : 'error', message: result.message });
    if (result.ok) form.reset();
  }

  return (
    <>
      <PageHero title={title} description={description} />
      <section className="form-shell single">
        <form className="stacked-form" onSubmit={onSubmit} noValidate>
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
  if (field.type === 'textarea') return <label><span>{field.label}{field.required ? ' *' : ''}</span><textarea name={field.name} required={field.required} rows={5} placeholder={field.placeholder} /></label>;
  if (field.type === 'select') return <SelectField name={field.name} label={field.label} options={field.options || []} required={field.required} />;
  return <label><span>{field.label}{field.required ? ' *' : ''}</span><input name={field.name} type={field.type || 'text'} required={field.required} placeholder={field.placeholder} /></label>;
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

function getCasePersistenceMessage(error: { code?: string; message?: string }) {
  if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
    return 'Migration Supabase requise : créez les tables cases et case_intake_answers avant d’enregistrer un dossier.';
  }
  return "Nous n'avons pas pu créer votre dossier. Réessayez ou contactez-nous par email.";
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
