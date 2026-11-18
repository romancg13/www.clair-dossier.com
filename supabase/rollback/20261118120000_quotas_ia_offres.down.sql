-- Retour arrière de 20261118120000_quotas_ia_offres.sql (exécution manuelle).
-- Niveau 1, sans perte : les fonctions de quota disparaissent — le worker
-- considère alors le quota illisible et met les nouveaux traitements en pause
-- (prudence) : à n'exécuter qu'avec un worker antérieur à ce quota, ou retiré.
-- Les colonnes de plafond et le journal des actions (chiffres seuls) sont
-- CONSERVÉS ; leur suppression (niveau 2, commentée) reste une décision
-- manuelle séparée.
drop function if exists public.get_my_ai_quota();
drop function if exists public.ai_consume_action(uuid, uuid, text);
drop function if exists public.ai_quota_allows_pages(uuid, integer);
drop function if exists public.ai_quota_state(uuid);

-- Niveau 2 (perte des réglages et du journal — décommenter sciemment) :
-- drop table if exists public.ai_action_events;
-- alter table public.entitlement_overrides
--   drop column if exists ai_pages_month,
--   drop column if exists ai_actions_month;
-- alter table public.plan_entitlements
--   drop column if exists ai_pages_month,
--   drop column if exists ai_actions_month;
