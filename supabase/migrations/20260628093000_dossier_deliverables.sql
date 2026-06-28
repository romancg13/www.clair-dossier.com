-- Documents PRODUITS / « Travail livré » : ClairDossier (admin global) dépose le
-- travail réalisé dans le dossier du client, qui peut alors y accéder et le télécharger.
--
-- Sécurité (cloisonnement préservé) :
--   * Le livrable est rangé sous le user_id / dossier DU CLIENT → le client le LIT via
--     sa policy _own existante (dossier_documents) et le télécharge via sa policy storage
--     _own existante (le fichier vit sous <client_id>/...). Aucune policy existante modifiée.
--   * L'admin global gagne UNIQUEMENT un droit d'INSERT croisé (déposer chez un client).
--     Il ne gagne aucun droit de lecture nouveau (il lisait déjà tout via is_admin()).
--   * Un client ne peut toujours écrire que sous son propre user_id (policies _own intactes).

-- Distinguer pièce déposée par le client ('piece') du livrable ClairDossier ('deliverable').
alter table public.dossier_documents
  add column if not exists kind text not null default 'piece';

alter table public.dossier_documents
  drop constraint if exists dossier_documents_kind_check;
alter table public.dossier_documents
  add constraint dossier_documents_kind_check check (kind in ('piece', 'deliverable'));

-- L'admin global peut INSÉRER un livrable dans N'IMPORTE quel dossier (livraison du travail).
drop policy if exists "docs_insert_admin" on public.dossier_documents;
create policy "docs_insert_admin" on public.dossier_documents
  for insert with check (public.is_admin());

-- L'admin global peut DÉPOSER un fichier dans le bucket (sous le dossier du client).
drop policy if exists "docs_storage_insert_admin" on storage.objects;
create policy "docs_storage_insert_admin" on storage.objects
  for insert with check (bucket_id = 'documents' and public.is_admin());
