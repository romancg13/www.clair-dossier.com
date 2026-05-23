import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, HomePage, InfoPage, LegalPage, NotFoundPage, PaymentStatusPage, PricingPage, WorkspacePage } from './pages';

export default function App() {
  const protect = (element: ReactElement) => <ProtectedRoute>{element}</ProtectedRoute>;

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
          <Route path="dashboard" element={protect(<WorkspacePage title="Tableau de bord client" audience="client" />)} />
          <Route path="mes-dossiers" element={protect(<WorkspacePage title="Mes dossiers" audience="client" />)} />
          <Route path="dossier/:id" element={protect(<WorkspacePage title="Dossier" audience="client" />)} />
          <Route path="documents" element={protect(<WorkspacePage title="Documents" audience="client" />)} />
          <Route path="messages" element={protect(<WorkspacePage title="Messages" audience="client" />)} />
          <Route path="paiements" element={protect(<WorkspacePage title="Paiements" audience="client" />)} />
          <Route path="abonnement" element={protect(<WorkspacePage title="Abonnement" audience="client" />)} />
          <Route path="parametres" element={protect(<WorkspacePage title="Paramètres" audience="client" />)} />
          <Route path="cabinet/dashboard" element={protect(<WorkspacePage title="Dashboard cabinet" audience="cabinet" />)} />
          <Route path="cabinet/dossiers" element={protect(<WorkspacePage title="Dossiers cabinet" audience="cabinet" />)} />
          <Route path="cabinet/clients" element={protect(<WorkspacePage title="Clients cabinet" audience="cabinet" />)} />
          <Route path="cabinet/messages" element={protect(<WorkspacePage title="Messages cabinet" audience="cabinet" />)} />
          <Route path="cabinet/taches" element={protect(<WorkspacePage title="Tâches cabinet" audience="cabinet" />)} />
          <Route path="cabinet/facturation" element={protect(<WorkspacePage title="Facturation cabinet" audience="cabinet" />)} />
          <Route path="cabinet/parametres" element={protect(<WorkspacePage title="Paramètres cabinet" audience="cabinet" />)} />
          <Route path="success" element={<PaymentStatusPage status="success" />} />
          <Route path="cancel" element={<PaymentStatusPage status="cancel" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
