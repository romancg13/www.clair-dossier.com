import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabase-env';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Ré-export : les consommateurs existants importent le booléen d'ici ;
// la source vit dans ./supabase-env (module sans SDK).
export { isSupabaseConfigured };

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    '[ClairDossier] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants — auth désactivée.'
  );
}

// Client unique partagé. Les pages marketing fonctionnent même sans config
// (isSupabaseConfigured permet de dégrader proprement les écrans de compte).
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'clairdossier-auth',
  },
});
