-- Correctif d'isolation (recette locale 2026-11-25, tests 16 et 61).
-- Avant : docs_insert_own / docs_update_own ne vérifiaient que
-- auth.uid() = user_id. Un compte B pouvait donc rattacher une ligne de pièce
-- (à son nom) au dossier d'un compte A. Désormais le dossier visé doit
-- appartenir à l'appelant — même règle que l'insertion des échéances et des
-- événements. Même correction pour le déplacement d'une échéance
-- (deadlines_update_own). Le chemin de fichier, lui, est contrôlé par le
-- worker (ai-worker : préfixe « <titulaire>/ » exigé avant toute lecture).
-- Rejouable. Les policies d'administration et le rôle serveur ne changent pas.
-- Retour arrière : supabase/rollback/20261125150000_pieces_dossier_proprietaire.down.sql

drop policy if exists "docs_insert_own" on public.dossier_documents;
create policy "docs_insert_own" on public.dossier_documents
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.dossiers d
      where d.id = dossier_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "deadlines_update_own" on public.dossier_deadlines;
create policy "deadlines_update_own" on public.dossier_deadlines
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.dossiers d
      where d.id = dossier_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "docs_update_own" on public.dossier_documents;
create policy "docs_update_own" on public.dossier_documents
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.dossiers d
      where d.id = dossier_id and d.user_id = auth.uid()
    )
  );
