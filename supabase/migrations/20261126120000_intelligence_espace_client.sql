-- ClairDossier Intelligence dans l'espace client ORIGINAL (Supabase) — un seul produit pour le site et l'application.
-- Additif. Apporte à Supabase ce qui n'existait que sur le serveur de recette :
--   1. historique privé de l'assistant, par dossier ;
--   2. préférences de travail du titulaire (mémoire corrigeable, 12 au plus) ;
--   3. automatisations confirmées par le titulaire, exécutées PAR LA BASE (pg_cron → fonction SQL),
--      navigateur fermé, sans secret ni appel réseau, idempotentes (une preuve par échéance) ;
--   4. notifications internes (boîte de l'espace client), sans doublon.
-- Droits : titulaire du dossier seulement ; abonnement actif exigé à la création, à la reprise et à chaque exécution
-- (même règle que enable_ai_processing). Écritures sensibles uniquement par fonctions SECURITY DEFINER.
-- Dépend de : 20260915120000 (dossier_deadlines), 20260917120000 (dossier_entitlement). Aucune dépendance au moteur IA.
-- Retour arrière : supabase/rollback/20261126120000_intelligence_espace_client.down.sql

-- ── 1. Historique de l'assistant ───────────────────────────────────────────────
create table if not exists public.assistant_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  author text not null check (author in ('vous', 'ia')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists assistant_turns_dossier_idx on public.assistant_turns (dossier_id, created_at);
alter table public.assistant_turns enable row level security;
drop policy if exists "assistant_turns_select_own" on public.assistant_turns;
create policy "assistant_turns_select_own" on public.assistant_turns for select using (auth.uid() = user_id);
drop policy if exists "assistant_turns_insert_own" on public.assistant_turns;
create policy "assistant_turns_insert_own" on public.assistant_turns for insert with check (
  auth.uid() = user_id and exists (select 1 from public.dossiers d where d.id = dossier_id and d.user_id = auth.uid())
);
drop policy if exists "assistant_turns_delete_own" on public.assistant_turns;
create policy "assistant_turns_delete_own" on public.assistant_turns for delete using (auth.uid() = user_id);

-- ── 2. Préférences de travail (mémoire professionnelle privée) ────────────────
create table if not exists public.assistant_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200 and body !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now()
);
create unique index if not exists assistant_preferences_unique on public.assistant_preferences (user_id, lower(body));
alter table public.assistant_preferences enable row level security;
drop policy if exists "assistant_preferences_select_own" on public.assistant_preferences;
create policy "assistant_preferences_select_own" on public.assistant_preferences for select using (auth.uid() = user_id);
drop policy if exists "assistant_preferences_insert_own" on public.assistant_preferences;
create policy "assistant_preferences_insert_own" on public.assistant_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "assistant_preferences_delete_own" on public.assistant_preferences;
create policy "assistant_preferences_delete_own" on public.assistant_preferences for delete using (auth.uid() = user_id);

create or replace function public.assistant_preferences_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.assistant_preferences where user_id = new.user_id) >= 12 then
    raise exception 'PREFERENCES_PLEINES';
  end if;
  return new;
end $$;
drop trigger if exists assistant_preferences_limit on public.assistant_preferences;
create trigger assistant_preferences_limit before insert on public.assistant_preferences for each row execute function public.assistant_preferences_limit();

-- ── 3. Notifications internes ──────────────────────────────────────────────────
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bilan', 'echeance')),
  title text not null,
  body text not null,
  link text not null default '/compte',
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, dedupe_key)
);
create index if not exists client_notifications_user_idx on public.client_notifications (user_id, created_at desc);
alter table public.client_notifications enable row level security;
drop policy if exists "client_notifications_select_own" on public.client_notifications;
create policy "client_notifications_select_own" on public.client_notifications for select using (auth.uid() = user_id);

create or replace function public.mark_client_notifications_read() returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.client_notifications set read_at = now() where user_id = auth.uid() and read_at is null;
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function public.mark_client_notifications_read() from public, anon;
grant execute on function public.mark_client_notifications_read() to authenticated;

-- ── 4. Automatisations ─────────────────────────────────────────────────────────
create table if not exists public.client_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('bilan_dossiers', 'prevenir_echeances')),
  frequence text not null check (frequence in ('hebdo', 'quotidien', 'mensuel', 'piece')),
  jour smallint check (jour between 1 and 7), -- 1 = lundi (ISO)
  heure smallint not null default 8 check (heure between 0 and 23),
  title text not null,
  status text not null default 'active' check (status in ('active', 'suspendue', 'annulee', 'arretee')),
  motif text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  runs integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, action, frequence, jour, heure)
);
create index if not exists client_automations_due_idx on public.client_automations (next_run_at) where status = 'active';
alter table public.client_automations enable row level security;
drop policy if exists "client_automations_select_own" on public.client_automations;
create policy "client_automations_select_own" on public.client_automations for select using (auth.uid() = user_id);

