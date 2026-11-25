-- Centre de supervision fondateur (2026-11-25) — MIGRATION ADDITIVE, idempotente
-- et rejouable. PROPOSITION DE RECETTE : jamais appliquée en production à ce jour.
--
-- Objet : combler les manques de la console d'administration SANS dupliquer
-- l'existant (file et validation par dossier : ai_admin_overview ; abonnements :
-- admin_list_entitlements ; journal : audit_logs) :
--   * UNE lecture agrégée `admin_supervision_overview()` — états et compteurs
--     réellement mesurés (file, reprises, erreurs par catégorie, abonnements,
--     coût IA et volume stocké par compte, quotas, alertes de saturation,
--     dernières actions d'administration). AUCUN contenu de pièce, aucun texte
--     extrait, aucun libellé d'erreur, aucun e-mail : identifiants de compte et
--     chiffres uniquement (la console associe les e-mails par admin_user_emails,
--     déjà existante) ;
--   * arrêt des traitements PILOTÉ EN BASE : `ai_admin_set_pause` pose un
--     drapeau que `ai_claim_jobs` respecte (plus aucun travail réclamé). Il
--     COMPLÈTE l'arrêt d'urgence existant du worker (secret AI_ENGINE_PAUSED=1),
--     qui reste prioritaire et inchangé ;
--   * repère d'alerte du budget global (chiffre de SURVEILLANCE seulement : le
--     plafond réel de dépense reste le secret AI_BUDGET_CENTS_GLOBAL_MONTH du
--     worker, que la base ne connaît pas).
-- Tolérance : la lecture fonctionne aussi quand les migrations du moteur IA
-- (20261023, 20261102, 20261104, 20261118*) ne sont pas installées — les blocs
-- correspondants valent alors null (état de la production au 2026-11-25).
-- Inchangés : toutes les tables et policies existantes, Stripe, quotas, e-mails.

-- ── 1. Réglages du moteur (ligne unique) ─────────────────────────────────────
create table if not exists public.ai_engine_control (
  id boolean primary key default true check (id),
  paused_at timestamptz,
  paused_by uuid references auth.users (id) on delete set null,
  reason text,
  -- Repère d'alerte (centimes / mois, tous comptes) : surveillance uniquement.
  alert_global_cents integer check (alert_global_cents is null or alert_global_cents > 0),
  updated_at timestamptz not null default now()
);
insert into public.ai_engine_control (id) values (true) on conflict (id) do nothing;
alter table public.ai_engine_control enable row level security;
drop policy if exists "ai_engine_control_select_admin" on public.ai_engine_control;
create policy "ai_engine_control_select_admin" on public.ai_engine_control
  for select using (coalesce(public.is_admin(), false));
-- Aucune policy d'écriture : RPC ci-dessous uniquement.

-- ── 2. Pause / reprise des traitements (administration, journalisée) ─────────
create or replace function public.ai_admin_set_pause(p_paused boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if p_paused is null then raise exception 'PARAMETRE_INVALIDE'; end if;
  if p_paused and length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'MOTIF_REQUIS'; end if;
  insert into public.ai_engine_control (id) values (true) on conflict (id) do nothing;
  -- Pause déjà posée : la date d'origine est conservée (appel idempotent).
  update public.ai_engine_control
     set paused_at = case when p_paused then coalesce(paused_at, now()) else null end,
         paused_by = case when p_paused then auth.uid() else null end,
         reason = case when p_paused then left(btrim(p_reason), 300) else null end,
         updated_at = now()
   where id;
  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, metadata)
    values (auth.uid(), 'admin', case when p_paused then 'ia_moteur_pause' else 'ia_moteur_reprise' end, 'ia',
            jsonb_build_object('motif', left(btrim(coalesce(p_reason, '')), 300)));
  end if;
end;
$$;
revoke execute on function public.ai_admin_set_pause(boolean, text) from public, anon;
grant execute on function public.ai_admin_set_pause(boolean, text) to authenticated;

-- Repère d'alerte du budget global (null = retiré).
create or replace function public.ai_admin_set_budget_alert(p_cents integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception 'FORBIDDEN'; end if;
  if p_cents is not null and p_cents <= 0 then raise exception 'PARAMETRE_INVALIDE'; end if;
  insert into public.ai_engine_control (id) values (true) on conflict (id) do nothing;
  update public.ai_engine_control set alert_global_cents = p_cents, updated_at = now() where id;
  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_id, actor_role, action, resource_type, metadata)
    values (auth.uid(), 'admin', 'ia_repere_budget', 'ia', jsonb_build_object('centimes', p_cents));
  end if;
