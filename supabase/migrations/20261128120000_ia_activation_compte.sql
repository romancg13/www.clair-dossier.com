-- Analyse automatique par COMPTE (acceptation unique), derrière un interrupteur général.
-- Additive et rejouable. EXIGE le moteur IA (20261023, 20261102) : refus explicite sinon.
--
--   * ai_auto_gate (ligne unique) : 'ferme' (défaut : aucune activation client), 'pilote'
--     (comptes administrateurs seulement), 'ouvert' (tous les comptes éligibles). Seul un
--     administrateur le change (RPC journalisée). C'est un COUPE-CIRCUIT : restreindre
--     l'interrupteur annule les travaux en file des comptes qui ne sont plus autorisés, et
--     ai_enqueue refuse toute nouvelle mise en file pour ces comptes (abonnement compris).
--     Reste 'ferme' tant que les garanties juridiques (CGV art. 6, confidentialité, AIPD,
--     DPA, transferts) ne sont pas validées.
--   * ai_account_settings : acceptation unique par compte (version des conditions en liste
--     blanche, horodatage), désactivable par le titulaire (tous ses dossiers).
--   * Chaque NOUVELLE pièce d'un compte ayant accepté, éligible et autorisé, active son dossier
--     sans relire les anciennes pièces (y compris à la réouverture) ; l'analyse des pièces
--     antérieures reste une demande explicite, dossier par dossier (enable_ai_processing).

do $$
begin
  if to_regclass('public.dossier_ai_settings') is null
     or to_regprocedure('public.ai_admin_audit(text,uuid,uuid,jsonb)') is null
     or to_regprocedure('public.client_subscription_active(uuid)') is null then
    raise exception 'MOTEUR_IA_ABSENT : appliquer 20261023, 20261102 et 20261126120000 avant 20261128120000';
  end if;
end $$;

