import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { NewsletterForm } from './components/NewsletterForm';
import { PricingCards } from './components/PricingCards';
import { Seo } from './components/Seo';
import { blogPosts, categories, caseStatuses, featureCards, infoPages, legalPages, plans, site, warnings } from './data/site';
import { useAuth } from './lib/auth';
import { insertPublicRecord, supabase } from './lib/supabase';
import { redirectToCustomerPortal } from './lib/stripe';

type FormState = { type: 'idle' | 'success' | 'error'; message: string };
type WorkspacePageId = 'dashboard' | 'cases' | 'case-detail' | 'documents' | 'messages' | 'payments' | 'subscription' | 'settings' | 'clients' | 'tasks' | 'billing';
type SubscriptionSummary = {
  plan_id: string;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
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
  const { user } = useAuth();

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

    try {
      const caseId = crypto.randomUUID();
      const caseResult = await insertPublicRecord('cases', {
        id: caseId,
        created_by: user?.id ?? null,
        title: `Dossier ${String(data.get('legal_domain'))}`,
        client_type: data.get('client_type'),
        legal_domain: data.get('legal_domain'),
        description: data.get('problem_description'),
        urgency: data.get('urgency'),
        status: 'reçu',
        terms_accepted: accepted,
      });

      if (!caseResult.ok) {
        setState({ type: 'error', message: caseResult.message });
        return;
      }

      const answerResult = await insertPublicRecord('case_intake_answers', {
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
      setState({ type: answerResult.ok ? 'success' : 'error', message: answerResult.ok ? 'Votre dossier a été créé avec le statut reçu.' : answerResult.message });
      if (answerResult.ok) form.reset();
    } catch (error) {
      console.error('Erreur création dossier', error);
      setState({ type: 'error', message: "Nous n'avons pas pu créer le dossier. Réessayez ou contactez-nous." });
    }
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
  const [state, setState] = useState<FormState>({ type: 'idle', message: '' });
  const { configured, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSignup = mode === 'inscription';
  const from = ((location.state as { from?: { pathname?: string } } | null)?.from?.pathname) || '/dashboard';

  useEffect(() => {
    if (user && !isSignup) navigate(from, { replace: true });
  }, [from, isSignup, navigate, user]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '').trim();
    const fullName = String(data.get('full_name') || '').trim();
    const termsAccepted = data.get('terms_accepted') === 'on';
    if (!email || !password) {
      setState({ type: 'error', message: 'Email et mot de passe sont obligatoires.' });
      return;
    }
    if (isSignup && (!fullName || !termsAccepted)) {
      setState({ type: 'error', message: 'Indiquez votre nom et acceptez les conditions pour créer un compte.' });
      return;
    }
    if (!configured || !supabase) {
      setState({ type: 'error', message: 'Authentification à connecter : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.' });
      return;
    }
    const response = isSignup
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (response.error) {
      console.error('Erreur auth Supabase', response.error);
      setState({ type: 'error', message: 'Impossible de finaliser l’authentification. Vérifiez vos informations.' });
      return;
    }
    setState({ type: 'success', message: isSignup ? 'Compte créé. Vérifiez votre email si la confirmation est activée.' : 'Connexion réussie.' });
    if (!isSignup) navigate(from, { replace: true });
  }

  return (
    <>
      <Seo title={isSignup ? 'Inscription' : 'Connexion'} description="Accéder à votre espace ClairDossier." path={`/${mode}`} />
      <PageHero title={isSignup ? 'Créer un compte' : 'Connexion'} description="Authentification Supabase prête à connecter pour session persistante et déconnexion." />
      <section className="form-shell single">
        <form className="stacked-form" onSubmit={onSubmit} noValidate>
          {isSignup && <label><span>Nom complet</span><input name="full_name" type="text" required /></label>}
          <label><span>Email</span><input name="email" type="email" required /></label>
          <label><span>Mot de passe</span><input name="password" type="password" minLength={8} required /></label>
          {isSignup && (
            <label className="checkbox-line">
              <input name="terms_accepted" type="checkbox" required />
              <span>J’accepte les <Link className="text-link" to="/conditions-utilisation">conditions d’utilisation</Link> et la <Link className="text-link" to="/politique-confidentialite">politique de confidentialité</Link>.</span>
            </label>
          )}
          <button className="primary-button" type="submit">{isSignup ? 'Créer mon compte' : 'Me connecter'}</button>
          {state.message && <p className={`form-message ${state.type}`}>{state.message}</p>}
          <Link className="text-link" to={isSignup ? '/connexion' : '/inscription'}>{isSignup ? 'J’ai déjà un compte' : 'Créer un compte'}</Link>
        </form>
      </section>
    </>
  );
}

export function WorkspacePage({ title, audience, page = 'dashboard' }: { title: string; audience: 'client' | 'cabinet'; page?: WorkspacePageId }) {
  const { session, user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [portalState, setPortalState] = useState<FormState>({ type: 'idle', message: '' });
  const privateLinks = audience === 'client'
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Dossiers', path: '/mes-dossiers' },
        { label: 'Documents', path: '/documents' },
        { label: 'Messages', path: '/messages' },
        { label: 'Paiements', path: '/paiements' },
        { label: 'Abonnement', path: '/abonnement' },
      ]
    : [
        { label: 'Dashboard', path: '/cabinet/dashboard' },
        { label: 'Dossiers', path: '/cabinet/dossiers' },
        { label: 'Clients', path: '/cabinet/clients' },
        { label: 'Messages', path: '/cabinet/messages' },
        { label: 'Tâches', path: '/cabinet/taches' },
        { label: 'Facturation', path: '/cabinet/facturation' },
      ];

  useEffect(() => {
    if (page !== 'subscription' || !supabase || !user) return;
    supabase
      .from('subscriptions')
      .select('plan_id,status,stripe_customer_id,current_period_end,cancel_at_period_end')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Erreur lecture abonnement', error);
          setPortalState({ type: 'error', message: "Impossible de charger l'abonnement pour le moment." });
          return;
        }
        setSubscription(data);
      });
  }, [page, user]);

  async function openCustomerPortal() {
    if (!subscription?.stripe_customer_id) {
      setPortalState({ type: 'error', message: 'Aucun client Stripe actif trouvé. Souscrivez une formule ou contactez le support.' });
      return;
    }
    setPortalState({ type: 'idle', message: '' });
    try {
      await redirectToCustomerPortal(subscription.stripe_customer_id, session?.access_token);
    } catch (error) {
      console.error('Erreur portail Stripe', error);
      setPortalState({ type: 'error', message: error instanceof Error ? error.message : 'Portail Stripe bientôt disponible.' });
    }
  }

  return (
    <>
      <Seo title={title} description={`Espace ${audience} ClairDossier prêt à connecter à Supabase Auth et RLS.`} />
      <PageHero title={title} description={`Page privée ${audience}. Session active pour ${user?.email || 'utilisateur connecté'} ; les données réelles restent protégées par Supabase Auth et RLS.`} />
      <section className="category-row" aria-label={`Navigation espace ${audience}`}>
        {privateLinks.map((link) => <Link key={link.path} to={link.path}>{link.label}</Link>)}
      </section>
      <section className="dashboard-grid">
        <article className="feature-card"><h2>Statuts dossier</h2><ul>{caseStatuses.map((status) => <li key={status}>{status}</li>)}</ul></article>
        <article className="feature-card"><h2>{workspaceModuleTitle(page)}</h2><p>{workspaceModuleDescription(page, audience)}</p></article>
        <article className="feature-card"><h2>Sécurité</h2><p>Ne pas exposer de données sensibles sans session active, règles RLS et vérification du rôle utilisateur.</p></article>
        {page === 'subscription' && (
          <article className="feature-card">
            <h2>Portail client Stripe</h2>
            {subscription ? (
              <p>Formule : {subscription.plan_id}. Statut : {subscription.status}. Fin de période : {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : 'à synchroniser'}.</p>
            ) : (
              <p>Aucun abonnement synchronisé pour ce compte. Le webhook Stripe doit alimenter la table subscriptions après checkout.</p>
            )}
            <button className="primary-button" type="button" onClick={openCustomerPortal}>Gérer mon abonnement</button>
            {portalState.message && <p className={`form-message ${portalState.type}`}>{portalState.message}</p>}
          </article>
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
    const payload = Object.fromEntries(fields.map((field) => [field.name, data.get(field.name)]));
    try {
      const result = await insertPublicRecord(table, { ...payload, consent_given: consent });
      setState({ type: result.ok ? 'success' : 'error', message: result.message });
      if (result.ok) form.reset();
    } catch (error) {
      console.error(`Erreur formulaire ${table}`, error);
      setState({ type: 'error', message: "Nous n'avons pas pu enregistrer votre demande. Réessayez ou contactez-nous par email." });
    }
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

function PageHero({ title, description }: { title: string; description: string }) {
  return <section className="page-hero"><p className="eyebrow">ClairDossier</p><h1>{title}</h1><p>{description}</p></section>;
}

function workspaceModuleTitle(page: WorkspacePageId) {
  const titles: Record<WorkspacePageId, string> = {
    dashboard: 'Vue opérationnelle',
    cases: 'Gestion des dossiers',
    'case-detail': 'Dossier détaillé',
    documents: 'Gestion documentaire',
    messages: 'Messagerie',
    payments: 'Paiements',
    subscription: 'Abonnement',
    settings: 'Paramètres',
    clients: 'Clients cabinet',
    tasks: 'Tâches et validations',
    billing: 'Facturation cabinet',
  };
  return titles[page];
}

function workspaceModuleDescription(page: WorkspacePageId, audience: 'client' | 'cabinet') {
  const descriptions: Record<WorkspacePageId, string> = {
    dashboard: audience === 'client' ? 'Vue synthétique des dossiers, messages, documents attendus et paiements.' : 'Vue cabinet des dossiers reçus, clients, tâches, validations et facturation.',
    cases: 'Les listes de dossiers seront lues depuis Supabase avec RLS : reçu, incomplet, en analyse, attente de pièces, validation avocat et clôturé.',
    'case-detail': 'Le détail dossier doit regrouper faits, pièces, messages, statuts et validations sans conseil automatisé non contrôlé.',
    documents: 'Upload, liste, statut, confidentialité et rattachement au dossier sont prévus par le schéma documents et les futurs buckets Storage.',
    messages: 'Les échanges client-avocat seront historisés, rattachés au dossier et marqués lu/non lu via la table messages.',
    payments: 'Les paiements Stripe sont synchronisés dans payments par webhook ; les factures restent consultables via Stripe.',
    subscription: 'Les abonnements sont synchronisés par webhook dans subscriptions et gérés via le portail client Stripe.',
    settings: 'Paramètres de compte, consentements, rôle et préférences doivent respecter les droits RGPD et la séparation des accès.',
    clients: 'Les cabinets pourront suivre les clients rattachés à leurs dossiers avec contrôle de rôle cabinet_admin/lawyer.',
    tasks: 'Les tâches cadrent les demandes de pièces, validations avocat et échéances internes.',
    billing: 'La facturation cabinet s’appuie sur Stripe Checkout, le portail client et la table subscriptions.',
  };
  return descriptions[page];
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
      <Link className="text-link" to={`/blog/${post.slug}`}>Lire l’article</Link>
    </article>
  );
}
