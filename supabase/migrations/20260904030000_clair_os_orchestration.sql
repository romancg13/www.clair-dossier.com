-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 13 du plan de build : CLAIR-OS — orchestration
-- (PARTIE 4.2 « comprendre l'intention, planifier, router, contrôler
-- l'avancement, croiser les résultats, détecter les incohérences inter-agents,
-- consolider », 4.3 « l'utilisateur ne choisit jamais un agent », 5.2 E9,
-- 7.4 file de travaux / budget / coupe-circuit, 11 budgets, 12.3 formulation
-- des états ; D-014).
--
-- Additive et rejouable.
--   * orchestrations : une demande de l'utilisateur (« organise », « où en est
--     le dossier ? »…) ou un passage automatique (autopilot : dernière pièce
--     terminée) → plan, intention, statut, exécution CLAIR-OS qui l'a consolidée ;
--   * demander_orchestration() : seule porte d'entrée du client — il formule une
--     demande, jamais un agent ; membre du tenant seulement ; journalisée sans
--     contenu ;
--   * mise en file « clair_os » (portée dossier) quand la dernière pièce active
--     atteint un statut terminal ;
--   * budgets_tokens par plan (NULL = aucun plafond tant qu'un humain n'a pas
--     décidé) et budget_dossier() : coupe-circuit lu par l'exécutant ;
--   * etat_dossier() : état d'avancement lisible par le propriétaire (12.3).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Orchestrations ───────────────────────────────────────────────────────
create table if not exists public.orchestrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  trace_id uuid not null default gen_random_uuid(),
  source text not null default 'utilisateur' check (source in ('utilisateur', 'autopilot')),
  demande text,
  intention text,
  statut text not null default 'planifiee'
    check (statut in ('planifiee', 'en_cours', 'terminee', 'bloquee', 'echec')),
  escalade text check (escalade is null or escalade in ('E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9')),
  plan jsonb not null default '[]'::jsonb,
  resume jsonb not null default '{}'::jsonb,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  cree_par uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists orchestrations_dossier_idx on public.orchestrations (dossier_id, created_at desc);
create index if not exists orchestrations_attente_idx on public.orchestrations (dossier_id) where statut in ('planifiee', 'en_cours');
drop trigger if exists orchestrations_touch on public.orchestrations;
create trigger orchestrations_touch before update on public.orchestrations
  for each row execute function public.touch_updated_at();

alter table public.orchestrations enable row level security;
drop policy if exists "orchestrations_select_tenant" on public.orchestrations;
create policy "orchestrations_select_tenant" on public.orchestrations for select using (public.is_tenant_member(tenant_id));
drop policy if exists "orchestrations_select_admin" on public.orchestrations;
create policy "orchestrations_select_admin" on public.orchestrations for select using (public.is_admin());
revoke insert, update, delete on public.orchestrations from anon, authenticated;

-- ── 2. File de travaux : portée dossier ─────────────────────────────────────
-- Un dossier n'a jamais deux travaux actifs du même type sans pièce (consolidation).
create unique index if not exists travaux_actif_dossier_unique_idx on public.travaux (type, dossier_id)
  where document_id is null and dossier_id is not null and statut in ('en_attente', 'en_cours');

