import { createClient } from '@supabase/supabase-js';
import { isPublicFormTable } from './security';
import type { PublicFormTable } from './security';

const supabaseUrl = normalizePublicEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizePublicEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigurationMessage = isSupabaseConfigured
  ? ''
  : "Service d'authentification indisponible : la configuration Supabase de production est manquante.";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  : null;

export type PublicInsertResult = {
  ok: boolean;
  message: string;
};

function normalizePublicEnv(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
  return trimmed;
}

export async function insertPublicRecord(table: PublicFormTable, payload: Record<string, unknown>): Promise<PublicInsertResult> {
  if (!isPublicFormTable(table)) {
    console.error('Table formulaire public refusée', table);
    return {
      ok: false,
      message: 'Une erreur est survenue. Veuillez réessayer.',
    };
  }
  if (!supabase) {
    return {
      ok: false,
      message: 'Une erreur est survenue. Veuillez réessayer.',
    };
  }

  const { error } = await supabase.from(table).insert(payload);
  if (error) {
    console.error(`Erreur Supabase (${table})`, error);
    return {
      ok: false,
      message: 'Une erreur est survenue. Veuillez réessayer.',
    };
  }

  return { ok: true, message: 'Votre demande a bien été enregistrée.' };
}