end;
$$;
revoke execute on function public.ai_admin_set_budget_alert(integer) from public, anon;
grant execute on function public.ai_admin_set_budget_alert(integer) to authenticated;

-- ── 3. La file respecte la pause ─────────────────────────────────────────────
-- Corps de 20261023120000 repris À L'IDENTIQUE, précédé du seul contrôle de
-- pause (nom, signature, droits et appelant inchangés). En pause : rien n'est
-- réclamé ni recyclé ; les travaux restent en file et repartent à la reprise.
-- Uniquement si le moteur est installé (le type de retour dépend d'ai_jobs).
do $do$
begin
  if to_regclass('public.ai_jobs') is null then return; end if;
  execute $fn$
    create or replace function public.ai_claim_jobs(p_worker text, p_limit integer default 5)
    returns setof public.ai_jobs language plpgsql security definer set search_path = public as $body$
    begin
      if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
      -- Pause posée par l'administration (ai_admin_set_pause) : rien n'est réclamé.
      if exists (select 1 from public.ai_engine_control where paused_at is not null) then return; end if;
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

-- ── 4. Lecture agrégée de supervision ────────────────────────────────────────
-- is_admin() obligatoire. Deux blocs restent réservés au super admin, comme les
-- policies existantes : dérogations (entitlement_overrides) et journal d'audit.
create or replace function public.admin_supervision_overview()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_super boolean := coalesce(public.is_super_admin(), false);
  v_has_jobs boolean := to_regclass('public.ai_jobs') is not null;
  v_has_ia boolean := to_regclass('public.ai_extractions') is not null
                  and to_regclass('public.ai_analyses') is not null;
  v_has_quota boolean := to_regprocedure('public.ai_quota_state(uuid)') is not null;
  v_has_inbound boolean := to_regclass('public.inbound_emails') is not null
                       and to_regclass('public.inbound_addresses') is not null;
  v_month timestamptz := date_trunc('month', now());
  v_paused_at timestamptz;
  v_repere integer;
  v_jobs jsonb;
  v_traitements jsonb;
  v_emails jsonb;
  v_abonnements jsonb;
  v_stockage jsonb;
  v_actions jsonb;
  v_comptes jsonb := '[]'::jsonb;
  v_alertes jsonb := '[]'::jsonb;
  v_cout_global numeric := 0;
  v_bloques integer := 0;
  v_echecs_def integer := 0;
  v_budget_mois integer := 0;
  v_emails_err integer := 0;
  v_q80 integer := 0;
  v_q100 integer := 0;
  v_total integer := 0;
  v_derogations integer;
  r record;
  v_cout numeric;
  v_plan text;
  v_statut text;
  v_pl integer; v_al integer; v_pu integer; v_au integer;
  v_pct numeric;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if not coalesce(public.is_admin(), false) then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;

  select c.paused_at, c.alert_global_cents into v_paused_at, v_repere
    from public.ai_engine_control c where c.id;

  -- File : états, reprises, blocages, échecs (mêmes définitions que le bilan
  -- quotidien ai_health_snapshot). Catégories d'erreur comptées, jamais citées.
  if v_has_jobs then
    select jsonb_build_object(
             'par_statut', jsonb_build_object(
               'queued', count(*) filter (where j.status = 'queued'),
               'running', count(*) filter (where j.status = 'running'),
               'done', count(*) filter (where j.status = 'done'),
               'failed', count(*) filter (where j.status = 'failed'),
               'cancelled', count(*) filter (where j.status = 'cancelled')),
             'bloques', count(*) filter (where (j.status = 'queued' and j.run_after < now() - interval '1 hour')
                                            or (j.status = 'running' and j.lease_until < now() - interval '15 minutes')),
             'reprises_en_cours', count(*) filter (where j.status = 'queued' and j.attempts > 0),
             'termines_24h', count(*) filter (where j.status = 'done' and j.finished_at >= now() - interval '1 day'),
             'echecs_24h', count(*) filter (where j.status = 'failed' and j.updated_at >= now() - interval '1 day'),
             'echecs_definitifs_7j', count(*) filter (where j.status = 'failed' and coalesce(j.last_error, '') not like 'BUDGET:%'
                                                        and j.updated_at >= now() - interval '7 days'),
             'pauses_budget_mois', count(*) filter (where j.status = 'failed' and coalesce(j.last_error, '') like 'BUDGET:%'
                                                      and j.updated_at >= v_month),
             'erreurs_30j', jsonb_build_object(
               'budget_ou_quota', count(*) filter (where j.status = 'failed' and j.updated_at >= now() - interval '30 days'
                                                    and coalesce(j.last_error, '') like 'BUDGET:%'),
               'interruption', count(*) filter (where j.status = 'failed' and j.updated_at >= now() - interval '30 days'
                                                 and coalesce(j.last_error, '') like 'traitement interrompu%'),
               'autre', count(*) filter (where j.status = 'failed' and j.updated_at >= now() - interval '30 days'
                                          and coalesce(j.last_error, '') not like 'BUDGET:%'
                                          and coalesce(j.last_error, '') not like 'traitement interrompu%')),
             'plus_ancien_en_attente', min(j.run_after) filter (where j.status = 'queued' and j.run_after <= now()),
             'derniere_activite', max(j.updated_at))
      into v_jobs
      from public.ai_jobs j;
    v_jobs := v_jobs || jsonb_build_object(
      'ouverts_par_type', (select coalesce(jsonb_object_agg(k.kind, k.n), '{}'::jsonb)
                             from (select j.kind, count(*) as n from public.ai_jobs j
                                    where j.status in ('queued', 'running') group by j.kind) k),
      'dossiers_multi_echecs_7j', (select count(*) from (
                                     select j.dossier_id from public.ai_jobs j
                                      where j.status = 'failed' and coalesce(j.last_error, '') not like 'BUDGET:%'
                                        and j.updated_at >= now() - interval '7 days'
                                      group by j.dossier_id having count(*) >= 2) m));
    v_bloques := (v_jobs ->> 'bloques')::integer;
    v_echecs_def := (v_jobs ->> 'echecs_definitifs_7j')::integer;
    v_budget_mois := (v_jobs ->> 'pauses_budget_mois')::integer;
  end if;

  -- Traitements du mois : volumes et coût (chiffres seuls).
  if v_has_ia then
    select coalesce((select sum(e.cost_cents) from public.ai_extractions e where e.created_at >= v_month), 0)
         + coalesce((select sum(a.cost_cents) from public.ai_analyses a where a.created_at >= v_month), 0)
      into v_cout_global;
    select jsonb_build_object(
             'extractions_ok', count(*) filter (where e.status = 'ok'),
             'extractions_non_prises_en_charge', count(*) filter (where e.status = 'unsupported'),
             'extractions_en_erreur', count(*) filter (where e.status = 'error'),
             'pages_lues', coalesce(sum(greatest(coalesce(e.pages, 1), 1)) filter (where e.status = 'ok'), 0))
      into v_traitements
      from public.ai_extractions e where e.created_at >= v_month;
    v_traitements := v_traitements || jsonb_build_object(
      'analyses', (select count(*) from public.ai_analyses a where a.created_at >= v_month));
  end if;

  -- Réception d'e-mails : états sur 30 jours (aucun expéditeur, aucun objet).
  if v_has_inbound then
    select jsonb_build_object(
             'recus_30j', count(*),
             'stockes_30j', count(*) filter (where m.status = 'stored'),
             'rejetes_30j', count(*) filter (where m.status = 'rejected'),
             'en_erreur_30j', count(*) filter (where m.status = 'error'),
             'en_erreur_7j', count(*) filter (where m.status = 'error' and m.created_at >= now() - interval '7 days'))
      into v_emails
      from public.inbound_emails m where m.created_at >= now() - interval '30 days';
    v_emails := v_emails || jsonb_build_object(
      'adresses_actives', (select count(*) from public.inbound_addresses a where a.revoked_at is null));
    v_emails_err := (v_emails ->> 'en_erreur_7j')::integer;
  end if;

  -- Abonnements et droits (lecture seule ; Stripe reste la source de vérité).
  if v_super then
    select count(*) into v_derogations
      from public.entitlement_overrides o
     where o.active and o.revoked_at is null and o.starts_at <= now()
       and (o.expires_at is null or o.expires_at > now());
  end if;
  v_abonnements := jsonb_build_object(
    'par_statut', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
                     from (select status, count(*) as n from public.subscriptions group by status) s),
    'en_cours_par_offre', (select coalesce(jsonb_object_agg(s.plan, s.n), '{}'::jsonb)
                             from (select coalesce(plan_id, 'inconnue') as plan, count(*) as n
                                     from public.subscriptions
                                    where status in ('active', 'trialing', 'past_due')
                                       or (status = 'canceled' and current_period_end > now())
                                    group by 1) s),
    'resiliations_programmees', (select count(*) from public.subscriptions
                                  where cancel_at_period_end and status in ('active', 'trialing', 'past_due')),
    'derogations_actives', v_derogations);

  -- Volume stocké (métadonnées des fichiers : tailles et nombres, rien d'autre).
  select jsonb_build_object(
           'octets', coalesce(sum(coalesce(d.size_bytes, 0)), 0),
           'documents', count(*),
           'documents_sans_taille', count(*) filter (where d.size_bytes is null),
           'octets_corbeille', coalesce(sum(coalesce(d.size_bytes, 0)) filter (where d.deleted_at is not null), 0))
    into v_stockage
    from public.dossier_documents d;

  -- Par compte : volume, coût IA du mois, quota de l'offre.
  for r in
    select u.user_id,
           coalesce(d.octets, 0) as octets,
           coalesce(d.documents, 0) as documents,
           coalesce(ds.dossiers, 0) as dossiers
      from (select user_id from public.dossier_documents
            union select user_id from public.dossiers
            union select user_id from public.subscriptions) u
      left join (select user_id, sum(coalesce(size_bytes, 0)) as octets, count(*) as documents
                   from public.dossier_documents group by user_id) d on d.user_id = u.user_id
      left join (select user_id, count(*) as dossiers
                   from public.dossiers where deleted_at is null group by user_id) ds on ds.user_id = u.user_id
  loop
    v_total := v_total + 1;
    v_cout := 0; v_plan := null; v_statut := null;
    v_pl := null; v_al := null; v_pu := null; v_au := null; v_pct := null;
    select s.plan_id, s.status into v_plan, v_statut
      from public.subscriptions s
     where s.user_id = r.user_id
     order by (s.status in ('active', 'trialing', 'past_due')
               or (s.status = 'canceled' and s.current_period_end > now())) desc,
              s.current_period_end desc nulls last, s.updated_at desc
     limit 1;
    if v_has_ia then
      select coalesce((select sum(e.cost_cents) from public.ai_extractions e where e.user_id = r.user_id and e.created_at >= v_month), 0)
           + coalesce((select sum(a.cost_cents) from public.ai_analyses a where a.user_id = r.user_id and a.created_at >= v_month), 0)
        into v_cout;
    end if;
    if v_has_quota then
      select q.pages_limit, q.actions_limit, q.pages_used, q.actions_used
        into v_pl, v_al, v_pu, v_au
        from public.ai_quota_state(r.user_id) q;
      -- Plafond à 0 non consommé = fonctionnalité non incluse, pas une saturation.
      v_pct := greatest(
        case when v_pl > 0 then round(100.0 * v_pu / v_pl, 1) when v_pl = 0 and v_pu > 0 then 100 end,
        case when v_al > 0 then round(100.0 * v_au / v_al, 1) when v_al = 0 and v_au > 0 then 100 end);
      if v_pct >= 100 then v_q100 := v_q100 + 1;
      elsif v_pct >= 80 then v_q80 := v_q80 + 1;
      end if;
    end if;
    v_comptes := v_comptes || jsonb_build_object(
      'user_id', r.user_id, 'offre', v_plan, 'statut_abonnement', v_statut,
      'cout_ia_mois_cents', v_cout,
      'pages_utilisees', v_pu, 'pages_limite', v_pl,
      'actions_utilisees', v_au, 'actions_limite', v_al,
      'quota_pct', v_pct,
      'octets', r.octets, 'documents', r.documents, 'dossiers', r.dossiers);
  end loop;
  -- Les 200 comptes les plus consommateurs (coût, puis quota, puis volume).
  select coalesce(jsonb_agg(s.e order by s.rang), '[]'::jsonb) into v_comptes
    from (select e, row_number() over (
                      order by (e ->> 'cout_ia_mois_cents')::numeric desc,
                               coalesce((e ->> 'quota_pct')::numeric, -1) desc,
                               (e ->> 'octets')::numeric desc,
                               e ->> 'user_id') as rang
            from jsonb_array_elements(v_comptes) e) s
   where s.rang <= 200;

  -- Alertes de saturation : uniquement des constats mesurés ci-dessus.
  if v_paused_at is not null then
    v_alertes := v_alertes || jsonb_build_object('code', 'MOTEUR_EN_PAUSE', 'niveau', 'info', 'valeur', 1);
  end if;
  if v_q100 > 0 then
    v_alertes := v_alertes || jsonb_build_object('code', 'QUOTA_ATTEINT', 'niveau', 'critique', 'valeur', v_q100);
  end if;
  if v_q80 > 0 then
    v_alertes := v_alertes || jsonb_build_object('code', 'QUOTA_80', 'niveau', 'attention', 'valeur', v_q80);
  end if;
  if v_repere is not null and v_cout_global >= v_repere then
    v_alertes := v_alertes || jsonb_build_object('code', 'BUDGET_GLOBAL_ATTEINT', 'niveau', 'critique',
                                                 'valeur', round(100.0 * v_cout_global / v_repere, 1));
  elsif v_repere is not null and v_cout_global >= 0.8 * v_repere then
    v_alertes := v_alertes || jsonb_build_object('code', 'BUDGET_GLOBAL_80', 'niveau', 'attention',
                                                 'valeur', round(100.0 * v_cout_global / v_repere, 1));
  end if;
  if v_budget_mois > 0 then
    v_alertes := v_alertes || jsonb_build_object('code', 'PAUSES_BUDGET', 'niveau', 'attention', 'valeur', v_budget_mois);
  end if;
  -- En pause volontaire, l'attente en file est attendue : pas d'alerte de blocage.
  if v_bloques > 0 and v_paused_at is null then
    v_alertes := v_alertes || jsonb_build_object('code', 'FILE_BLOQUEE', 'niveau', 'critique', 'valeur', v_bloques);
  end if;
  if v_echecs_def > 0 then
    v_alertes := v_alertes || jsonb_build_object('code', 'ECHECS_REPETES', 'niveau', 'critique', 'valeur', v_echecs_def);
  end if;
  if v_emails_err > 0 then
    v_alertes := v_alertes || jsonb_build_object('code', 'EMAILS_EN_ERREUR', 'niveau', 'attention', 'valeur', v_emails_err);
  end if;

  -- Historique des actions d'administration : super admin seulement (comme la
  -- policy audit_select_super). Jamais les métadonnées (motifs, références).
  if v_super then
    v_actions := jsonb_build_object(
      'visible', true,
      'total_30j', (select count(*) from public.audit_logs l where l.created_at >= now() - interval '30 days'),
      'par_action_30j', (select coalesce(jsonb_object_agg(x.action, x.n), '{}'::jsonb)
                           from (select l.action, count(*) as n from public.audit_logs l
                                  where l.created_at >= now() - interval '30 days' group by l.action) x),
      'dernieres', (select coalesce(jsonb_agg(jsonb_build_object(
                             'at', x.created_at, 'action', x.action, 'ressource', x.resource_type,
                             'acteur', x.actor_id, 'compte', x.target_user_id) order by x.created_at desc), '[]'::jsonb)
                      from (select l.created_at, l.action, l.resource_type, l.actor_id, l.target_user_id
                              from public.audit_logs l order by l.created_at desc limit 30) x));
  else
    v_actions := jsonb_build_object('visible', false);
  end if;

  return jsonb_build_object(
    'version', 1,
    'genere_le', now(),
    'moteur', jsonb_build_object(
      'installe', v_has_jobs,
      'en_pause', v_paused_at is not null,
      'en_pause_depuis', v_paused_at),
    'file', v_jobs,
    'traitements_mois', v_traitements,
    'emails_entrants', v_emails,
    'abonnements', v_abonnements,
    'budget', jsonb_build_object(
      'cout_global_mois_cents', v_cout_global,
      'repere_alerte_cents', v_repere,
      'repere_pct', case when v_repere is not null then round(100.0 * v_cout_global / v_repere, 1) end),
    'stockage', v_stockage,
    'comptes_total', v_total,
    'comptes', v_comptes,
    'alertes', v_alertes,
    'actions_admin', v_actions);
end;
$$;
revoke execute on function public.admin_supervision_overview() from public, anon;
grant execute on function public.admin_supervision_overview() to authenticated;
