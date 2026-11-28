-- Retour arrière de 20261128120000_ia_activation_compte.sql.
-- Coupe d'abord : les dossiers activés « par compte » sont désactivés et leurs travaux annulés
-- (aucune analyse ne continue sans l'interrupteur). La table des acceptations est ARCHIVÉE
-- (preuve du consentement), jamais supprimée. Les résultats déjà produits sont conservés.
-- Attention : enable_ai_processing redevient celle de 20261102 (activation par dossier sans
-- interrupteur, réservée aux abonnés) — équivalent à l'état d'avant la migration.
update public.ai_jobs j set status = 'cancelled', finished_at = now(), updated_at = now()
  from public.dossier_ai_settings s
 where s.dossier_id = j.dossier_id and s.consent_reference like 'compte%' and j.status in ('queued', 'running');
update public.dossier_ai_settings set enabled_at = null, enabled_by = null, updated_at = now()
 where consent_reference like 'compte%' and enabled_at is not null;

drop trigger if exists documents_ai_account_enable on public.dossier_documents;
drop function if exists public.documents_ai_account_enable();
drop function if exists public.my_ai_account();
drop function if exists public.disable_ai_account();
drop function if exists public.accept_ai_account(text);
drop function if exists public.ai_admin_set_auto_gate(text);
drop function if exists public.ai_account_cutoff();

do $$
begin
  if to_regclass('public.ai_account_settings') is not null then
    if to_regclass('public.ai_account_settings_archive') is not null then
      insert into public.ai_account_settings_archive select * from public.ai_account_settings on conflict do nothing;
      drop table public.ai_account_settings;
    else
      alter table public.ai_account_settings rename to ai_account_settings_archive;
    end if;
  end if;
end $$;

-- Fonctions d'origine (20261023 / 20261102).
create or replace function public.ai_enqueue(p_dossier uuid, p_kind text, p_document uuid, p_delay interval default '0 seconds')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  select d.user_id into v_user
    from public.dossiers d
    join public.dossier_ai_settings s on s.dossier_id = d.id and s.enabled_at is not null
   where d.id = p_dossier and d.deleted_at is null;
  if v_user is null or public.dossier_is_closed(p_dossier) then return; end if;
  insert into public.ai_jobs (dossier_id, user_id, kind, document_id, run_after)
  values (p_dossier, v_user, p_kind, p_document, now() + p_delay)
  on conflict (dossier_id, kind, coalesce(document_id, '00000000-0000-0000-0000-000000000000'::uuid))
    where status in ('queued', 'running')
  do update set run_after = greatest(public.ai_jobs.run_after, excluded.run_after), updated_at = now()
    where public.ai_jobs.status = 'queued';
end;
$$;
revoke execute on function public.ai_enqueue(uuid, text, uuid, interval) from public, anon, authenticated;

create or replace function public.ai_enqueue_dossier(p_dossier uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_doc record;
  v_count integer := 0;
begin
  for v_doc in
    select dd.id from public.dossier_documents dd
     where dd.dossier_id = p_dossier and dd.kind = 'piece' and dd.deleted_at is null
       and not exists (select 1 from public.ai_extractions x where x.document_id = dd.id and x.status in ('ok', 'unsupported'))
  loop
    perform public.ai_enqueue(p_dossier, 'extract', v_doc.id);
    v_count := v_count + 1;
  end loop;
  if v_count > 0 or not exists (select 1 from public.ai_analyses a where a.dossier_id = p_dossier) then
    perform public.ai_enqueue(p_dossier, 'consolidate', null, interval '90 seconds');
  end if;
  return v_count;
end;
$$;
revoke execute on function public.ai_enqueue_dossier(uuid) from public, anon, authenticated;

create or replace function public.enable_ai_processing(p_dossier uuid, p_terms_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_ent record;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_terms_version, '') = '' then raise exception 'TERMS_VERSION_REQUIRED'; end if;
  select user_id into v_owner from public.dossiers where id = p_dossier and deleted_at is null;
  if v_owner is null then raise exception 'DOSSIER_INTROUVABLE'; end if;
  if v_owner <> v_actor then raise exception 'FORBIDDEN'; end if;
  if public.dossier_is_closed(p_dossier) then raise exception 'DOSSIER_CLOTURE'; end if;
  select * into v_ent from public.dossier_entitlement(v_owner);
  if not (coalesce(v_ent.subscription_status, '') in ('active', 'trialing') or v_ent.override_mode is not null) then
    raise exception 'SUBSCRIPTION_REQUIRED';
  end if;
  insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at, enabled_by, terms_version)
  values (p_dossier, v_owner, now(), v_actor, p_terms_version)
  on conflict (dossier_id) do update
    set enabled_at = now(), enabled_by = v_actor, terms_version = p_terms_version, updated_at = now();
  insert into public.dossier_events (dossier_id, user_id, type, label)
  values (p_dossier, v_owner, 'ia_activee', 'Traitement automatique activé — conditions ' || p_terms_version);
  perform public.ai_enqueue_dossier(p_dossier);
end;
$$;

drop function if exists public.ai_auto_gate_allows(uuid);
drop table if exists public.ai_auto_gate;
