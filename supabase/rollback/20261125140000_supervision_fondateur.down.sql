-- Retour arrière de 20261125140000_supervision_fondateur.sql (exécution manuelle).
-- Niveau 1, sans perte : la lecture de supervision et les RPC de pause
-- disparaissent (la console affiche « non installée ») ; ai_claim_jobs retrouve
-- EXACTEMENT son corps de 20261023120000 — une pause posée en base n'a donc
-- plus d'effet : si l'arrêt doit être maintenu, poser d'abord le secret
-- AI_ENGINE_PAUSED=1 sur la fonction ai-worker. La table des réglages (date et
-- motif de pause, repère d'alerte) est CONSERVÉE ; sa suppression (niveau 2,
-- commentée) reste une décision manuelle séparée, à ne JAMAIS exécuter sans
-- avoir d'abord restauré ai_claim_jobs ci-dessous (sinon le worker échoue à
-- chaque réclamation).
do $do$
begin
  if to_regclass('public.ai_jobs') is null then return; end if;
  execute $fn$
    create or replace function public.ai_claim_jobs(p_worker text, p_limit integer default 5)
    returns setof public.ai_jobs language plpgsql security definer set search_path = public as $body$
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
    $body$
  $fn$;
  execute 'revoke execute on function public.ai_claim_jobs(text, integer) from public, anon, authenticated';
end
$do$;

drop function if exists public.admin_supervision_overview();
drop function if exists public.ai_admin_set_budget_alert(integer);
drop function if exists public.ai_admin_set_pause(boolean, text);

-- Niveau 2 (perte de la date/motif de pause et du repère — décommenter sciemment) :
-- drop table if exists public.ai_engine_control;
