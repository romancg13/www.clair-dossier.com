-- Console admin sans vérification en deux étapes (2026-09-20) — MIGRATION
-- ADDITIVE, idempotente et rejouable. À appliquer EN DERNIER, après
-- 20260919120000.
--
-- Décision propriétaire : le TOTP n'est pas activé sur le projet Supabase ; la
-- console exigeait donc un niveau de session (AAL2) impossible à atteindre et
-- l'administrateur était bloqué hors de sa propre console. L'exigence AAL2 est
-- retirée PARTOUT côté base. Ce qui ne change pas :
--   * l'authentification Supabase normale (session obligatoire) ;
--   * le rôle, décidé par la seule table app_admins — verrouillée (RLS sans
--     aucune policy, privilèges révoqués), lue par des fonctions SECURITY
--     DEFINER qui ne renvoient qu'un booléen pour l'appelant ;
--   * le cloisonnement clients : auth.uid() = user_id sur chaque policy _own ;
--   * la corbeille du propriétaire (20260919120000), l'audit en transaction
--     (20260918120000), le quota, les notifications, le verrou « un seul
--     super admin ».
--
-- Technique : les policies de 20260918100000 (et la garde dossiers_guard)
-- appellent admin_aal2() / super_admin_aal2(). Seul le CORPS de ces deux
-- fonctions change — aucune policy n'est supprimée ni recréée, la RLS reste
-- active partout. Les noms sont conservés (historiques) parce que les policies
-- y sont liées ; ils ne disent plus rien du niveau de session.
--
-- Aucune donnée modifiée, aucune table ni colonne détruite.

-- ── 1. Aides : le rôle seul décide (plus de condition sur le jeton) ──────────
create or replace function public.admin_aal2()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_admin();
$$;
revoke all on function public.admin_aal2() from public, anon;
grant execute on function public.admin_aal2() to authenticated;
comment on function public.admin_aal2() is
  'Nom historique : équivaut à is_admin() depuis 20260920120000 (MFA non exigée).';

create or replace function public.super_admin_aal2()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_super_admin();
$$;
revoke all on function public.super_admin_aal2() from public, anon;
grant execute on function public.super_admin_aal2() to authenticated;
comment on function public.super_admin_aal2() is
  'Nom historique : équivaut à is_super_admin() depuis 20260920120000 (MFA non exigée).';

-- ── 2. Sonde de capacité pour le site ────────────────────────────────────────
-- Présente = cette migration est appliquée ; vraie = l'appelant peut mettre à
-- la corbeille, restaurer et supprimer définitivement N'IMPORTE QUEL dossier.
-- Ce n'est qu'un indicateur d'interface : l'autorisation réelle reste la RLS
-- et la garde dossiers_guard, évaluées à chaque écriture.
create or replace function public.admin_delete_enabled()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_super_admin();
$$;
revoke all on function public.admin_delete_enabled() from public, anon;
grant execute on function public.admin_delete_enabled() to authenticated;

-- ── 3. Correction d'un profil client : super admin (condition AAL2 retirée) ──
drop policy if exists "profiles_update_super" on public.profiles;
create policy "profiles_update_super" on public.profiles
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ── 4. Vue des droits : même corps que 20260918100000, sans MFA_REQUIRED ─────
create or replace function public.admin_list_entitlements()
returns table (
  user_id uuid,
  email text,
  suspended_at timestamptz,
  plan_id text,
  subscription_status text,
  stripe_customer_id text,
  plan_limit integer,
  override_mode text,
  override_limit integer,
  override_reason text,
  applies boolean,
  unlimited boolean,
  effective_limit integer,
  used integer,
  period_end timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return query
  select
    u.id,
    u.email::text,
    p.suspended_at,
    e.plan_id,
    e.subscription_status,
    (select s.stripe_customer_id from public.subscriptions s
       where s.user_id = u.id order by s.updated_at desc limit 1),
    e.plan_limit,
    e.override_mode,
    e.override_limit,
    (select o.reason from public.entitlement_overrides o where o.user_id = u.id and o.active limit 1),
    e.applies,
    e.unlimited,
    e.dossier_limit,
    e.used,
    e.period_end
  from auth.users u
  left join public.profiles p on p.id = u.id
  cross join lateral public.dossier_entitlement(u.id) e;
end;
$$;
revoke all on function public.admin_list_entitlements() from public, anon;
grant execute on function public.admin_list_entitlements() to authenticated;

-- ── 5. Exception de quota : même corps que 20260917120000, sans MFA_REQUIRED ─
create or replace function public.admin_set_dossier_override(
  p_user uuid,
  p_mode text,
  p_limit integer,
  p_reason text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_old public.entitlement_overrides%rowtype;
  v_had_old boolean;
  v_new uuid;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception using errcode = '22023', message = 'REASON_REQUIRED';
  end if;
  if p_mode not in ('unlimited', 'custom_limit', 'bonus', 'remove') then
    raise exception using errcode = '22023', message = 'INVALID_MODE';
  end if;
  if p_mode in ('custom_limit', 'bonus') and (p_limit is null or p_limit < 0) then
    raise exception using errcode = '22023', message = 'INVALID_LIMIT';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception using errcode = '22023', message = 'UNKNOWN_USER';
  end if;

  select * into v_old from public.entitlement_overrides o where o.user_id = p_user and o.active limit 1;
  v_had_old := found;

  if v_had_old then
    update public.entitlement_overrides
      set active = false, revoked_at = now(), revoked_by = auth.uid()
      where id = v_old.id;
  end if;

  if p_mode <> 'remove' then
    insert into public.entitlement_overrides (user_id, mode, dossier_limit, reason, expires_at, created_by)
    values (
      p_user,
      p_mode,
      case when p_mode = 'unlimited' then null else p_limit end,
      trim(p_reason),
      p_expires_at,
      auth.uid()
    )
    returning id into v_new;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
  values (
    auth.uid(),
    'super_admin',
    case when p_mode = 'remove' then 'quota_override_retire' else 'quota_override_modifie' end,
    'utilisateur',
    p_user::text,
    p_user,
    jsonb_build_object(
      'ancienne_valeur', case when v_had_old
        then v_old.mode || coalesce(':' || v_old.dossier_limit::text, '') else 'aucune' end,
      'nouvelle_valeur', case when p_mode = 'remove' then 'aucune'
        else p_mode || coalesce(':' || p_limit::text, '') end,
      'motif', trim(p_reason)
    )
  );

  return v_new;
end;
$$;
revoke all on function public.admin_set_dossier_override(uuid, text, integer, text, timestamptz) from public, anon;
grant execute on function public.admin_set_dossier_override(uuid, text, integer, text, timestamptz) to authenticated;
