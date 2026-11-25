-- Essai prospect — protections SERVEUR (2026-11-25). MIGRATION ADDITIVE,
-- idempotente et rejouable. À appliquer APRÈS 20261118130000.
--
-- PRÉPARATION INTERNE : aucune route publique, aucun lien, aucune interface.
-- Rien n'est activé par cette migration : trial_settings.enabled = false,
-- plafond global = 0 essai, budget par essai = 0 centime. Tant que le
-- propriétaire n'a pas fixé ces trois valeurs (trial_admin_configure), aucun
-- essai ne peut être ouvert ni lancé. Détail : docs/recette/ESSAI_PROSPECT.md.
--
-- Règle produit : un prospect vérifié dispose de DEUX analyses réelles
-- gratuites, sur deux dossiers. La troisième est refusée, y compris via API.
--   * un enregistrement d'essai par compte (trial_accounts), SANS clé étrangère
--     en cascade : ni la suppression d'un dossier, d'une pièce ou du compte, ni
--     une nouvelle session, ni une réémission d'accès ne remet le compteur à
--     zéro ; empreinte normalisée de l'e-mail (casse, alias +tag, points
--     Gmail), hachée — jamais l'adresse en clair, aucun pistage d'appareil ;
--   * deux emplacements (trial_slots) : contrainte slot_no in (1, 2) + unicité
--     (essai, n°) + verrou de ligne à la réservation = jamais de troisième,
--     même en concurrence ; clé d'idempotence = une reprise technique ne
--     décompte jamais deux fois ;
--   * manifeste des pièces FIGÉ à la réservation (id + empreinte) : une pièce
--     ajoutée ou modifiée ensuite n'est jamais lue pendant l'essai ;
--   * expiration, suspension par l'administration, budget IA individuel
--     (dépense cumulée conservée même après suppression), plafond global ;
--   * journal privé append-only (trial_events), lisible de l'administration ;
--   * point d'intégration unique : trial_check (mise en file, déclencheur
--     BEFORE INSERT sur ai_jobs) et trial_allows (worker). Les deux ne
--     concernent QUE les dossiers porteurs d'un emplacement d'essai dont le
--     titulaire n'est pas abonné : pour tout autre dossier, retour immédiat,
--     comportement strictement inchangé.
-- Inchangés : ai_enqueue, enable_ai_processing (toujours SUBSCRIPTION_REQUIRED
-- hors essai), quotas par offre, Stripe, tables existantes (aucune colonne).

