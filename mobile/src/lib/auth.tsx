/**
 * Authentification — Supabase Auth EXISTANT (mêmes comptes que le site).
 *
 * Aucun compte à recréer, aucune migration : un utilisateur inscrit sur
 * www.clair-dossier.com se connecte ici avec les mêmes identifiants (§49).
 * Les messages d'erreur sont ceux du site (packages/core/errors.ts).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { translateAuthError } from '@clairdossier/core';
import { supabase, isSupabaseConfigured, startAuthRefreshBridge } from './supabase';
import { WEB_LINKS } from './config';
import { loadPrefs, savePrefs, wipeLocalData } from './storage';
import { log } from './logger';

export type CompanyType =
  | 'pme'
  | 'artisan'
  | 'entreprise-individuelle'
  | 'profession-liberale'
  | 'particulier'
  | 'autre';

export type SignUpInfo = { fullName?: string; companyName?: string; companyType?: CompanyType };
type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, info?: SignUpInfo) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;
    const stopBridge = startAuthRefreshBridge();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        lastUserId.current = data.session?.user.id ?? null;
        setLoading(false);
      })
      .catch((error) => {
        log.error('auth.getSession', error);
        if (alive) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Changement d'utilisateur sur le même appareil : on purge les données locales
      // de l'ancien compte (§28) avant toute lecture du nouveau.
      const nextId = next?.user.id ?? null;
      if (nextId && lastUserId.current && nextId !== lastUserId.current) {
        void wipeLocalData(true);
      }
      lastUserId.current = nextId;
      if (event === 'SIGNED_OUT') void wipeLocalData(true);
      if (nextId) void savePrefs({ lastUserId: nextId });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      stopBridge();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, info?: SignUpInfo): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Mêmes métadonnées que le site : le déclencheur SQL crée le profil.
        data: {
          full_name: info?.fullName ?? null,
          company_name: info?.companyName ?? null,
          company_type: info?.companyType ?? null,
        },
        emailRedirectTo: WEB_LINKS.resetRedirect,
      },
    });
    if (error) return { error: translateAuthError(error.message) };
    if (data.session) setSession(data.session);
    log.info('auth.signup');
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: translateAuthError(error.message) };
    setSession(data.session);
    log.info('auth.signin');
    return { error: null };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      log.error('auth.signout', error);
    }
    setSession(null);
    await wipeLocalData(true);
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: WEB_LINKS.resetRedirect,
    });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
    }),
    [session, loading, signUp, signIn, signOut, sendPasswordReset, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}

/** Utilisateur connecté garanti (écrans privés) — lève si absent. */
export function useUserId(): string {
  const { user } = useAuth();
  if (!user) throw new Error('Écran privé monté sans session.');
  return user.id;
}

export { loadPrefs, savePrefs };
