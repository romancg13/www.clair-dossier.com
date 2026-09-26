-- Durcissement AAL2 + suppression exclusive (2026-09-18) — MIGRATION ADDITIVE,
-- idempotente et rejouable. À appliquer APRÈS 20260917120000.
--
-- Objet (mission sécurité console admin) :
--   1. les données de TIERS (dossiers, pièces, profils, échéances, activité,
--      abonnements, notifications, prospects, e-mails) ne sont plus lisibles
--      ou modifiables par un administrateur qu'en session AAL2 (MFA vérifiée).
--      En AAL1, l'admin ne voit que SES propres données, comme un client :
--      le parcours d'enrôlement TOTP n'expose donc plus rien ;
--   2. la mise à la corbeille, la restauration et la suppression définitive
--      d'un dossier client sont réservées au SUPER ADMIN (prestige.seller,
--      seul rôle super_admin — verrou structurel : une seule ligne possible),
--      toujours en AAL2 — y compris par UPDATE direct de deleted_at (trigger) ;
--   3. l'ancienne policy « dossiers_delete_own » (2026-06) est resserrée :
--      un client ne peut plus supprimer par l'API qu'un dossier JAMAIS validé
--      (brouillon) — aucun frontend n'utilisait la suppression client ;
--   4. quotas : sur une période de facturation longue (offre annuelle), la
--      limite du plan s'applique par FENÊTRE MENSUELLE glissée sur la date
--      anniversaire — même droit mensuel que la facturation mensuelle du
--      même plan (ne peut qu'augmenter les droits, jamais bloquer plus).
--
-- Aucune donnée modifiée, aucune table détruite, RLS partout. Les policies
-- recréées ci-dessous reprennent mot pour mot leur prédicat d'origine, avec
-- la seule condition AAL2 en plus.

-- ── 0. Aides : admin / super admin en session MFA vérifiée ──────────────────
create or replace function public.admin_aal2()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_admin() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
revoke all on function public.admin_aal2() from public, anon;
grant execute on function public.admin_aal2() to authenticated;

create or replace function public.super_admin_aal2()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_super_admin() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
revoke all on function public.super_admin_aal2() from public, anon;
grant execute on function public.super_admin_aal2() to authenticated;

-- Verrou structurel : au plus UNE ligne super_admin (prestige.seller).
-- Pour nommer un second super admin un jour : supprimer d'abord cet index
-- (décision humaine explicite, hors application).
create unique index if not exists app_admins_un_seul_super
  on public.app_admins ((true)) where role = 'super_admin';

-- ── 1. Lectures administrateur : AAL2 exigée ────────────────────────────────
drop policy if exists "dossiers_select_admin" on public.dossiers;
create policy "dossiers_select_admin" on public.dossiers
  for select using (public.admin_aal2());

drop policy if exists "docs_select_admin" on public.dossier_documents;
create policy "docs_select_admin" on public.dossier_documents
  for select using (public.admin_aal2());

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.admin_aal2());

drop policy if exists "docs_storage_select_admin" on storage.objects;
create policy "docs_storage_select_admin" on storage.objects
  for select using (bucket_id = 'documents' and public.admin_aal2());

drop policy if exists "deadlines_select_own" on public.dossier_deadlines;
create policy "deadlines_select_own" on public.dossier_deadlines
  for select using (auth.uid() = user_id or public.admin_aal2());

drop policy if exists "events_select_own" on public.dossier_events;
create policy "events_select_own" on public.dossier_events
  for select using (auth.uid() = user_id or public.admin_aal2());

-- Prospects : migration 20260829 facultative (capture des demandes) — ne
-- resserrer ses policies que si la table existe.
do $$
begin
  if to_regclass('public.prospects') is not null then
    execute 'drop policy if exists "prospects_select_admin" on public.prospects';
    execute 'create policy "prospects_select_admin" on public.prospects
      for select using (public.admin_aal2())';
    execute 'drop policy if exists "prospects_update_admin" on public.prospects';
    execute 'create policy "prospects_update_admin" on public.prospects
      for update using (public.admin_aal2()) with check (public.admin_aal2())';
  end if;
end $$;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id or public.admin_aal2());

drop policy if exists "submissions_select_own" on public.dossier_submissions;
create policy "submissions_select_own" on public.dossier_submissions
  for select using (auth.uid() = user_id or public.admin_aal2());

