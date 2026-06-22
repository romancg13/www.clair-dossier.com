-- Identité (e-mail) des propriétaires de dossiers — RÉSERVÉE à l'admin global.
-- SECURITY DEFINER (peut lire auth.users) + gardé par is_admin() :
--   * admin  -> renvoie (id, email) de tous les utilisateurs
--   * non-admin / anon -> 0 ligne (le WHERE is_admin() coupe tout) : aucune fuite.

create or replace function public.admin_user_emails()
returns table (id uuid, email text)
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.id, u.email::text
  from auth.users u
  where public.is_admin();
$$;

revoke all on function public.admin_user_emails() from public, anon;
grant execute on function public.admin_user_emails() to authenticated;
