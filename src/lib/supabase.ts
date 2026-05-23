import { createClient } from '@supabase/supabase-js';
import { isPublicFormTable } from './security';
import type { PublicFormTable } from './security';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseConfigurationError = getSupabaseConfigurationError(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = !supabaseConfigurationError;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type PublicInsertResult = {
  ok: boolean;
  message: string;
};

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

function getSupabaseConfigurationError(url: string, anonKey: string) {
  if (!url || !anonKey) {
    return 'La connexion Supabase n’est pas configurée en production. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.';
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
      return 'La variable VITE_SUPABASE_URL doit pointer vers un projet Supabase HTTPS valide.';
    }
  } catch {
    return 'La variable VITE_SUPABASE_URL est invalide.';
  }

  if (!anonKey.startsWith('eyJ')) {
    return 'La variable VITE_SUPABASE_ANON_KEY ne ressemble pas à une clé anon Supabase valide.';
  }

  return '';
}
