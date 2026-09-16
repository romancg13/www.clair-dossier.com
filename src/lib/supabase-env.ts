/**
 * Détection de configuration Supabase, sans importer le SDK.
 * Séparée de ./supabase pour que les modules qui n'ont besoin que du booléen
 * (auth.tsx avant import dynamique, prospects.ts) ne tirent pas les ~209 Ko
 * de @supabase/supabase-js dans leur chunk.
 */
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);
