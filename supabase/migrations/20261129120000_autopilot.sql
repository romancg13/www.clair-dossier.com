-- Autopilote (V18) : plus de temps mort entre le dépôt et les résultats, publication automatique.
-- Additive et rejouable. Dépend de 20261023, 20261102 et 20261128120000.
--
--   1. Réveil immédiat du worker : dès qu'un travail est dû (dépôt d'une pièce, fin d'un travail),
--      la base appelle ai-worker (pg_net, asynchrone, après validation de la transaction).
--      pg_cron (chaque minute) reste le filet de sécurité. Le réveil n'est JAMAIS bloquant :
--      toute erreur est ignorée, le dépôt aboutit toujours.
--   2. Consolidation sans attente : quand la dernière lecture d'un dossier se termine, la
--      synthèse en file (différée de 90 s pour regrouper les dépôts) part aussitôt.
--   3. Débit borné : au plus 3 réveils par rafale de dépôts et pas de réveil au-delà de
--      3 travaux en cours (les workers en cours enchaînent d'eux-mêmes).
--   4. Publication automatique par défaut (décision du fondateur du 28/11/2026) : les documents
--      paraissent dès qu'ils sont prêts, incertitudes signalées ; la relecture avant publication
--      reste possible dossier par dossier (console « IA privée », ai_set_review_mode).

do $$
begin
  if to_regclass('public.ai_jobs') is null or to_regclass('public.ai_auto_gate') is null then
    raise exception 'PREREQUIS_ABSENTS : appliquer 20261023, 20261102 et 20261128120000 avant 20261129120000';
  end if;
end $$;

-- ── 1. Réveil du worker ─────────────────────────────────────────────────────
create or replace function public.ai_worker_kick()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_token text := '';
begin
  if to_regnamespace('net') is null then return; end if;
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into v_token using 'clairdossier_ai_worker_token';
  end if;
  perform net.http_post(
    url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/ai-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U',
      'x-worker-token', coalesce(v_token, '')
    ),
    body := '{"source":"depot"}'::jsonb
  );
exception when others then
  null; -- optimisation seulement : pg_cron reprend dans la minute
end;
$$;
revoke execute on function public.ai_worker_kick() from public, anon, authenticated;

create or replace function public.ai_jobs_autopilot()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_running integer;
  v_due integer;
begin
  -- Dernière lecture du dossier terminée : la synthèse en attente part maintenant
  -- (cette mise à jour redéclenche ce déclencheur, qui réveille le worker).
  if tg_op = 'UPDATE' and new.kind = 'extract'
     and old.status in ('queued', 'running') and new.status in ('done', 'failed', 'cancelled')
     and not exists (select 1 from public.ai_jobs j where j.dossier_id = new.dossier_id and j.kind = 'extract'
                       and j.status in ('queued', 'running') and j.id <> new.id) then
    update public.ai_jobs set run_after = now(), updated_at = now()
     where dossier_id = new.dossier_id and kind = 'consolidate' and status = 'queued' and run_after > now();
    if found then return new; end if;
  end if;

  -- Réveil seulement si ce changement rend un travail disponible ou libère un worker.
  if not (
       (tg_op = 'INSERT' and new.status = 'queued' and new.run_after <= now())
    or (tg_op = 'UPDATE' and new.status = 'queued' and new.run_after <= now() and old.run_after > now())
    or (tg_op = 'UPDATE' and old.status = 'running' and new.status <> 'running')
  ) then return new; end if;

  select count(*) filter (where status = 'running'), count(*) filter (where status = 'queued' and run_after <= now())
    into v_running, v_due
    from public.ai_jobs where status in ('queued', 'running');
  if v_due = 0 or v_running >= 3 then return new; end if;
  if tg_op = 'INSERT' and v_due > 3 then return new; end if; -- rafale : 3 réveils au plus
  perform public.ai_worker_kick();
  return new;
end;
$$;
revoke execute on function public.ai_jobs_autopilot() from public, anon, authenticated;

drop trigger if exists ai_jobs_autopilot on public.ai_jobs;
create trigger ai_jobs_autopilot
  after insert or update of status, run_after on public.ai_jobs
  for each row execute function public.ai_jobs_autopilot();

-- ── 2. Publication automatique par défaut ───────────────────────────────────
alter table public.dossier_ai_settings alter column review_mode set default 'auto';

-- Comptes ayant accepté l'analyse automatique : leurs dossiers déjà activés publient directement.
update public.dossier_ai_settings s set review_mode = 'auto', updated_at = now()
  from public.ai_account_settings a
 where a.user_id = s.user_id and a.enabled_at is not null and s.review_mode = 'manual';

-- Même fonction que 20261128120000, sans relecture imposée en pilote (défaut de la table : auto).
create or replace function public.documents_ai_account_enable()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid;
  v_existing text;
  v_exists boolean;
  a public.ai_account_settings;
  v_ref text;
  v_done integer;
begin
  if new.kind <> 'piece' or new.deleted_at is not null then return new; end if;
  select true, s.consent_reference into v_exists, v_existing
    from public.dossier_ai_settings s where s.dossier_id = new.dossier_id;
  if coalesce(v_exists, false) and coalesce(v_existing, '') not like 'compte-desactive:%' then return new; end if;
  select d.user_id into v_owner from public.dossiers d where d.id = new.dossier_id and d.deleted_at is null;
  if v_owner is null then return new; end if;
  select * into a from public.ai_account_settings where user_id = v_owner and enabled_at is not null;
  if a.user_id is null then return new; end if;
  if not public.ai_auto_gate_allows(v_owner) then return new; end if;
  if not public.client_subscription_active(v_owner) then return new; end if;
  if public.dossier_is_closed(new.dossier_id) then return new; end if;
  v_ref := 'compte:' || a.terms_version || ':' || to_char(a.accepted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at, enabled_by, terms_version, consent_reference)
  values (new.dossier_id, v_owner, now(), v_owner, a.terms_version, v_ref)
  on conflict (dossier_id) do update
    set enabled_at = now(), enabled_by = v_owner, terms_version = excluded.terms_version,
        consent_reference = excluded.consent_reference, updated_at = now()
    where public.dossier_ai_settings.enabled_at is null
      and public.dossier_ai_settings.consent_reference like 'compte-desactive:%';
  get diagnostics v_done = row_count;
  if v_done > 0 then
    insert into public.dossier_events (dossier_id, user_id, type, label)
    values (new.dossier_id, v_owner, 'ia_activee',
            'Analyse automatique activée (réglage du compte, conditions ' || a.terms_version || ') — nouvelles pièces seulement');
  end if;
  return new;
end;
$$;
revoke execute on function public.documents_ai_account_enable() from public, anon, authenticated;
