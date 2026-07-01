-- L'admin global peut SUPPRIMER un document (retirer un livrable envoyé par erreur)
-- et le fichier associé dans le storage. Additif : aucune policy existante modifiée.
-- Le client garde ses seules policies _own (il ne peut supprimer QUE ses propres pièces).

drop policy if exists "docs_delete_admin" on public.dossier_documents;
create policy "docs_delete_admin" on public.dossier_documents
  for delete using (public.is_admin());

drop policy if exists "docs_storage_delete_admin" on storage.objects;
create policy "docs_storage_delete_admin" on storage.objects
  for delete using (bucket_id = 'documents' and public.is_admin());
