import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, HomePage, InfoPage, LegalPage, NotFoundPage, PaymentStatusPage, PaymentsPage, PricingPage, SubscriptionPage, WorkspacePage } from './pages';

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
          <Route path="creer-dossier" element={<ProtectedRoute><CreateCasePage /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute><WorkspacePage title="Tableau de bord client" audience="client" /></ProtectedRoute>} />
          <Route path="mes-dossiers" element={<ProtectedRoute><WorkspacePage title="Mes dossiers" audience="client" /></ProtectedRoute>} />
          <Route path="dossier/:id" element={<ProtectedRoute><WorkspacePage title="Dossier" audience="client" /></ProtectedRoute>} />
          <Route path="documents" element={<ProtectedRoute><WorkspacePage title="Documents" audience="client" /></ProtectedRoute>} />
          <Route path="messages" element={<ProtectedRoute><WorkspacePage title="Messages" audience="client" /></ProtectedRoute>} />
          <Route path="paiements" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="abonnement" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
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