-- ── 1. Interrupteur général ─────────────────────────────────────────────────
create table if not exists public.ai_auto_gate (
  id smallint primary key default 1 check (id = 1),
  mode text not null default 'ferme' check (mode in ('ferme', 'pilote', 'ouvert')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.ai_auto_gate (id) values (1) on conflict (id) do nothing;
alter table public.ai_auto_gate enable row level security;
drop policy if exists "ai_auto_gate_select" on public.ai_auto_gate;
-- Lecture réservée à l'administration ; les clients passent par my_ai_account().
create policy "ai_auto_gate_select" on public.ai_auto_gate for select to authenticated using (public.is_admin());

create or replace function public.ai_auto_gate_allows(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case (select mode from public.ai_auto_gate where id = 1)
    when 'ouvert' then true
    when 'pilote' then exists (select 1 from public.app_admins a where a.user_id = p_user)
    else false end
$$;
revoke execute on function public.ai_auto_gate_allows(uuid) from public, anon, authenticated;

-- ── 2. Acceptation par compte ───────────────────────────────────────────────
create table if not exists public.ai_account_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled_at timestamptz,
  terms_version text,
  accepted_at timestamptz,
  disabled_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ai_account_settings enable row level security;
drop policy if exists "ai_account_select_own" on public.ai_account_settings;
create policy "ai_account_select_own" on public.ai_account_settings
  for select using (auth.uid() = user_id or public.is_admin());
-- Aucune policy d'écriture : seules les RPC ci-dessous écrivent.

-- Coupe-circuit : travaux en file des dossiers « par compte » dont le titulaire n'est plus autorisé.
create or replace function public.ai_account_cutoff()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  update public.ai_jobs j set status = 'cancelled', finished_at = now(), updated_at = now()
    from public.dossier_ai_settings s
   where s.dossier_id = j.dossier_id and s.consent_reference like 'compte:%'
     and j.status in ('queued', 'running')
     and not (public.ai_auto_gate_allows(s.user_id) and public.client_subscription_active(s.user_id));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.ai_account_cutoff() from public, anon, authenticated;

create or replace function public.ai_admin_set_auto_gate(p_mode text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_annules integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if p_mode not in ('ferme', 'pilote', 'ouvert') then raise exception 'MODE_INVALIDE'; end if;
  update public.ai_auto_gate set mode = p_mode, updated_at = now(), updated_by = auth.uid() where id = 1;
  v_annules := public.ai_account_cutoff();
  perform public.ai_admin_audit('ia_interrupteur_' || p_mode, null, null, jsonb_build_object('mode', p_mode, 'travaux_annules', v_annules));
  return p_mode;
end;
$$;
revoke execute on function public.ai_admin_set_auto_gate(text) from public, anon;
grant execute on function public.ai_admin_set_auto_gate(text) to authenticated;

create or replace function public.accept_ai_account(p_terms_version text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Liste blanche : seules les conditions publiées peuvent être acceptées.
  if coalesce(p_terms_version, '') not in ('ia-2026-11') then raise exception 'TERMS_VERSION_INVALIDE'; end if;
  if not public.ai_auto_gate_allows(v_user) then raise exception 'ANALYSE_FERMEE'; end if;
  insert into public.ai_account_settings (user_id, enabled_at, terms_version, accepted_at, disabled_at)
  values (v_user, now(), p_terms_version, now(), null)
  on conflict (user_id) do update
    set enabled_at = now(), terms_version = excluded.terms_version, accepted_at = now(),
        disabled_at = null, updated_at = now();
end;
$$;
revoke execute on function public.accept_ai_account(text) from public, anon;
grant execute on function public.accept_ai_account(text) to authenticated;

-- Désactivation par le titulaire : TOUS ses dossiers (y compris activés dossier par dossier) ;
-- travaux en file annulés, événement journalisé ; les résultats déjà produits restent.
-- Les dossiers activés par le compte sont marqués « compte-desactive » : une nouvelle
-- acceptation les réactivera à la prochaine pièce ; les autres restent désactivés.
create or replace function public.disable_ai_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.ai_account_settings set enabled_at = null, disabled_at = now(), updated_at = now()
   where user_id = v_user;
  update public.ai_jobs j set status = 'cancelled', finished_at = now(), updated_at = now()
    from public.dossier_ai_settings s
   where s.dossier_id = j.dossier_id and s.user_id = v_user and j.status in ('queued', 'running');
  insert into public.dossier_events (dossier_id, user_id, type, label)
  select s.dossier_id, v_user, 'ia_desactivee', 'Analyse automatique désactivée depuis Mon compte'
    from public.dossier_ai_settings s where s.user_id = v_user and s.enabled_at is not null;
  update public.dossier_ai_settings
     set enabled_at = null, enabled_by = null, updated_at = now(),
         consent_reference = case when consent_reference like 'compte:%'
                                  then 'compte-desactive:' || substr(consent_reference, 8) else consent_reference end
   where user_id = v_user and enabled_at is not null;
end;
$$;
revoke execute on function public.disable_ai_account() from public, anon;
grant execute on function public.disable_ai_account() to authenticated;

-- État lisible par le titulaire (interface : fenêtre d'acceptation, Mon compte).
create or replace function public.my_ai_account()
returns table (enabled boolean, terms_version text, accepted_at timestamptz, gate_allows boolean, eligible boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(a.enabled_at is not null, false), a.terms_version, a.accepted_at,
         public.ai_auto_gate_allows(auth.uid()), public.client_subscription_active(auth.uid())
    from (select auth.uid() as uid) u
    left join public.ai_account_settings a on a.user_id = u.uid
   where u.uid is not null
$$;
revoke execute on function public.my_ai_account() from public, anon;
grant execute on function public.my_ai_account() to authenticated;

-- ── 3. Mise en file : coupe-circuit pour les dossiers « par compte » ─────────
-- Même corps que 20261023, plus : un dossier activé par le compte n'est mis en file que si
-- l'interrupteur autorise encore son titulaire et que son abonnement est actif.
create or replace function public.ai_enqueue(p_dossier uuid, p_kind text, p_document uuid, p_delay interval default '0 seconds')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_ref text;
begin
  select d.user_id, s.consent_reference into v_user, v_ref
    from public.dossiers d
    join public.dossier_ai_settings s on s.dossier_id = d.id and s.enabled_at is not null
   where d.id = p_dossier and d.deleted_at is null;
  if v_user is null or public.dossier_is_closed(p_dossier) then return; end if;
  if coalesce(v_ref, '') like 'compte:%'
     and not (public.ai_auto_gate_allows(v_user) and public.client_subscription_active(v_user)) then return; end if;
  insert into public.ai_jobs (dossier_id, user_id, kind, document_id, run_after)
  values (p_dossier, v_user, p_kind, p_document, now() + p_delay)
  on conflict (dossier_id, kind, coalesce(document_id, '00000000-0000-0000-0000-000000000000'::uuid))
    where status in ('queued', 'running')
  do update set run_after = greatest(public.ai_jobs.run_after, excluded.run_after), updated_at = now()
    where public.ai_jobs.status = 'queued';
end;
$$;
revoke execute on function public.ai_enqueue(uuid, text, uuid, interval) from public, anon, authenticated;

-- Reprise d'un dossier (réouverture) : pour un dossier activé par le compte, seules les pièces
-- déposées depuis l'activation sont lues (jamais les pièces antérieures sans demande expresse).
create or replace function public.ai_enqueue_dossier(p_dossier uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_doc record;
  v_count integer := 0;
  v_since timestamptz;
begin
  select case when s.consent_reference like 'compte:%' then s.enabled_at end into v_since
    from public.dossier_ai_settings s where s.dossier_id = p_dossier;
  for v_doc in
    select dd.id from public.dossier_documents dd
     where dd.dossier_id = p_dossier and dd.kind = 'piece' and dd.deleted_at is null
       and (v_since is null or dd.created_at >= v_since)
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

-- ── 4. Activation à chaque nouvelle pièce (avant documents_ai_enqueue) ──────
create or replace function public.documents_ai_account_enable()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid;
  v_existing text;
  v_exists boolean;
  a public.ai_account_settings;
  v_ref text;
  v_done integer;
begin
  if new.kind <> 'piece' or new.deleted_at is not null then return new; end if;
  select true, s.consent_reference into v_exists, v_existing
    from public.dossier_ai_settings s where s.dossier_id = new.dossier_id;
  -- Réglage existant (activé, ou désactivé dossier par dossier) : respecté. Seul un dossier
  -- désactivé depuis Mon compte peut être réactivé par une nouvelle acceptation.
  if coalesce(v_exists, false) and coalesce(v_existing, '') not like 'compte-desactive:%' then return new; end if;
  select d.user_id into v_owner from public.dossiers d where d.id = new.dossier_id and d.deleted_at is null;
  if v_owner is null then return new; end if;
  select * into a from public.ai_account_settings where user_id = v_owner and enabled_at is not null;
  if a.user_id is null then return new; end if;
  if not public.ai_auto_gate_allows(v_owner) then return new; end if;
  if not public.client_subscription_active(v_owner) then return new; end if;
  if public.dossier_is_closed(new.dossier_id) then return new; end if;
  v_ref := 'compte:' || a.terms_version || ':' || to_char(a.accepted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at, enabled_by, terms_version, consent_reference, review_mode)
  values (new.dossier_id, v_owner, now(), v_owner, a.terms_version, v_ref,
          case when (select mode from public.ai_auto_gate where id = 1) = 'ouvert' then 'auto' else 'manual' end)
  on conflict (dossier_id) do update
    set enabled_at = now(), enabled_by = v_owner, terms_version = excluded.terms_version,
        consent_reference = excluded.consent_reference, updated_at = now()
    where public.dossier_ai_settings.enabled_at is null
      and public.dossier_ai_settings.consent_reference like 'compte-desactive:%';
  get diagnostics v_done = row_count;
  if v_done > 0 then
    insert into public.dossier_events (dossier_id, user_id, type, label)
    values (new.dossier_id, v_owner, 'ia_activee',
            'Analyse automatique activée (réglage du compte, conditions ' || a.terms_version || ') — nouvelles pièces seulement');
  end if;
  return new;
end;
$$;
revoke execute on function public.documents_ai_account_enable() from public, anon, authenticated;
drop trigger if exists documents_ai_account_enable on public.dossier_documents;
create trigger documents_ai_account_enable
  before insert on public.dossier_documents
  for each row execute function public.documents_ai_account_enable();

-- ── 5. L'activation par dossier (rétroactive, demande expresse) respecte l'interrupteur ──
create or replace function public.enable_ai_processing(p_dossier uuid, p_terms_version text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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
  if not public.ai_auto_gate_allows(v_owner) then raise exception 'ANALYSE_FERMEE'; end if;
  if public.dossier_is_closed(p_dossier) then raise exception 'DOSSIER_CLOTURE'; end if;
  select * into v_ent from public.dossier_entitlement(v_owner);
  if not (coalesce(v_ent.subscription_status, '') in ('active', 'trialing') or v_ent.override_mode is not null) then
    raise exception 'SUBSCRIPTION_REQUIRED';
  end if;
  -- Demande expresse pour CE dossier : la référence « par compte » est remplacée (pièces antérieures incluses).
  insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at, enabled_by, terms_version)
  values (p_dossier, v_owner, now(), v_actor, p_terms_version)
  on conflict (dossier_id) do update
    set enabled_at = now(), enabled_by = v_actor, terms_version = p_terms_version,
        consent_reference = null, updated_at = now();
  insert into public.dossier_events (dossier_id, user_id, type, label)
  values (p_dossier, v_owner, 'ia_activee', 'Traitement automatique activé — conditions ' || p_terms_version);
  perform public.ai_enqueue_dossier(p_dossier);
end;
$$;
revoke execute on function public.enable_ai_processing(uuid, text) from public, anon;
grant execute on function public.enable_ai_processing(uuid, text) to authenticated;
