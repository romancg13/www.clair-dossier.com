import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { NewsletterForm } from './components/NewsletterForm';
import { PricingCards } from './components/PricingCards';
import { Seo } from './components/Seo';
import { blogPosts, categories, caseStatuses, featureCards, infoPages, legalPages, plans, site, warnings } from './data/site';
import { redirectToCustomerPortal } from './lib/stripe';
import { insertPublicRecord, supabase } from './lib/supabase';

type FormState = { type: 'idle' | 'success' | 'error'; message: string };
type WorkspaceModule = 'dashboard' | 'cases' | 'case-detail' | 'documents' | 'messages' | 'payments' | 'subscription' | 'settings' | 'clients' | 'tasks' | 'billing';
type SubscriptionRecord = {
  plan_id: string;
  status: string;
  billing_period: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
};

type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number' | 'datetime-local';
  options?: string[];
  required?: boolean;
};

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
          <h2>Dossier prud’homal - synthèse</h2>
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
          <button className="secondary-button" type="button" onClick={() => window.alert('Module de gestion des préférences à connecter avant activation de cookies non nécessaires.')}>
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
      <Seo title="Tarifs" description="Formules ClairDossier pour particuliers, PME et cabinets d’avocats avec Stripe Checkout prêt à connecter." path="/tarifs" />
      <PageHero title="Tarifs" description="Choisissez une formule adaptée. Le paiement Stripe devient actif dès que les clés et Price IDs sont configurés côté serveur." />
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
          { name: 'name', label: 'Nom', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Téléphone', type: 'tel' },
          { name: 'request_type', label: 'Type de demande', type: 'select', required: true, options: ['Particulier', 'PME', 'Avocat', 'Cabinet', 'Partenariat', 'Support'] },
          { name: 'message', label: 'Message', type: 'textarea', required: true },
        ]}
        consentLabel="J’accepte que ClairDossier traite ma demande conformément à la politique de confidentialité."
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
          { name: 'name', label: 'Nom', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'organization', label: 'Cabinet ou entreprise', required: true },
          { name: 'users_count', label: 'Nombre d’utilisateurs', type: 'number', required: true },
          { name: 'preferred_slot', label: 'Créneau souhaité', type: 'datetime-local', required: true },
          { name: 'message', label: 'Message', type: 'textarea' },
        ]}
        consentLabel="J’accepte d’être recontacté au sujet de la démo."
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
          <label><span>Description du problème</span><textarea name="problem_description" required rows={6} /></label>
          <SelectField name="urgency" label="Urgence" options={['Faible', 'Normale', 'Élevée', 'Délai judiciaire proche']} required />
          <label><span>Documents disponibles</span><textarea name="documents_available" rows={4} placeholder="Contrat, emails, facture, courrier..." /></label>
          <p className="notice mini">Les informations transmises servent à préparer votre dossier. Aucun conseil juridique personnalisé n’est fourni sans validation par un professionnel habilité.</p>
          <label className="checkbox-line"><input name="terms_accepted" type="checkbox" required /><span>J’accepte les conditions d’utilisation et comprends que l’IA ne remplace pas l’avocat.</span></label>
          <button className="primary-button" type="submit">Créer le dossier</button>
          {state.message && <p className={`form-message ${state.type}`}>{state.message}</p>}
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
      <section className="split-section compact">
        <div>
          <p className="eyebrow">Newsletter juridique</p>
          <h2>Recevoir les nouveaux articles et guides pratiques</h2>
          <p>Inscription enregistrée dans Supabase lorsque la table `newsletter_subscribers` et les règles RLS sont déployées.</p>
        </div>
        <NewsletterForm />
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
        <Link className="text-link" to="/blog">Retour au blog</Link>
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
      <section className="blog-grid">{posts.map((post) => <BlogCard key={post.slug} post={post} />)}</section>
    </>
  );
}

export function AuthPage({ mode }: { mode: 'connexion' | 'inscription' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });
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
          {isSignup && <label><span>Nom complet</span><input name="full_name" type="text" autoComplete="name" required /></label>}
          <label><span>Email</span><input name="email" type="email" required /></label>
          <label><span>Mot de passe</span><input name="password" type="password" minLength={8} required /></label>
          {isSignup && <label><span>Confirmation du mot de passe</span><input name="password_confirm" type="password" minLength={8} required /></label>}
          {isSignup && <SelectField name="account_type" label="Type de compte" options={['client', 'entreprise', 'cabinet']} required />}
          {isSignup && <label className="checkbox-line"><input name="terms_accepted" type="checkbox" required /><span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span></label>}
          <button className="primary-button" type="submit">{isSignup ? 'Créer mon compte' : 'Me connecter'}</button>
          {state.message && <p className={`form-message ${state.type}`}>{state.message}</p>}
          <Link className="text-link" to={`${isSignup ? '/connexion' : '/inscription'}${redirectQuery}`}>{isSignup ? 'J’ai déjà un compte' : 'Créer un compte'}</Link>
        </form>
      </section>
    </>
  );
}

