/**
 * Capture de prospect côté serveur (Lot 2.2) — client.
 *
 * La demande est écrite en base AVANT l'ouverture de WhatsApp : un visiteur
 * qui n'achève pas le passage n'est plus perdu. WhatsApp reste le canal
 * visible — la capture est silencieuse et NE BLOQUE JAMAIS le parcours :
 * tout échec (fonction non déployée, réseau, 4xx/5xx) est avalé et le
 * comportement actuel du site reste inchangé.
 *
 * Feature flag (II.7.4 — désactivé par défaut) : VITE_ENABLE_PROSPECT_CAPTURE
 * n'est à passer à "true" (netlify.toml [build.environment]) qu'une fois :
 *   1. la migration 20260829120000_prospects.sql appliquée au projet Supabase ;
 *   2. l'Edge Function submit-prospect déployée (secret PROSPECT_HASH_SALT créé) ;
 *   3. la politique de confidentialité mise à jour (décision de Roman).
 */
import { isSupabaseConfigured } from './supabase';

export type ProspectPayload = {
  full_name: string;
  email: string;
  organization?: string;
  segment: string;
  topic: string;
  message: string;
  source_page: string;
  referrer?: string;
  creneaux?: string;
  /** Durée depuis l'affichage du formulaire (anti-robot, ≥ 3000 requis). */
  elapsed_ms: number;
  /** Champ leurre anti-robot : doit rester vide. */
  website?: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const prospectCaptureEnabled =
  import.meta.env.VITE_ENABLE_PROSPECT_CAPTURE === 'true' && isSupabaseConfigured;

/**
 * Envoie la demande à l'Edge Function submit-prospect.
 * Jamais d'exception : résultat { ok } purement informatif.
 */
export async function submitProspect(payload: ProspectPayload): Promise<{ ok: boolean }> {
  if (!prospectCaptureEnabled || !SUPABASE_URL || !ANON_KEY) return { ok: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-prospect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
