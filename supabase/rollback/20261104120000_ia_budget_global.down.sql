-- Retour arrière de 20261104120000_ia_budget_global.sql (exécution manuelle).
-- Sans ai_global_month_cost_cents, le worker considère le plafond atteint
-- (prudence) et ne réclame plus rien : à n'exécuter qu'avec le retrait du worker.
-- Les bilans de santé (chiffres seuls) sont CONSERVÉS : supprimer la table
-- ai_health_reports reste une décision manuelle séparée.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'clairdossier-ai-sante';
  end if;
end $$;
drop function if exists public.ai_health_snapshot();
drop function if exists public.ai_global_month_cost_cents();
