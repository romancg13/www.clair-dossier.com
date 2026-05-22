import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, HomePage, InfoPage, LegalPage, NotFoundPage, PaymentStatusPage, PricingPage, PrivateWorkspacePage } from './pages';

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
          <Route path="dashboard" element={<PrivateWorkspacePage title="Tableau de bord client" audience="client" />} />
          <Route path="mes-dossiers" element={<PrivateWorkspacePage title="Mes dossiers" audience="client" />} />
          <Route path="dossier/:id" element={<PrivateWorkspacePage title="Dossier" audience="client" />} />
          <Route path="documents" element={<PrivateWorkspacePage title="Documents" audience="client" />} />
          <Route path="messages" element={<PrivateWorkspacePage title="Messages" audience="client" />} />
          <Route path="paiements" element={<PrivateWorkspacePage title="Paiements" audience="client" />} />
          <Route path="abonnement" element={<PrivateWorkspacePage title="Abonnement" audience="client" />} />
          <Route path="parametres" element={<PrivateWorkspacePage title="Paramètres" audience="client" />} />
          <Route path="cabinet/dashboard" element={<PrivateWorkspacePage title="Dashboard cabinet" audience="cabinet" />} />
          <Route path="cabinet/dossiers" element={<PrivateWorkspacePage title="Dossiers cabinet" audience="cabinet" />} />
          <Route path="cabinet/clients" element={<PrivateWorkspacePage title="Clients cabinet" audience="cabinet" />} />
          <Route path="cabinet/messages" element={<PrivateWorkspacePage title="Messages cabinet" audience="cabinet" />} />
          <Route path="cabinet/taches" element={<PrivateWorkspacePage title="Tâches cabinet" audience="cabinet" />} />
          <Route path="cabinet/facturation" element={<PrivateWorkspacePage title="Facturation cabinet" audience="cabinet" />} />
          <Route path="cabinet/parametres" element={<PrivateWorkspacePage title="Paramètres cabinet" audience="cabinet" />} />
          <Route path="success" element={<PaymentStatusPage status="success" />} />
          <Route path="cancel" element={<PaymentStatusPage status="cancel" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
