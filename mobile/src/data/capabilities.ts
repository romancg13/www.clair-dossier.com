/**
 * Détection des capacités du backend — même stratégie que le site
 * (`src/lib/dossier-workspace.ts`) : certaines colonnes et tables viennent de
 * migrations qui peuvent ne pas encore être appliquées en production.
 * L'application détecte, met en cache, et se replie sans jamais casser.
 */
import { supabase } from '../lib/supabase';

const cache: Record<string, Promise<boolean>> = {};

function probe(key: string, run: () => Promise<boolean>): Promise<boolean> {
  if (!(key in cache)) cache[key] = run().catch(() => false);
  return cache[key];
}

/** Colonnes `category` / `deleted_at` sur dossier_documents. */
export function hasDocExtras(): Promise<boolean> {
  return probe('doc-extras', async () => {
    const { error } = await supabase.from('dossier_documents').select('id,category,deleted_at').limit(1);
    return !error;
  });
}

/** Table dossier_deadlines. */
export function hasDeadlines(): Promise<boolean> {
  return probe('deadlines', async () => {
    const { error } = await supabase.from('dossier_deadlines').select('id').limit(1);
    return !error;
  });
}

/** Table dossier_events. */
export function hasEvents(): Promise<boolean> {
  return probe('events', async () => {
    const { error } = await supabase.from('dossier_events').select('id').limit(1);
    return !error;
  });
}

/** Colonne dossiers.deleted_at (corbeille côté console d'administration). */
export function hasDossierTrash(): Promise<boolean> {
  return probe('dossier-trash', async () => {
    const { error } = await supabase.from('dossiers').select('id,deleted_at').limit(1);
    return !error;
  });
}

/** Colonne dossier_documents.kind ('piece' | 'deliverable'). */
export function hasDocKind(): Promise<boolean> {
  return probe('doc-kind', async () => {
    const { error } = await supabase.from('dossier_documents').select('id,kind').limit(1);
    return !error;
  });
}

export type Capabilities = {
  docExtras: boolean;
  deadlines: boolean;
  events: boolean;
  dossierTrash: boolean;
  docKind: boolean;
};

export async function readCapabilities(): Promise<Capabilities> {
  const [docExtras, deadlines, events, dossierTrash, docKind] = await Promise.all([
    hasDocExtras(),
    hasDeadlines(),
    hasEvents(),
    hasDossierTrash(),
    hasDocKind(),
  ]);
  return { docExtras, deadlines, events, dossierTrash, docKind };
}
