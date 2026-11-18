// Routes de l'espace privé de recette (build VITE_RECETTE=1 uniquement). Déclarées
// AVANT les routes existantes de même chemin : React Router retient la première.
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { MoiProvider, useMoi } from './useMoi';

const P = {
  Connexion: lazy(() => import('./pages').then((m) => ({ default: m.RecetteConnexion }))),
  Inscription: lazy(() => import('./pages').then((m) => ({ default: m.RecetteInscription }))),
  Compte: lazy(() => import('./pages').then((m) => ({ default: m.RecetteCompte }))),
  Nouveau: lazy(() => import('./pages').then((m) => ({ default: m.RecetteNouveau }))),
  Boite: lazy(() => import('./pages').then((m) => ({ default: m.RecetteBoite }))),
  Admin: lazy(() => import('./pages').then((m) => ({ default: m.RecetteAdmin }))),
  Dossier: lazy(() => import('./DossierPage').then((m) => ({ default: m.DossierPage }))),
  Tarifs: lazy(() => import('./tarifs').then((m) => ({ default: m.TarifsLisibles }))),
  Paiement: lazy(() => import('./tarifs').then((m) => ({ default: m.PaiementRecette }))),
};

function Garde({ children }: { children: ReactNode }) {
  const { moi, loading } = useMoi();
  const loc = useLocation();
  if (loading) return <p role="status" className="px-6 py-16 text-center text-slate-500">Ouverture de votre espace…</p>;
  if (!moi?.user) return <Navigate to={`/connexion?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

const wrap = (node: ReactNode, guarded: boolean) => (
  <Suspense fallback={<p role="status" className="px-6 py-16 text-center text-slate-500">Chargement de l’espace…</p>}>
    <MoiProvider>{guarded ? <Garde>{node}</Garde> : node}</MoiProvider>
  </Suspense>
);

export function recetteRoutes() {
  return (
    <>
      <Route path="connexion" element={wrap(<P.Connexion />, false)} />
      <Route path="inscription" element={wrap(<P.Inscription />, false)} />
      <Route path="tarifs" element={wrap(<P.Tarifs />, false)} />
      <Route path="abonnement" element={wrap(<P.Paiement />, true)} />
      <Route path="compte" element={wrap(<P.Compte />, true)} />
      <Route path="compte/dossier/:id" element={wrap(<P.Dossier />, true)} />
      <Route path="dossier/nouveau" element={wrap(<P.Nouveau />, true)} />
      <Route path="boite" element={wrap(<P.Boite />, true)} />
      <Route path="admin" element={wrap(<P.Admin />, true)} />
    </>
  );
}
