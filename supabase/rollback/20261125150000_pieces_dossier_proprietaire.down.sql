-- Retour arrière de 20261125150000_pieces_dossier_proprietaire.sql (exécution manuelle).
-- ATTENTION : rétablit le défaut d'isolation (pièce rattachable au dossier d'autrui).
drop policy if exists "docs_insert_own" on public.dossier_documents;
create policy "docs_insert_own" on public.dossier_documents
  for insert with check (auth.uid() = user_id);
drop policy if exists "deadlines_update_own" on public.dossier_deadlines;
create policy "deadlines_update_own" on public.dossier_deadlines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "docs_update_own" on public.dossier_documents;
create policy "docs_update_own" on public.dossier_documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
