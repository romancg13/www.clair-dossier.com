-- Retour arrière de la migration 20261102120000_ia_console_privee.sql
-- Hors de supabase/migrations : jamais appliqué automatiquement.
-- Exécution manuelle uniquement, par le propriétaire, APRÈS export de la base.
--
-- Niveau 1 (actif) — NEUTRALISATION sans perte : plus aucune action
-- d'administration possible (approbation, rejet, relance, activation sur accord),
-- plus aucune publication ; les analyses et livrables en attente restent en base,
-- invisibles du client (les policies restrictives sont conservées : c'est elles qui
-- protègent le client). Les livrables déjà publiés restent publiés.
-- Niveau 2 (commenté) — retrait des colonnes et policies ajoutées. Irréversible.

begin;

revoke execute on function public.ai_set_review_mode(uuid, text) from public, anon, authenticated;
revoke execute on function public.ai_approve_revision(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.ai_reject_revision(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.ai_retry_job(uuid) from public, anon, authenticated;
revoke execute on function public.ai_admin_enable(uuid, text, text) from public, anon, authenticated;

-- Travaux de publication ouverts annulés (historique conservé).
update public.ai_jobs set status = 'cancelled', finished_at = now(), updated_at = now(),
  last_error = 'console privée désactivée (retour arrière)'
  where kind = 'publish' and status in ('queued', 'running');

-- Sonde : la console se déclare indisponible.
create or replace function public.ai_private_console_enabled()
returns boolean language sql stable as $$ select false $$;

commit;

-- ── Niveau 2 — retrait complet (COMMENTÉ VOLONTAIREMENT) ────────────────────
-- Attention : retirer les policies restrictives rend visibles au client les
-- analyses et livrables « pending »/« rejected » encore en base. Les purger avant.
-- begin;
-- update public.ai_analyses set review_status = 'rejected' where review_status in ('pending', 'approved');
-- update public.dossier_documents set deleted_at = coalesce(deleted_at, now()) where review_status in ('pending', 'rejected');
-- drop policy if exists "ai_analyses_published_only" on public.ai_analyses;
-- drop policy if exists "docs_hide_unpublished_ai" on public.dossier_documents;
-- drop function if exists public.ai_set_review_mode(uuid, text), public.ai_approve_revision(uuid, integer, text),
--   public.ai_reject_revision(uuid, integer, text), public.ai_retry_job(uuid), public.ai_admin_enable(uuid, text, text),
--   public.ai_admin_overview(), public.ai_admin_month_cost(), public.ai_admin_audit(text, uuid, uuid, jsonb),
--   public.ai_private_console_enabled();
-- alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
-- alter table public.ai_jobs add constraint ai_jobs_kind_check check (kind in ('extract', 'consolidate', 'render'));
-- alter table public.ai_jobs drop column if exists revision;
-- alter table public.dossier_documents drop constraint if exists dossier_documents_review_status_check;
-- drop index if exists public.dossier_documents_ai_revision_idx;
-- alter table public.dossier_documents drop column if exists ai_revision, drop column if exists review_status;
-- alter table public.ai_analyses drop constraint if exists ai_analyses_review_status_check;
-- alter table public.ai_analyses drop column if exists review_status, drop column if exists reviewed_at,
--   drop column if exists reviewed_by, drop column if exists review_note, drop column if exists published_at;
-- alter table public.dossier_ai_settings drop constraint if exists dossier_ai_settings_review_mode_check;
-- alter table public.dossier_ai_settings drop column if exists review_mode, drop column if exists consent_reference;
-- commit;
-- Note : enable_ai_processing garde sa définition 20261102 (titulaire seul) ; pour
-- revenir à la version 20261023, rejouer la section 10 de cette migration.