export function WorkspacePage({ title, audience, module }: { title: string; audience: 'client' | 'cabinet'; module: WorkspaceModule }) {
  const cards = workspaceCards[module];
  return (
    <>
      <Seo title={title} description={`Espace ${audience} ClairDossier prêt à connecter à Supabase Auth et RLS.`} />
      <PageHero title={title} description={`Page privée ${audience}. Les données réelles doivent être protégées par Supabase Auth et RLS avant production.`} />
      <section className="dashboard-grid">
        {cards.map((card) => (
          <article className="feature-card" key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </article>
        ))}
        <article className="feature-card"><h2>Statuts dossier</h2><ul>{caseStatuses.map((status) => <li key={status}>{status}</li>)}</ul></article>
        <article className="feature-card"><h2>Sécurité</h2><p>Ne pas exposer de données sensibles sans session active, règles RLS et vérification du rôle utilisateur.</p></article>
      </section>
      {module === 'subscription' && <SubscriptionPanel />}
    </>
  );
}

export function PaymentStatusPage({ status }: { status: 'success' | 'cancel' }) {
  const success = status === 'success';
  return (
    <>
      <Seo title={success ? 'Paiement confirmé' : 'Paiement annulé'} description="Retour Stripe Checkout ClairDossier." path={success ? '/success' : '/cancel'} />
      <PageHero title={success ? 'Paiement confirmé' : 'Paiement annulé'} description={success ? 'Stripe a redirigé vers la page de succès. Le webhook doit maintenant synchroniser l’abonnement.' : 'Le paiement a été annulé ou interrompu. Aucun abonnement n’a été activé.'} />
      <section className="section-block centered"><Link className="primary-button" to={success ? '/abonnement' : '/tarifs'}>{success ? 'Voir mon abonnement' : 'Retour aux tarifs'}</Link></section>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <Seo title="Page introuvable" description="La page demandée n’existe pas." />
      <PageHero title="Page introuvable" description="Cette route n’existe pas encore ou l’URL est incorrecte." />
      <section className="section-block centered"><Link className="primary-button" to="/">Retour à l’accueil</Link></section>
    </>
  );
}

function FormPage({ title, description, table, fields, consentLabel }: { title: string; description: string; table: string; fields: FieldDef[]; consentLabel: string }) {
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const missing = fields.some((field) => field.required && !String(data.get(field.name) || '').trim());
    const consent = data.get('consent') === 'on';
    if (missing || !consent) {
      setState({ type: 'error', message: 'Complétez les champs obligatoires et cochez le consentement RGPD.' });
      return;
    }
    const payload = Object.fromEntries(fields.map((field) => [field.name, getFieldPayloadValue(field, data)]));
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
          <button className="primary-button" type="submit">Envoyer</button>
          {state.message && <p className={`form-message ${state.type}`}>{state.message}</p>}
        </form>
      </section>
    </>
  );
}

function getFieldPayloadValue(field: FieldDef, data: FormData) {
  const rawValue = String(data.get(field.name) || '').trim();
  if (field.type === 'number') return rawValue ? Number(rawValue) : null;
  if (field.type === 'datetime-local') return rawValue ? new Date(rawValue).toISOString() : null;
  return rawValue;
}

function RenderField({ field }: { field: FieldDef }) {
  if (field.type === 'textarea') return <label><span>{field.label}</span><textarea name={field.name} required={field.required} rows={5} /></label>;
  if (field.type === 'select') return <SelectField name={field.name} label={field.label} options={field.options || []} required={field.required} />;
  return <label><span>{field.label}</span><input name={field.name} type={field.type || 'text'} required={field.required} /></label>;
}

