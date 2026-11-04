-- Moteur IA — exploitation : plafond de dépense GLOBAL et bilan de santé quotidien.
-- Additive : deux fonctions, une table de chiffres, une tâche planifiée.
-- Aucun objet de paiement, aucun contenu de dossier.

-- ── 1. Plafond global mensuel (tous comptes confondus) ──────────────────────
-- Le worker refuse de réclamer un travail si ce total (+ réserve) dépasse
-- AI_BUDGET_CENTS_GLOBAL_MONTH, fixé par le propriétaire (aucun défaut).
create or replace function public.ai_global_month_cost_cents()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(cost_cents) from public.ai_extractions where created_at >= date_trunc('month', now())), 0)
       + coalesce((select sum(cost_cents) from public.ai_analyses   where created_at >= date_trunc('month', now())), 0)
$$;
revoke execute on function public.ai_global_month_cost_cents() from public, anon, authenticated;
grant execute on function public.ai_global_month_cost_cents() to service_role;

-- ── 2. Bilan de santé quotidien ──────────────────────────────────────────────
-- Une ligne par jour, chiffres uniquement. Lecture : administration seule ;
-- écriture : fonction planifiée seule. Affiché dans l'onglet « IA privée » ;
-- needs_action = une décision humaine est requise (échecs, blocages, budget).
create table if not exists public.ai_health_reports (
  day date primary key,
  created_at timestamptz not null default now(),
  jobs_done integer not null default 0,
  jobs_failed integer not null default 0,
  jobs_open integer not null default 0,
  jobs_stuck integer not null default 0,
  budget_paused integer not null default 0,
  cost_cents numeric(12, 4) not null default 0,
  last_job_at timestamptz,
  needs_action boolean not null default false
);
alter table public.ai_health_reports enable row level security;
drop policy if exists "ai_health_reports_select_admin" on public.ai_health_reports;
create policy "ai_health_reports_select_admin" on public.ai_health_reports
  for select using (public.is_admin());

create or replace function public.ai_health_snapshot()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_done integer; v_failed integer; v_open integer; v_stuck integer; v_budget integer; v_last timestamptz;
begin
  select count(*) filter (where status = 'done' and finished_at >= now() - interval '1 day'),
         count(*) filter (where status = 'failed' and updated_at >= now() - interval '1 day'),
         count(*) filter (where status in ('queued', 'running')),
         -- bloqué : exécutable depuis plus d'une heure sans être pris, ou bail expiré
         count(*) filter (where (status = 'queued' and run_after < now() - interval '1 hour')
                             or (status = 'running' and lease_until < now() - interval '15 minutes')),
         count(*) filter (where status = 'failed' and last_error like 'BUDGET:%' and updated_at >= now() - interval '1 day'),
         max(updated_at)
    into v_done, v_failed, v_open, v_stuck, v_budget, v_last
    from public.ai_jobs;
  insert into public.ai_health_reports as r
    (day, jobs_done, jobs_failed, jobs_open, jobs_stuck, budget_paused, cost_cents, last_job_at, needs_action)
  values (current_date, v_done, v_failed, v_open, v_stuck, v_budget, public.ai_global_month_cost_cents(), v_last,
          v_failed > 0 or v_stuck > 0 or v_budget > 0)
  on conflict (day) do update set
    created_at = now(), jobs_done = excluded.jobs_done, jobs_failed = excluded.jobs_failed,
    jobs_open = excluded.jobs_open, jobs_stuck = excluded.jobs_stuck, budget_paused = excluded.budget_paused,
    cost_cents = excluded.cost_cents, last_job_at = excluded.last_job_at, needs_action = excluded.needs_action;
  -- Rétention des bilans : 90 jours (chiffres seuls).
  delete from public.ai_health_reports where day < current_date - 90;
end;
$$;
revoke execute on function public.ai_health_snapshot() from public, anon, authenticated;
grant execute on function public.ai_health_snapshot() to service_role;

-- ── 3. Planification (si pg_cron est disponible) ─────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'clairdossier-ai-sante';
    perform cron.schedule('clairdossier-ai-sante', '15 6 * * *', 'select public.ai_health_snapshot()');
  end if;
end $$;
