-- Retour arrière de 20261128120000_ia_activation_compte.sql.
-- Retire l'activation par compte et l'interrupteur ; rétablit enable_ai_processing (20261102).
-- Les dossiers déjà activés (dossier_ai_settings) et leurs résultats sont CONSERVÉS.
drop trigger if exists documents_ai_account_enable on public.dossier_documents;
drop function if exists public.documents_ai_account_enable();
drop function if exists public.my_ai_account();
drop function if exists public.disable_ai_account();
drop function if exists public.accept_ai_account(text);
drop function if exists public.ai_admin_set_auto_gate(text);
drop table if exists public.ai_account_settings;

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
