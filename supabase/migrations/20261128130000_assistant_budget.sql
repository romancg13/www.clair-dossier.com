-- ClairDossier Intelligence avec modèle (fonction Edge « assistant ») : comptabilité en base.
-- Additive et rejouable. Montants en micro-USD (1 USD = 1 000 000). Aucun contenu de dossier stocké.
--   * assistant_pots : réservé + dépensé par mois, global (user_id null) et par compte ;
--   * assistant_reserve : réserve le coût MAXIMAL d'un appel sous verrou (global puis compte) ;
--   * assistant_settle : libère la réservation et comptabilise le coût réel ;
--   * assistant_usage : journal par appel (modèle, jetons, coût, durée, statut) — lecture titulaire / admin.
-- Les RPC sont réservées au rôle service (fonction Edge) : aucun client ne peut réserver ni écrire.

create table if not exists public.assistant_pots (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  user_id uuid references auth.users (id) on delete cascade,
  reserved_micro bigint not null default 0 check (reserved_micro >= 0),
  spent_micro bigint not null default 0 check (spent_micro >= 0),
  updated_at timestamptz not null default now()
);
create unique index if not exists assistant_pots_scope_idx
  on public.assistant_pots (month, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.assistant_pots enable row level security;
drop policy if exists "assistant_pots_select" on public.assistant_pots;
create policy "assistant_pots_select" on public.assistant_pots
  for select using (public.is_admin() or (user_id is not null and auth.uid() = user_id));

create table if not exists public.assistant_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dossier_id uuid references public.dossiers (id) on delete set null,
  feature text not null default 'assistant',
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  estimated_micro bigint not null default 0,
  actual_micro bigint not null default 0,
  duration_ms integer not null default 0,
  status text not null check (status in ('ok', 'erreur', 'refus')),
  created_at timestamptz not null default now()
);
create index if not exists assistant_usage_user_created_idx on public.assistant_usage (user_id, created_at desc);
alter table public.assistant_usage enable row level security;
drop policy if exists "assistant_usage_select" on public.assistant_usage;
create policy "assistant_usage_select" on public.assistant_usage
  for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.assistant_reserve(p_user uuid, p_micro bigint, p_cap_global_micro bigint, p_cap_user_micro bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_g public.assistant_pots;
  v_u public.assistant_pots;
begin
  if p_user is null or p_micro is null or p_micro < 0 or p_cap_global_micro is null or p_cap_user_micro is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext('assistant_pots:' || v_month));
  insert into public.assistant_pots (month, user_id) values (v_month, null) on conflict do nothing;
  insert into public.assistant_pots (month, user_id) values (v_month, p_user) on conflict do nothing;
  select * into v_g from public.assistant_pots where month = v_month and user_id is null;
  select * into v_u from public.assistant_pots where month = v_month and user_id = p_user;
  if v_g.reserved_micro + v_g.spent_micro + p_micro > p_cap_global_micro then return false; end if;
  if v_u.reserved_micro + v_u.spent_micro + p_micro > p_cap_user_micro then return false; end if;
  update public.assistant_pots set reserved_micro = reserved_micro + p_micro, updated_at = now()
   where month = v_month and (user_id is null or user_id = p_user);
  return true;
end;
$$;

create or replace function public.assistant_settle(p_user uuid, p_reserved_micro bigint, p_actual_micro bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
begin
  perform pg_advisory_xact_lock(hashtext('assistant_pots:' || v_month));
  update public.assistant_pots
     set reserved_micro = greatest(0, reserved_micro - greatest(0, coalesce(p_reserved_micro, 0))),
         spent_micro = spent_micro + greatest(0, coalesce(p_actual_micro, 0)),
         updated_at = now()
   where month = v_month and (user_id is null or user_id = p_user);
end;
$$;

revoke execute on function public.assistant_reserve(uuid, bigint, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.assistant_settle(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.assistant_reserve(uuid, bigint, bigint, bigint) to service_role;
grant execute on function public.assistant_settle(uuid, bigint, bigint) to service_role;
