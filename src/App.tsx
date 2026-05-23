import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage, BlogCategoryPage, BlogIndexPage, BlogPostPage, ContactPage, CreateCasePage, DemoPage, HomePage, InfoPage, LegalPage, NotFoundPage, PaymentStatusPage, PricingPage, WorkspacePage } from './pages';
import type { UserRole } from './lib/security';

const clientRoles: UserRole[] = ['client_particulier', 'client_entreprise'];
const cabinetRoles: UserRole[] = ['avocat', 'collaborateur', 'admin_cabinet', 'super_admin'];

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
          <Route path="creer-dossier" element={<ProtectedRoute allowedRoles={clientRoles} unauthenticatedTo="/inscription"><CreateCasePage /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Tableau de bord client" audience="client" /></ProtectedRoute>} />
          <Route path="mes-dossiers" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Mes dossiers" audience="client" /></ProtectedRoute>} />
          <Route path="dossier/:id" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Dossier" audience="client" /></ProtectedRoute>} />
          <Route path="documents" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Documents" audience="client" /></ProtectedRoute>} />
          <Route path="messages" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Messages" audience="client" /></ProtectedRoute>} />
          <Route path="paiements" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Paiements" audience="client" /></ProtectedRoute>} />
          <Route path="abonnement" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Abonnement" audience="client" /></ProtectedRoute>} />
          <Route path="parametres" element={<ProtectedRoute allowedRoles={clientRoles}><WorkspacePage title="Paramètres" audience="client" /></ProtectedRoute>} />
          <Route path="cabinet/dashboard" element={<ProtectedRoute allowedRoles={cabinetRoles}><WorkspacePage title="Dashboard cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/dossiers" element={<ProtectedRoute allowedRoles={cabinetRoles}><WorkspacePage title="Dossiers cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/clients" element={<ProtectedRoute allowedRoles={cabinetRoles}><WorkspacePage title="Clients cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/messages" element={<ProtectedRoute allowedRoles={cabinetRoles}><WorkspacePage title="Messages cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/taches" element={<ProtectedRoute allowedRoles={cabinetRoles}><WorkspacePage title="Tâches cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/facturation" element={<ProtectedRoute allowedRoles={cabinetRoles}><WorkspacePage title="Facturation cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="cabinet/parametres" element={<ProtectedRoute allowedRoles={cabinetRoles}><WorkspacePage title="Paramètres cabinet" audience="cabinet" /></ProtectedRoute>} />
          <Route path="success" element={<PaymentStatusPage status="success" />} />
          <Route path="cancel" element={<PaymentStatusPage status="cancel" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