drop policy if exists "admin_notifications_select" on public.admin_notifications;
create policy "admin_notifications_select" on public.admin_notifications
  for select using (public.admin_aal2());

drop policy if exists "notes_select_admin" on public.admin_notes;
create policy "notes_select_admin" on public.admin_notes
  for select using (public.admin_aal2());

drop policy if exists "audit_select_super" on public.audit_logs;
create policy "audit_select_super" on public.audit_logs
  for select using (public.super_admin_aal2());

-- E-mails des comptes : réservés à l'admin en AAL2 (0 ligne sinon).
create or replace function public.admin_user_emails()
returns table (id uuid, email text)
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.id, u.email::text
  from auth.users u
  where public.admin_aal2();
$$;
revoke all on function public.admin_user_emails() from public, anon;
grant execute on function public.admin_user_emails() to authenticated;

-- ── 2. Écritures administrateur : AAL2 exigée ───────────────────────────────
drop policy if exists "dossiers_update_admin" on public.dossiers;
create policy "dossiers_update_admin" on public.dossiers
  for update using (public.admin_aal2()) with check (public.admin_aal2());

drop policy if exists "docs_update_admin" on public.dossier_documents;
create policy "docs_update_admin" on public.dossier_documents
  for update using (public.admin_aal2()) with check (public.admin_aal2());

drop policy if exists "deadlines_all_admin" on public.dossier_deadlines;
create policy "deadlines_all_admin" on public.dossier_deadlines
  for all using (public.admin_aal2()) with check (public.admin_aal2());

drop policy if exists "admin_notifications_update" on public.admin_notifications;
create policy "admin_notifications_update" on public.admin_notifications
  for update using (public.admin_aal2()) with check (public.admin_aal2());

drop policy if exists "notes_insert_admin" on public.admin_notes;
create policy "notes_insert_admin" on public.admin_notes
  for insert with check (public.admin_aal2() and author_id = auth.uid());

drop policy if exists "audit_insert_admin" on public.audit_logs;
create policy "audit_insert_admin" on public.audit_logs
  for insert with check (public.admin_aal2() and actor_id = auth.uid());

-- Dépôt de livrables chez un client : admin en AAL2.
drop policy if exists "docs_insert_admin" on public.dossier_documents;
create policy "docs_insert_admin" on public.dossier_documents
  for insert with check (public.admin_aal2());

drop policy if exists "docs_storage_insert_admin" on storage.objects;
create policy "docs_storage_insert_admin" on storage.objects
  for insert with check (bucket_id = 'documents' and public.admin_aal2());

-- ── 3. Suppressions : exclusives au SUPER ADMIN (AAL2) ──────────────────────
drop policy if exists "dossiers_delete_super" on public.dossiers;
create policy "dossiers_delete_super" on public.dossiers
  for delete using (public.super_admin_aal2());

drop policy if exists "docs_delete_admin" on public.dossier_documents;
create policy "docs_delete_admin" on public.dossier_documents
  for delete using (public.super_admin_aal2());

drop policy if exists "docs_storage_delete_admin" on storage.objects;
create policy "docs_storage_delete_admin" on storage.objects
  for delete using (bucket_id = 'documents' and public.super_admin_aal2());

drop policy if exists "notes_delete_super" on public.admin_notes;
create policy "notes_delete_super" on public.admin_notes
  for delete using (public.super_admin_aal2());

-- Client : suppression par l'API limitée aux dossiers JAMAIS validés
-- (brouillons). Un dossier validé ne se supprime que via le super admin
-- (corbeille puis, au besoin, suppression définitive). Aucun frontend
-- n'utilisait la suppression client : aucun parcours existant n'est cassé.
drop policy if exists "dossiers_delete_own" on public.dossiers;
create policy "dossiers_delete_own" on public.dossiers
  for delete using (auth.uid() = user_id and submitted_at is null);

-- ── 4. Garde de soumission : corbeille réservée au super admin (anti-bypass) ─
-- Même corps que 20260917120000, avec deux resserrements :
--   * admin_seen_at / taken_by / taken_at / current_step : admin en AAL2 ;
--   * deleted_at / deleted_by / delete_reason : SUPER admin en AAL2 uniquement
--     (un UPDATE direct ne peut plus mettre un dossier à la corbeille ni l'en
--     sortir sans MFA vérifiée du propriétaire de la plateforme).
-- L'exemption de quota des comptes internes (is_admin) est inchangée.
create or replace function public.dossiers_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
  v_admin_console boolean := coalesce(public.admin_aal2(), false);
  v_super_delete boolean := coalesce(public.super_admin_aal2(), false);
  v_ent record;
  v_recent integer;
