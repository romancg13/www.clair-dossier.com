import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../lib/security';

type GuardState =
  | { status: 'checking' }
  | { status: 'unauthenticated' }
  | { status: 'authorized' }
  | { status: 'forbidden' };

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: readonly UserRole[];
  unauthenticatedTo?: '/connexion' | '/inscription';
};

export function ProtectedRoute({ children, allowedRoles, unauthenticatedTo = '/connexion' }: ProtectedRouteProps) {
  const location = useLocation();
  const [guardState, setGuardState] = useState<GuardState>({ status: 'checking' });

  useEffect(() => {
    if (!supabase) {
      setGuardState({ status: 'unauthenticated' });
      return;
    }

    let isMounted = true;
    async function checkAccess() {
      setGuardState({ status: 'checking' });
      const { data, error } = await supabase!.auth.getUser();
      if (!isMounted) return;
      if (error || !data.user) {
        if (error) console.error('Erreur vérification session Supabase', error);
        setGuardState({ status: 'unauthenticated' });
        return;
      }

      if (!allowedRoles?.length) {
        setGuardState({ status: 'authorized' });
        return;
      }

      const { data: profile, error: profileError } = await supabase!
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
      if (!isMounted) return;
      if (profileError) console.error('Erreur lecture rôle utilisateur', profileError);
      const role = normalizeRole(profile?.role);
      const fallbackRole = normalizeRole(data.user.user_metadata?.account_type);
      const authorized = (role && allowedRoles.includes(role)) || (fallbackRole && allowedRoles.includes(fallbackRole));
      setGuardState(authorized ? { status: 'authorized' } : { status: 'forbidden' });
    }

    void checkAccess();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void checkAccess();
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [allowedRoles]);

  if (guardState.status === 'checking') {
    return <section className="section-block centered"><p className="notice">Vérification de votre session...</p></section>;
  }

  if (guardState.status === 'unauthenticated') {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${unauthenticatedTo}?redirect=${redirect}`} replace />;
  }

  if (guardState.status === 'forbidden') {
    return <section className="section-block centered"><p className="form-message error">Accès refusé.</p></section>;
  }

  return <>{children}</>;
}

function normalizeRole(role: unknown): UserRole | undefined {
  if (role === 'client') return 'client_particulier';
  if (role === 'entreprise' || role === 'cabinet') return 'client_entreprise';
  if (role === 'lawyer') return 'avocat';
  if (role === 'cabinet_admin') return 'admin_cabinet';
  if (role === 'admin') return 'super_admin';
  if (
    role === 'client_particulier'
    || role === 'client_entreprise'
    || role === 'avocat'
    || role === 'collaborateur'
    || role === 'admin_cabinet'
    || role === 'super_admin'
  ) {
    return role;
  }
  return undefined;
}
