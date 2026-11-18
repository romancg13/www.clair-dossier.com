-- Quotas IA par offre — configuration serveur UNIQUE (interface, API, jobs).
-- Additive et idempotente. PROPOSITION DE RECETTE (2026-11-18) : le moteur IA
-- étant désactivé en production, ces plafonds n'ont d'effet qu'en recette ;
-- aucun droit acquis retiré (les comptes sans abonnement gardent dépôt et
-- export : le moteur leur est déjà inaccessible), aucune publication
-- commerciale automatique (src/data/pricing.ts inchangé).
--
-- Définitions (détail et chiffres à valider : docs/recette/QUOTAS_IA.md) :
--   page IA     : page lue d'une pièce lors d'une extraction réussie — PDF =
--                 pages réelles, image = 1, texte/DOCX/XLSX/CSV = 1 par pièce.
--                 Le résumé initial (consolidation) est compris : il ne
--                 consomme aucune page supplémentaire.
--   action IA   : question posée sur un dossier ou brouillon complémentaire
--                 demandé hors analyse initiale — journalisée dans
--                 ai_action_events par les fonctionnalités qui l'offriront.
--   renouvellement : mensuel calendaire (date_trunc('month')), y compris en
--                 facturation annuelle. Réanalyse d'une pièce : remplace
--                 l'extraction (jamais de double décompte le même mois),
--                 compte dans le mois où la pièce est relue.
--   plafond atteint : suspension des NOUVEAUX traitements seulement (état
--                 « pause », préfixe BUDGET: existant — travail non retenté) ;
--                 données, résultats et exports conservés ; aucune
--                 facturation supplémentaire.
--   « dossiers illimités » ne signifie jamais consommation illimitée : les
--                 offres Pro/Premium restent plafonnées en pages et actions.

-- ── 1. Plafonds par offre ────────────────────────────────────────────────────
-- null = non plafonné à CE niveau. L'offre personnalisée (contractuelle) et
-- les dérogations se règlent par entitlement_overrides, jamais ici.
alter table public.plan_entitlements
  add column if not exists ai_pages_month integer
    check (ai_pages_month is null or ai_pages_month >= 0),
  add column if not exists ai_actions_month integer
    check (ai_actions_month is null or ai_actions_month >= 0);
comment on column public.plan_entitlements.ai_pages_month is
  'Pages IA incluses par mois calendaire (null = non plafonné à ce niveau).';
comment on column public.plan_entitlements.ai_actions_month is
  'Actions IA (questions, brouillons complémentaires) par mois calendaire.';

-- Valeurs proposées (grille de recette) — jamais réécrites si le propriétaire
-- les a déjà ajustées (mise à jour uniquement quand les deux sont null).
update public.plan_entitlements p
   set ai_pages_month = v.pages, ai_actions_month = v.actions
  from (values
    ('essentiel',            50,    0),
    ('entrepreneur',         150,   20),
    ('business-pme-20',      300,   50),
    ('business-pme-50',      800,   150),
    ('business-pme-pro',     2000,  400),
    ('business-pme-premium', 5000,  1000))
    as v(plan_id, pages, actions)
 where p.plan_id = v.plan_id
   and p.ai_pages_month is null
   and p.ai_actions_month is null;

-- Dérogations par compte (offre personnalisée, recette) : champ null = la
-- valeur de l'offre s'applique.
alter table public.entitlement_overrides
  add column if not exists ai_pages_month integer
    check (ai_pages_month is null or ai_pages_month >= 0),
  add column if not exists ai_actions_month integer
    check (ai_actions_month is null or ai_actions_month >= 0);

-- ── 2. Journal des actions IA ────────────────────────────────────────────────
-- Écrit par les fonctionnalités serveur concernées (service_role) ; aucun
-- contenu de dossier, chiffres seulement. Lecture : titulaire + administration.
create table if not exists public.ai_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dossier_id uuid references public.dossiers (id) on delete set null,
  kind text not null check (kind in ('question', 'brouillon')),
  created_at timestamptz not null default now()
);
create index if not exists ai_action_events_user_month_idx
  on public.ai_action_events (user_id, created_at);
alter table public.ai_action_events enable row level security;
drop policy if exists "ai_action_events_select_own" on public.ai_action_events;
create policy "ai_action_events_select_own" on public.ai_action_events
  for select using (user_id = auth.uid() or coalesce(public.is_admin(), false));