create table if not exists public.client_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.client_automations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  due timestamptz not null,
  status text not null check (status in ('faite', 'rien_a_signaler', 'refusee')),
  resume text not null,
  counters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (automation_id, due)
);
alter table public.client_automation_runs enable row level security;
drop policy if exists "client_automation_runs_select_own" on public.client_automation_runs;
create policy "client_automation_runs_select_own" on public.client_automation_runs for select using (auth.uid() = user_id);

-- Dossier clos : même règle que dossier_is_closed (moteur IA), redéfinie ici pour ne pas dépendre du moteur.
create or replace function public.client_dossier_closed(p_dossier uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select e.type = 'dossier_cloture' from public.dossier_events e
      where e.dossier_id = p_dossier and e.type in ('dossier_cloture', 'dossier_rouvert')
      order by e.created_at desc limit 1),
    (select d.status = 'archive' from public.dossiers d where d.id = p_dossier),
    false)
$$;
revoke all on function public.client_dossier_closed(uuid) from public, anon, authenticated;

-- Abonnement actif : même règle que l'activation du moteur IA.
create or replace function public.client_subscription_active(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dossier_entitlement(p_user) e
    where e.blocked_reason is null and (coalesce(e.subscription_status, '') in ('active', 'trialing') or e.override_mode is not null)
  );
$$;
revoke all on function public.client_subscription_active(uuid) from public, anon, authenticated;

