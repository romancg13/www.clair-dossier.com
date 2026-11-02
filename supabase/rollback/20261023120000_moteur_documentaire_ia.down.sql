-- Retour arrière de la migration 20261023120000_moteur_documentaire_ia.sql
-- Hors de supabase/migrations : jamais appliqué automatiquement.
-- Exécution manuelle uniquement, par le propriétaire, APRÈS export de la base.
--
-- Niveau 1 (ci-dessous, actif) — NEUTRALISATION, sans perte de données :
--   plus aucun travail créé ni réclamé, plus aucune activation possible ;
--   les tables IA, les livrables publiés et les échéances restent intacts.
-- Niveau 2 (en fin de fichier, commenté) — SUPPRESSION complète des objets IA.
--   Irréversible : ne le décommenter qu'après export et décision écrite.

begin;

-- Horloge pg_cron (si l'extension est présente).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'clairdossier-ai-worker';
  end if;
end $$;

-- Déclencheurs automatiques : plus aucune mise en file.
drop trigger if exists documents_ai_enqueue on public.dossier_documents;
drop trigger if exists dossier_events_lifecycle on public.dossier_events;
drop trigger if exists ai_overrides_render on public.ai_event_overrides;

-- Activation impossible ; travaux ouverts annulés (historique conservé).
revoke execute on function public.enable_ai_processing(uuid, text) from public, anon, authenticated;
update public.ai_jobs set status = 'cancelled', last_error = 'moteur désactivé (retour arrière)'
  where status in ('queued', 'running');

-- Sonde de capacité : le site considère le moteur indisponible.
create or replace function public.ai_engine_enabled()
returns boolean language sql stable as $$ select false $$;

commit;

-- ── Niveau 2 — suppression complète (COMMENTÉ VOLONTAIREMENT) ───────────────
-- begin;
-- drop trigger if exists deadlines_mark_user_edited on public.dossier_deadlines;
-- drop policy if exists "events_insert_admin" on public.dossier_events;
-- drop table if exists public.ai_notifications, public.ai_event_overrides,
--   public.ai_analyses, public.ai_extractions, public.ai_jobs, public.dossier_ai_settings cascade;
-- drop function if exists public.deadlines_mark_user_edited(), public.dossier_is_closed(uuid),
--   public.ai_enqueue(uuid, text, uuid, interval), public.ai_enqueue_dossier(uuid),
--   public.documents_ai_enqueue(), public.dossier_events_lifecycle(),
--   public.ai_overrides_stamp(), public.ai_overrides_render(),
--   public.enable_ai_processing(uuid, text), public.disable_ai_processing(uuid),
--   public.ai_month_cost_cents(uuid), public.ai_engine_enabled();
-- drop index if exists public.dossier_deadlines_ai_key_idx;
-- alter table public.dossier_deadlines drop column if exists ai_key, drop column if exists user_edited;
-- alter table public.dossier_documents drop constraint if exists dossier_documents_generated_by_check;
-- alter table public.dossier_documents drop column if exists generated_by;
-- commit;
-- Note : ai_claim_jobs et ai_finish_job dépendent du type ai_jobs et tombent avec la table (cascade).
