import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { AuthConfigurationPage, AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, HomePage, InfoPage, LegalPage, LoadingPage, NotFoundPage, PaymentStatusPage, PricingPage, WorkspacePage } from './pages';
import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="dashboard" element={<ProtectedRoute><WorkspacePage title="Tableau de bord client" audience="client" /></ProtectedRoute>} />
          <Route path="mes-dossiers" element={<ProtectedRoute><WorkspacePage title="Mes dossiers" audience="client" /></ProtectedRoute>} />
          <Route path="dossier/:id" element={<ProtectedRoute><WorkspacePage title="Dossier" audience="client" /></ProtectedRoute>} />
          <Route path="documents" element={<ProtectedRoute><WorkspacePage title="Documents" audience="client" /></ProtectedRoute>} />
          <Route path="messages" element={<ProtectedRoute><WorkspacePage title="Messages" audience="client" /></ProtectedRoute>} />
          <Route path="paiements" element={<ProtectedRoute><WorkspacePage title="Paiements" audience="client" /></ProtectedRoute>} />
          <Route path="abonnement" element={<ProtectedRoute><WorkspacePage title="Abonnement" audience="client" /></ProtectedRoute>} />
          <Route path="parametres" element={<ProtectedRoute><WorkspacePage title="Paramètres" audience="client" /></ProtectedRoute>} />
          <Route path="cabinet/dashboard" element={<ProtectedRoute><WorkspacePage title="Dashboard cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/dossiers" element={<ProtectedRoute><WorkspacePage title="Dossiers cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/clients" element={<ProtectedRoute><WorkspacePage title="Clients cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/messages" element={<ProtectedRoute><WorkspacePage title="Messages cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/taches" element={<ProtectedRoute><WorkspacePage title="Tâches cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/facturation" element={<ProtectedRoute><WorkspacePage title="Facturation cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/parametres" element={<ProtectedRoute><WorkspacePage title="Paramètres cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="success" element={<PaymentStatusPage status="success" />} />
          <Route path="cancel" element={<PaymentStatusPage status="cancel" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) return <AuthConfigurationPage />;
  if (loading) return <LoadingPage />;
  if (!session) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}