-- Aucune policy insert/update/delete : écriture réservée au rôle serveur.

-- ── 3. État des quotas d'un compte ───────────────────────────────────────────
-- Limites effectives (dérogation active, sinon offre de l'abonnement courant —
-- même résolution d'abonnement que dossier_entitlement) + consommé du mois.
create or replace function public.ai_quota_state(p_user uuid)
returns table (
  pages_limit integer,
  actions_limit integer,
  pages_used integer,
  actions_used integer,
  plan_id text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ov_pages integer;
  v_ov_actions integer;
  v_plan_pages integer;
  v_plan_actions integer;
begin
  plan_id := null;

  select o.ai_pages_month, o.ai_actions_month
    into v_ov_pages, v_ov_actions
    from public.entitlement_overrides o
   where o.user_id = p_user
     and o.active
     and o.revoked_at is null
     and o.starts_at <= now()
     and (o.expires_at is null or o.expires_at > now())
     and (o.ai_pages_month is not null or o.ai_actions_month is not null)
   order by o.created_at desc
   limit 1;

  select pe.ai_pages_month, pe.ai_actions_month, s.plan_id
    into v_plan_pages, v_plan_actions, plan_id
    from public.subscriptions s
    left join public.plan_entitlements pe on pe.plan_id = s.plan_id
   where s.user_id = p_user
     and (s.status in ('active', 'trialing', 'past_due')
          or (s.status = 'canceled' and s.current_period_end > now()))
   order by s.current_period_end desc nulls last, s.updated_at desc
   limit 1;

  pages_limit := coalesce(v_ov_pages, v_plan_pages);
  actions_limit := coalesce(v_ov_actions, v_plan_actions);

  pages_used := coalesce((
    select sum(greatest(coalesce(e.pages, 1), 1))::integer
      from public.ai_extractions e
     where e.user_id = p_user
       and e.status = 'ok'
       and e.created_at >= date_trunc('month', now())), 0);
  actions_used := coalesce((
    select count(*)::integer
      from public.ai_action_events a
     where a.user_id = p_user
       and a.created_at >= date_trunc('month', now())), 0);

  return next;
end;
$$;
revoke execute on function public.ai_quota_state(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_state(uuid) to service_role;

-- Lecture d'une pièce de p_pages couverte par l'offre ? Appelée par ai-worker
-- avec le nombre RÉEL de pages, avant tout appel au modèle (rien n'est
-- consommé en cas de refus : aucune extraction n'est créée).
create or replace function public.ai_quota_allows_pages(p_user uuid, p_pages integer)
returns boolean
language sql stable security definer set search_path = public as $$
  select q.pages_limit is null
      or q.pages_used + greatest(coalesce(p_pages, 1), 1) <= q.pages_limit
    from public.ai_quota_state(p_user) q
$$;
revoke execute on function public.ai_quota_allows_pages(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_quota_allows_pages(uuid, integer) to service_role;

-- Action (question / brouillon complémentaire) couverte puis journalisée, en
-- un seul appel (jamais de décompte sans journal, ni l'inverse). false =
-- plafond atteint, rien n'est écrit.
create or replace function public.ai_consume_action(p_user uuid, p_dossier uuid, p_kind text)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_state record;
begin
  -- Un compte à la fois : sérialise les décomptes concurrents du même compte.
  perform pg_advisory_xact_lock(hashtext('ai_actions'), hashtext(p_user::text));
  select * into v_state from public.ai_quota_state(p_user);
  if v_state.actions_limit is not null and v_state.actions_used + 1 > v_state.actions_limit then
    return false;
  end if;
  insert into public.ai_action_events (user_id, dossier_id, kind) values (p_user, p_dossier, p_kind);
  return true;
end;
$$;
revoke execute on function public.ai_consume_action(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ai_consume_action(uuid, uuid, text) to service_role;

-- ── 4. Affichage « usage restant » (titulaire) ───────────────────────────────
create or replace function public.get_my_ai_quota()
returns table (
  pages_limit integer,
  actions_limit integer,
  pages_used integer,
  actions_used integer,
  plan_id text
)
language sql stable security definer set search_path = public as $$
  select * from public.ai_quota_state(auth.uid())
$$;
revoke execute on function public.get_my_ai_quota() from public, anon;
grant execute on function public.get_my_ai_quota() to authenticated;
