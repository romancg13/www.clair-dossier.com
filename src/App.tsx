import { lazy, Suspense, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';

// Keep Home eager so the first paint is immediate on the most visited route.
import { Home } from './pages/Home';

// Lazy-load the rest — each route ships its own chunk so the initial bundle
// stays tight and visits to /tarifs, /blog, /securite, etc. only load what
// they need.
//
// Pré-rendu (Lot 3) : côté serveur, React.lazy suspend et l'API prerender
// émet alors la frontière en format « complétion différée » (segment caché +
// script), illisible sans JavaScript. entry-server.tsx appelle donc
// preloadAllRoutes() avant le rendu : chaque page est résolue dans ssrPages
// et rendue de façon synchrone — aucune frontière Suspense en attente.
type PageComponent = ComponentType<Record<string, never>>;
type PageLoader = () => Promise<Record<string, PageComponent>>;

const pageRegistry: Array<{ load: PageLoader; name: string }> = [];
const ssrPages = new Map<string, PageComponent>();
// Côté client : pages résolues AVANT hydratation (voir preloadForPath) pour
// que la frontière Suspense n'affiche jamais son fallback par-dessus le HTML
// pré-rendu. Vide en navigation SPA classique → comportement lazy inchangé.
const clientPages = new Map<string, PageComponent>();

/** Réservé au pré-rendu (src/entry-server.tsx). */
export async function preloadAllRoutes(): Promise<void> {
  for (const { load, name } of pageRegistry) {
    if (!ssrPages.has(name)) {
      const mod = await load();
      ssrPages.set(name, mod[name]);
    }
  }
}

/**
 * Précharge le chunk de la route courante avant hydrateRoot (src/main.tsx).
 * Doit rester aligné avec les routes publiques déclarées plus bas.
 */
export async function preloadForPath(pathname: string): Promise<void> {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const name = /^\/fonctionnalites\/[^/]+$/.test(clean)
    ? 'FeatureDetail'
    : clean === '/fonctionnalites'
      ? 'FeaturesIndex'
      : clean === '/tarifs'
        ? 'Pricing'
        : clean === '/securite'
          ? 'Security'
          : /^\/blog\/[^/]+$/.test(clean)
            ? 'BlogPost'
            : clean === '/blog'
              ? 'BlogIndex'
              : clean === '/contact'
                ? 'Contact'
                : /^\/(mentions-legales|cgv|politique-confidentialite|cookies)$/.test(clean)
                  ? 'LegalPage'
                  : clean === '/cabinets-avocats'
                    ? 'CabinetsAvocats'
                    : clean === '/experts-comptables'
                      ? 'ExpertsComptables'
                      : clean === '/grands-comptes'
                        ? 'GrandsComptes'
                        : clean === '/etat-du-produit'
                          ? 'ProductStatus'
                          : clean === '/rendez-vous'
                            ? 'RendezVous'
                            : clean === '/marseille'
                              ? 'Marseille'
                              : null;
  if (!name) return;
  const entry = pageRegistry.find((e) => e.name === name);
  if (!entry || clientPages.has(name)) return;
  try {
    const mod = await entry.load();
    clientPages.set(name, mod[name]);
  } catch {
    // Échec de préchargement : l'hydratation retombera sur le lazy classique.
  }
}

const named = <T extends string>(load: () => Promise<Record<T, PageComponent>>, name: T): PageComponent => {
  pageRegistry.push({ load: load as PageLoader, name });
  const Lazy = lazy(() => load().then((m) => ({ default: m[name] })));
  if (import.meta.env.SSR) {
    return function SsrResolved(props: Record<string, never>) {
      const Resolved = ssrPages.get(name);
      const Comp = (Resolved ?? Lazy) as PageComponent;
      return <Comp {...props} />;
    };
  }
  return function PageResolver(props: Record<string, never>) {
    const Ready = clientPages.get(name);
    const Comp = (Ready ?? Lazy) as PageComponent;
    return <Comp {...props} />;
  };
};

const FeaturesIndex = named(() => import('./pages/FeaturesIndex'), 'FeaturesIndex');
const FeatureDetail = named(() => import('./pages/FeatureDetail'), 'FeatureDetail');
const Pricing = named(() => import('./pages/Pricing'), 'Pricing');
const Security = named(() => import('./pages/Security'), 'Security');
const BlogIndex = named(() => import('./pages/BlogIndex'), 'BlogIndex');
const BlogPost = named(() => import('./pages/BlogPost'), 'BlogPost');
const Contact = named(() => import('./pages/Contact'), 'Contact');
const DossierFlow = named(() => import('./pages/DossierFlow'), 'DossierFlow');
// LegalPage prend une prop (slug) : même mécanique que named(), avec ses types.
pageRegistry.push({
  load: () => import('./pages/LegalPage') as unknown as Promise<Record<string, PageComponent>>,
  name: 'LegalPage',
});
const LegalLazy = lazy(() =>
  import('./pages/LegalPage').then((m) => ({ default: m.LegalPage }))
);
function LegalPage(props: { slug: string }) {
  const cache = import.meta.env.SSR ? ssrPages : clientPages;
  const Resolved = cache.get('LegalPage') as unknown as ComponentType<{ slug: string }> | undefined;
  if (Resolved) return <Resolved {...props} />;
  return <LegalLazy {...props} />;
}
const NotFound = named(() => import('./pages/NotFound'), 'NotFound');
const Signup = named(() => import('./pages/Signup'), 'Signup');
const Login = named(() => import('./pages/Login'), 'Login');
const Account = named(() => import('./pages/Account'), 'Account');
const DossierDetail = named(() => import('./pages/DossierDetail'), 'DossierDetail');
// Vague 1 — parcours à forte valeur (toute route ajoutée ici doit aussi
// entrer dans le manifeste public src/data/routes.ts).
const CabinetsAvocats = named(() => import('./pages/SegmentPage'), 'CabinetsAvocats');
const ExpertsComptables = named(() => import('./pages/SegmentPage'), 'ExpertsComptables');
const GrandsComptes = named(() => import('./pages/SegmentPage'), 'GrandsComptes');
const ProductStatus = named(() => import('./pages/ProductStatus'), 'ProductStatus');
const RendezVous = named(() => import('./pages/RendezVous'), 'RendezVous');
const Marseille = named(() => import('./pages/Marseille'), 'Marseille');

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
            <RequireAuth>
              <Suspense fallback={<RouteFallback />}>
                <DossierFlow />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="inscription"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Signup />
            </Suspense>
          }
        />
        <Route
          path="connexion"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path="compte"
          element={
            <RequireAuth>
              <Suspense fallback={<RouteFallback />}>
                <Account />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="compte/dossier/:id"
          element={
            <RequireAuth>
              <Suspense fallback={<RouteFallback />}>
                <DossierDetail />
              </Suspense>
            </RequireAuth>
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
          path="cabinets-avocats"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CabinetsAvocats />
            </Suspense>
          }
        />
        <Route
          path="experts-comptables"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ExpertsComptables />
            </Suspense>
          }
        />
        <Route
          path="grands-comptes"
          element={
            <Suspense fallback={<RouteFallback />}>
              <GrandsComptes />
            </Suspense>
          }
        />
        <Route
          path="etat-du-produit"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductStatus />
            </Suspense>
          }
        />
        <Route
          path="rendez-vous"
          element={
            <Suspense fallback={<RouteFallback />}>
              <RendezVous />
            </Suspense>
          }
        />
        <Route
          path="marseille"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Marseille />
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