-- Prochaine échéance d'une planification, à l'heure de Paris (changements d'heure gérés par le fuseau).
create or replace function public.client_automation_next(p_frequence text, p_jour integer, p_heure integer, p_after timestamptz)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_local timestamp := p_after at time zone 'Europe/Paris';
  v_day date := v_local::date;
  v_cand timestamp;
begin
  if p_frequence = 'piece' then return null; end if;
  for i in 0..62 loop
    v_cand := (v_day + i) + make_time(p_heure, 0, 0);
    if v_cand > v_local
       and (p_frequence = 'quotidien'
            or (p_frequence = 'hebdo' and extract(isodow from v_day + i) = p_jour)
            or (p_frequence = 'mensuel' and extract(day from v_day + i) = 1)) then
      return v_cand at time zone 'Europe/Paris';
    end if;
  end loop;
  return null;
end $$;

-- Création après confirmation du titulaire (assistant ou liste). Rejouable : même demande = même automatisation.
create or replace function public.create_client_automation(p_action text, p_frequence text, p_jour smallint default null, p_heure smallint default 8)
returns public.client_automations language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row public.client_automations;
  v_title text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.client_subscription_active(v_user) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  if p_action not in ('bilan_dossiers', 'prevenir_echeances') then raise exception 'ACTION_INCONNUE'; end if;
  if p_frequence not in ('hebdo', 'quotidien', 'mensuel', 'piece') then raise exception 'FREQUENCE_INCONNUE'; end if;
  if p_frequence = 'hebdo' and p_jour is null then raise exception 'JOUR_REQUIS'; end if;
  if p_frequence <> 'hebdo' then p_jour := null; end if;
  if (select count(*) from public.client_automations where user_id = v_user and status = 'active') >= 10 then raise exception 'TROP_D_AUTOMATISATIONS'; end if;
  v_title := case p_action when 'bilan_dossiers' then 'Bilan de vos dossiers' else 'Alerte avant vos échéances' end;
  insert into public.client_automations (user_id, action, frequence, jour, heure, title, next_run_at)
  values (v_user, p_action, p_frequence, p_jour, coalesce(p_heure, 8), v_title, public.client_automation_next(p_frequence, p_jour, coalesce(p_heure, 8), now()))
  on conflict (user_id, action, frequence, jour, heure) do update
    set status = 'active', motif = null,
        next_run_at = coalesce(public.client_automations.next_run_at, excluded.next_run_at)
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.create_client_automation(text, text, smallint, smallint) from public, anon;
grant execute on function public.create_client_automation(text, text, smallint, smallint) to authenticated;

create or replace function public.set_client_automation_status(p_id uuid, p_op text)
returns public.client_automations language plpgsql security definer set search_path = public as $$
declare
  v_row public.client_automations;
begin
  select * into v_row from public.client_automations where id = p_id and user_id = auth.uid();
  if v_row.id is null then raise exception 'AUTOMATISATION_INTROUVABLE'; end if; -- celle d'un autre compte aussi
  if p_op = 'suspendre' then
    update public.client_automations set status = 'suspendue' where id = p_id returning * into v_row;
  elsif p_op = 'reprendre' then
    if not public.client_subscription_active(auth.uid()) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
    update public.client_automations set status = 'active', motif = null,
      next_run_at = public.client_automation_next(frequence, jour, heure, now()) where id = p_id returning * into v_row;
  elsif p_op = 'annuler' then
    update public.client_automations set status = 'annulee', next_run_at = null where id = p_id returning * into v_row;
  else
    raise exception 'OPERATION_INCONNUE';
  end if;
  return v_row;
end $$;
revoke all on function public.set_client_automation_status(uuid, text) from public, anon;
grant execute on function public.set_client_automation_status(uuid, text) to authenticated;

-- « À chaque pièce reçue » : une pièce déposée rend l'automatisation due au prochain passage.
create or replace function public.client_automation_on_document() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.client_automations set next_run_at = coalesce(next_run_at, now())
   where user_id = new.user_id and frequence = 'piece' and status = 'active';
  return new;
end $$;
drop trigger if exists client_automation_on_document on public.dossier_documents;
create trigger client_automation_on_document after insert on public.dossier_documents for each row execute function public.client_automation_on_document();

-- Exécution : appelée par pg_cron (chaque heure). Bornée, idempotente (preuve unique par échéance), sans appel réseau.
create or replace function public.run_client_automations(p_now timestamptz default now(), p_max integer default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.client_automations;
  v_today date := (p_now at time zone 'Europe/Paris')::date;
  v_inserted integer;
  v_n integer;
  v_docs integer;
  v_dossiers integer;
  v_status text;
  v_resume text;
  v_done integer := 0;
  v_skipped integer := 0;
  r record;
begin
  for a in
    select * from public.client_automations
     where status = 'active' and next_run_at is not null and next_run_at <= p_now
     order by next_run_at limit p_max
     for update skip locked
  loop
    -- Une seule exécution par échéance, même si deux passages se chevauchent.
    insert into public.client_automation_runs (automation_id, user_id, due, status, resume)
    values (a.id, a.user_id, a.next_run_at, 'faite', 'en cours')
    on conflict (automation_id, due) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then v_skipped := v_skipped + 1; continue; end if;

    if not public.client_subscription_active(a.user_id) then
      update public.client_automation_runs set status = 'refusee', resume = 'Abonnement inactif : automatisation arrêtée.' where automation_id = a.id and due = a.next_run_at;
      update public.client_automations set status = 'arretee', motif = 'Abonnement inactif', next_run_at = null where id = a.id;
      continue;
    end if;

    if a.action = 'prevenir_echeances' then
      v_n := 0;
      for r in
        select dl.id, dl.title, dl.due_date, d.id as dossier_id, (dl.due_date - v_today) as jours
          from public.dossier_deadlines dl join public.dossiers d on d.id = dl.dossier_id
         where d.user_id = a.user_id and dl.done = false and not public.client_dossier_closed(d.id)
           and dl.due_date between v_today and v_today + 30
      loop
        insert into public.client_notifications (user_id, kind, title, body, link, dedupe_key)
        values (a.user_id, 'echeance',
                case when r.jours = 0 then 'Échéance aujourd’hui' when r.jours = 1 then 'Échéance demain' else format('Échéance dans %s jours', r.jours) end,
                format('%s — %s.', r.title, to_char(r.due_date, 'DD/MM/YYYY')),
                '/compte/dossier/' || r.dossier_id,
                format('ech:%s:%s', r.id, case when r.jours <= 1 then 1 when r.jours <= 7 then 7 else 30 end))
        on conflict (user_id, dedupe_key) do nothing;
        get diagnostics v_inserted = row_count;
        v_n := v_n + v_inserted;
      end loop;
      v_status := case when v_n > 0 then 'faite' else 'rien_a_signaler' end;
      v_resume := case when v_n > 0 then format('%s échéance(s) signalée(s).', v_n) else 'Aucune nouvelle échéance dans les 30 jours.' end;
      update public.client_automation_runs set status = v_status, resume = v_resume, counters = jsonb_build_object('alertes', v_n) where automation_id = a.id and due = a.next_run_at;
    else
      select count(*) into v_dossiers from public.dossiers d where d.user_id = a.user_id and not public.client_dossier_closed(d.id);
      select count(*) into v_docs from public.dossier_documents x where x.user_id = a.user_id and x.created_at > coalesce(a.last_run_at, a.created_at);
      v_resume := format('%s dossier(s) en cours, %s pièce(s) reçue(s) depuis le dernier bilan.', v_dossiers, v_docs);
      insert into public.client_notifications (user_id, kind, title, body, link, dedupe_key)
      values (a.user_id, 'bilan', 'Bilan de vos dossiers', v_resume, '/compte', format('bilan:%s:%s', a.id, a.next_run_at))
      on conflict (user_id, dedupe_key) do nothing;
      update public.client_automation_runs set status = 'faite', resume = v_resume, counters = jsonb_build_object('dossiers', v_dossiers, 'pieces', v_docs) where automation_id = a.id and due = a.next_run_at;
    end if;

    update public.client_automations
       set runs = runs + 1, last_run_at = p_now,
           next_run_at = public.client_automation_next(frequence, jour, heure, greatest(p_now, a.next_run_at))
     where id = a.id;
    v_done := v_done + 1;
  end loop;
  return jsonb_build_object('executees', v_done, 'ignorees', v_skipped, 'at', p_now);
end $$;
revoke all on function public.run_client_automations(timestamptz, integer) from public, anon, authenticated;

-- Planification : chaque heure à la minute 7, si pg_cron est disponible (Supabase). Sinon rien (tests, local).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'clairdossier-automatisations';
    perform cron.schedule('clairdossier-automatisations', '7 * * * *', 'select public.run_client_automations()');
  end if;
end $$;
