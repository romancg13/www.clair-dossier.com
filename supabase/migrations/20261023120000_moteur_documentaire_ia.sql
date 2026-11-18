-- Moteur documentaire IA (2026-10-23) — MIGRATION ADDITIVE, idempotente et rejouable.
-- À appliquer APRÈS 20261012120000. Jamais appliquée en production à ce jour.
--
-- Objet : traitement asynchrone des pièces d'un dossier (extraction sourcée →
-- consolidation → livrables), sans navigateur ni intervention par dossier.
--   * activation IA PAR DOSSIER, explicite et traçable (dossier_ai_settings :
--     enabled_at / enabled_by / terms_version) — jamais rétroactive : un dossier
--     non activé n'est jamais lu. Aucune policy d'écriture : seules les RPC
--     enable/disable_ai_processing (titulaire abonné ou administration) écrivent ;
--   * file de travaux ai_jobs : UN travail ouvert par (dossier, type, pièce),
--     réclamation « for update skip locked » + bail (lease), tentatives bornées
--     avec backoff — y compris quand le worker est tué par la limite de durée
--     (bail expiré) —, annulation à la désactivation ou à la clôture ;
--     types : extract (une pièce), consolidate (analyse IA + rendu), render
--     (rendu seul, sans appel IA : après une correction humaine) ;
--   * ai_extractions (une par pièce, remplacée à chaque réanalyse) et
--     ai_analyses (une révision par consolidation) : lecture seule pour le
--     titulaire et l'administration, écriture réservée au worker (service role) ;
--   * ai_event_overrides : corrections de la chronologie, APPEND-ONLY (historique
--     complet, auteur et motif imposés), appliquées à chaque rendu ;
--   * ai_notifications : registre durable des e-mails client (unicité par
--     dossier, type et révision : jamais deux fois le même envoi) ;
--   * clôture / réouverture : événements dossier_events (dossier_cloture /
--     dossier_rouvert) — un dossier clôturé n'est plus traité, la réouverture
--     reprend les pièces non lues ; la livraison reste un événement distinct ;
--   * livrables générés : lignes dossier_documents kind='deliverable' marquées
--     generated_by='ai' (modèle existant conservé ; livrables manuels intacts) ;
--   * échéances : dossier_deadlines.ai_key (clé stable par dossier) et
--     user_edited (posé automatiquement dès qu'un utilisateur modifie une ligne)
--     pour que les réanalyses ne piétinent jamais une correction humaine ;
--   * déclencheur sur dépôt / corbeille / restauration d'une pièce : extraction
--     de la pièce puis consolidation TEMPORISÉE (90 s, réarmée à chaque dépôt) ;
--   * pg_cron (si présent) : toutes les minutes, net.http_post vers la fonction
--     ai-worker qui ne fait que vider la file (aucune entrée utilisateur).
-- Inchangés : table dossiers, RLS existantes, quota, corbeille, Stripe, notify-lead.

-- ── 1. Activation IA par dossier ─────────────────────────────────────────────
create table if not exists public.dossier_ai_settings (
  dossier_id uuid primary key references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  enabled_at timestamptz,
  enabled_by uuid references auth.users (id) on delete set null,
  terms_version text,
  updated_at timestamptz not null default now()
);
alter table public.dossier_ai_settings enable row level security;
drop policy if exists "ai_settings_select_own" on public.dossier_ai_settings;
create policy "ai_settings_select_own" on public.dossier_ai_settings
  for select using (auth.uid() = user_id or public.is_admin());
-- Aucune policy d'écriture : RPC uniquement.

-- ── 2. Livrables générés ─────────────────────────────────────────────────────
alter table public.dossier_documents add column if not exists generated_by text;
alter table public.dossier_documents drop constraint if exists dossier_documents_generated_by_check;
alter table public.dossier_documents
  add constraint dossier_documents_generated_by_check check (generated_by is null or generated_by = 'ai');

-- ── 3. File de travaux ───────────────────────────────────────────────────────
create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  document_id uuid references public.dossier_documents (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  lease_until timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check check (kind in ('extract', 'consolidate', 'render'));
create unique index if not exists ai_jobs_one_open_idx
  on public.ai_jobs (dossier_id, kind, coalesce(document_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('queued', 'running');
create index if not exists ai_jobs_claim_idx on public.ai_jobs (status, run_after);
create index if not exists ai_jobs_dossier_idx on public.ai_jobs (dossier_id, created_at desc);
alter table public.ai_jobs enable row level security;
drop policy if exists "ai_jobs_select_own" on public.ai_jobs;
create policy "ai_jobs_select_own" on public.ai_jobs
  for select using (auth.uid() = user_id or public.is_admin());
-- Aucune policy d'écriture : seul le service role (worker) écrit.

-- ── 4. Extractions et analyses ───────────────────────────────────────────────
create table if not exists public.ai_extractions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null unique references public.dossier_documents (id) on delete cascade,
  status text not null check (status in ('ok', 'unsupported', 'error')),
  model text,
  schema_version text not null default '1',
  pages integer,
  data jsonb,
  error text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_cents numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_extractions_dossier_idx on public.ai_extractions (dossier_id);
alter table public.ai_extractions enable row level security;
drop policy if exists "ai_extractions_select_own" on public.ai_extractions;
create policy "ai_extractions_select_own" on public.ai_extractions
  for select using (auth.uid() = user_id or public.is_admin());

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  revision integer not null,
  model text,
  schema_version text not null default '1',
  coverage jsonb not null default '{}'::jsonb,
  data jsonb not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_cents numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  unique (dossier_id, revision)
);
alter table public.ai_analyses enable row level security;
drop policy if exists "ai_analyses_select_own" on public.ai_analyses;
create policy "ai_analyses_select_own" on public.ai_analyses
  for select using (auth.uid() = user_id or public.is_admin());

-- ── 5. Échéances : clé IA + protection des corrections humaines ──────────────
alter table public.dossier_deadlines add column if not exists ai_key text;
alter table public.dossier_deadlines add column if not exists user_edited boolean not null default false;
-- Index complet (NULL distincts) : les échéances manuelles (ai_key null) ne se
-- heurtent jamais, et l'upsert « on conflict (dossier_id, ai_key) » reste inférable.
create unique index if not exists dossier_deadlines_ai_key_idx
  on public.dossier_deadlines (dossier_id, ai_key);

create or replace function public.deadlines_mark_user_edited()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.title is distinct from old.title or new.description is distinct from old.description
    or new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time
    or new.priority is distinct from old.priority or new.done is distinct from old.done) then
    new.user_edited := true;
  end if;
  return new;
end;
$$;
drop trigger if exists deadlines_mark_user_edited on public.dossier_deadlines;
create trigger deadlines_mark_user_edited
  before update on public.dossier_deadlines
  for each row execute function public.deadlines_mark_user_edited();

-- ── 6. Clôture / réouverture (événements, jamais une écriture sur dossiers) ──
-- L'administration peut journaliser sur le dossier d'un client (clôture,
-- réouverture) ; le titulaire le pouvait déjà (events_insert_own).
drop policy if exists "events_insert_admin" on public.dossier_events;
create policy "events_insert_admin" on public.dossier_events
  for insert with check (public.is_admin());

-- Clôturé = dernier événement de cycle de vie « dossier_cloture » ; à défaut
-- d'événement, le statut historique « archive » vaut clôture.
create or replace function public.dossier_is_closed(p_dossier uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select e.type = 'dossier_cloture' from public.dossier_events e
      where e.dossier_id = p_dossier and e.type in ('dossier_cloture', 'dossier_rouvert')
      order by e.created_at desc limit 1),
    (select d.status = 'archive' from public.dossiers d where d.id = p_dossier),
    false)
$$;
-- Interne (worker, fonctions) : l'interface lit les événements sous RLS.
revoke execute on function public.dossier_is_closed(uuid) from public, anon, authenticated;

-- ── 7. Mise en file (interne) ────────────────────────────────────────────────
-- Un travail ouvert au plus par (dossier, type, pièce). Pour une consolidation
-- déjà en attente, la date d'exécution est repoussée (temporisation réarmée).
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

-- Reprise d'un dossier : pièces encore jamais lues + consolidation si utile.
-- Les pièces déjà extraites ne sont pas relues (aucun coût en double).
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

create or replace function public.documents_ai_enqueue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'piece' then return new; end if;
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      perform public.ai_enqueue(new.dossier_id, 'extract', new.id);
      perform public.ai_enqueue(new.dossier_id, 'consolidate', null, interval '90 seconds');
    end if;
  elsif new.deleted_at is distinct from old.deleted_at then
    perform public.ai_enqueue(new.dossier_id, 'consolidate', null, interval '90 seconds');
  end if;
  return new;
end;
$$;
drop trigger if exists documents_ai_enqueue on public.dossier_documents;
create trigger documents_ai_enqueue
  after insert or update of deleted_at on public.dossier_documents
  for each row execute function public.documents_ai_enqueue();

-- Clôture : travaux ouverts annulés. Réouverture : reprise des pièces non lues.
create or replace function public.dossier_events_lifecycle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'dossier_cloture' then
    update public.ai_jobs set status = 'cancelled', finished_at = now(), updated_at = now()
     where dossier_id = new.dossier_id and status = 'queued';
  elsif new.type = 'dossier_rouvert' then
    perform public.ai_enqueue_dossier(new.dossier_id);
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_events_lifecycle on public.dossier_events;
create trigger dossier_events_lifecycle
  after insert on public.dossier_events
  for each row execute function public.dossier_events_lifecycle();

-- ── 8. Corrections de la chronologie (append-only) ───────────────────────────
create table if not exists public.ai_event_overrides (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null check (length(event_key) between 1 and 200),
  retained_date text check (retained_date is null or retained_date ~ '^\d{4}(-\d{2}){0,2}$'),
  label text check (label is null or length(label) <= 300),
  hidden boolean not null default false,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  created_by uuid references auth.users (id) on delete set null,
  author_role text not null default 'titulaire' check (author_role in ('titulaire', 'equipe')),
  created_at timestamptz not null default now()
);
create index if not exists ai_event_overrides_dossier_idx on public.ai_event_overrides (dossier_id, created_at);
alter table public.ai_event_overrides enable row level security;
drop policy if exists "ai_overrides_select_own" on public.ai_event_overrides;
create policy "ai_overrides_select_own" on public.ai_event_overrides
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "ai_overrides_insert_own" on public.ai_event_overrides;
create policy "ai_overrides_insert_own" on public.ai_event_overrides
  for insert with check (
    exists (select 1 from public.dossiers d where d.id = dossier_id and d.user_id = ai_event_overrides.user_id)
    and (auth.uid() = user_id or public.is_admin())
  );
-- Ni update ni delete : l'historique des corrections est intangible.

-- Auteur et rôle imposés côté base (valeurs envoyées ignorées), puis rendu
-- temporisé des livrables (sans appel IA).
create or replace function public.ai_overrides_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  new.author_role := case when coalesce(public.is_admin(), false) and auth.uid() is distinct from new.user_id then 'equipe' else 'titulaire' end;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists ai_overrides_stamp on public.ai_event_overrides;
create trigger ai_overrides_stamp
  before insert on public.ai_event_overrides
  for each row execute function public.ai_overrides_stamp();

create or replace function public.ai_overrides_render()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ai_enqueue(new.dossier_id, 'render', null, interval '20 seconds');
  return new;
end;
$$;
drop trigger if exists ai_overrides_render on public.ai_event_overrides;
create trigger ai_overrides_render
  after insert on public.ai_event_overrides
  for each row execute function public.ai_overrides_render();

-- ── 9. Registre des notifications client (jamais deux fois le même envoi) ────
create table if not exists public.ai_notifications (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('client_livrables_disponibles')),
  revision integer not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'not_configured', 'skipped')),
  provider_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (dossier_id, kind, revision)
);
alter table public.ai_notifications enable row level security;
drop policy if exists "ai_notifications_select_own" on public.ai_notifications;
create policy "ai_notifications_select_own" on public.ai_notifications
  for select using (auth.uid() = user_id or public.is_admin());

