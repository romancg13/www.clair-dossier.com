/**
 * Dossiers — lecture et écriture, strictement sur le schéma existant.
 *
 * Cloisonnement : les policies RLS filtrent déjà par `auth.uid()`, mais chaque
 * requête ajoute `.eq('user_id', …)` — défense en profondeur, et l'application
 * mobile reste un espace client même si le compte est aussi administrateur.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  eventLabel,
  type Dossier,
  type EventType,
} from '@clairdossier/core';
import { supabase } from '../lib/supabase';
import { qk } from '../lib/query';
import { log } from '../lib/logger';
import { hasDossierTrash, hasEvents } from './capabilities';

export type DossierListItem = Pick<
  Dossier,
  'id' | 'typology' | 'title' | 'status' | 'created_at' | 'updated_at'
>;

async function fetchDossiers(userId: string): Promise<DossierListItem[]> {
  const trashAware = await hasDossierTrash();
  const columns = `id,typology,title,status,created_at,updated_at${trashAware ? ',deleted_at' : ''}`;
  const { data, error } = await supabase
    .from('dossiers')
    .select(columns)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const rows = (data as unknown as (DossierListItem & { deleted_at?: string | null })[] | null) ?? [];
  return rows.filter((r) => !r.deleted_at);
}

export function useDossiers(userId: string | undefined) {
  return useQuery({
    queryKey: qk.dossiers,
    enabled: !!userId,
    queryFn: () => fetchDossiers(userId as string),
  });
}

export function useDossier(id: string, userId: string | undefined) {
  return useQuery({
    queryKey: qk.dossier(id),
    enabled: !!userId && !!id,
    queryFn: async (): Promise<Dossier> => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id,user_id,typology,title,status,answers,legal_review_requested,created_at,updated_at')
        .eq('id', id)
        .eq('user_id', userId as string)
        .single();
      if (error) throw error;
      return data as Dossier;
    },
  });
}

/** Journalise un événement ; silencieux si la table n'existe pas encore. */
export async function logDossierEvent(
  dossierId: string,
  userId: string,
  type: EventType,
  detail?: string,
): Promise<void> {
  try {
    if (!(await hasEvents())) return;
    await supabase.from('dossier_events').insert({
      dossier_id: dossierId,
      user_id: userId,
      type,
      label: eventLabel(type, detail),
    });
  } catch (error) {
    log.error('event.log', error); // jamais bloquant
  }
}

export type CreateDossierInput = {
  userId: string;
  typology: string;
  title: string;
  answers: Record<string, string>;
  legalReviewRequested?: boolean;
};

/** Crée un dossier — mêmes colonnes et même statut initial que le tunnel web. */
export async function createDossier(input: CreateDossierInput): Promise<string> {
  const { data, error } = await supabase
    .from('dossiers')
    .insert({
      user_id: input.userId,
      typology: input.typology,
      title: input.title,
      answers: input.answers,
      legal_review_requested: input.legalReviewRequested ?? false,
      status: 'brouillon',
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export function useRenameDossier(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from('dossiers')
        .update({ title: title.trim() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      await logDossierEvent(id, userId, 'dossier_renomme', title.trim());
    },
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: qk.dossier(id) });
      void qc.invalidateQueries({ queryKey: qk.dossiers });
      void qc.invalidateQueries({ queryKey: qk.events(id) });
    },
  });
}

/** Passage de statut — suit la progression métier existante (jamais en arrière). */
export function useUpdateDossierStatus(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('dossiers').update({ status }).eq('id', id).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: qk.dossier(id) });
      void qc.invalidateQueries({ queryKey: qk.dossiers });
    },
  });
}