function SelectField({ name, label, options, required }: { name: string; label: string; options: string[]; required?: boolean }) {
  return (
    <label>
      <span>{label}</span>
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

const workspaceCards: Record<WorkspaceModule, { title: string; text: string }[]> = {
  dashboard: [
    { title: 'Vue synthèse', text: 'Regroupez les dossiers ouverts, demandes de pièces, messages récents et échéances à suivre.' },
    { title: 'Rôle utilisateur', text: 'La navigation différencie visiteurs, clients connectés et cabinets lorsque Supabase Auth est configuré.' },
  ],
  cases: [
    { title: 'Liste des dossiers', text: 'Les dossiers sont rattachés à l’utilisateur ou au cabinet via les règles RLS Supabase.' },
    { title: 'Priorités', text: 'Urgence, statut et prochaines actions doivent guider le traitement opérationnel.' },
  ],
  'case-detail': [
    { title: 'Dossier détaillé', text: 'Faits, pièces, messages et validation avocat seront réunis autour de l’identifiant de dossier.' },
    { title: 'Validation humaine', text: 'Toute synthèse ou analyse IA doit rester préparatoire tant qu’un professionnel habilité ne l’a pas validée.' },
  ],
  documents: [
    { title: 'Gestion documentaire', text: 'Upload, rattachement au dossier, confidentialité et statut sont prévus par la table documents.' },
    { title: 'Confidentialité', text: 'Les accès aux pièces doivent rester limités au propriétaire, au cabinet concerné et aux administrateurs habilités.' },
  ],
  messages: [
    { title: 'Messagerie dossier', text: 'Les échanges client-avocat peuvent être historisés avec expéditeur, destinataire, dossier et statut lu/non lu.' },
    { title: 'Traçabilité', text: 'Les conversations sensibles doivent être conservées avec un contexte dossier clair.' },
  ],
  payments: [
    { title: 'Historique paiements', text: 'Les paiements Stripe sont enregistrés par webhook dans la table payments lorsque Stripe est configuré.' },
    { title: 'Factures', text: 'Les factures et justificatifs doivent être récupérés depuis Stripe ou le portail client.' },
  ],
  subscription: [
    { title: 'Abonnement actif', text: 'Le webhook Stripe synchronise le statut actif, annulé, incomplet ou en retard dans subscriptions.' },
    { title: 'Portail client Stripe', text: 'Le portail s’ouvre uniquement avec un customer Stripe réel et la fonction Edge customer-portal configurée.' },
  ],
  settings: [
    { title: 'Paramètres de compte', text: 'Profil, préférences, sécurité et demandes RGPD doivent être accessibles depuis cette page.' },
    { title: 'Droits RGPD', text: 'Accès, rectification, suppression, opposition, portabilité et limitation sont documentés sur la page RGPD.' },
  ],
  clients: [
    { title: 'Clients cabinet', text: 'Les cabinets pourront suivre les clients rattachés, leurs dossiers et les prochaines actions.' },
    { title: 'Rôles équipe', text: 'Les droits doivent être affinés par cabinet et rôle avant ouverture multi-utilisateur.' },
  ],
  tasks: [
    { title: 'Tâches et validations', text: 'Demandes de pièces, relances, revues avocat et validations peuvent être pilotées depuis ce module.' },
    { title: 'Priorisation', text: 'Les tâches doivent tenir compte des urgences et des délais judiciaires signalés.' },
  ],
  billing: [
    { title: 'Facturation cabinet', text: 'Stripe gère les abonnements et le portail client dès que les clés serveur, Price IDs et webhooks sont actifs.' },
    { title: 'Restrictions formule', text: 'Les limites par formule doivent être appliquées côté serveur pour éviter tout contournement frontend.' },
  ],
};

function SubscriptionPanel() {
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadSubscription() {
      if (!supabase) {
        setState({ type: 'error', message: 'Supabase doit être configuré pour afficher votre abonnement.' });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan_id,status,billing_period,stripe_customer_id,current_period_end')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMounted) return;
      if (error) {
        console.error('Erreur lecture abonnement', error);
        setState({ type: 'error', message: "Impossible de charger l'abonnement pour le moment." });
      } else {
        setSubscription(data as SubscriptionRecord | null);
      }
      setLoading(false);
    }

    loadSubscription();
    return () => {
      isMounted = false;
    };
  }, []);

  async function openPortal() {
    if (!subscription?.stripe_customer_id) {
      setState({ type: 'error', message: 'Aucun client Stripe actif. Choisissez une formule après configuration Stripe.' });
      return;
    }

    try {
      await redirectToCustomerPortal(subscription.stripe_customer_id);
    } catch (error) {
      console.error('Portail Stripe indisponible', error);
      setState({ type: 'error', message: error instanceof Error ? error.message : "Le portail client n'est pas disponible." });
    }
  }

  return (
    <section className="section-block centered">
      <article className="feature-card subscription-card">
        <h2>Gestion de l’abonnement</h2>
        {loading ? <p>Chargement de votre abonnement...</p> : subscription ? (
          <>
            <p><strong>Formule :</strong> {subscription.plan_id}</p>
            <p><strong>Statut :</strong> {subscription.status}</p>
            <p><strong>Période :</strong> {subscription.billing_period || 'mensuelle'}</p>
            {subscription.current_period_end && <p><strong>Fin de période :</strong> {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}</p>}
            <button className="primary-button" type="button" onClick={openPortal}>Ouvrir le portail Stripe</button>
          </>
        ) : (
          <>
            <p>Aucun abonnement Stripe synchronisé pour ce compte.</p>
            <Link className="primary-button" to="/tarifs">Choisir une formule</Link>
          </>
        )}
        {state.message && <p className={`form-message ${state.type}`}>{state.message}</p>}
      </article>
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
      <Link className="text-link" to={`/blog/${post.slug}`}>Lire l’article</Link>
    </article>
  );
}
