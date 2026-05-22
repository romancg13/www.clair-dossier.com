import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'client' | 'lawyer' | 'cabinet_admin' | 'admin';
  cabinet_id: string | null;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  dashboardPath: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchOrCreateProfile(user: User): Promise<Profile | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,cabinet_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Erreur chargement profil Supabase', error);
    return null;
  }

  if (data) return data as Profile;

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? null,
      full_name: user.user_metadata?.full_name ?? null,
      role: 'client',
    })
    .select('id,email,full_name,role,cabinet_id')
    .single();

  if (insertError) {
    console.error('Erreur création profil Supabase', insertError);
    return null;
  }

  return created as Profile;
}

function getDashboardPath(profile: Profile | null) {
  if (profile?.role === 'lawyer' || profile?.role === 'cabinet_admin' || profile?.role === 'admin') {
    return '/cabinet/dashboard';
  }
  return '/dashboard';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function refreshProfile() {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    setProfile(await fetchOrCreateProfile(session.user));
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        setProfile(await fetchOrCreateProfile(data.session.user));
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        fetchOrCreateProfile(nextSession.user).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    user: session?.user ?? null,
    profile,
    dashboardPath: getDashboardPath(profile),
    refreshProfile,
    async signOut() {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Erreur déconnexion Supabase', error);
      setSession(null);
      setProfile(null);
    },
  }), [loading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
