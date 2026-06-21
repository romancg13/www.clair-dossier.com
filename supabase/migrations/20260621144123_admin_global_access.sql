-- Admin global UNIQUE (prestige.seller@icloud.com) : lecture/téléchargement de TOUT.
-- Sécurité anti-escalade :
--   * table app_admins NON modifiable par les utilisateurs (RLS active, AUCUNE policy,
--     privilèges révoqués pour anon/authenticated) → un user ne peut pas se promouvoir.
--   * is_admin() en SECURITY DEFINER : ne révèle jamais la liste, renvoie juste un booléen
--     pour l'appelant courant.
--   * Politiques admin ADDITIVES et en LECTURE SEULE : les politiques _own existantes
--     restent en place → un user normal ne voit QUE ses propres données (hermétique).

-- ── Table des admins (source de vérité, hors d'atteinte des utilisateurs) ──────
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- Aucune policy => aucun accès en lecture/écriture pour les rôles applicatifs.
revoke all on public.app_admins from anon, authenticated;

-- Désignation de l'admin par email (idempotent).
insert into public.app_admins (user_id)
select id from auth.users where email = 'prestige.seller@icloud.com'
on conflict (user_id) do nothing;

-- ── Helper : l'appelant courant est-il admin ? ────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ── Politiques de LECTURE admin (PERMISSIVE => OR avec les politiques _own) ────
drop policy if exists "dossiers_select_admin" on public.dossiers;
create policy "dossiers_select_admin" on public.dossiers
  for select using (public.is_admin());

drop policy if exists "docs_select_admin" on public.dossier_documents;
create policy "docs_select_admin" on public.dossier_documents
  for select using (public.is_admin());

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- ── Storage : l'admin peut lire/télécharger n'importe quelle pièce ────────────
drop policy if exists "docs_storage_select_admin" on storage.objects;
create policy "docs_storage_select_admin" on storage.objects
  for select using (bucket_id = 'documents' and public.is_admin());
