/**
 * Pièces d'un dossier — liste, renommage, reclassement, corbeille, liens de
 * téléchargement temporaires.
 *
 * Le bucket `documents` est PRIVÉ : aucun fichier n'est accessible par URL
 * publique. Chaque consultation passe par un lien signé de courte durée,
 * généré à la demande et jamais mis en cache sur le disque (§22).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DossierDocument } from '@clairdossier/core';
import { supabase } from '../lib/supabase';
import { qk } from '../lib/query';
import { hasDocExtras, hasDocKind } from './capabilities';
import { logDossierEvent } from './dossiers';

/** Durée de validité d'un lien signé : le temps d'ouvrir le document. */
export const SIGNED_URL_TTL_SECONDS = 120;

export async function fetchDocuments(dossierId: string, userId: string): Promise<DossierDocument[]> {
  const [extras, kind] = await Promise.all([hasDocExtras(), hasDocKind()]);
  const columns = [
    'id,dossier_id,user_id,file_path,file_name,size_bytes,created_at',
    extras ? 'category,deleted_at' : '',
    kind ? 'kind' : '',
  ]
    .filter(Boolean)
    .join(',');
  const { data, error } = await supabase
    .from('dossier_documents')
    .select(columns)
    .eq('dossier_id', dossierId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as DossierDocument[] | null) ?? [];
}

export function useDocuments(dossierId: string, userId: string | undefined) {
  return useQuery({
    queryKey: qk.documents(dossierId),
    enabled: !!userId && !!dossierId,
    queryFn: () => fetchDocuments(dossierId, userId as string),
  });
}

/** Lien signé temporaire pour consulter ou partager une pièce. */
export async function signedUrl(filePath: string, ttl = SIGNED_URL_TTL_SECONDS): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, ttl);
  if (error || !data?.signedUrl) throw error ?? new Error('signed-url');
  return data.signedUrl;
}

export function useRenameDocument(dossierId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const name = fileName.trim();
      if (!name) throw new Error('empty-name');
      const { error } = await supabase
        .from('dossier_documents')
        .update({ file_name: name })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      await logDossierEvent(dossierId, userId, 'document_renomme', name);
    },
    onSuccess: () => invalidate(qc, dossierId),
  });
}

export function useReclassifyDocument(dossierId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category, label }: { id: string; category: string; label: string }) => {
      const { error } = await supabase
        .from('dossier_documents')
        .update({ category })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      await logDossierEvent(dossierId, userId, 'document_reclasse', label);
    },
    onSuccess: () => invalidate(qc, dossierId),
  });
}

/**
 * Corbeille : suppression réversible quand la colonne existe, sinon
 * suppression définitive après confirmation explicite de l'utilisateur.
 */
export function useTrashDocument(dossierId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DossierDocument) => {
      if (await hasDocExtras()) {
        const { error } = await supabase
          .from('dossier_documents')
          .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
          .eq('id', doc.id)
          .eq('user_id', userId);
        if (error) throw error;
        await logDossierEvent(dossierId, userId, 'document_corbeille', doc.file_name);
        return 'trashed' as const;
      }
      await supabase.storage.from('documents').remove([doc.file_path]);
      const { error } = await supabase.from('dossier_documents').delete().eq('id', doc.id).eq('user_id', userId);
      if (error) throw error;
      await logDossierEvent(dossierId, userId, 'document_supprime', doc.file_name);
      return 'deleted' as const;
    },
    onSuccess: () => invalidate(qc, dossierId),
  });
}

export function useRestoreDocument(dossierId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DossierDocument) => {
      const { error } = await supabase
        .from('dossier_documents')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', doc.id)
        .eq('user_id', userId);
      if (error) throw error;
      await logDossierEvent(dossierId, userId, 'document_restaure', doc.file_name);
    },
    onSuccess: () => invalidate(qc, dossierId),
  });
}

/** Suppression définitive (fichier + ligne) — toujours après confirmation. */
export function useDeleteDocumentForever(dossierId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DossierDocument) => {
      await supabase.storage.from('documents').remove([doc.file_path]);
      const { error } = await supabase.from('dossier_documents').delete().eq('id', doc.id).eq('user_id', userId);
      if (error) throw error;
      await logDossierEvent(dossierId, userId, 'document_supprime', doc.file_name);
    },
    onSuccess: () => invalidate(qc, dossierId),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, dossierId: string) {
  void qc.invalidateQueries({ queryKey: qk.documents(dossierId) });
  void qc.invalidateQueries({ queryKey: qk.events(dossierId) });
}
