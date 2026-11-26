-- Retour arrière de 20261126120000_intelligence_espace_client.sql (exécution manuelle).
-- Supprime l'historique de l'assistant, les préférences, les automatisations, leurs preuves et les notifications internes.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'clairdossier-automatisations';
  end if;
end $$;
drop trigger if exists client_automation_on_document on public.dossier_documents;
drop function if exists public.client_automation_on_document();
drop function if exists public.run_client_automations(timestamptz, integer);
drop function if exists public.set_client_automation_status(uuid, text);
drop function if exists public.create_client_automation(text, text, smallint, smallint);
drop function if exists public.client_automation_next(text, integer, integer, timestamptz);
drop function if exists public.client_subscription_active(uuid);
drop function if exists public.client_dossier_closed(uuid);
drop table if exists public.client_automation_runs;
drop table if exists public.client_automations;
drop function if exists public.mark_client_notifications_read();
drop table if exists public.client_notifications;
drop trigger if exists assistant_preferences_limit on public.assistant_preferences;
drop function if exists public.assistant_preferences_limit();
drop table if exists public.assistant_preferences;
drop table if exists public.assistant_turns;
