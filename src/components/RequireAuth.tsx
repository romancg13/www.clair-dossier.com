import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Protège une route : redirige vers /connexion si non authentifié. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useAuth();
  const location = useLocation();

  if (loading) {
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

  // Si l'auth n'est pas configurée (build sans env), on ne bloque pas la démo.
  if (configured && !session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?next=${next}`} replace />;
  }

  return <>{children}</>;
}
