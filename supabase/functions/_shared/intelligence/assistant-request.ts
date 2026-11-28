// Validation de la requête de la fonction Edge « assistant » et réglages serveur (purs, testés sous Node).
import { DELIVERABLE_CATALOG, type DeliverableKey } from '../analysis-model.ts';
import { DEFAULT_MODELS, type ModelMap } from './assistant-model.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_ASSISTANT_MESSAGE = 2000;
/** Limite de débit par compte (messages par heure), au-delà : 429. */
export const ASSISTANT_MESSAGES_PER_HOUR = 40;

export interface AssistantRequest {
  dossierId: string;
  message: string;
  available: DeliverableKey[];
}

/** Corps attendu : { dossier_id: uuid, message: 1..2000, available?: clés du catalogue }. null = invalide. */
export function parseAssistantRequest(body: unknown): AssistantRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { dossier_id?: unknown; message?: unknown; available?: unknown };
  if (typeof b.dossier_id !== 'string' || !UUID.test(b.dossier_id)) return null;
  if (typeof b.message !== 'string') return null;
  const message = b.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, MAX_ASSISTANT_MESSAGE);
  if (!message) return null;
  const keys = new Set<string>(DELIVERABLE_CATALOG.map((d) => d.key));
  const available = Array.isArray(b.available) ? [...new Set(b.available.filter((k): k is DeliverableKey => typeof k === 'string' && keys.has(k)))] : [];
  return { dossierId: b.dossier_id.toLowerCase(), message, available };
}

export interface AssistantSettings {
  paused: boolean;
  hasKey: boolean;
  capGlobalMicro: number | null;
  capUserMicro: number | null;
  models: ModelMap;
}

const positiveInt = (v: string | undefined): number | null => {
  if (!v || !/^\d+$/.test(v.trim())) return null;
  const n = Number(v.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Réglages lus dans l'environnement : AUCUN plafond par défaut (sans plafond, aucun appel payant). */
export function assistantSettings(env: (name: string) => string | undefined): AssistantSettings {
  return {
    paused: env('ASSISTANT_PAUSED') === '1',
    hasKey: Boolean(env('ANTHROPIC_API_KEY')),
    capGlobalMicro: positiveInt(env('ASSISTANT_BUDGET_MICRO_USD_GLOBAL_MONTH')),
    capUserMicro: positiveInt(env('ASSISTANT_BUDGET_MICRO_USD_PER_USER_MONTH')),
    models: {
      simple: env('ASSISTANT_MODEL_SIMPLE') || DEFAULT_MODELS.simple,
      courant: env('ASSISTANT_MODEL_COURANT') || DEFAULT_MODELS.courant,
      avance: env('ASSISTANT_MODEL_AVANCE') || DEFAULT_MODELS.avance,
    },
  };
}

/** Le modèle n'est utilisable que si rien ne manque : clé, deux plafonds, pas de pause. */
export function modelUsable(s: AssistantSettings): boolean {
  return !s.paused && s.hasKey && s.capGlobalMicro !== null && s.capUserMicro !== null;
}
