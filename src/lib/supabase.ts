import { createClient } from '@supabase/supabase-js';

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

export async function insertPublicRecord(table: string, payload: Record<string, unknown>): Promise<PublicInsertResult> {
  if (!supabase) {
    return {
      ok: false,
      message: "La connexion Supabase doit être configurée avant d'enregistrer ce formulaire.",
    };
  }

  const { error } = await supabase.from(table).insert(payload);
  if (error) {
    console.error(`Erreur Supabase (${table})`, error);
    return {
      ok: false,
      message: "Nous n'avons pas pu enregistrer votre demande. Réessayez ou contactez-nous par email.",
    };
  }

  return { ok: true, message: 'Votre demande a bien été enregistrée.' };
}
