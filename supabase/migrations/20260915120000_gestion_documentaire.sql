-- Gestion documentaire (2026-09-15) — MIGRATION ADDITIVE, rétrocompatible.
-- Le frontend détecte ces capacités à l'exécution : il fonctionne à l'identique
-- tant que cette migration n'est pas appliquée, puis les active tout seul.
--
-- Contenu :
--   1. dossier_documents : catégorie corrigeable + corbeille (soft delete)
--      + politique UPDATE manquante pour le propriétaire.
--   2. dossier_deadlines : échéances gérées par l'utilisateur (CRUD, RLS _own).
--   3. dossier_events : journal d'activité (insertion + lecture _own, immuable).
--
-- Aucune donnée existante n'est modifiée ; aucun droit existant n'est retiré.

-- ── 1. Pièces : catégorie + corbeille ────────────────────────────────────────
alter table public.dossier_documents
  add column if not exists category text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id);

comment on column public.dossier_documents.category is
  'Catégorie corrigée par l''utilisateur (prioritaire sur la classification déterministe par nom de fichier, côté client).';
comment on column public.dossier_documents.deleted_at is
  'Corbeille (soft delete) : renseigné = pièce dans la corbeille, restaurable.';

-- Le propriétaire peut METTRE À JOUR ses propres pièces (renommer, reclasser,
-- corbeille/restauration). user_id ne peut pas changer (with check).
drop policy if exists "docs_update_own" on public.dossier_documents;
create policy "docs_update_own" on public.dossier_documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. Échéances ─────────────────────────────────────────────────────────────
create table if not exists public.dossier_deadlines (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  due_time time,
  priority text not null default 'normale' check (priority in ('haute', 'normale', 'basse')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dossier_deadlines_dossier_id_idx
  on public.dossier_deadlines (dossier_id);
create index if not exists dossier_deadlines_user_due_idx
  on public.dossier_deadlines (user_id, due_date);

alter table public.dossier_deadlines enable row level security;

drop policy if exists "deadlines_select_own" on public.dossier_deadlines;
create policy "deadlines_select_own" on public.dossier_deadlines
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "deadlines_insert_own" on public.dossier_deadlines;
create policy "deadlines_insert_own" on public.dossier_deadlines
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.dossiers d where d.id = dossier_id and d.user_id = auth.uid())
  );
drop policy if exists "deadlines_update_own" on public.dossier_deadlines;
create policy "deadlines_update_own" on public.dossier_deadlines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "deadlines_delete_own" on public.dossier_deadlines;
create policy "deadlines_delete_own" on public.dossier_deadlines
  for delete using (auth.uid() = user_id);

-- ── 3. Journal d'activité (immuable : ni update ni delete par le client) ─────
create table if not exists public.dossier_events (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  label text not null,
  created_at timestamptz not null default now()
);

create index if not exists dossier_events_dossier_created_idx
  on public.dossier_events (dossier_id, created_at desc);

alter table public.dossier_events enable row level security;

drop policy if exists "events_select_own" on public.dossier_events;
create policy "events_select_own" on public.dossier_events
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "events_insert_own" on public.dossier_events;
create policy "events_insert_own" on public.dossier_events
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.dossiers d where d.id = dossier_id and d.user_id = auth.uid())
  );
