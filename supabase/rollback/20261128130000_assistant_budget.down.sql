-- Retour arrière de 20261128130000_assistant_budget.sql (comptabilité et journal de l'assistant).
-- Sans ces fonctions, la fonction Edge « assistant » répond par les règles (aucun appel payant).
drop function if exists public.assistant_settle(uuid, bigint, bigint);
drop function if exists public.assistant_reserve(uuid, bigint, bigint, bigint);
drop table if exists public.assistant_usage;
drop table if exists public.assistant_pots;
