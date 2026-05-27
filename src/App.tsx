import { lazy, Suspense, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';

// Keep Home eager so the first paint is immediate on the most visited route.
import { Home } from './pages/Home';

// Lazy-load the rest — each route ships its own chunk so the initial bundle
// stays tight and visits to /tarifs, /blog, /securite, etc. only load what
// they need.
const named = <T extends string>(load: () => Promise<Record<T, ComponentType<Record<string, never>>>>, name: T) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const FeaturesIndex = named(() => import('./pages/FeaturesIndex'), 'FeaturesIndex');
const FeatureDetail = named(() => import('./pages/FeatureDetail'), 'FeatureDetail');
const Pricing = named(() => import('./pages/Pricing'), 'Pricing');
const Security = named(() => import('./pages/Security'), 'Security');
const BlogIndex = named(() => import('./pages/BlogIndex'), 'BlogIndex');
const BlogPost = named(() => import('./pages/BlogPost'), 'BlogPost');
const Contact = named(() => import('./pages/Contact'), 'Contact');
const DossierFlow = named(() => import('./pages/DossierFlow'), 'DossierFlow');
const LegalPage = lazy(() =>
  import('./pages/LegalPage').then((m) => ({ default: m.LegalPage }))
);
const NotFound = named(() => import('./pages/NotFound'), 'NotFound');

function RouteFallback() {
  return (
    <div
      className="mx-auto flex max-w-7xl items-center justify-center px-5 py-32"
      role="status"
      aria-live="polite"
    >
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
        Chargement…
      </span>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="fonctionnalites"
          element={
            <Suspense fallback={<RouteFallback />}>
              <FeaturesIndex />
            </Suspense>
          }
        />
        <Route
          path="fonctionnalites/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <FeatureDetail />
            </Suspense>
          }
        />
        <Route
          path="tarifs"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Pricing />
            </Suspense>
          }
        />
        <Route
          path="securite"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Security />
            </Suspense>
          }
        />
        <Route
          path="blog"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BlogIndex />
            </Suspense>
          }
        />
        <Route
          path="blog/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BlogPost />
            </Suspense>
          }
        />
        <Route
          path="contact"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Contact />
            </Suspense>
          }
        />
        <Route
          path="dossier/nouveau"
          element={
            <Suspense fallback={<RouteFallback />}>
              <DossierFlow />
            </Suspense>
          }
        />
        <Route
          path="mentions-legales"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LegalPage slug="mentions-legales" />
            </Suspense>
          }
        />
        <Route
          path="cgv"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LegalPage slug="cgv" />
            </Suspense>
          }
        />
        <Route
          path="politique-confidentialite"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LegalPage slug="politique-confidentialite" />
            </Suspense>
          }
        />
        <Route
          path="cookies"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LegalPage slug="cookies" />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NotFound />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