-- Variante interne (sans garde d'appel client) : appelée par les fonctions
-- SECURITY DEFINER qui ont elles-mêmes vérifié le droit de l'appelant.
create or replace function public.planifier_travail_interne(
  p_type text,
  p_tenant_id uuid,
  p_dossier_id uuid default null,
  p_document_id uuid default null,
  p_charge jsonb default '{}'::jsonb,
  p_priorite integer default 5
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_document_id is null and p_dossier_id is not null then
    select id into v_id from public.travaux
     where type = p_type and dossier_id = p_dossier_id and document_id is null and statut in ('en_attente', 'en_cours')
     order by id desc limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;
  insert into public.travaux (type, tenant_id, dossier_id, document_id, charge, priorite)
  values (p_type, p_tenant_id, p_dossier_id, p_document_id, coalesce(p_charge, '{}'::jsonb), coalesce(p_priorite, 5))
  on conflict (type, document_id) where document_id is not null and statut in ('en_attente', 'en_cours') do nothing
  returning id into v_id;
  if v_id is null and p_document_id is not null then
    select id into v_id from public.travaux
     where type = p_type and document_id = p_document_id and statut in ('en_attente', 'en_cours')
     order by id desc limit 1;
  end if;
  return v_id;
end;
$$;
revoke all on function public.planifier_travail_interne(text, uuid, uuid, uuid, jsonb, integer) from public, anon, authenticated;

create or replace function public.planifier_travail(
  p_type text,
  p_tenant_id uuid,
  p_dossier_id uuid default null,
  p_document_id uuid default null,
  p_charge jsonb default '{}'::jsonb,
  p_priorite integer default 5
) returns bigint language plpgsql security definer set search_path = public as $$
begin
  if public.est_appel_client() and pg_trigger_depth() = 0 then
    raise exception 'SERVEUR_UNIQUEMENT: planifier_travail est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  return public.planifier_travail_interne(p_type, p_tenant_id, p_dossier_id, p_document_id, p_charge, p_priorite);
end;
$$;
revoke all on function public.planifier_travail(text, uuid, uuid, uuid, jsonb, integer) from public, anon, authenticated;

-- ── 3. Demande de l'utilisateur : il formule, CLAIR-OS route (4.3) ──────────
create or replace function public.demander_orchestration(p_dossier_id uuid, p_demande text)
returns uuid language plpgsql security definer set search_path = public as $$
declare d public.dossiers%rowtype; v_id uuid; v_demande text := left(btrim(coalesce(p_demande, '')), 2000);
begin
  if public.est_appel_client() and auth.uid() is null then
    raise exception 'AUTHENTIFICATION_REQUISE: connectez-vous pour formuler une demande' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.dossiers where id = p_dossier_id;
  if not found or (auth.uid() is not null and not (public.is_tenant_member(d.tenant_id) or public.is_admin())) then
    raise exception 'DOSSIER_INTERDIT: dossier inconnu ou hors de vos tenants' using errcode = 'insufficient_privilege';
  end if;
  if v_demande = '' then
    raise exception 'DEMANDE_VIDE: formulez votre demande en quelques mots' using errcode = 'check_violation';
  end if;
  insert into public.orchestrations (tenant_id, dossier_id, source, demande, statut, cree_par)
  values (d.tenant_id, d.id, 'utilisateur', v_demande, 'planifiee', auth.uid())
  returning id into v_id;
  perform public.planifier_travail_interne('clair_os', d.tenant_id, d.id, null,
    jsonb_build_object('source', 'utilisateur', 'orchestration_id', v_id), 4);
  -- Journal : longueur de la demande seulement, jamais son contenu (PARTIE 11).
  perform public.journaliser('orchestration.demandee', 'orchestration', v_id, d.tenant_id, d.id,
    null, jsonb_build_object('longueur_demande', length(v_demande)), null, null);
  return v_id;
end;
$$;
revoke all on function public.demander_orchestration(uuid, text) from public, anon;
grant execute on function public.demander_orchestration(uuid, text) to authenticated;

-- Écriture du résultat par CLAIR-OS (serveur uniquement).
create or replace function public.enregistrer_orchestration(
  p_id uuid,
  p_statut text,
  p_intention text,
  p_plan jsonb,
  p_agent_run_id uuid default null,
  p_escalade text default null,
  p_resume jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare o public.orchestrations%rowtype;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_orchestration est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into o from public.orchestrations where id = p_id for update;
  if not found then
    raise exception 'ORCHESTRATION_INCONNUE: %', p_id using errcode = 'no_data_found';
  end if;
  update public.orchestrations
     set statut = p_statut, intention = coalesce(p_intention, intention), plan = coalesce(p_plan, plan),
         agent_run_id = coalesce(p_agent_run_id, agent_run_id), escalade = p_escalade, resume = coalesce(p_resume, resume),
         finished_at = case when p_statut in ('terminee', 'bloquee', 'echec') then now() else finished_at end
   where id = p_id;
  perform public.journaliser('orchestration.' || p_statut, 'orchestration', o.id, o.tenant_id, o.dossier_id,
    null, jsonb_build_object('source', o.source, 'intention', p_intention, 'escalade', p_escalade, 'agent_run_id', p_agent_run_id,
                             'nb_etapes', coalesce(jsonb_array_length(p_plan), 0)),
    'agent', o.trace_id);
end;
$$;
revoke all on function public.enregistrer_orchestration(uuid, text, text, jsonb, uuid, text, jsonb) from public, anon, authenticated;

-- ── 4. Autopilot : consolidation dès que la dernière pièce active est terminée ─
create or replace function public.dossier_documents_planifier_clair_os()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if new.kind = 'piece'
     and new.statut_ingestion in ('termine', 'doublon', 'qualite_insuffisante', 'echec')
     and old.statut_ingestion is distinct from new.statut_ingestion
     and not exists (
       select 1 from public.dossier_documents x
        where x.dossier_id = new.dossier_id and x.id <> new.id and x.kind = 'piece' and x.supprime_le is null
          and x.statut_ingestion not in ('termine', 'doublon', 'qualite_insuffisante', 'echec')) then
    insert into public.orchestrations (tenant_id, dossier_id, source, demande, intention, statut)
    values (new.tenant_id, new.dossier_id, 'autopilot', null, 'organiser', 'planifiee')
    returning id into v_id;
    perform public.planifier_travail_interne('clair_os', new.tenant_id, new.dossier_id, null,
      jsonb_build_object('source', 'autopilot', 'orchestration_id', v_id), 6);
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_documents_planifier_clair_os on public.dossier_documents;
create trigger dossier_documents_planifier_clair_os after update of statut_ingestion on public.dossier_documents
  for each row execute function public.dossier_documents_planifier_clair_os();

create or replace function public.travaux_reveiller_executant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('ingestion', 'indexation', 'veritas', 'atlas', 'clair_os') then
    perform net.http_post(
      url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/ingest-document',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U'
      ),
      body := jsonb_build_object('source', 'travaux', 'travail_id', new.id, 'type', new.type)
    );
  end if;
  return new;
end;
$$;

-- ── 5. Budgets de tokens et coupe-circuit (7.4, 11) ─────────────────────────
-- Plafonds par plan : NULL = aucun plafond tant qu'un humain n'a pas fixé les
-- budgets (décision commerciale). Le plafond est lu côté serveur seulement (I7).
create table if not exists public.budgets_tokens (
  plan text primary key,
  tokens_par_dossier integer check (tokens_par_dossier is null or tokens_par_dossier > 0),
  tokens_par_execution integer check (tokens_par_execution is null or tokens_par_execution > 0),
  motif text,
  updated_at timestamptz not null default now()
);
insert into public.budgets_tokens (plan, tokens_par_dossier, tokens_par_execution, motif)
values ('*', null, null, 'valeur par défaut : aucun plafond tant qu''un humain n''a pas fixé les budgets')
on conflict (plan) do nothing;
insert into public.budgets_tokens (plan, tokens_par_dossier, tokens_par_execution, motif)
select distinct plan, null::integer, null::integer, 'plafond à fixer (décision commerciale)' from public.tenants where plan is not null
on conflict (plan) do nothing;
alter table public.budgets_tokens enable row level security;
revoke all on public.budgets_tokens from anon, authenticated;

create or replace function public.budget_dossier(p_dossier_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare v_plan text; v_budget integer; v_consomme bigint;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: budget_dossier est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select t.plan into v_plan from public.dossiers d join public.tenants t on t.id = d.tenant_id where d.id = p_dossier_id;
  select coalesce(b.tokens_par_dossier, bd.tokens_par_dossier) into v_budget
    from (select 1) x
    left join public.budgets_tokens b on b.plan = v_plan
    left join public.budgets_tokens bd on bd.plan = '*';
  select coalesce(sum(coalesce(tokens_entree, 0) + coalesce(tokens_sortie, 0)), 0) into v_consomme
    from public.agent_runs where dossier_id = p_dossier_id;
  return jsonb_build_object('plan', v_plan, 'budget_tokens_par_dossier', v_budget, 'consomme', v_consomme,
                            'depasse', v_budget is not null and v_consomme >= v_budget);
end;
$$;
revoke all on function public.budget_dossier(uuid) from public, anon, authenticated;

-- ── 6. État d'avancement lisible par le propriétaire (12.3) ─────────────────
-- SECURITY INVOKER : la RLS du lecteur s'applique ; null si le dossier n'est pas visible.
create or replace function public.etat_dossier(p_dossier_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'dossier_id', d.id,
    'pieces', (select jsonb_build_object(
                 'total', coalesce(sum(n), 0),
                 'terminees', coalesce(sum(n) filter (where statut_ingestion in ('termine', 'doublon', 'qualite_insuffisante', 'echec')), 0),
                 'par_statut', coalesce(jsonb_object_agg(statut_ingestion, n) filter (where statut_ingestion is not null), '{}'::jsonb))
                 from (select statut_ingestion, count(*) as n from public.dossier_documents
                        where dossier_id = d.id and kind = 'piece' and supprime_le is null group by statut_ingestion) s),
    'entites', (select count(*) from public.entites where dossier_id = d.id),
    'evenements', (select count(*) from public.evenements where dossier_id = d.id),
    'derniere_orchestration', (select to_jsonb(o) - 'plan' from public.orchestrations o where o.dossier_id = d.id order by o.created_at desc limit 1)
  )
  from public.dossiers d where d.id = p_dossier_id;
$$;
revoke all on function public.etat_dossier(uuid) from public, anon;
grant execute on function public.etat_dossier(uuid) to authenticated;
