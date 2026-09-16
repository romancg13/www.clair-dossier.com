import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabase-env';

// Perf (audit 2026-09) : le SDK Supabase (~209 Ko) était tiré dans le chunk
// d'entrée via cet import statique, donc téléchargé et parsé sur toutes les
// pages vitrine avant le premier rendu. On ne le charge plus que par import
// dynamique (mis en cache par Vite) : après hydratation pour l'état de
// session, ou au premier appel signUp/signIn/signOut. Comportement identique,
// chemin critique allégé.
async function getSupabase() {
  const { supabase } = await import('./supabase');
  return supabase;
}

export type CompanyType =
  | 'pme'
  | 'artisan'
  | 'entreprise-individuelle'
  | 'profession-liberale'
  | 'particulier'
  | 'autre';

export type SignUpInfo = {
  fullName?: string;
  companyName?: string;
  companyType?: CompanyType;
};

type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, info?: SignUpInfo) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
    return 'Un compte existe déjà avec cet email. Connectez-vous.';
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('password should be at least')) return 'Mot de passe trop court (6 caractères minimum).';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Adresse email invalide.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (m.includes('email not confirmed')) return "Email non confirmé. Vérifiez votre boîte mail.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void getSupabase().then((supabase) => {
      if (!active) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    }).catch(() => {
      // Échec de chargement du chunk (réseau, déploiement entre deux hashes) :
      // ne jamais laisser RequireAuth sur « Chargement… » indéfiniment.
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function signUp(email: string, password: string, info?: SignUpInfo): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const supabase = await getSupabase().catch(() => null);
    if (!supabase) return { error: 'Service momentanément indisponible. Vérifiez votre connexion, puis réessayez.' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: info?.fullName ?? null,
          company_name: info?.companyName ?? null,
          company_type: info?.companyType ?? null,
        },
      },
    });
    if (error) return { error: translateError(error.message) };
    if (data.session) setSession(data.session);
    return { error: null };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const supabase = await getSupabase().catch(() => null);
    if (!supabase) return { error: 'Service momentanément indisponible. Vérifiez votre connexion, puis réessayez.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateError(error.message) };
    setSession(data.session);
    return { error: null };
  }

  async function signOut(): Promise<void> {
    // Si le chunk ne charge pas, on déconnecte au moins l'état local (le SDK
    // aura de toute façon échoué à charger la session dans le même contexte).
    const supabase = await getSupabase().catch(() => null);
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}
