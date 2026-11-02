-- Console IA privée (2026-11-02) — MIGRATION ADDITIVE, idempotente et rejouable.
-- À appliquer APRÈS 20261023120000. Jamais appliquée en production à ce jour.
--
-- Objet : publication CONTRÔLÉE des résultats du moteur documentaire et pilotage
-- réservé à l'administration (« ClairDossier Private AI »).
--   * relecture par dossier : dossier_ai_settings.review_mode = 'manual' (défaut :
--     rien n'est montré au client avant validation) ou 'auto' (publication
--     immédiate, pour les dossiers à faible enjeu expressément autorisés) ;
--   * ai_analyses.review_status : pending → approved → published, ou rejected ;
--     une analyse non publiée est INVISIBLE du titulaire (policy restrictive) ;
--   * livrables : dossier_documents.ai_revision + review_status ; un livrable
--     « pending » ou « rejected » est invisible du titulaire (policy restrictive)
--     et son fichier vit sous le préfixe ai-review/<user>/<dossier>/ que les
--     policies de stockage du titulaire (premier dossier = son uid) ne couvrent
--     pas ; à la publication, le worker déplace le fichier sous <user>/<dossier>/ ;
--   * file : nouveau type de travail 'publish' (exécuté par le worker : déplacement
--     des fichiers, bascule des statuts, e-mail au client) ; colonne revision ;
--   * RPC administration (is_admin() obligatoire, journalisées dans audit_logs) :
--     ai_set_review_mode, ai_approve_revision, ai_reject_revision, ai_retry_job,
--     ai_admin_overview, ai_admin_month_cost.
-- Inchangés : policies existantes (aucune n'est modifiée ni supprimée), tables
-- dossiers/profiles, quota, Stripe, notify-lead, RPC enable/disable_ai_processing.

-- ── 1. Mode de relecture par dossier ─────────────────────────────────────────
alter table public.dossier_ai_settings add column if not exists review_mode text not null default 'manual';
alter table public.dossier_ai_settings drop constraint if exists dossier_ai_settings_review_mode_check;
alter table public.dossier_ai_settings
  add constraint dossier_ai_settings_review_mode_check check (review_mode in ('manual', 'auto'));

-- Référence du consentement écrit du titulaire lorsque l'activation est faite par
-- l'administration (courriel, avenant, date…). Jamais une case à cocher côté admin.
alter table public.dossier_ai_settings add column if not exists consent_reference text;

-- ── 2. Statut de relecture des analyses ────────────────────────────────────
alter table public.ai_analyses add column if not exists review_status text not null default 'pending';
alter table public.ai_analyses drop constraint if exists ai_analyses_review_status_check;
alter table public.ai_analyses
  add constraint ai_analyses_review_status_check check (review_status in ('pending', 'approved', 'published', 'rejected'));
alter table public.ai_analyses add column if not exists reviewed_at timestamptz;
alter table public.ai_analyses add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table public.ai_analyses add column if not exists review_note text;
alter table public.ai_analyses add column if not exists published_at timestamptz;

-- Le titulaire ne voit qu'une analyse PUBLIÉE ; l'administration voit tout.
-- Policy RESTRICTIVE : s'ajoute (ET logique) aux policies existantes, sans les modifier.
drop policy if exists "ai_analyses_published_only" on public.ai_analyses;
create policy "ai_analyses_published_only" on public.ai_analyses
  as restrictive for select
  using (review_status = 'published' or coalesce(public.is_admin(), false));

-- ── 3. Livrables : révision et statut de publication ─────────────────────────────
alter table public.dossier_documents add column if not exists ai_revision integer;
alter table public.dossier_documents add column if not exists review_status text;
alter table public.dossier_documents drop constraint if exists dossier_documents_review_status_check;
alter table public.dossier_documents
  add constraint dossier_documents_review_status_check
  check (review_status is null or review_status in ('pending', 'approved', 'rejected'));
create index if not exists dossier_documents_ai_revision_idx
  on public.dossier_documents (dossier_id, ai_revision) where ai_revision is not null;

-- Un livrable non approuvé n'existe pas pour le titulaire (ni pour personne d'autre
-- que l'administration). Les pièces et livrables historiques (review_status null)
-- sont strictement inchangés.
drop policy if exists "docs_hide_unpublished_ai" on public.dossier_documents;
create policy "docs_hide_unpublished_ai" on public.dossier_documents
  as restrictive for select
  using (review_status is null or review_status = 'approved' or coalesce(public.is_admin(), false));

-- ── 4. File : travail de publication ────────────────────────────────────────────
alter table public.ai_jobs add column if not exists revision integer;
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check check (kind in ('extract', 'consolidate', 'render', 'publish'));

-- ── 5. Journal d'administration (interne) ──────────────────────────────────────────
create or replace function public.ai_admin_audit(p_action text, p_dossier uuid, p_target uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.audit_logs') is null then return; end if;
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
  values (auth.uid(), 'admin', p_action, 'ia', p_dossier::text, p_target, coalesce(p_meta, '{}'::jsonb));
end;
$$;
revoke execute on function public.ai_admin_audit(text, uuid, uuid, jsonb) from public, anon, authenticated;

-- ── 6. RPC administration ────────────────────────────────────────────────────
-- Mode de relecture (ne touche jamais à l'activation : enabled_at inchangé).
create or replace function public.ai_set_review_mode(p_dossier uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if p_mode not in ('manual', 'auto') then raise exception 'MODE_INVALIDE'; end if;
  select user_id into v_owner from public.dossiers where id = p_dossier;
  if v_owner is null then raise exception 'DOSSIER_INTROUVABLE'; end if;
  insert into public.dossier_ai_settings (dossier_id, user_id, review_mode)
  values (p_dossier, v_owner, p_mode)
  on conflict (dossier_id) do update set review_mode = excluded.review_mode, updated_at = now();
  perform public.ai_admin_audit('ia_mode_relecture', p_dossier, v_owner, jsonb_build_object('mode', p_mode));
end;
$$;

-- Approbation d'une révision : statut approved + travail 'publish' (le worker
-- déplace les fichiers, publie, informe le client). Idempotente.
create or replace function public.ai_approve_revision(p_dossier uuid, p_revision integer, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  select a.id, a.user_id, a.review_status into v
    from public.ai_analyses a where a.dossier_id = p_dossier and a.revision = p_revision;
  if v.id is null then raise exception 'REVISION_INTROUVABLE'; end if;
  if v.review_status = 'published' then return; end if;
  update public.ai_analyses
     set review_status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
         review_note = coalesce(left(p_note, 1000), review_note)
   where id = v.id;
  -- Un seul travail de publication ouvert par dossier ; la révision la plus récente l'emporte.
  insert into public.ai_jobs (dossier_id, user_id, kind, document_id, revision, run_after)
  values (p_dossier, v.user_id, 'publish', null, p_revision, now())
  on conflict (dossier_id, kind, coalesce(document_id, '00000000-0000-0000-0000-000000000000'::uuid))
    where status in ('queued', 'running')
  do update set revision = greatest(public.ai_jobs.revision, excluded.revision), updated_at = now()
    where public.ai_jobs.status = 'queued';
  perform public.ai_admin_audit('ia_revision_approuvee', p_dossier, v.user_id, jsonb_build_object('revision', p_revision));
end;
$$;

-- Rejet : l'analyse et ses livrables restent en base (traçabilité), invisibles
-- du titulaire ; les fichiers restent sous ai-review/ (jamais déplacés).
create or replace function public.ai_reject_revision(p_dossier uuid, p_revision integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'MOTIF_REQUIS'; end if;
  select a.id, a.user_id, a.review_status into v
    from public.ai_analyses a where a.dossier_id = p_dossier and a.revision = p_revision;
  if v.id is null then raise exception 'REVISION_INTROUVABLE'; end if;
  if v.review_status = 'published' then raise exception 'DEJA_PUBLIEE'; end if;
  update public.ai_analyses
     set review_status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), review_note = left(p_note, 1000)
   where id = v.id;
  update public.dossier_documents set review_status = 'rejected'
   where dossier_id = p_dossier and ai_revision = p_revision and review_status = 'pending';
  update public.ai_jobs set status = 'cancelled', finished_at = now(), updated_at = now()
   where dossier_id = p_dossier and kind = 'publish' and revision = p_revision and status = 'queued';
  perform public.ai_admin_audit('ia_revision_rejetee', p_dossier, v.user_id, jsonb_build_object('revision', p_revision, 'motif', left(p_note, 300)));
end;
$$;

-- Relance d'un travail en échec (compteur remis à zéro, exécution immédiate).
create or replace function public.ai_retry_job(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  select id, dossier_id, user_id, kind, status into v from public.ai_jobs where id = p_job;
  if v.id is null then raise exception 'TRAVAIL_INTROUVABLE'; end if;
  if v.status <> 'failed' then raise exception 'TRAVAIL_NON_ECHOUE'; end if;
  -- Un travail ouvert existe déjà pour la même clé (dossier, type, pièce) : relance inutile.
  if exists (select 1 from public.ai_jobs o where o.dossier_id = v.dossier_id and o.kind = v.kind
               and coalesce(o.document_id, '00000000-0000-0000-0000-000000000000'::uuid)
                 = coalesce((select document_id from public.ai_jobs where id = p_job), '00000000-0000-0000-0000-000000000000'::uuid)
               and o.status in ('queued', 'running')) then
    raise exception 'TRAVAIL_DEJA_EN_FILE';
  end if;
  update public.ai_jobs
     set status = 'queued', attempts = 0, run_after = now(), lease_until = null, locked_by = null,
         last_error = null, finished_at = null, updated_at = now()
   where id = p_job;
  perform public.ai_admin_audit('ia_travail_relance', v.dossier_id, v.user_id, jsonb_build_object('job', p_job, 'kind', v.kind));
end;
$$;

-- Activation par le TITULAIRE uniquement : la version 20261023 acceptait aussi un
-- administrateur sans aucune preuve d'accord du client. Corps redéfini (nom, signature
-- et appelants inchangés) : un admin passe désormais par ai_admin_enable, qui exige
-- une référence de consentement écrit et la journalise.
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

-- Activation par l'administration : uniquement sur accord écrit du titulaire, dont la
-- référence est obligatoire et conservée (réglages + événement + journal d'audit).
create or replace function public.ai_admin_enable(p_dossier uuid, p_terms_version text, p_consent_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if coalesce(p_terms_version, '') = '' then raise exception 'TERMS_VERSION_REQUIRED'; end if;
  if length(btrim(coalesce(p_consent_reference, ''))) < 10 then raise exception 'CONSENTEMENT_REQUIS'; end if;
  select user_id into v_owner from public.dossiers where id = p_dossier and deleted_at is null;
  if v_owner is null then raise exception 'DOSSIER_INTROUVABLE'; end if;
  if public.dossier_is_closed(p_dossier) then raise exception 'DOSSIER_CLOTURE'; end if;
  insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at, enabled_by, terms_version, consent_reference)
  values (p_dossier, v_owner, now(), auth.uid(), p_terms_version, left(btrim(p_consent_reference), 500))
  on conflict (dossier_id) do update
    set enabled_at = now(), enabled_by = auth.uid(), terms_version = p_terms_version,
        consent_reference = left(btrim(p_consent_reference), 500), updated_at = now();
  insert into public.dossier_events (dossier_id, user_id, type, label)
  values (p_dossier, v_owner, 'ia_activee', 'Traitement automatique activé par l''équipe sur accord écrit — conditions ' || p_terms_version);
  perform public.ai_admin_audit('ia_activation_admin', p_dossier, v_owner,
    jsonb_build_object('terms_version', p_terms_version, 'consentement', left(btrim(p_consent_reference), 300)));
  perform public.ai_enqueue_dossier(p_dossier);
end;
$$;
revoke execute on function public.ai_admin_enable(uuid, text, text) from public, anon;
grant execute on function public.ai_admin_enable(uuid, text, text) to authenticated;

-- Vue d'ensemble pour la console (une ligne par dossier concerné par l'IA).
create or replace function public.ai_admin_overview()
returns table (
  dossier_id uuid, user_id uuid, title text, typology text, dossier_status text, closed boolean,
  enabled_at timestamptz, review_mode text, pieces integer, extracted integer, unsupported integer,
  jobs_open integer, jobs_failed integer, jobs_failed_budget integer,
  last_revision integer, last_review_status text, last_analysis_at timestamptz, last_coverage jsonb, last_cost_cents numeric,
  pending_revision integer, month_cost_cents numeric
) language sql security definer stable set search_path = public as $$
  select d.id, d.user_id, d.title, d.typology, d.status,
         public.dossier_is_closed(d.id),
         s.enabled_at, coalesce(s.review_mode, 'manual'),
         (select count(*)::int from public.dossier_documents x where x.dossier_id = d.id and x.kind = 'piece' and x.deleted_at is null),
         (select count(*)::int from public.ai_extractions x where x.dossier_id = d.id and x.status = 'ok'),
         (select count(*)::int from public.ai_extractions x where x.dossier_id = d.id and x.status = 'unsupported'),
         (select count(*)::int from public.ai_jobs j where j.dossier_id = d.id and j.status in ('queued', 'running')),
         (select count(*)::int from public.ai_jobs j where j.dossier_id = d.id and j.status = 'failed' and coalesce(j.last_error, '') not like 'BUDGET:%'),
         (select count(*)::int from public.ai_jobs j where j.dossier_id = d.id and j.status = 'failed' and coalesce(j.last_error, '') like 'BUDGET:%'),
         la.revision, la.review_status, la.created_at, la.coverage, la.cost_cents,
         (select max(a.revision) from public.ai_analyses a where a.dossier_id = d.id and a.review_status = 'pending'),
         public.ai_month_cost_cents(d.user_id)
    from public.dossiers d
    left join public.dossier_ai_settings s on s.dossier_id = d.id
    left join lateral (
      select a.revision, a.review_status, a.created_at, a.coverage, a.cost_cents
        from public.ai_analyses a where a.dossier_id = d.id order by a.revision desc limit 1
    ) la on true
   where coalesce(public.is_admin(), false)
     and d.deleted_at is null
     and (s.dossier_id is not null or la.revision is not null or exists (select 1 from public.ai_jobs j where j.dossier_id = d.id))
   order by coalesce(la.created_at, s.updated_at, d.created_at) desc
$$;

-- Coût du mois en cours (toutes extractions + analyses), pour le bloc « coûts ».
create or replace function public.ai_admin_month_cost()
returns table (extraction_cents numeric, analysis_cents numeric, extractions integer, analyses integer, accounts integer)
language sql security definer stable set search_path = public as $$
  select coalesce((select sum(cost_cents) from public.ai_extractions where created_at >= date_trunc('month', now())), 0),
         coalesce((select sum(cost_cents) from public.ai_analyses where created_at >= date_trunc('month', now())), 0),
         (select count(*)::int from public.ai_extractions where created_at >= date_trunc('month', now())),
         (select count(*)::int from public.ai_analyses where created_at >= date_trunc('month', now())),
         (select count(distinct user_id)::int from public.ai_analyses where created_at >= date_trunc('month', now()))
   where coalesce(public.is_admin(), false)
$$;

revoke execute on function public.ai_set_review_mode(uuid, text) from public, anon;
revoke execute on function public.ai_approve_revision(uuid, integer, text) from public, anon;
revoke execute on function public.ai_reject_revision(uuid, integer, text) from public, anon;
revoke execute on function public.ai_retry_job(uuid) from public, anon;
revoke execute on function public.ai_admin_overview() from public, anon;
revoke execute on function public.ai_admin_month_cost() from public, anon;
grant execute on function public.ai_set_review_mode(uuid, text), public.ai_approve_revision(uuid, integer, text),
  public.ai_reject_revision(uuid, integer, text), public.ai_retry_job(uuid),
  public.ai_admin_overview(), public.ai_admin_month_cost() to authenticated;

-- Sonde de capacité pour la console.
create or replace function public.ai_private_console_enabled()
returns boolean language sql stable as $$ select true $$;

-- ── 7. Horloge : l'appel du worker présente un jeton lu dans Vault ───────────
-- Le secret `clairdossier_ai_worker_token` (Vault) doit être égal au secret de
-- fonction AI_WORKER_TOKEN ; sans lui, la fonction (si AI_WORKER_TOKEN est posé)
-- répond 401 et rien n'est réclamé. Lu à chaque exécution : rotation sans migration.
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
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U',
            'x-worker-token', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'clairdossier_ai_worker_token' limit 1), '')
          ),
          body := '{"source":"pg_cron"}'::jsonb
        )
      $cron$
    );
  end if;
end $$;
