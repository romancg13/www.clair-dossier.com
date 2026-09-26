/**
 * Échéances — CRUD sur `dossier_deadlines` (table existante).
 *
 * ClairDossier n'envoie AUCUN rappel automatique côté serveur (voir
 * /etat-du-produit). Les rappels proposés par l'application sont des
 * notifications LOCALES, programmées sur l'appareil, activées par
 * l'utilisateur — voir src/lib/notifications.ts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sortDeadlines, type Deadline, type DeadlinePriority } from '@clairdossier/core';
import { supabase } from '../lib/supabase';
import { qk } from '../lib/query';
import { hasDeadlines } from './capabilities';
import { logDossierEvent } from './dossiers';

const COLUMNS = 'id,dossier_id,user_id,title,description,due_date,due_time,priority,done,created_at';

export async function fetchDeadlines(dossierId: string, userId: string): Promise<Deadline[]> {
  if (!(await hasDeadlines())) return [];
  const { data, error } = await supabase
    .from('dossier_deadlines')
    .select(COLUMNS)
    .eq('dossier_id', dossierId)
    .eq('user_id', userId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return sortDeadlines((data as Deadline[] | null) ?? []);
}

/** Toutes les échéances du compte — onglet « Échéances » et accueil. */
export async function fetchAllDeadlines(userId: string): Promise<Deadline[]> {
  if (!(await hasDeadlines())) return [];
  const { data, error } = await supabase
    .from('dossier_deadlines')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return sortDeadlines((data as Deadline[] | null) ?? []);
}

export function useDeadlines(dossierId: string, userId: string | undefined) {
  return useQuery({
    queryKey: qk.deadlines(dossierId),
    enabled: !!userId && !!dossierId,
    queryFn: () => fetchDeadlines(dossierId, userId as string),
  });
}

export function useAllDeadlines(userId: string | undefined) {
  return useQuery({
    queryKey: qk.deadlinesAll,
    enabled: !!userId,
    queryFn: () => fetchAllDeadlines(userId as string),
  });
}

export type DeadlineInput = {
  id?: string;
  dossierId: string;
  title: string;
  description?: string | null;
  dueDate: string;
  dueTime?: string | null;
  priority: DeadlinePriority;
};

export function useSaveDeadline(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeadlineInput) => {
      const payload = {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        due_date: input.dueDate,
        due_time: input.dueTime || null,
        priority: input.priority,
      };
      if (input.id) {
        const { error } = await supabase
          .from('dossier_deadlines')
          .update(payload)
          .eq('id', input.id)
          .eq('user_id', userId);
        if (error) throw error;
        await logDossierEvent(input.dossierId, userId, 'echeance_modifiee', payload.title);
        return input.id;
      }
      const { data, error } = await supabase
        .from('dossier_deadlines')
        .insert({ ...payload, dossier_id: input.dossierId, user_id: userId, done: false })
        .select('id')
        .single();
      if (error) throw error;
      await logDossierEvent(input.dossierId, userId, 'echeance_creee', payload.title);
      return (data as { id: string }).id;
    },
    onSuccess: (_id, input) => invalidate(qc, input.dossierId),
  });
}

export function useToggleDeadline(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deadline: Deadline) => {
      const done = !deadline.done;
      const { error } = await supabase
        .from('dossier_deadlines')
        .update({ done })
        .eq('id', deadline.id)
        .eq('user_id', userId);
      if (error) throw error;
      if (done) await logDossierEvent(deadline.dossier_id, userId, 'echeance_terminee', deadline.title);
    },
    onSuccess: (_d, deadline) => invalidate(qc, deadline.dossier_id),
  });
}

export function useDeleteDeadline(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deadline: Deadline) => {
      const { error } = await supabase
        .from('dossier_deadlines')
        .delete()
        .eq('id', deadline.id)
        .eq('user_id', userId);
      if (error) throw error;
      await logDossierEvent(deadline.dossier_id, userId, 'echeance_supprimee', deadline.title);
    },
    onSuccess: (_d, deadline) => invalidate(qc, deadline.dossier_id),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, dossierId: string) {
  void qc.invalidateQueries({ queryKey: qk.deadlines(dossierId) });
  void qc.invalidateQueries({ queryKey: qk.deadlinesAll });
  void qc.invalidateQueries({ queryKey: qk.events(dossierId) });
}
