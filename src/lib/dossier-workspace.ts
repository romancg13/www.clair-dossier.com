
/**
 * Espace dossier — organisation documentaire (classement, échéances, activité).
 *
 * Rétrocompatibilité : les colonnes/tables ajoutées par la migration
 * 20260915120000_gestion_documentaire.sql peuvent ne pas encore exister en
 * production. Chaque capacité est donc DÉTECTÉE à l'exécution (une requête
 * témoin, mise en cache) et l'interface se replie sur le comportement
 * historique tant que la migration n'est pas appliquée. Aucune perte de
 * données, aucun écran cassé.
 */

/* ── Logique métier partagée (web + application mobile) ─────────────────
 * Ces règles vivent désormais dans packages/core (aucune dépendance, aucun
 * DOM) pour que le site et l'application iOS/Android classent, valident et
 * nomment EXACTEMENT de la même façon. L'API publique de ce module est
 * inchangée : tous les imports existants continuent de fonctionner.
 *
 * Aucune lecture du CONTENU des documents (engagement CGV) : seules des
 * règles sur le NOM du fichier sont utilisées. */

export {
  PIECE_CATEGORIES,
  CATEGORY_LABELS,
  classifyFileName,
  effectiveCategory,
  deadlineStatus,
  ACCEPTED_EXTENSIONS,
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  sanitizeFileName,
  formatBytes,
  duplicateWarning,
  isGenericTitle,
  EVENT_LABELS,
} from '../../packages/core/src/index';

export type { PieceCategory, DeadlineStatus, ExistingDoc, EventType } from '../../packages/core/src/index';

import { validateUploadMeta } from '../../packages/core/src/index';
import { eventLabel } from '../../packages/core/src/index';
import type { EventType } from '../../packages/core/src/index';

/** Retourne un message d'erreur (français) ou null si le fichier est accepté. */
export function validateUpload(file: File): string | null {
  return validateUploadMeta({ name: file.name, size: file.size });
}

/* ── Détection des capacités (migration appliquée ou non) ───────────────── */

const capabilityCache: Record<string, Promise<boolean>> = {};

async function client() {
  const { supabase } = await import('./supabase');
  return supabase;
}

function probe(key: string, run: () => Promise<boolean>): Promise<boolean> {
  if (!(key in capabilityCache)) {
    capabilityCache[key] = run().catch(() => false);
  }
  return capabilityCache[key];
}

/** Colonnes category / deleted_at disponibles sur dossier_documents ? */
export function hasDocExtras(): Promise<boolean> {
  return probe('doc-extras', async () => {
    const { error } = await (await client())
      .from('dossier_documents')
      .select('id,category,deleted_at')
      .limit(1);
    return !error;
  });
}

/** Table dossier_deadlines disponible ? */
export function hasDeadlines(): Promise<boolean> {
  return probe('deadlines', async () => {
    const { error } = await (await client()).from('dossier_deadlines').select('id').limit(1);
    return !error;
  });
}

/** Table dossier_events disponible ? */
export function hasEvents(): Promise<boolean> {
  return probe('events', async () => {
    const { error } = await (await client()).from('dossier_events').select('id').limit(1);
    return !error;
  });
}

/* ── Journal d'activité (meilleur effort, jamais bloquant) ──────────────── */

/** Journalise un événement ; silencieux si la table n'existe pas encore. */
export async function logDossierEvent(
  dossierId: string,
  userId: string,
  type: EventType,
  detail?: string,
): Promise<void> {
  try {
    if (!(await hasEvents())) return;
    await (await client()).from('dossier_events').insert({
      dossier_id: dossierId,
      user_id: userId,
      type,
      label: eventLabel(type, detail),
    });
  } catch {
    /* jamais bloquant */
  }
}
