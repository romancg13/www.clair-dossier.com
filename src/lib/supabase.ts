import { createClient } from '@supabase/supabase-js';
import { isPublicFormTable } from './security';
import type { PublicFormTable } from './security';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
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
