/**
 * Client Supabase — MÊME projet, mêmes comptes, mêmes données que le site
 * (§0 : l'application est une extension native, pas un second produit).
 *
 * Différences avec le web, toutes liées au natif :
 *   - session conservée dans le magasin sécurisé de l'appareil (jamais en clair) ;
 *   - pas de détection de session dans l'URL (les liens profonds sont traités
 *     explicitement par src/lib/links.ts) ;
 *   - rafraîchissement automatique du jeton suspendu quand l'app est en
 *     arrière-plan (économie de batterie et de requêtes).
 */
import 'react-native-url-polyfill/auto';
import { AppState, type AppStateStatus } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';
import { secureSessionStorage } from './storage';

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      storage: secureSessionStorage,
      storageKey: 'clairdossier-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-clairdossier-client': 'mobile' },
    },
  },
);

let subscribed = false;

/** Ne rafraîchit les jetons que lorsque l'application est au premier plan. */
export function startAuthRefreshBridge(): () => void {
  if (!isSupabaseConfigured || subscribed) return () => {};
  subscribed = true;
  const handler = (state: AppStateStatus) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  handler(AppState.currentState);
  const sub = AppState.addEventListener('change', handler);
  return () => {
    sub.remove();
    subscribed = false;
  };
}

/** Jeton d'accès courant — utilisé pour les envois de fichiers en flux (REST). */
export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export { isSupabaseConfigured };
