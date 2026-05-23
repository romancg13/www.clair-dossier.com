import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { NewsletterForm } from './components/NewsletterForm';
import { PricingCards } from './components/PricingCards';
import { Seo } from './components/Seo';
import { blogPosts, categories, caseStatuses, featureCards, infoPages, legalPages, plans, site, warnings } from './data/site';
import { insertPublicRecord, supabase } from './lib/supabase';
import { createDocumentSignedUrl, uploadCaseDocument } from './lib/documents';
import { redirectToCustomerPortal } from './lib/stripe';
import { getSafeRedirect, isHoneypotFilled, isValidEmail, sanitizeText, validatePassword } from './lib/security';
import type { PublicFormTable } from './lib/security';

type FormState = { type: 'idle' | 'loading' | 'success' | 'error'; message: string };
type SelectOption = string | { label: string; value: string };
type CaseRow = { id: string; title: string; status: string; legal_domain: string | null; urgency: string | null; created_at: string };
type DocumentRow = { id: string; case_id: string | null; file_name: string; file_path: string; confidentiality: string; status: string; created_at: string };
type MessageRow = { id: string; case_id: string | null; sender_id: string | null; recipient_id: string | null; body: string; read_at: string | null; created_at: string };
type PaymentRow = { id: string; plan_id: string | null; amount_total: number | null; currency: string | null; status: string; created_at: string };
type SubscriptionRow = { id: string; plan_id: string; status: string; billing_period: string | null; current_period_end: string | null; cancel_at_period_end: boolean };

type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number' | 'datetime-local';
  options?: SelectOption[];
  required?: boolean;
  placeholder?: string;
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
      return;
    }
    const problemDescription = sanitizeText(data.get('problem_description'), 3000);
    const documentsAvailable = sanitizeText(data.get('documents_available'), 1200);
    if (problemDescription.length < 20) {
      setState({ type: 'error', message: 'Décrivez votre situation en quelques phrases avant de créer le dossier.' });
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
          <label><span>Description du problème *</span><textarea name="problem_description" required rows={6} maxLength={3000} placeholder="Décrivez les faits, le contexte et les documents disponibles..." /></label>
          <SelectField name="urgency" label="Urgence" options={['Faible', 'Normale', 'Élevée', 'Délai judiciaire proche']} required />
          <label><span>Documents disponibles</span><textarea name="documents_available" rows={4} maxLength={1200} placeholder="Contrat, emails, facture, courrier..." /></label>
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
      setState({ type: 'error', message: 'Impossible de créer le compte pour le moment. Veuillez réessayer.' });
      return;
    }
    setState({ type: 'loading', message: '' });
    const response = isSignup
      ? await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            account_type: accountType,
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
          {isSignup && <SelectField name="account_type" label="Type de compte" options={[
            { label: 'Particulier', value: 'client_particulier' },
            { label: 'PME / entreprise', value: 'client_entreprise' },
            { label: "Cabinet d'avocats", value: 'cabinet' },
          ]} required />}
          {isSignup && <label className="checkbox-line"><input name="terms_accepted" type="checkbox" required /><span>J'accepte les <Link to="/conditions-utilisation">conditions d'utilisation</Link> et la <Link to="/politique-confidentialite">politique de confidentialité</Link>.</span></label>}
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
  const location = useLocation();
  const isDocuments = location.pathname === '/documents';
  const isMessages = location.pathname.endsWith('/messages');
  const isBilling = location.pathname === '/paiements' || location.pathname === '/abonnement' || location.pathname === '/cabinet/facturation';
  const isCases = location.pathname === '/dashboard' || location.pathname === '/mes-dossiers' || location.pathname === '/cabinet/dashboard' || location.pathname === '/cabinet/dossiers';
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

      {isCases && <CasesModule audience={audience} />}
      {isDocuments && <DocumentsModule />}
      {isMessages && <MessagesModule />}
      {isBilling && <BillingModule />}

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
      const rawValue = sanitizeText(data.get(field.name), maxLength);
      if (field.name === 'email') return [field.name, email];
      if (!rawValue && !field.required) return [field.name, null];
      if (field.type === 'number') {
        const parsed = Number(rawValue);
        return [field.name, Number.isFinite(parsed) ? parsed : null];
      }
      if (field.type === 'datetime-local') {
        const date = new Date(rawValue);
        return [field.name, Number.isNaN(date.getTime()) ? null : date.toISOString()];
      }
      return [field.name, rawValue];
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

