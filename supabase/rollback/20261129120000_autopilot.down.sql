-- Retour arrière de 20261129120000_autopilot.sql.
-- Retire le réveil immédiat (pg_cron reprend seul, chaque minute) et rétablit la relecture
-- avant publication par défaut pour les NOUVELLES activations. Les dossiers déjà en
-- publication automatique le restent (réglage par dossier : console « IA privée »).
-- Pour rétablir aussi la relecture imposée en pilote, rejouer la section 4 de
-- 20261128120000_ia_activation_compte.sql (fonction documents_ai_account_enable).
drop trigger if exists ai_jobs_autopilot on public.ai_jobs;
drop function if exists public.ai_jobs_autopilot();
drop function if exists public.ai_worker_kick();
alter table public.dossier_ai_settings alter column review_mode set default 'manual';
