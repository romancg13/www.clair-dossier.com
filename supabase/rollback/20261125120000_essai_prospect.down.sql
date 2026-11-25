-- Retour arrière de 20261125120000_essai_prospect.sql (exécution manuelle).
-- Niveau 1, sans perte : les essais sont FERMÉS, les dossiers d'essai des
-- comptes non abonnés sont désactivés et leurs travaux en attente annulés
-- (sans la garde, ils ne seraient plus bornés), puis les déclencheurs posés sur
-- le moteur (ai_jobs, ai_extractions, ai_analyses) et les RPC disparaissent.
-- Le worker traite l'absence de trial_allows comme « compte non concerné » :
-- les abonnés ne sont pas affectés. Essais, emplacements et journal CONSERVÉS
-- (gardes d'immutabilité comprises) ; leur suppression (niveau 2, commentée)
-- reste une décision manuelle séparée.
update public.trial_settings set enabled = false, updated_at = now() where id;

update public.dossier_ai_settings s
   set enabled_at = null, enabled_by = null, updated_at = now()
 where s.enabled_at is not null
   and exists (select 1 from public.trial_slots ts
                 join public.trial_accounts a on a.id = ts.trial_id
                where ts.dossier_id = s.dossier_id
                  and not public.trial_account_entitled(a.user_id));
update public.ai_jobs j
   set status = 'cancelled', finished_at = now(), updated_at = now()
 where j.status in ('queued', 'running')
   and exists (select 1 from public.trial_slots ts
                 join public.trial_accounts a on a.id = ts.trial_id
                where ts.dossier_id = j.dossier_id
                  and not public.trial_account_entitled(a.user_id));

drop trigger if exists ai_jobs_trial_gate on public.ai_jobs;
drop trigger if exists trial_track_extraction on public.ai_extractions;
drop trigger if exists trial_track_analysis on public.ai_analyses;
drop function if exists public.ai_jobs_trial_gate();
drop function if exists public.trial_track_usage();
drop function if exists public.trial_admin_configure(boolean, integer, integer, integer);
drop function if exists public.trial_admin_set_budget(uuid, integer);
drop function if exists public.trial_admin_resume(uuid);
drop function if exists public.trial_admin_suspend(uuid, text);
drop function if exists public.trial_claim_slot(uuid, uuid, text, text);
drop function if exists public.trial_open(uuid);
drop function if exists public.trial_allows(uuid, integer);
drop function if exists public.trial_check(uuid, text, uuid, integer);
drop function if exists public.trial_log(uuid, uuid, text, jsonb);
drop function if exists public.trial_account_entitled(uuid);
drop function if exists public.trial_document_fingerprint(uuid);
drop function if exists public.trial_email_fingerprint(text);

-- Niveau 2 (perte des compteurs d'essai et du journal : tout prospect
-- retrouverait deux analyses — décommenter sciemment) :
-- drop table if exists public.trial_events;
-- drop table if exists public.trial_slots;
-- drop table if exists public.trial_accounts;
-- drop table if exists public.trial_settings;
-- drop function if exists public.trial_guard();