-- ── 10. Activation / désactivation par le titulaire (ou l'administration) ────
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
  if v_owner <> v_actor and not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if public.dossier_is_closed(p_dossier) then raise exception 'DOSSIER_CLOTURE'; end if;
  select * into v_ent from public.dossier_entitlement(v_owner);
  if not coalesce(public.is_admin(), false)
     and not (coalesce(v_ent.subscription_status, '') in ('active', 'trialing') or v_ent.override_mode is not null) then
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

create or replace function public.disable_ai_processing(p_dossier uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select user_id into v_owner from public.dossiers where id = p_dossier;
  if v_owner is null then raise exception 'DOSSIER_INTROUVABLE'; end if;
  if v_owner <> v_actor and not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  update public.dossier_ai_settings set enabled_at = null, enabled_by = null, updated_at = now()
   where dossier_id = p_dossier;
  update public.ai_jobs set status = 'cancelled', finished_at = now(), updated_at = now()
   where dossier_id = p_dossier and status in ('queued', 'running');
  insert into public.dossier_events (dossier_id, user_id, type, label)
  values (p_dossier, v_owner, 'ia_desactivee', 'Traitement automatique désactivé');
end;
$$;

-- ── 11. Réclamation / clôture des travaux (worker uniquement) ────────────────
create or replace function public.ai_claim_jobs(p_worker text, p_limit integer default 5)
returns setof public.ai_jobs language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  -- Bail expiré = worker interrompu (limite de durée, panne) : la tentative
  -- compte ; au-delà du maximum, échec définitif (jamais de boucle infinie).
  update public.ai_jobs
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         finished_at = case when attempts >= max_attempts then now() else finished_at end,
         last_error = 'traitement interrompu (délai dépassé ou panne du worker)',
         lease_until = null, locked_by = null, updated_at = now()
   where status = 'running' and lease_until < now();
  return query
    with picked as (
      select j.id from public.ai_jobs j
       where j.status = 'queued' and j.run_after <= now()
       order by j.run_after
       limit greatest(1, least(p_limit, 20))
       for update skip locked
    )
    update public.ai_jobs j
       set status = 'running', attempts = j.attempts + 1, locked_by = p_worker,
           lease_until = now() + interval '8 minutes', updated_at = now()
      from picked where j.id = picked.id
    returning j.*;
end;
$$;
revoke execute on function public.ai_claim_jobs(text, integer) from public, anon, authenticated;

create or replace function public.ai_finish_job(p_job uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select * into v from public.ai_jobs where id = p_job;
  if v.id is null or v.status <> 'running' then return; end if;
  if p_ok then
    update public.ai_jobs set status = 'done', finished_at = now(), lease_until = null, last_error = null, updated_at = now() where id = p_job;
  elsif v.attempts >= v.max_attempts or left(coalesce(p_error, ''), 7) = 'BUDGET:' then
    update public.ai_jobs set status = 'failed', finished_at = now(), lease_until = null, last_error = left(p_error, 2000), updated_at = now() where id = p_job;
  else
    update public.ai_jobs
       set status = 'queued', lease_until = null, locked_by = null, last_error = left(p_error, 2000),
           run_after = now() + make_interval(mins => power(2, v.attempts)::integer), updated_at = now()
     where id = p_job;
  end if;
end;
$$;
revoke execute on function public.ai_finish_job(uuid, boolean, text) from public, anon, authenticated;

-- Coût IA du mois en cours pour un compte (budget, worker uniquement).
create or replace function public.ai_month_cost_cents(p_user uuid)
returns numeric language sql security definer set search_path = public as $$
  select coalesce((select sum(cost_cents) from public.ai_extractions where user_id = p_user and created_at >= date_trunc('month', now())), 0)
       + coalesce((select sum(cost_cents) from public.ai_analyses   where user_id = p_user and created_at >= date_trunc('month', now())), 0)
$$;
revoke execute on function public.ai_month_cost_cents(uuid) from public, anon, authenticated;

-- Sonde de capacité pour le site.
create or replace function public.ai_engine_enabled()
returns boolean language sql stable as $$ select true $$;

-- ── 12. Horloge : pg_cron → ai-worker (si l'extension est disponible) ─────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'clairdossier-ai-worker';
    perform cron.schedule(
      'clairdossier-ai-worker', '* * * * *',
      $cron$
        select net.http_post(
          url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/ai-worker',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U'
          ),
          body := '{"source":"pg_cron"}'::jsonb
        )
      $cron$
    );
  end if;
end $$;
