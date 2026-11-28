-- Analyse automatique par COMPTE (acceptation unique), derrière un interrupteur général.
-- Additive et rejouable. Dépend de 20261023/20261102 (moteur IA) et 20261126120000.
--
--   * ai_auto_gate (ligne unique) : 'ferme' (défaut : aucune activation client), 'pilote'
--     (comptes administrateurs seulement), 'ouvert' (tous les comptes éligibles). Seul un
--     administrateur le change (RPC journalisée). Reste 'ferme' tant que les garanties
--     juridiques (CGV art. 6, confidentialité, AIPD, DPA, transferts) ne sont pas validées.
--   * ai_account_settings : acceptation unique par compte (version des conditions, horodatage),
--     désactivable par le titulaire.
--   * Chaque NOUVELLE pièce d'un compte ayant accepté, éligible (abonnement ou dérogation) et
--     autorisé par l'interrupteur, active le dossier (sans relire les anciennes pièces) ;
--     l'analyse des pièces antérieures reste à la demande, dossier par dossier.
--   * enable_ai_processing (activation par dossier, rétroactive) respecte aussi l'interrupteur.

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
create policy "ai_auto_gate_select" on public.ai_auto_gate for select to authenticated using (true);

create or replace function public.ai_auto_gate_allows(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case (select mode from public.ai_auto_gate where id = 1)
    when 'ouvert' then true
    when 'pilote' then exists (select 1 from public.app_admins a where a.user_id = p_user)
    else false end
$$;
revoke execute on function public.ai_auto_gate_allows(uuid) from public, anon, authenticated;

create or replace function public.ai_admin_set_auto_gate(p_mode text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if p_mode not in ('ferme', 'pilote', 'ouvert') then raise exception 'MODE_INVALIDE'; end if;
  update public.ai_auto_gate set mode = p_mode, updated_at = now(), updated_by = auth.uid() where id = 1;
  perform public.ai_admin_audit('ia_interrupteur_' || p_mode, null, null, jsonb_build_object('mode', p_mode));
  return p_mode;
end;
$$;
revoke execute on function public.ai_admin_set_auto_gate(text) from public, anon;
grant execute on function public.ai_admin_set_auto_gate(text) to authenticated;

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

create or replace function public.accept_ai_account(p_terms_version text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(btrim(p_terms_version), '') = '' then raise exception 'TERMS_VERSION_REQUIRED'; end if;
  if not public.ai_auto_gate_allows(v_user) then raise exception 'ANALYSE_FERMEE'; end if;
  insert into public.ai_account_settings (user_id, enabled_at, terms_version, accepted_at, disabled_at)
  values (v_user, now(), left(btrim(p_terms_version), 40), now(), null)
  on conflict (user_id) do update
    set enabled_at = now(), terms_version = excluded.terms_version, accepted_at = now(),
        disabled_at = null, updated_at = now();
end;
$$;
revoke execute on function public.accept_ai_account(text) from public, anon;
grant execute on function public.accept_ai_account(text) to authenticated;

-- Désactivation : plus aucune nouvelle pièce analysée ; les dossiers activés par le compte
-- sont désactivés et leurs travaux en file annulés. Les résultats déjà produits restent.
create or replace function public.disable_ai_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.ai_account_settings set enabled_at = null, disabled_at = now(), updated_at = now()
   where user_id = v_user;
  update public.ai_jobs j set status = 'cancelled', finished_at = now(), updated_at = now()
   from public.dossier_ai_settings s
   where s.dossier_id = j.dossier_id and s.user_id = v_user and s.consent_reference like 'compte:%'
     and j.status in ('queued', 'running');
  update public.dossier_ai_settings set enabled_at = null, enabled_by = null, updated_at = now()
   where user_id = v_user and consent_reference like 'compte:%' and enabled_at is not null;
end;
$$;
revoke execute on function public.disable_ai_account() from public, anon;
grant execute on function public.disable_ai_account() to authenticated;

-- État lisible par le titulaire (interface : fenêtre d'acceptation, Mon compte).
create or replace function public.my_ai_account()
returns table (enabled boolean, terms_version text, accepted_at timestamptz, gate_allows boolean, eligible boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(a.enabled_at is not null, false), a.terms_version, a.accepted_at,
         public.ai_auto_gate_allows(auth.uid()), public.client_subscription_active(auth.uid())
    from (select auth.uid() as uid) u
    left join public.ai_account_settings a on a.user_id = u.uid
   where u.uid is not null
$$;
revoke execute on function public.my_ai_account() from public, anon;
grant execute on function public.my_ai_account() to authenticated;

-- ── 3. Activation à chaque nouvelle pièce (avant documents_ai_enqueue) ──────
create or replace function public.documents_ai_account_enable()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  a public.ai_account_settings;
begin
  if new.kind <> 'piece' or new.deleted_at is not null then return new; end if;
  -- Un réglage existe déjà pour ce dossier (activé, ou désactivé expressément) : on le respecte.
  if exists (select 1 from public.dossier_ai_settings s where s.dossier_id = new.dossier_id) then return new; end if;
  select d.user_id into v_owner from public.dossiers d where d.id = new.dossier_id and d.deleted_at is null;
  if v_owner is null then return new; end if;
  select * into a from public.ai_account_settings where user_id = v_owner and enabled_at is not null;
  if a.user_id is null then return new; end if;
  if not public.ai_auto_gate_allows(v_owner) then return new; end if;
  if not public.client_subscription_active(v_owner) then return new; end if;
  if public.dossier_is_closed(new.dossier_id) then return new; end if;
  insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at, enabled_by, terms_version, consent_reference, review_mode)
  values (new.dossier_id, v_owner, now(), v_owner, a.terms_version,
          'compte:' || a.terms_version || ':' || to_char(a.accepted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          case when (select mode from public.ai_auto_gate where id = 1) = 'ouvert' then 'auto' else 'manual' end)
  on conflict (dossier_id) do nothing;
  insert into public.dossier_events (dossier_id, user_id, type, label)
  values (new.dossier_id, v_owner, 'ia_activee',
          'Analyse automatique activée (réglage du compte, conditions ' || a.terms_version || ') — nouvelles pièces seulement');
  return new;
end;
$$;
revoke execute on function public.documents_ai_account_enable() from public, anon, authenticated;
drop trigger if exists documents_ai_account_enable on public.dossier_documents;
create trigger documents_ai_account_enable
  before insert on public.dossier_documents
  for each row execute function public.documents_ai_account_enable();

-- ── 4. L'activation par dossier (rétroactive) respecte l'interrupteur ───────
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
  if not public.ai_auto_gate_allows(v_owner) then raise exception 'ANALYSE_FERMEE'; end if;
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
