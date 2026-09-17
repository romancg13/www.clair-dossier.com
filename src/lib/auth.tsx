import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export type CompanyType =
  | 'pme'
  | 'artisan'
  | 'entreprise-individuelle'
  | 'profession-liberale'
  | 'particulier'
  | 'autre';

export type SignUpInfo = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyType?: CompanyType;
  phone?: string | null;
};

type AuthResult = { error: string | null };
/** `needsVerification` : compte créé, e-mail à confirmer avant toute session. */
type SignUpResult = AuthResult & { needsVerification?: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, info?: SignUpInfo) => Promise<SignUpResult>;
  verifyEmailOtp: (email: string, code: string) => Promise<AuthResult>;
  resendSignupCode: (email: string) => Promise<AuthResult>;
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
  if (m.includes('token has expired') || m.includes('expired'))
    return 'Ce code a expiré. Demandez un nouveau code.';
  if (m.includes('invalid') && (m.includes('otp') || m.includes('token')))
    return 'Code incorrect. Vérifiez les 6 chiffres reçus par e-mail.';
  if (m.includes('for security purposes'))
    return 'Patientez quelques secondes avant de demander un nouveau code.';
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
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signUp(email: string, password: string, info?: SignUpInfo): Promise<SignUpResult> {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const first = info?.firstName?.trim() || null;
    const last = info?.lastName?.trim() || null;
    const full = info?.fullName?.trim() || [first, last].filter(Boolean).join(' ') || null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/compte` : undefined,
        data: {
          full_name: full,
          first_name: first,
          last_name: last,
          company_name: info?.companyName?.trim() || null,
          company_type: info?.companyType ?? null,
          phone: info?.phone?.trim() || null,
        },
      },
    });
    if (error) return { error: translateError(error.message) };
    if (data.session) {
      setSession(data.session);
      return { error: null, needsVerification: false };
    }
    return { error: null, needsVerification: true };
  }

  // Vérification e-mail par code à 6 chiffres (Supabase Auth natif).
  async function verifyEmailOtp(email: string, code: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' });
    if (error) return { error: translateError(error.message) };
    if (data.session) setSession(data.session);
    return { error: null };
  }

  async function resendSignupCode(email: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { error: translateError(error.message) };
    return { error: null };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) return { error: "Le service de comptes n'est pas configuré." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateError(error.message) };
    setSession(data.session);
    return { error: null };
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setSession(null);
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    signUp,
    verifyEmailOtp,
    resendSignupCode,
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
