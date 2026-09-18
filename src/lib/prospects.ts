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
 *   (Chantier 14 : appliquer aussi 20260918130000_prospects_partenariat.sql
 *   AVANT de déployer la nouvelle version de submit-prospect.)
 *
 * Confirmation exacte (chantier 14) : `ok` (et `stored`) ne valent true que
 * si le serveur a CONFIRMÉ l'enregistrement (201, ou 200 { stored: true }
 * pour un renvoi idempotent). Capture désactivée, fonction absente, réponse
 * neutre anti-robot, délai dépassé : jamais présentés comme « enregistrés ».
 */
import { isSupabaseConfigured } from './supabase';
import { SEGMENTS, type Segment } from '../../supabase/functions/submit-prospect/validate';

// Listes fermées et normalisation d'URL : source unique partagée avec
// l'Edge Function (module pur, sans dépendance).
export {
  EMAIL_RE,
  PARTNER_TYPES,
  PARTNER_TYPE_LABELS,
  normalizeSiteUrl,
  type PartnerType,
} from '../../supabase/functions/submit-prospect/validate';

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
  /** Partenariat uniquement : type (liste fermée PARTNER_TYPES). */
  partner_type?: string;
  /** Partenariat uniquement : site web facultatif (http/https). */
  site_url?: string;
  /** Identifiant de requête (UUID) : un renvoi ne crée pas de doublon. */
  request_id?: string;
};

export type ProspectFailure = 'disabled' | 'validation' | 'rate_limit' | 'unconfirmed';

export type ProspectResult =
  | { ok: true; stored: true; ref: string | null; duplicate: boolean }
  | { ok: false; stored: false; reason: ProspectFailure; fields: string[] };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const prospectCaptureEnabled =
  import.meta.env.VITE_ENABLE_PROSPECT_CAPTURE === 'true' && isSupabaseConfigured;

/** Durée minimale exigée par le serveur (validate.ts), avec une marge. */
const MIN_ELAPSED_MS = 3200;

/** Segment de la liste fermée, sinon « autre » (paramètre d'URL non fiable). */
export function toSegment(raw: string | null | undefined): Segment {
  return (SEGMENTS as readonly string[]).includes(raw ?? '') ? (raw as Segment) : 'autre';
}

/** Identifiant de requête (UUID v4) pour l'idempotence des envois. */
export function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function failure(reason: ProspectFailure, fields: string[] = []): ProspectResult {
  return { ok: false, stored: false, reason, fields };
}

/**
 * Envoie la demande à l'Edge Function submit-prospect.
 * Jamais d'exception. `timeoutMs` : court pour une capture silencieuse
 * (Contact → WhatsApp), plus long pour un envoi explicite attendu à l'écran.
 */
export async function submitProspect(
  payload: ProspectPayload,
  options: { timeoutMs?: number } = {},
): Promise<ProspectResult> {
  if (!prospectCaptureEnabled || !SUPABASE_URL || !ANON_KEY) return failure('disabled');
  // Un humain rapide (saisie automatique) ne doit pas tomber dans le filtre
  // anti-robot : on attend simplement la durée minimale avant l'envoi.
  let elapsed = Number.isFinite(payload.elapsed_ms) ? payload.elapsed_ms : 0;
  if (elapsed < MIN_ELAPSED_MS) {
    await new Promise((r) => setTimeout(r, MIN_ELAPSED_MS - elapsed));
    elapsed = MIN_ELAPSED_MS;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-prospect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ ...payload, elapsed_ms: elapsed }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      stored?: boolean;
      duplicate?: boolean;
      ref?: unknown;
      error?: string;
      fields?: unknown;
    } | null;
    if (res.status === 429) return failure('rate_limit');
    if (res.status === 400 && body?.error === 'validation') {
      return failure(
        'validation',
        Array.isArray(body.fields) ? body.fields.filter((f): f is string => typeof f === 'string') : [],
      );
    }
    // 201 = insertion confirmée ; 200 + stored = renvoi d'une demande déjà
    // enregistrée. Un 200 { ok } sans stored (réponse neutre anti-robot) ne
    // prouve AUCUN enregistrement.
    if (res.ok && body?.ok === true && (res.status === 201 || body.stored === true)) {
      return {
        ok: true,
        stored: true,
        ref: typeof body.ref === 'string' ? body.ref : null,
        duplicate: body.duplicate === true,
      };
    }
    return failure('unconfirmed');
  } catch {
    // Réseau coupé ou délai dépassé : l'enregistrement n'est pas confirmé.
    return failure('unconfirmed');
  } finally {
    clearTimeout(timer);
  }
}
