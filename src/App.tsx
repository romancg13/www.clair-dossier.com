import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, DocumentsPage, HomePage, InfoPage, LegalPage, NotFoundPage, PaymentStatusPage, PaymentsPage, PricingPage, SubscriptionPage, WorkspacePage } from './pages';
import { AuthProvider, useAuth } from './lib/auth';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="fonctionnalites" element={<InfoPage pageKey="fonctionnalites" />} />
            <Route path="tarifs" element={<PricingPage />} />
            <Route path="securite" element={<LegalPage pageKey="securite" />} />
            <Route path="rgpd" element={<LegalPage pageKey="rgpd" />} />
            <Route path="documentation" element={<InfoPage pageKey="documentation" />} />
            <Route path="aide" element={<InfoPage pageKey="aide" />} />
            <Route path="blog" element={<BlogIndexPage />} />
            <Route path="blog/categorie/:slug" element={<BlogCategoryPage />} />
            <Route path="blog/:slug" element={<BlogPostPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="demo" element={<DemoPage />} />
            <Route path="conditions-utilisation" element={<LegalPage pageKey="conditions-utilisation" />} />
            <Route path="politique-confidentialite" element={<LegalPage pageKey="politique-confidentialite" />} />
            <Route path="mentions-legales" element={<LegalPage pageKey="mentions-legales" />} />
            <Route path="cookies" element={<LegalPage pageKey="cookies" />} />
            <Route path="connexion" element={<AuthPage mode="connexion" />} />
            <Route path="inscription" element={<AuthPage mode="inscription" />} />
            <Route path="creer-dossier" element={<CreateCasePage />} />
            <Route path="dashboard" element={<RequireAuth><WorkspacePage title="Tableau de bord client" audience="client" /></RequireAuth>} />
            <Route path="mes-dossiers" element={<RequireAuth><WorkspacePage title="Mes dossiers" audience="client" /></RequireAuth>} />
            <Route path="dossier/:id" element={<RequireAuth><WorkspacePage title="Dossier" audience="client" /></RequireAuth>} />
            <Route path="documents" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
            <Route path="messages" element={<RequireAuth><WorkspacePage title="Messages" audience="client" /></RequireAuth>} />
            <Route path="paiements" element={<RequireAuth><PaymentsPage /></RequireAuth>} />
            <Route path="abonnement" element={<RequireAuth><SubscriptionPage /></RequireAuth>} />
            <Route path="parametres" element={<RequireAuth><WorkspacePage title="Paramètres" audience="client" /></RequireAuth>} />
            <Route path="cabinet/dashboard" element={<RequireAuth><WorkspacePage title="Dashboard cabinet" audience="cabinet" /></RequireAuth>} />
            <Route path="cabinet/dossiers" element={<RequireAuth><WorkspacePage title="Dossiers cabinet" audience="cabinet" /></RequireAuth>} />
            <Route path="cabinet/clients" element={<RequireAuth><WorkspacePage title="Clients cabinet" audience="cabinet" /></RequireAuth>} />
            <Route path="cabinet/messages" element={<RequireAuth><WorkspacePage title="Messages cabinet" audience="cabinet" /></RequireAuth>} />
            <Route path="cabinet/taches" element={<RequireAuth><WorkspacePage title="Tâches cabinet" audience="cabinet" /></RequireAuth>} />
            <Route path="cabinet/facturation" element={<RequireAuth><WorkspacePage title="Facturation cabinet" audience="cabinet" /></RequireAuth>} />
            <Route path="cabinet/parametres" element={<RequireAuth><WorkspacePage title="Paramètres cabinet" audience="cabinet" /></RequireAuth>} />
            <Route path="success" element={<PaymentStatusPage status="success" />} />
            <Route path="cancel" element={<PaymentStatusPage status="cancel" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function RequireAuth({ children }: { children: ReactElement }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <div className="route-loading">Vérification de la session...</div>;
  }

  if (!auth.configured || !auth.user) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }

  return children;
}
