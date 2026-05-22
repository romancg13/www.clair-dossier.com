import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function ProtectedRoute() {
  const { configured, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <section className="page-hero">
        <p className="eyebrow">ClairDossier</p>
        <h1>Chargement de votre espace</h1>
        <p>Vérification de la session Supabase en cours.</p>
      </section>
    );
  }

  if (!configured) {
    return (
      <section className="page-hero">
        <p className="eyebrow">Espace privé</p>
        <h1>Authentification à connecter</h1>
        <p>Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY pour activer les espaces client, avocat et cabinet en production.</p>
        <div className="hero-actions">
          <Link className="primary-button" to="/documentation">Voir la documentation</Link>
          <Link className="secondary-button" to="/contact">Contacter ClairDossier</Link>
        </div>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