-- ── 1. Réglages (ligne unique, administration seule) ─────────────────────────
create table if not exists public.trial_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  max_trials integer not null default 0 check (max_trials >= 0),
  duration_days integer not null default 14 check (duration_days between 1 and 90),
  budget_cents integer not null default 0 check (budget_cents >= 0),
  max_pieces integer not null default 10 check (max_pieces between 1 and 50),
  max_pages integer not null default 60 check (max_pages >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.trial_settings is
  'Essai prospect : interrupteur, plafond global d''essais, durée, budget IA par essai (centimes), pièces et pages par analyse.';
insert into public.trial_settings (id) values (true) on conflict (id) do nothing;
alter table public.trial_settings enable row level security;
drop policy if exists "trial_settings_select_admin" on public.trial_settings;
create policy "trial_settings_select_admin" on public.trial_settings
  for select using (coalesce(public.is_admin(), false));
-- Aucune policy d'écriture : RPC trial_admin_configure uniquement.

-- ── 2. Essais (un par compte) ────────────────────────────────────────────────
-- user_id SANS clé étrangère, volontairement : la ligne survit à la suppression
-- du compte (sinon recréer le compte offrirait deux nouvelles analyses).
create table if not exists public.trial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email_fingerprint text not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  budget_cents integer not null check (budget_cents >= 0),
  spent_cents numeric(12, 4) not null default 0 check (spent_cents >= 0),
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.trial_accounts enable row level security;
drop policy if exists "trial_accounts_select_own" on public.trial_accounts;
create policy "trial_accounts_select_own" on public.trial_accounts
  for select using (user_id = auth.uid() or coalesce(public.is_admin(), false));

-- ── 3. Emplacements (deux au plus, jamais rendus) ────────────────────────────
-- dossier_id SANS clé étrangère : supprimer le dossier ne rend pas l'emplacement.
create table if not exists public.trial_slots (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trial_accounts (id) on delete restrict,
  slot_no smallint not null check (slot_no in (1, 2)),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  dossier_id uuid not null unique,
  manifest jsonb not null check (jsonb_typeof(manifest) = 'array'),
  manifest_hash text not null,
  piece_count integer not null check (piece_count >= 1),
  pages_used integer not null default 0,
  analysis_job_id uuid,
  analysis_job_count integer not null default 0,
  analysis_done_at timestamptz,
  claimed_at timestamptz not null default now(),
  unique (trial_id, slot_no),
  unique (trial_id, idempotency_key)
);
alter table public.trial_slots enable row level security;
drop policy if exists "trial_slots_select_own" on public.trial_slots;
create policy "trial_slots_select_own" on public.trial_slots
  for select using (
    exists (select 1 from public.trial_accounts a where a.id = trial_id and a.user_id = auth.uid())
    or coalesce(public.is_admin(), false)
  );

-- ── 4. Journal privé (append-only, administration seule) ─────────────────────
-- Chiffres et motifs seulement : aucun contenu de dossier, aucune adresse.
create table if not exists public.trial_events (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid,
  user_id uuid,
  kind text not null check (length(kind) between 3 and 60),
  detail jsonb not null default '{}'::jsonb,
  actor uuid,
  created_at timestamptz not null default now()
);
create index if not exists trial_events_trial_idx on public.trial_events (trial_id, created_at);
alter table public.trial_events enable row level security;
drop policy if exists "trial_events_select_admin" on public.trial_events;
create policy "trial_events_select_admin" on public.trial_events
  for select using (coalesce(public.is_admin(), false));
-- Aucune policy d'écriture : fonctions serveur uniquement.

-- Garde d'intégrité, valable pour TOUS les rôles (rôle serveur compris) :
-- journal intangible ; essais et emplacements jamais supprimés ; consommation,
-- manifeste et empreinte jamais réécrits ; dépense jamais diminuée.
create or replace function public.trial_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'TRUNCATE' then raise exception 'ESSAI_IMMUABLE'; end if;
  if tg_table_name = 'trial_events' then raise exception 'ESSAI_JOURNAL_IMMUABLE'; end if;
  if tg_op = 'DELETE' then raise exception 'ESSAI_IMMUABLE'; end if;
  if tg_table_name = 'trial_slots' then
    if new.id is distinct from old.id or new.trial_id is distinct from old.trial_id
       or new.slot_no is distinct from old.slot_no or new.idempotency_key is distinct from old.idempotency_key
       or new.dossier_id is distinct from old.dossier_id or new.manifest is distinct from old.manifest
       or new.manifest_hash is distinct from old.manifest_hash or new.piece_count is distinct from old.piece_count
       or new.claimed_at is distinct from old.claimed_at
       or new.pages_used < old.pages_used or new.analysis_job_count < old.analysis_job_count
       or (old.analysis_done_at is not null and new.analysis_done_at is distinct from old.analysis_done_at) then
      raise exception 'ESSAI_IMMUABLE';
    end if;
  else
    if new.id is distinct from old.id or new.email_fingerprint is distinct from old.email_fingerprint
       or new.started_at is distinct from old.started_at or new.spent_cents < old.spent_cents then
      raise exception 'ESSAI_IMMUABLE';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trial_events_guard on public.trial_events;
create trigger trial_events_guard before update or delete on public.trial_events
  for each row execute function public.trial_guard();
drop trigger if exists trial_events_guard_truncate on public.trial_events;
create trigger trial_events_guard_truncate before truncate on public.trial_events
  for each statement execute function public.trial_guard();
drop trigger if exists trial_slots_guard on public.trial_slots;
create trigger trial_slots_guard before update or delete on public.trial_slots
  for each row execute function public.trial_guard();
drop trigger if exists trial_slots_guard_truncate on public.trial_slots;
create trigger trial_slots_guard_truncate before truncate on public.trial_slots
  for each statement execute function public.trial_guard();
drop trigger if exists trial_accounts_guard on public.trial_accounts;
create trigger trial_accounts_guard before update or delete on public.trial_accounts
  for each row execute function public.trial_guard();
drop trigger if exists trial_accounts_guard_truncate on public.trial_accounts;
create trigger trial_accounts_guard_truncate before truncate on public.trial_accounts
  for each statement execute function public.trial_guard();

-- ── 5. Fonctions internes ────────────────────────────────────────────────────
-- Empreinte normalisée d'une adresse : casse, espaces, alias « +tag », et pour
-- Gmail les points et le domaine googlemail. Hachée (SHA-256) : l'adresse n'est
-- jamais conservée ici. Proportionné : aucune IP, aucun appareil, aucun cookie.
create or replace function public.trial_email_fingerprint(p_email text)
returns text language plpgsql immutable set search_path = public as $$
declare
  v text := lower(btrim(coalesce(p_email, '')));
  v_at integer := length(v) - position('@' in reverse(v)) + 1;
  v_local text;
  v_domain text;
begin
  if position('@' in v) = 0 then return null; end if;
  v_local := split_part(left(v, v_at - 1), '+', 1);
  v_domain := substr(v, v_at + 1);
  if v_domain in ('gmail.com', 'googlemail.com') then
    v_local := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  end if;
  if v_local = '' or v_domain = '' then return null; end if;
  return encode(sha256(convert_to(v_local || '@' || v_domain, 'UTF8')), 'hex');
end;
$$;
revoke execute on function public.trial_email_fingerprint(text) from public, anon, authenticated;

-- Empreinte d'une pièce telle qu'enregistrée (identité, chemin, taille, date de
-- dépôt). N'est PAS une empreinte du contenu binaire (voir ESSAI_PROSPECT.md).
create or replace function public.trial_document_fingerprint(p_document uuid)
returns text language sql stable security definer set search_path = public as $$
  select encode(sha256(convert_to(
           d.id::text || '|' || d.file_path || '|' || coalesce(d.size_bytes::text, '') || '|'
           || extract(epoch from d.created_at)::text, 'UTF8')), 'hex')
    from public.dossier_documents d
   where d.id = p_document
$$;
revoke execute on function public.trial_document_fingerprint(uuid) from public, anon, authenticated;

-- Titulaire abonné (ou sous dérogation) : même critère que enable_ai_processing.
-- Un prospect devenu client sort du périmètre de l'essai (quotas de son offre).
create or replace function public.trial_account_entitled(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select coalesce(e.subscription_status, '') in ('active', 'trialing') or e.override_mode is not null
      from public.dossier_entitlement(p_user) e), false)
