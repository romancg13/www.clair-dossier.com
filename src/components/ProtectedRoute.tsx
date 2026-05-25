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

const AUTH_CHECK_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e: unknown) => { clearTimeout(timer); reject(e); },
    );
  });
}

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
      try {
        const { data, error } = await withTimeout(
          supabase!.auth.getUser(),
          AUTH_CHECK_TIMEOUT_MS,
          'auth.getUser',
        );
        if (!isMounted) return;
        if (error || !data.user) {
          setGuardState({ status: 'unauthenticated' });
          return;
        }

        if (!allowedRoles?.length) {
          setGuardState({ status: 'authorized' });
          return;
        }

        const { data: profile } = await withTimeout(
          supabase!.from('profiles').select('role').eq('id', data.user.id).maybeSingle(),
          AUTH_CHECK_TIMEOUT_MS,
          'profile.role',
        );
        if (!isMounted) return;
        const role = profile?.role as UserRole | undefined;
        setGuardState(role && allowedRoles.includes(role) ? { status: 'authorized' } : { status: 'forbidden' });
      } catch {
        if (!isMounted) return;
        // Timeout ou erreur réseau : fallback unauthenticated avec message explicite
        setGuardState({ status: 'unauthenticated' });
      }
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
