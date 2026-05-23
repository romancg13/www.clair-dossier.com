import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, HomePage, InfoPage, LegalPage, NotFoundPage, PaymentStatusPage, PricingPage, WorkspacePage } from './pages';

function privatePage(element: ReactNode) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

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
          <Route path="creer-dossier" element={privatePage(<CreateCasePage />)} />
          <Route path="dashboard" element={privatePage(<WorkspacePage title="Tableau de bord client" audience="client" module="dashboard" />)} />
          <Route path="mes-dossiers" element={privatePage(<WorkspacePage title="Mes dossiers" audience="client" module="cases" />)} />
          <Route path="dossier/:id" element={privatePage(<WorkspacePage title="Dossier" audience="client" module="case-detail" />)} />
          <Route path="documents" element={privatePage(<WorkspacePage title="Documents" audience="client" module="documents" />)} />
          <Route path="messages" element={privatePage(<WorkspacePage title="Messages" audience="client" module="messages" />)} />
          <Route path="paiements" element={privatePage(<WorkspacePage title="Paiements" audience="client" module="payments" />)} />
          <Route path="abonnement" element={privatePage(<WorkspacePage title="Abonnement" audience="client" module="subscription" />)} />
          <Route path="parametres" element={privatePage(<WorkspacePage title="Paramètres" audience="client" module="settings" />)} />
          <Route path="cabinet/dashboard" element={privatePage(<WorkspacePage title="Dashboard cabinet" audience="cabinet" module="dashboard" />)} />
          <Route path="cabinet/dossiers" element={privatePage(<WorkspacePage title="Dossiers cabinet" audience="cabinet" module="cases" />)} />
          <Route path="cabinet/clients" element={privatePage(<WorkspacePage title="Clients cabinet" audience="cabinet" module="clients" />)} />
          <Route path="cabinet/messages" element={privatePage(<WorkspacePage title="Messages cabinet" audience="cabinet" module="messages" />)} />
          <Route path="cabinet/taches" element={privatePage(<WorkspacePage title="Tâches cabinet" audience="cabinet" module="tasks" />)} />
          <Route path="cabinet/facturation" element={privatePage(<WorkspacePage title="Facturation cabinet" audience="cabinet" module="billing" />)} />
          <Route path="cabinet/parametres" element={privatePage(<WorkspacePage title="Paramètres cabinet" audience="cabinet" module="settings" />)} />
          <Route path="success" element={<PaymentStatusPage status="success" />} />
          <Route path="cancel" element={<PaymentStatusPage status="cancel" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
