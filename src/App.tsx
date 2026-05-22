import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, HomePage, InfoPage, LegalPage, NotFoundPage, PaymentStatusPage, PricingPage, WorkspacePage } from './pages';

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
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<WorkspacePage title="Tableau de bord client" audience="client" page="dashboard" />} />
            <Route path="mes-dossiers" element={<WorkspacePage title="Mes dossiers" audience="client" page="cases" />} />
            <Route path="dossier/:id" element={<WorkspacePage title="Dossier" audience="client" page="case-detail" />} />
            <Route path="documents" element={<WorkspacePage title="Documents" audience="client" page="documents" />} />
            <Route path="messages" element={<WorkspacePage title="Messages" audience="client" page="messages" />} />
            <Route path="paiements" element={<WorkspacePage title="Paiements" audience="client" page="payments" />} />
            <Route path="abonnement" element={<WorkspacePage title="Abonnement" audience="client" page="subscription" />} />
            <Route path="parametres" element={<WorkspacePage title="Paramètres" audience="client" page="settings" />} />
            <Route path="cabinet/dashboard" element={<WorkspacePage title="Dashboard cabinet" audience="cabinet" page="dashboard" />} />
            <Route path="cabinet/dossiers" element={<WorkspacePage title="Dossiers cabinet" audience="cabinet" page="cases" />} />
            <Route path="cabinet/clients" element={<WorkspacePage title="Clients cabinet" audience="cabinet" page="clients" />} />
            <Route path="cabinet/messages" element={<WorkspacePage title="Messages cabinet" audience="cabinet" page="messages" />} />
            <Route path="cabinet/taches" element={<WorkspacePage title="Tâches cabinet" audience="cabinet" page="tasks" />} />
            <Route path="cabinet/facturation" element={<WorkspacePage title="Facturation cabinet" audience="cabinet" page="billing" />} />
            <Route path="cabinet/parametres" element={<WorkspacePage title="Paramètres cabinet" audience="cabinet" page="settings" />} />
          </Route>
          <Route path="success" element={<PaymentStatusPage status="success" />} />
          <Route path="cancel" element={<PaymentStatusPage status="cancel" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
