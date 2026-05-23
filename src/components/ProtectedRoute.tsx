import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export type UserRole = 'client' | 'lawyer' | 'cabinet_admin' | 'admin';

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: UserRole[];
};

type AuthCheck = {
  isCheckingSession: boolean;
  isAuthenticated: boolean;
  isAuthorized: boolean;
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const [authCheck, setAuthCheck] = useState<AuthCheck>({
    isCheckingSession: true,
    isAuthenticated: false,
    isAuthorized: false,
  });
  const roleKey = allowedRoles?.join('|') || '';

  useEffect(() => {
    if (!supabase) {
      setAuthCheck({ isCheckingSession: false, isAuthenticated: false, isAuthorized: false });
      return;
    }
    const client = supabase;

    let isMounted = true;
    async function checkSession() {
      const { data } = await client.auth.getSession();
      if (!isMounted) return;

      if (!data.session) {
        setAuthCheck({ isCheckingSession: false, isAuthenticated: false, isAuthorized: false });
        return;
      }

      if (!allowedRoles?.length) {
        setAuthCheck({ isCheckingSession: false, isAuthenticated: true, isAuthorized: true });
        return;
      }

      const { data: profile, error } = await client
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Impossible de vérifier le rôle utilisateur', error);
      }

      const role = profile?.role as UserRole | undefined;
      setAuthCheck({
        isCheckingSession: false,
        isAuthenticated: true,
        isAuthorized: Boolean(role && allowedRoles.includes(role)),
      });
    }

    void checkSession();

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthCheck({ isCheckingSession: false, isAuthenticated: false, isAuthorized: false });
        return;
      }
      void checkSession();
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [allowedRoles, roleKey]);

  if (authCheck.isCheckingSession) {
    return <section className="section-block centered"><p className="notice">Vérification de votre session...</p></section>;
  }

  if (!authCheck.isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/inscription?redirect=${redirect}`} replace />;
  }

  if (!authCheck.isAuthorized) {
    return (
      <section className="section-block centered">
        <p className="notice">Vous n'avez pas les droits nécessaires pour accéder à cet espace.</p>
      </section>
    );
  }

  return <>{children}</>;
}