$$;
revoke execute on function public.trial_account_entitled(uuid) from public, anon, authenticated;

create or replace function public.trial_log(p_trial uuid, p_user uuid, p_kind text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.trial_events (trial_id, user_id, kind, detail, actor)
  values (p_trial, p_user, p_kind, coalesce(p_detail, '{}'::jsonb), auth.uid())
$$;
revoke execute on function public.trial_log(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ── 6. Point d'intégration : un travail IA est-il permis par l'essai ? ────────
-- null = permis OU dossier non concerné (aucun emplacement d'essai, travail
-- sans appel au modèle, titulaire abonné). Sinon : motif du refus.
-- Lecture seule : appelée à la mise en file (déclencheur) et par trial_allows.
create or replace function public.trial_check(p_dossier uuid, p_kind text, p_document uuid, p_pages integer default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v record;
  v_set public.trial_settings;
begin
  select s.manifest, s.pages_used, s.analysis_done_at,
         a.user_id, a.expires_at, a.suspended_at, a.budget_cents, a.spent_cents
    into v
    from public.trial_slots s
    join public.trial_accounts a on a.id = s.trial_id
   where s.dossier_id = p_dossier;
  if not found then return null; end if;                          -- dossier hors essai : inchangé
  if p_kind not in ('extract', 'consolidate') then return null; end if; -- rendu / publication : aucun appel IA
  if public.trial_account_entitled(v.user_id) then return null; end if;  -- devenu abonné : règles de l'offre
  select * into v_set from public.trial_settings;
  if not coalesce(v_set.enabled, false) then return 'ESSAIS_FERMES'; end if;
  if v.suspended_at is not null then return 'ESSAI_SUSPENDU'; end if;
  if v.expires_at <= now() then return 'ESSAI_EXPIRE'; end if;
  if v.spent_cents >= v.budget_cents then return 'BUDGET_ESSAI_EPUISE'; end if;
  if p_kind = 'extract' then
    if p_document is null
       or not v.manifest @> jsonb_build_array(jsonb_build_object('id', p_document::text)) then
      return 'PIECE_HORS_MANIFESTE';
    end if;
    if not v.manifest @> jsonb_build_array(jsonb_build_object(
         'id', p_document::text, 'empreinte', public.trial_document_fingerprint(p_document))) then
      return 'PIECE_MODIFIEE';
    end if;
    if p_pages is not null and v.pages_used + greatest(p_pages, 1) > v_set.max_pages then
      return 'PAGES_ESSAI_EPUISEES';
    end if;
  elsif v.analysis_done_at is not null then
    return 'ANALYSE_DEJA_LIVREE';
  end if;
  return null;
end;
$$;
revoke execute on function public.trial_check(uuid, text, uuid, integer) from public, anon, authenticated;

-- Worker : appelée avant tout appel au modèle avec l'identifiant du travail.
-- Reprise technique du MÊME travail = aucun nouveau décompte ; au plus trois
-- travaux de consolidation distincts par emplacement (échecs compris).
create or replace function public.trial_allows(p_job uuid, p_pages integer default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  j public.ai_jobs;
  s record;
  v_reason text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select * into j from public.ai_jobs where id = p_job;
  if not found then return null; end if;
  v_reason := public.trial_check(j.dossier_id, j.kind, j.document_id, p_pages);
  if v_reason is null and j.kind = 'consolidate' then
    select ts.id, ts.trial_id, ts.analysis_job_id, ts.analysis_job_count, a.user_id
      into s
      from public.trial_slots ts
      join public.trial_accounts a on a.id = ts.trial_id
     where ts.dossier_id = j.dossier_id
       for update of ts;
    if found and not public.trial_account_entitled(s.user_id)
       and s.analysis_job_id is distinct from p_job then
      if s.analysis_job_count >= 3 then
        v_reason := 'TENTATIVES_ANALYSE_EPUISEES';
      else
        update public.trial_slots
           set analysis_job_id = p_job, analysis_job_count = analysis_job_count + 1
         where id = s.id;
      end if;
    end if;
  end if;
  if v_reason is not null then
    perform public.trial_log(
      (select ts.trial_id from public.trial_slots ts where ts.dossier_id = j.dossier_id),
      j.user_id, 'controle_refuse',
      jsonb_build_object('motif', v_reason, 'travail', p_job, 'type', j.kind, 'dossier', j.dossier_id));
  end if;
  return v_reason;
end;
$$;
revoke execute on function public.trial_allows(uuid, integer) from public, anon, authenticated;
grant execute on function public.trial_allows(uuid, integer) to service_role;

-- Mise en file : un travail refusé par l'essai n'est jamais créé (ligne
-- ignorée, journalisée). Dossier hors essai : NEW rendu tel quel.
create or replace function public.ai_jobs_trial_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_reason text;
begin
  v_reason := public.trial_check(new.dossier_id, new.kind, new.document_id, null);
  if v_reason is null then return new; end if;
  perform public.trial_log(
    (select ts.trial_id from public.trial_slots ts where ts.dossier_id = new.dossier_id),
    new.user_id, 'mise_en_file_refusee',
    jsonb_build_object('motif', v_reason, 'type', new.kind, 'dossier', new.dossier_id, 'piece', new.document_id));
  return null;
end;
$$;
drop trigger if exists ai_jobs_trial_gate on public.ai_jobs;
create trigger ai_jobs_trial_gate
  before insert on public.ai_jobs
  for each row execute function public.ai_jobs_trial_gate();

-- ── 7. Consommation réelle (survit aux suppressions) ─────────────────────────
-- ai_extractions / ai_analyses disparaissent avec le dossier (cascade) : la
-- dépense et les pages de l'essai sont donc reportées ici, sans retour possible.
create or replace function public.trial_track_usage()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_trial uuid;
begin
  if tg_table_name = 'ai_extractions' then
    if new.status <> 'ok' then return new; end if;
    -- Mise à jour sans relecture (même horodatage) : rien à reporter.
    if tg_op = 'UPDATE' and old.status = 'ok' and new.created_at is not distinct from old.created_at then
      return new;
    end if;
    update public.trial_slots
       set pages_used = pages_used + greatest(coalesce(new.pages, 1), 1)
     where dossier_id = new.dossier_id
    returning trial_id into v_trial;
  else
    if new.model is null then return new; end if; -- « aucune pièce exploitable » : pas une analyse
    update public.trial_slots
       set analysis_done_at = coalesce(analysis_done_at, now())
     where dossier_id = new.dossier_id
    returning trial_id into v_trial;
    if v_trial is not null then
      perform public.trial_log(v_trial, new.user_id, 'analyse_livree',
        jsonb_build_object('dossier', new.dossier_id, 'revision', new.revision));
    end if;
  end if;
  if v_trial is not null then
    update public.trial_accounts
       set spent_cents = spent_cents + greatest(coalesce(new.cost_cents, 0), 0)
     where id = v_trial;
  end if;
  return new;
end;
$$;
drop trigger if exists trial_track_extraction on public.ai_extractions;
create trigger trial_track_extraction
  after insert or update on public.ai_extractions
  for each row execute function public.trial_track_usage();
drop trigger if exists trial_track_analysis on public.ai_analyses;
create trigger trial_track_analysis
  after insert on public.ai_analyses
  for each row execute function public.trial_track_usage();

-- ── 8. Ouverture d'un essai (serveur ou administration) ──────────────────────
-- Appelée par le futur point d'entrée serveur, APRÈS ses contrôles anti-robot
-- (différés : voir ESSAI_PROSPECT.md). Jamais par le client.
create or replace function public.trial_open(p_user uuid)
returns table (ok boolean, reason text, trial_id uuid)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_set public.trial_settings;
  v_email text;
  v_confirmed timestamptz;
  v_fp text;
  v_existing public.trial_accounts;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not coalesce(public.is_admin(), false) then
    raise exception 'FORBIDDEN';
  end if;
  ok := false;
  trial_id := null;
  -- Une ouverture à la fois : le plafond global ne peut pas être dépassé en concurrence.
  perform pg_advisory_xact_lock(hashtext('trial_open'));
  select * into v_set from public.trial_settings;

  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = p_user;
  if not found then reason := 'COMPTE_INTROUVABLE'; return next; return; end if;

  select * into v_existing from public.trial_accounts a where a.user_id = p_user;
  if found then
    ok := true; reason := 'DEJA_OUVERT'; trial_id := v_existing.id; return next; return;
  end if;

  if v_confirmed is null then
    reason := 'EMAIL_NON_VERIFIE';
  else
    v_fp := public.trial_email_fingerprint(v_email);
    if v_fp is null then
      reason := 'EMAIL_INVALIDE';
    else
      select * into v_existing from public.trial_accounts a where a.email_fingerprint = v_fp;
      if found then
        if exists (select 1 from auth.users u where u.id = v_existing.user_id) then
          reason := 'EMAIL_DEJA_UTILISE'; -- alias (+tag, points) d'un compte ayant déjà son essai
        else
          -- Compte supprimé puis recréé : l'essai EXISTANT est rattaché, compteur intact.
          update public.trial_accounts set user_id = p_user where id = v_existing.id;
          perform public.trial_log(v_existing.id, p_user, 'rattachement',
            jsonb_build_object('ancien_compte', v_existing.user_id));
          ok := true; reason := 'RATTACHE'; trial_id := v_existing.id; return next; return;
        end if;
      elsif not v_set.enabled then
        reason := 'ESSAIS_FERMES';
      elsif v_set.budget_cents <= 0 then
        reason := 'BUDGET_NON_FIXE';
      elsif (select count(*) from public.trial_accounts) >= v_set.max_trials then
        reason := 'PLAFOND_GLOBAL_ATTEINT';
      else
        insert into public.trial_accounts (user_id, email_fingerprint, expires_at, budget_cents)
        values (p_user, v_fp, now() + make_interval(days => v_set.duration_days), v_set.budget_cents)
        returning id into trial_id;
        perform public.trial_log(trial_id, p_user, 'ouverture',
          jsonb_build_object('budget_centimes', v_set.budget_cents, 'jours', v_set.duration_days));
        ok := true; reason := 'OUVERT'; return next; return;
      end if;
    end if;
  end if;
  perform public.trial_log(null, p_user, 'ouverture_refusee', jsonb_build_object('motif', reason));
  return next;
end;
$$;
revoke execute on function public.trial_open(uuid) from public, anon;
grant execute on function public.trial_open(uuid) to authenticated, service_role;

-- ── 9. Réservation ATOMIQUE d'un emplacement + lancement de l'analyse ────────
-- Rôle serveur uniquement (jamais le client : pas d'appel direct possible).
-- Dans une seule transaction : verrou de l'essai, contrôles, emplacement,
-- manifeste figé, activation du dossier (consentement tracé : version des
-- conditions), mise en file des pièces du manifeste et de la consolidation.
-- Idempotente : même clé (ou même dossier) = même emplacement, sans décompte.
create or replace function public.trial_claim_slot(p_user uuid, p_dossier uuid, p_idempotency_key text, p_terms_version text)
returns table (ok boolean, reason text, slot integer, replayed boolean)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_set public.trial_settings;
  v_trial public.trial_accounts;
  v_slot public.trial_slots;
  v_used integer;
  v_manifest jsonb;
  v_count integer;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  ok := false; slot := null; replayed := false; reason := null;

  -- Verrou de ligne : deux réservations du même compte ne se croisent jamais.
  select * into v_trial from public.trial_accounts a where a.user_id = p_user for update;
  if not found then
    reason := 'ESSAI_ABSENT';
    perform public.trial_log(null, p_user, 'emplacement_refuse', jsonb_build_object('motif', reason, 'dossier', p_dossier));
    return next; return;
  end if;

  if length(v_key) not between 8 and 200 then
    reason := 'CLE_IDEMPOTENCE_INVALIDE';
  else
    -- Reprise technique : même clé → même emplacement, rien n'est consommé.
    select * into v_slot from public.trial_slots ts where ts.trial_id = v_trial.id and ts.idempotency_key = v_key;
    if found then
      if v_slot.dossier_id = p_dossier then
        ok := true; reason := 'REJEU'; slot := v_slot.slot_no; replayed := true;
        perform public.trial_log(v_trial.id, p_user, 'emplacement_rejoue', jsonb_build_object('emplacement', slot, 'dossier', p_dossier));
        return next; return;
      end if;
      reason := 'CLE_IDEMPOTENCE_CONFLIT';
    else
      -- Même dossier, autre clé : l'emplacement existe déjà (manifeste figé inchangé).
      select * into v_slot from public.trial_slots ts where ts.dossier_id = p_dossier;
      if found and v_slot.trial_id = v_trial.id then
        ok := true; reason := 'DOSSIER_DEJA_RESERVE'; slot := v_slot.slot_no; replayed := true;
        perform public.trial_log(v_trial.id, p_user, 'emplacement_rejoue', jsonb_build_object('emplacement', slot, 'dossier', p_dossier));
        return next; return;
      end if;
    end if;
  end if;

  if reason is null then
    select * into v_set from public.trial_settings;
    select count(*)::integer into v_used from public.trial_slots ts where ts.trial_id = v_trial.id;
    if not coalesce(v_set.enabled, false) then reason := 'ESSAIS_FERMES';
    elsif v_trial.suspended_at is not null then reason := 'ESSAI_SUSPENDU';
    elsif v_trial.expires_at <= now() then reason := 'ESSAI_EXPIRE';
    elsif v_used >= 2 then reason := 'EMPLACEMENTS_EPUISES';
    elsif v_trial.spent_cents >= v_trial.budget_cents then reason := 'BUDGET_ESSAI_EPUISE';
    elsif coalesce(btrim(p_terms_version), '') = '' then reason := 'CONDITIONS_REQUISES';
    elsif not exists (select 1 from public.dossiers d
                       where d.id = p_dossier and d.user_id = p_user and d.deleted_at is null) then
      reason := 'DOSSIER_INTROUVABLE';
    elsif public.dossier_is_closed(p_dossier) then reason := 'DOSSIER_CLOTURE';
    else
      select coalesce(jsonb_agg(jsonb_build_object('id', dd.id::text, 'empreinte', public.trial_document_fingerprint(dd.id))
                                order by dd.id), '[]'::jsonb),
             count(*)::integer
        into v_manifest, v_count
        from public.dossier_documents dd
       where dd.dossier_id = p_dossier and dd.kind = 'piece' and dd.deleted_at is null;
      if v_count = 0 then reason := 'AUCUNE_PIECE';
      elsif v_count > v_set.max_pieces then reason := 'TROP_DE_PIECES';
      end if;
    end if;
  end if;

  if reason is not null then
    perform public.trial_log(v_trial.id, p_user, 'emplacement_refuse', jsonb_build_object('motif', reason, 'dossier', p_dossier));
    return next; return;
  end if;

  slot := v_used + 1;
  insert into public.trial_slots (trial_id, slot_no, idempotency_key, dossier_id, manifest, manifest_hash, piece_count)
  values (v_trial.id, slot, v_key, p_dossier, v_manifest,
          encode(sha256(convert_to(v_manifest::text, 'UTF8')), 'hex'), v_count);
  perform public.trial_log(v_trial.id, p_user, 'emplacement_reserve',
    jsonb_build_object('emplacement', slot, 'dossier', p_dossier, 'pieces', v_count));

  -- Activation du dossier (relecture manuelle par défaut : rien n'est publié
  -- au prospect sans approbation de l'équipe) puis mise en file ; le
  -- déclencheur ai_jobs_trial_gate ne laisse passer que le manifeste.
  insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at, enabled_by, terms_version)
  values (p_dossier, p_user, now(), p_user, btrim(p_terms_version))
  on conflict (dossier_id) do update
    set enabled_at = now(), enabled_by = p_user, terms_version = btrim(p_terms_version), updated_at = now();
  insert into public.dossier_events (dossier_id, user_id, type, label)
  values (p_dossier, p_user, 'ia_activee', 'Traitement automatique activé (essai) — conditions ' || btrim(p_terms_version));
  perform public.ai_enqueue_dossier(p_dossier);

  ok := true; reason := 'RESERVE';
  return next;
end;
$$;
revoke execute on function public.trial_claim_slot(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.trial_claim_slot(uuid, uuid, text, text) to service_role;

-- ── 10. Administration (is_admin) ────────────────────────────────────────────
-- Suspension : plus aucune réservation ni lecture ; travaux en attente annulés.
-- Le motif reste dans le journal privé (jamais visible du prospect).
create or replace function public.trial_admin_suspend(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_trial uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'MOTIF_REQUIS'; end if;
  update public.trial_accounts set suspended_at = coalesce(suspended_at, now())
   where user_id = p_user returning id into v_trial;
  if v_trial is null then raise exception 'ESSAI_INTROUVABLE'; end if;
  update public.ai_jobs j
     set status = 'cancelled', finished_at = now(), updated_at = now()
   where j.status = 'queued' and j.kind in ('extract', 'consolidate')
     and j.dossier_id in (select ts.dossier_id from public.trial_slots ts where ts.trial_id = v_trial);
  perform public.trial_log(v_trial, p_user, 'suspension', jsonb_build_object('motif', left(btrim(p_reason), 500)));
  perform public.ai_admin_audit('essai_suspension', null, p_user, jsonb_build_object('motif', left(btrim(p_reason), 300)));
end;
$$;

create or replace function public.trial_admin_resume(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_trial uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  update public.trial_accounts set suspended_at = null where user_id = p_user returning id into v_trial;
  if v_trial is null then raise exception 'ESSAI_INTROUVABLE'; end if;
  perform public.trial_log(v_trial, p_user, 'reprise', '{}'::jsonb);
  perform public.ai_admin_audit('essai_reprise', null, p_user, '{}'::jsonb);
end;
$$;

-- Budget IA individuel (centimes) : ajustable compte par compte.
create or replace function public.trial_admin_set_budget(p_user uuid, p_budget_cents integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_trial uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if p_budget_cents is null or p_budget_cents < 0 then raise exception 'BUDGET_INVALIDE'; end if;
  update public.trial_accounts set budget_cents = p_budget_cents where user_id = p_user returning id into v_trial;
  if v_trial is null then raise exception 'ESSAI_INTROUVABLE'; end if;
  perform public.trial_log(v_trial, p_user, 'budget_modifie', jsonb_build_object('budget_centimes', p_budget_cents));
  perform public.ai_admin_audit('essai_budget', null, p_user, jsonb_build_object('budget_centimes', p_budget_cents));
end;
$$;

-- Réglages globaux : un paramètre null = valeur conservée.
create or replace function public.trial_admin_configure(
  p_enabled boolean default null, p_max_trials integer default null,
  p_duration_days integer default null, p_budget_cents integer default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  update public.trial_settings
     set enabled = coalesce(p_enabled, enabled),
         max_trials = coalesce(p_max_trials, max_trials),
         duration_days = coalesce(p_duration_days, duration_days),
         budget_cents = coalesce(p_budget_cents, budget_cents),
         updated_at = now(), updated_by = auth.uid()
   where id;
  perform public.trial_log(null, null, 'configuration', jsonb_build_object(
    'ouvert', p_enabled, 'plafond_global', p_max_trials, 'jours', p_duration_days, 'budget_centimes', p_budget_cents));
  perform public.ai_admin_audit('essai_configuration', null, null, jsonb_build_object(
    'ouvert', p_enabled, 'plafond_global', p_max_trials, 'jours', p_duration_days, 'budget_centimes', p_budget_cents));
end;
$$;

revoke execute on function public.trial_admin_suspend(uuid, text) from public, anon;
revoke execute on function public.trial_admin_resume(uuid) from public, anon;
revoke execute on function public.trial_admin_set_budget(uuid, integer) from public, anon;
revoke execute on function public.trial_admin_configure(boolean, integer, integer, integer) from public, anon;
grant execute on function public.trial_admin_suspend(uuid, text), public.trial_admin_resume(uuid),
  public.trial_admin_set_budget(uuid, integer), public.trial_admin_configure(boolean, integer, integer, integer)
  to authenticated;
revoke execute on function public.trial_guard(), public.ai_jobs_trial_gate(), public.trial_track_usage()
  from public, anon, authenticated;
