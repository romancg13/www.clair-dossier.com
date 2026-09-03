-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 11 du plan de build : agent SENTINEL — contrôle qualité et
-- anti-hallucination de toute sortie d'agent (PARTIE 4.3, 4.4, 7.3 ; D-012).
--
-- Additive et rejouable. Chaque exécution d'agent contrôlée porte le verdict de
-- SENTINEL et le nombre d'itérations de correction (PARTIE 11 : taux de
-- correction par agent, alerte au-delà de 15 %). L'écriture est réservée au
-- serveur.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.agent_runs add column if not exists sentinel_run_id uuid references public.agent_runs (id) on delete set null;
alter table public.agent_runs add column if not exists sentinel_verdict text;
alter table public.agent_runs add column if not exists sentinel_iterations integer;
alter table public.agent_runs drop constraint if exists agent_runs_sentinel_verdict_check;
alter table public.agent_runs add constraint agent_runs_sentinel_verdict_check
  check (sentinel_verdict is null or sentinel_verdict in ('accepte', 'corrige', 'refuse'));
create index if not exists agent_runs_sentinel_idx on public.agent_runs (agent, sentinel_verdict) where sentinel_verdict is not null;

create or replace function public.enregistrer_controle(
  p_run_id uuid,
  p_sentinel_run_id uuid,
  p_verdict text,
  p_iterations integer
) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_controle est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  update public.agent_runs
     set sentinel_run_id = p_sentinel_run_id, sentinel_verdict = p_verdict, sentinel_iterations = p_iterations
   where id = p_run_id;
end;
$$;
revoke all on function public.enregistrer_controle(uuid, uuid, text, integer) from public, anon, authenticated;

-- Taux de correction SENTINEL par agent (PARTIE 11), lisible par l'admin global.
create or replace view public.sentinel_taux_correction as
  select agent,
         count(*) filter (where sentinel_verdict is not null) as controles,
         count(*) filter (where sentinel_verdict = 'corrige') as corriges,
         count(*) filter (where sentinel_verdict = 'refuse') as refuses,
         case when count(*) filter (where sentinel_verdict is not null) = 0 then null
              else round(100.0 * count(*) filter (where sentinel_verdict in ('corrige', 'refuse'))
                         / count(*) filter (where sentinel_verdict is not null), 1) end as taux_correction_pct
    from public.agent_runs
   group by agent;
revoke all on public.sentinel_taux_correction from public, anon, authenticated;