begin
  if tg_op = 'INSERT' then
    new.submitted_at := null;
    new.admin_seen_at := null;
    new.taken_by := null;
    new.taken_at := null;
    new.created_by := coalesce(v_actor, new.user_id);
    if not v_admin_console then
      new.current_step := null;
    end if;
    if not v_super_delete then
      new.deleted_at := null;
      new.deleted_by := null;
      new.delete_reason := null;
    end if;
  else
    new.submitted_at := old.submitted_at;
    new.created_by := old.created_by;
    new.client_request_id := old.client_request_id;
    new.user_id := old.user_id;
    if not v_admin_console then
      new.admin_seen_at := old.admin_seen_at;
      new.taken_by := old.taken_by;
      new.taken_at := old.taken_at;
      new.current_step := old.current_step;
    end if;
    if not v_super_delete then
      new.deleted_at := old.deleted_at;
      new.deleted_by := old.deleted_by;
      new.delete_reason := old.delete_reason;
    end if;
  end if;

  -- Première validation (sortie de l'état brouillon) : contrôle et consommation.
  -- Statuts de progression : un brouillon archivé ou abandonné ne consomme rien.
  if new.status in ('complete', 'transmis', 'en-cours', 'valide') and new.submitted_at is null then
    -- Sérialise les validations d'un même utilisateur (double onglet, double
    -- clic, appels simultanés) jusqu'à la fin de la transaction.
    perform pg_advisory_xact_lock(hashtextextended('clairdossier:quota:' || new.user_id::text, 0));

    if not v_admin and v_actor is not null then
      if v_actor <> new.user_id then
        raise exception using errcode = '42501', message = 'FORBIDDEN';
      end if;

      if not exists (select 1 from auth.users u where u.id = v_actor and u.email_confirmed_at is not null) then
        raise exception using errcode = 'P0001', message = 'EMAIL_NOT_VERIFIED';
      end if;

      select count(*) into v_recent
      from public.dossier_submissions ds
      where ds.user_id = new.user_id and ds.submitted_at > now() - interval '10 minutes';
      if v_recent >= 10 then
        raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
      end if;

      select * into v_ent from public.dossier_entitlement(new.user_id);
      if v_ent.blocked_reason is not null then
        raise exception using errcode = 'P0001', message = 'SUBMISSION_BLOCKED',
          detail = v_ent.blocked_reason;
      end if;
      if v_ent.applies and not v_ent.unlimited and v_ent.dossier_limit is not null
         and v_ent.used >= v_ent.dossier_limit then
        raise exception using errcode = 'P0001', message = 'DOSSIER_QUOTA_EXCEEDED',
          detail = json_build_object(
            'limit', v_ent.dossier_limit,
            'used', v_ent.used,
            'period_end', v_ent.period_end
          )::text;
      end if;
    end if;

    new.submitted_at := now();
  end if;

  return new;
end;
$$;

-- ── 5. Vue super admin des droits : AAL2 exigée aussi en lecture ────────────
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
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
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

