import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { FeaturesIndex } from './pages/FeaturesIndex';
import { FeatureDetail } from './pages/FeatureDetail';
import { Pricing } from './pages/Pricing';
import { Security } from './pages/Security';
import { BlogIndex } from './pages/BlogIndex';
import { BlogPost } from './pages/BlogPost';
import { Contact } from './pages/Contact';
import { DossierFlow } from './pages/DossierFlow';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="fonctionnalites" element={<FeaturesIndex />} />
        <Route path="fonctionnalites/:slug" element={<FeatureDetail />} />
        <Route path="tarifs" element={<Pricing />} />
        <Route path="securite" element={<Security />} />
        <Route path="blog" element={<BlogIndex />} />
        <Route path="blog/:slug" element={<BlogPost />} />
        <Route path="contact" element={<Contact />} />
        <Route path="dossier/nouveau" element={<DossierFlow />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
