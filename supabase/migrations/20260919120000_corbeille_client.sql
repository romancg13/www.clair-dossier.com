-- Corbeille CLIENT (2026-09-19) — MIGRATION ADDITIVE, idempotente et rejouable.
-- À appliquer APRÈS 20260918100000 et 20260918120000.
--
-- Objet : chaque propriétaire peut mettre SON dossier à la corbeille et
-- restaurer ce qu'il a lui-même supprimé ; le super admin en AAL2 garde la
-- main sur tous les dossiers (inchangé). Tout se décide dans la base :
--   * dossiers_guard : même corps que 20260918100000, seul le bloc
--     deleted_at / deleted_by / delete_reason change — pour le propriétaire,
--     date = now() et auteur = auth.uid() imposés (valeurs envoyées ignorées),
--     restauration seulement si deleted_by = lui-même (un dossier mis à la
--     corbeille par l'administration reste sous son contrôle) ; tout autre
--     acteur non super admin AAL2 : valeurs inchangées, comme avant.
--   * dossiers_audit_corbeille : rôle « client » journalisé (au lieu de « admin »).
--   * client_trash_enabled() : sonde de capacité pour le site.
-- Inchangés : RLS (dossiers_select_own / dossiers_update_own / policies admin),
-- quota (registre dossier_submissions : aucun recrédit, aucune consommation à
-- la restauration), pièces et Storage (aucune suppression physique),
-- suppression définitive (super admin AAL2 uniquement).

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
      if v_actor is not null and v_actor = old.user_id
         and old.deleted_at is null and new.deleted_at is not null then
        -- Corbeille du propriétaire : date et auteur imposés par la base.
        new.deleted_at := now();
        new.deleted_by := v_actor;
        new.delete_reason := left(nullif(btrim(coalesce(new.delete_reason, '')), ''), 300);
      elsif v_actor is not null and v_actor = old.user_id
         and old.deleted_at is not null and new.deleted_at is null
         and old.deleted_by = v_actor then
        -- Restauration par le propriétaire de ce qu'il a lui-même supprimé.
        new.deleted_by := null;
        new.delete_reason := null;
      else
        new.deleted_at := old.deleted_at;
        new.deleted_by := old.deleted_by;
        new.delete_reason := old.delete_reason;
      end if;
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

create or replace function public.dossiers_audit_corbeille()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  -- Sans utilisateur authentifié (maintenance serveur), dossiers_guard
  -- empêche déjà toute modification de deleted_at : rien à journaliser.
  if v_actor is null then
    return null;
  end if;
  v_role := case
    when coalesce(public.is_super_admin(), false) then 'super_admin'
    when coalesce(public.is_admin(), false) then 'admin'
    else 'client'
  end;

  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
    values (
      v_actor, v_role, 'dossier_corbeille', 'dossier', new.id::text, new.user_id,
      jsonb_build_object('source', 'base', 'motif', coalesce(new.delete_reason, ''))
    );
  elsif old.deleted_at is not null and new.deleted_at is null then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
    values (
      v_actor, v_role, 'dossier_restaure', 'dossier', new.id::text, new.user_id,
      jsonb_build_object('source', 'base')
    );
  end if;
  return null;
end;
$$;

create or replace function public.client_trash_enabled()
returns boolean language sql stable as $$ select true $$;
revoke all on function public.client_trash_enabled() from public, anon;
grant execute on function public.client_trash_enabled() to authenticated;