function getOptionValue(option: SelectOption) {
  return typeof option === 'string' ? option : option.value;
}

function getOptionLabel(option: SelectOption) {
  return typeof option === 'string' ? option : option.label;
}

function SelectField({ name, label, options, required }: { name: string; label: string; options: SelectOption[]; required?: boolean }) {
  return (
    <label>
      <span>{label}{required ? ' *' : ''}</span>
      <select name={name} required={required} defaultValue="">
        <option value="" disabled>Choisir</option>
        {options.map((option) => <option key={getOptionValue(option)} value={getOptionValue(option)}>{getOptionLabel(option)}</option>)}
      </select>
    </label>
  );
}

function getCasePersistenceMessage(error: { code?: string; message?: string }) {
  void error;
  return 'Impossible de créer le dossier pour le moment. Veuillez réessayer.';
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

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

function CasesModule({ audience }: { audience: 'client' | 'cabinet' }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  useEffect(() => {
    async function loadCases() {
      if (!supabase) {
        setState({ type: 'error', message: 'Connectez Supabase pour afficher les dossiers.' });
        return;
      }
      const { data, error } = await supabase
        .from('cases')
        .select('id,title,status,legal_domain,urgency,created_at')
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) {
        console.error('Erreur chargement dossiers', error);
        setState({ type: 'error', message: 'Impossible de charger les dossiers pour le moment.' });
        return;
      }
      setCases((data || []) as CaseRow[]);
      setState({ type: 'success', message: '' });
    }
    void loadCases();
  }, []);

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <p className="eyebrow">{audience === 'client' ? 'Espace client' : 'Espace cabinet'}</p>
          <h2>Dossiers suivis</h2>
        </div>
        {audience === 'client' && <Link className="primary-button" to="/creer-dossier">Créer un dossier</Link>}
      </div>
      {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
      {cases.length > 0 ? (
        <div className="table-card" role="table" aria-label="Dossiers">
          <div role="row"><strong role="columnheader">Dossier</strong><strong role="columnheader">Domaine</strong><strong role="columnheader">Statut</strong><strong role="columnheader">Créé le</strong><strong role="columnheader">Action</strong></div>
          {cases.map((caseRow) => (
            <div key={caseRow.id} role="row">
              <span role="cell">{caseRow.title}</span>
              <span role="cell">{caseRow.legal_domain || '—'}</span>
              <span role="cell" className="status-pill compact">{caseRow.status}</span>
              <span role="cell">{formatDate(caseRow.created_at)}</span>
              <Link role="cell" className="text-link" to={`/dossier/${caseRow.id}`}>Ouvrir</Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="notice">Aucun dossier visible avec la session actuelle. Les règles RLS limitent l’affichage aux dossiers autorisés.</p>
      )}
    </section>
  );
}

function DocumentsModule() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [caseId, setCaseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  async function loadDocuments() {
    if (!supabase) {
      setState({ type: 'error', message: 'Connectez Supabase pour afficher les documents.' });
      return;
    }
    const { data, error } = await supabase
      .from('documents')
      .select('id,case_id,file_name,file_path,confidentiality,status,created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Erreur chargement documents', error);
      setState({ type: 'error', message: 'Impossible de charger les documents pour le moment.' });
      return;
    }
    setDocuments((data || []) as DocumentRow[]);
  }

  useEffect(() => { void loadDocuments(); }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeCaseId = sanitizeText(caseId, 80);
    if (!safeCaseId || !file) {
      setState({ type: 'error', message: 'Indiquez le dossier et choisissez un fichier.' });
      return;
    }
    setState({ type: 'loading', message: '' });
    const result = await uploadCaseDocument(safeCaseId, file);
    setState({ type: result.ok ? 'success' : 'error', message: result.message });
    if (result.ok) {
      setFile(null);
      setCaseId('');
      event.currentTarget.reset();
      await loadDocuments();
    }
  }

  async function openDocument(filePath: string) {
    const result = await createDocumentSignedUrl(filePath);
    if (!result.ok || !result.url) {
      setState({ type: 'error', message: result.message });
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <p className="eyebrow">Documents confidentiels</p>
          <h2>Upload et liste des pièces</h2>
        </div>
      </div>
      <form className="stacked-form compact-form" onSubmit={onSubmit} noValidate>
        <label><span>ID du dossier *</span><input value={caseId} onChange={(event) => setCaseId(event.target.value)} maxLength={80} placeholder="UUID du dossier" required /></label>
        <label><span>Fichier *</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>
        <p className="notice mini">Formats autorisés : PDF, PNG, JPG, JPEG, DOC, DOCX. Taille maximale : 10 Mo. Stockage privé Supabase requis.</p>
        <button className="primary-button" type="submit" disabled={state.type === 'loading'}>{state.type === 'loading' ? 'Envoi…' : 'Envoyer le document'}</button>
      </form>
      {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
      {documents.length > 0 ? (
        <div className="table-card" role="table" aria-label="Documents">
          <div role="row"><strong role="columnheader">Nom</strong><strong role="columnheader">Statut</strong><strong role="columnheader">Confidentialité</strong><strong role="columnheader">Créé le</strong><strong role="columnheader">Action</strong></div>
          {documents.map((documentRow) => (
            <div key={documentRow.id} role="row">
              <span role="cell">{documentRow.file_name}</span>
              <span role="cell">{documentRow.status}</span>
              <span role="cell">{documentRow.confidentiality}</span>
              <span role="cell">{formatDate(documentRow.created_at)}</span>
              <button role="cell" className="text-link link-button" type="button" onClick={() => openDocument(documentRow.file_path)}>Ouvrir</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="notice">Aucun document visible. Les documents privés ne sont listés que pour les participants autorisés au dossier.</p>
      )}
    </section>
  );
}

function MessagesModule() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  async function loadMessages() {
    if (!supabase) {
      setState({ type: 'error', message: 'Connectez Supabase pour afficher les messages.' });
      return;
    }
    const { data, error } = await supabase
      .from('messages')
      .select('id,case_id,sender_id,recipient_id,body,read_at,created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Erreur chargement messages', error);
      setState({ type: 'error', message: 'Impossible de charger les messages pour le moment.' });
      return;
    }
    setMessages((data || []) as MessageRow[]);
  }

  useEffect(() => { void loadMessages(); }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const caseId = sanitizeText(data.get('case_id'), 80);
    const recipientId = sanitizeText(data.get('recipient_id'), 80);
    const body = sanitizeText(data.get('body'), 5000);
    if (!caseId || !recipientId || body.length < 2) {
      setState({ type: 'error', message: 'Indiquez un dossier, un destinataire et un message.' });
      return;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('Session absente pour message', userError);
      setState({ type: 'error', message: 'Connectez-vous pour envoyer un message.' });
      return;
    }
    setState({ type: 'loading', message: '' });
    const { error } = await supabase.from('messages').insert({
      case_id: caseId,
      sender_id: userData.user.id,
      recipient_id: recipientId,
      body,
    });
    if (error) {
      console.error('Erreur envoi message', error);
      setState({ type: 'error', message: 'Impossible d’envoyer le message pour le moment.' });
      return;
    }
    setState({ type: 'success', message: 'Message envoyé.' });
    form.reset();
    await loadMessages();
  }

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <p className="eyebrow">Messagerie dossier</p>
          <h2>Échanges client ↔ avocat</h2>
        </div>
      </div>
      <form className="stacked-form compact-form" onSubmit={onSubmit} noValidate>
        <label><span>ID du dossier *</span><input name="case_id" maxLength={80} required placeholder="UUID du dossier" /></label>
        <label><span>ID du destinataire *</span><input name="recipient_id" maxLength={80} required placeholder="UUID Supabase du client ou avocat" /></label>
        <label><span>Message *</span><textarea name="body" rows={4} maxLength={5000} required placeholder="Votre message..." /></label>
        <p className="notice mini">En production, le destinataire doit être sélectionné depuis les participants du dossier afin de conserver le secret professionnel.</p>
        <button className="primary-button" type="submit" disabled={state.type === 'loading'}>{state.type === 'loading' ? 'Envoi…' : 'Envoyer'}</button>
      </form>
      {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
      {messages.length > 0 ? (
        <div className="message-list">
          {messages.map((message) => (
            <article className="feature-card" key={message.id}>
              <p className="eyebrow">{formatDate(message.created_at)} · dossier {message.case_id || '—'}</p>
              <p>{message.body}</p>
              <p className="notice mini">{message.read_at ? 'Lu' : 'Non lu'} · expéditeur et destinataire protégés par RLS.</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="notice">Aucun message visible avec la session actuelle.</p>
      )}
    </section>
  );
}

function BillingModule() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  useEffect(() => {
    async function loadBilling() {
      if (!supabase) {
        setState({ type: 'error', message: 'Connectez Supabase pour afficher la facturation.' });
        return;
      }
      const [paymentsResponse, subscriptionsResponse] = await Promise.all([
        supabase.from('payments').select('id,plan_id,amount_total,currency,status,created_at').order('created_at', { ascending: false }).limit(12),
        supabase.from('subscriptions').select('id,plan_id,status,billing_period,current_period_end,cancel_at_period_end').order('updated_at', { ascending: false }).limit(6),
      ]);
      if (paymentsResponse.error) {
        console.error('Erreur chargement paiements', paymentsResponse.error);
        setState({ type: 'error', message: 'Impossible de charger les paiements pour le moment.' });
        return;
      }
      if (subscriptionsResponse.error) {
        console.error('Erreur chargement abonnements', subscriptionsResponse.error);
        setState({ type: 'error', message: 'Impossible de charger les abonnements pour le moment.' });
        return;
      }
      setPayments((paymentsResponse.data || []) as PaymentRow[]);
      setSubscriptions((subscriptionsResponse.data || []) as SubscriptionRow[]);
    }
    void loadBilling();
  }, []);

  async function openPortal() {
    setState({ type: 'loading', message: '' });
    try {
      await redirectToCustomerPortal();
    } catch (error) {
      console.error('Portail Stripe indisponible', error);
      setState({ type: 'error', message: error instanceof Error ? error.message : 'Portail client disponible après configuration Stripe.' });
    }
  }

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <p className="eyebrow">Stripe</p>
          <h2>Paiements et abonnements</h2>
        </div>
        <button className="primary-button" type="button" onClick={openPortal} disabled={state.type === 'loading'}>{state.type === 'loading' ? 'Ouverture…' : 'Gérer via le portail Stripe'}</button>
      </div>
      {state.message && <p className={`form-message ${state.type === 'success' ? 'success' : 'error'}`}>{state.message}</p>}
      <div className="dashboard-grid compact-dashboard">
        <article className="feature-card">
          <h3>Abonnements</h3>
          {subscriptions.length > 0 ? (
            <ul>{subscriptions.map((subscription) => <li key={subscription.id}>{subscription.plan_id} · {subscription.status} · {subscription.billing_period || 'mensuel'} · fin {formatDate(subscription.current_period_end)}</li>)}</ul>
          ) : (
            <p>Aucun abonnement confirmé par webhook Stripe pour cette session.</p>
          )}
        </article>
        <article className="feature-card">
          <h3>Paiements</h3>
          {payments.length > 0 ? (
            <ul>{payments.map((payment) => <li key={payment.id}>{payment.plan_id || 'plan'} · {payment.status} · {payment.amount_total ? `${(payment.amount_total / 100).toLocaleString('fr-FR', { style: 'currency', currency: (payment.currency || 'eur').toUpperCase() })}` : 'montant en attente'} · {formatDate(payment.created_at)}</li>)}</ul>
          ) : (
            <p>Aucun paiement enregistré. La table est mise à jour uniquement après retour fiable du webhook Stripe.</p>
          )}
        </article>
      </div>
      <p className="notice mini">Ne considérez jamais `/success` comme preuve de paiement : seul le webhook Stripe met à jour l’abonnement actif, annulé ou expiré.</p>
    </section>
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
