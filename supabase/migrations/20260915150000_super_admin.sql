-- Super Admin (2026-09-15) — MIGRATION ADDITIVE, rétrocompatible, idempotente.
-- Le frontend détecte ces capacités à l'exécution (même modèle que la
-- migration gestion documentaire) : rien ne change tant qu'elle n'est pas
-- appliquée. Aucune policy existante n'est modifiée ni retirée ; la RLS
-- reste active partout. Modèle anti-escalade conservé : app_admins reste
-- inaccessible aux rôles applicatifs, seuls des booléens sortent des RPC.

-- ── 1. Rôle d'administration (l'admin global existant devient super_admin) ───
alter table public.app_admins
  add column if not exists role text not null default 'super_admin'
  check (role in ('super_admin', 'support'));

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- ── 2. Journal d'audit admin (immuable depuis l'application) ─────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id) on delete cascade,
  actor_role text not null default 'super_admin',
  action text not null,
  resource_type text not null,
  resource_id text,
  target_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
alter table public.audit_logs enable row level security;

-- Insertion : tout admin, pour lui-même. Lecture : super_admin.
-- AUCUNE policy update/delete : le journal n'est pas effaçable depuis l'UI.
drop policy if exists "audit_insert_admin" on public.audit_logs;
create policy "audit_insert_admin" on public.audit_logs
  for insert with check (public.is_admin() and actor_id = auth.uid());
drop policy if exists "audit_select_super" on public.audit_logs;
create policy "audit_select_super" on public.audit_logs
  for select using (public.is_super_admin());

-- ── 3. Notes internes admin (jamais visibles par le client) ──────────────────
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users (id) on delete cascade,
  dossier_id uuid references public.dossiers (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_notes_target_idx on public.admin_notes (target_user_id, created_at desc);
alter table public.admin_notes enable row level security;
-- Aucune policy pour les non-admins : un client ne peut NI lire NI écrire.
drop policy if exists "notes_select_admin" on public.admin_notes;
create policy "notes_select_admin" on public.admin_notes
  for select using (public.is_admin());
drop policy if exists "notes_insert_admin" on public.admin_notes;
create policy "notes_insert_admin" on public.admin_notes
  for insert with check (public.is_admin() and author_id = auth.uid());
drop policy if exists "notes_delete_super" on public.admin_notes;
create policy "notes_delete_super" on public.admin_notes
  for delete using (public.is_super_admin());

-- ── 4. Dossiers : corbeille + corrections admin ──────────────────────────────
alter table public.dossiers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id),
  add column if not exists delete_reason text;
create index if not exists dossiers_deleted_idx on public.dossiers (deleted_at) where deleted_at is not null;

-- L'admin peut corriger n'importe quel dossier (titre, statut, corbeille).
drop policy if exists "dossiers_update_admin" on public.dossiers;
create policy "dossiers_update_admin" on public.dossiers
  for update using (public.is_admin()) with check (public.is_admin());
-- Suppression DÉFINITIVE d'un dossier : super_admin uniquement.
drop policy if exists "dossiers_delete_super" on public.dossiers;
create policy "dossiers_delete_super" on public.dossiers
  for delete using (public.is_super_admin());

-- ── 5. Documents : corrections admin (renommer, reclasser, corbeille) ────────
drop policy if exists "docs_update_admin" on public.dossier_documents;
create policy "docs_update_admin" on public.dossier_documents
  for update using (public.is_admin()) with check (public.is_admin());

-- ── 6. Échéances : l'admin peut corriger/ajouter pour un client ──────────────
-- (table créée par 20260915120000_gestion_documentaire — no-op sinon)
do $$
begin
  if to_regclass('public.dossier_deadlines') is not null then
    drop policy if exists "deadlines_all_admin" on public.dossier_deadlines;
    create policy "deadlines_all_admin" on public.dossier_deadlines
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