-- ── 6. Quota : fenêtre MENSUELLE sur les périodes de facturation longues ────
-- Même corps que 20260917120000 ; seule la fenêtre de décompte change quand la
-- période de facturation dépasse 35 jours (offre annuelle) : la limite du plan
-- s'applique alors par mois anniversaire, jamais une seule fois pour l'année.
create or replace function public.dossier_entitlement(p_user uuid)
returns table (
  applies boolean,
  unlimited boolean,
  dossier_limit integer,
  plan_limit integer,
  used integer,
  period_start timestamptz,
  period_end timestamptz,
  plan_id text,
  subscription_status text,
  override_mode text,
  override_limit integer,
  blocked_reason text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_has_sub boolean := false;
  v_ov public.entitlement_overrides%rowtype;
  v_has_ov boolean := false;
  v_is_admin boolean;
  v_suspended timestamptz;
  v_plan_limit integer;
  v_months integer;
  v_window_start timestamptz;
begin
  applies := false;
  unlimited := false;
  dossier_limit := null;
  plan_limit := null;
  period_start := now() - interval '30 days';
  period_end := null;
  plan_id := null;
  subscription_status := null;
  override_mode := null;
  override_limit := null;
  blocked_reason := null;

  select p.suspended_at into v_suspended from public.profiles p where p.id = p_user;
  if v_suspended is not null then
    blocked_reason := 'suspended';
  end if;

  select exists (select 1 from public.app_admins a where a.user_id = p_user) into v_is_admin;

  -- Abonnement courant : actif / essai / paiement en retard (période de grâce
  -- Stripe), ou résilié mais encore dans la période payée.
  select s.* into v_sub
  from public.subscriptions s
  where s.user_id = p_user
    and (s.status in ('active', 'trialing', 'past_due')
         or (s.status = 'canceled' and s.current_period_end > now()))
  order by s.current_period_end desc nulls last, s.updated_at desc
  limit 1;
  v_has_sub := found;

  if v_has_sub then
    applies := true;
    plan_id := v_sub.plan_id;
    subscription_status := v_sub.status;
    select pe.dossier_limit into v_plan_limit from public.plan_entitlements pe where pe.plan_id = v_sub.plan_id;
    plan_limit := v_plan_limit;
    if v_sub.plan_id is null or not exists (select 1 from public.plan_entitlements pe where pe.plan_id = v_sub.plan_id) then
      -- Offre inconnue : on n'invente pas de limite.
      applies := false;
    end if;
    if v_sub.current_period_start is not null then
      period_start := v_sub.current_period_start;
      period_end := v_sub.current_period_end;
      -- Période échue mais webhook de renouvellement pas encore reçu : on ne
      -- bloque pas le client sur une période passée.
      if v_sub.current_period_end is not null and v_sub.current_period_end <= now() then
        period_start := v_sub.current_period_end;
        period_end := null;
      end if;
      -- Facturation longue (annuelle) : fenêtre mensuelle anniversaire.
      if period_end is not null and period_end - period_start > interval '35 days' then
        v_months := (extract(year from age(now(), period_start)) * 12
                   + extract(month from age(now(), period_start)))::integer;
        v_window_start := period_start + make_interval(months => greatest(v_months, 0));
        if v_window_start > now() then
          v_window_start := period_start + make_interval(months => greatest(v_months - 1, 0));
        end if;
        period_start := v_window_start;
        period_end := least(v_window_start + interval '1 month', period_end);
      end if;
    end if;
    if v_plan_limit is null and applies then
      unlimited := true;
    end if;
    dossier_limit := v_plan_limit;
  else
    -- Paiement en échec sans abonnement exploitable : création bloquée.
    select s.status into subscription_status
    from public.subscriptions s
    where s.user_id = p_user and s.status in ('unpaid', 'incomplete', 'paused')
    order by s.updated_at desc limit 1;
    if found and blocked_reason is null then
      blocked_reason := 'payment';
    end if;
  end if;

  select o.* into v_ov
  from public.entitlement_overrides o
  where o.user_id = p_user and o.active and o.starts_at <= now()
    and (o.expires_at is null or o.expires_at > now())
  limit 1;
  v_has_ov := found;

  if v_has_ov then
    override_mode := v_ov.mode;
    override_limit := v_ov.dossier_limit;
    if v_ov.mode = 'unlimited' then
      applies := true;
      unlimited := true;
      dossier_limit := null;
    elsif v_ov.mode = 'custom_limit' then
      applies := true;
      unlimited := false;
      dossier_limit := v_ov.dossier_limit;
    elsif v_ov.mode = 'bonus' and applies and not unlimited then
      dossier_limit := coalesce(v_plan_limit, 0) + v_ov.dossier_limit;
    end if;
  end if;

  -- Comptes internes de l'équipe : jamais limités en quantité.
  if v_is_admin then
    applies := true;
    unlimited := true;
    dossier_limit := null;
  end if;

  select count(*)::integer into used
  from public.dossier_submissions ds
  where ds.user_id = p_user
    and ds.submitted_at >= period_start
    and (period_end is null or ds.submitted_at < period_end);

  return next;
end;
$$;

revoke all on function public.dossier_entitlement(uuid) from public, anon, authenticated;
