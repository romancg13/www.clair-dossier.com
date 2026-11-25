-- Connexion directe d'une messagerie (Gmail / Google Workspace, Outlook /
-- Microsoft 365) — LECTURE SEULE, périmètre d'import explicite, jetons jamais
-- lisibles par un client. Additive et idempotente. PROPOSITION DE RECETTE
-- (2026-11-25) : sans les fonctions `mail-oauth` et `mail-sync` déployées, les
-- identifiants OAuth du propriétaire et un build `VITE_MAIL_CONNECT=1`, rien ne
-- change pour personne. docs/recette/MESSAGERIE_DIRECTE.md décrit le flux.
--
-- Principes :
--  * une connexion appartient à UN compte ; au plus une connexion non révoquée
--    par (compte, fournisseur) et par boîte ;
--  * périmètre explicite : import à partir de la date de connexion
--    (import_since), historique global DÉSACTIVÉ par défaut (history_import),
--    libellé/dossier de messagerie optionnel (scope_label), dossier ClairDossier
--    cible optionnel (dossier_id) ;
--  * les jetons OAuth vivent dans une table SANS aucune policy client, chiffrés
--    par l'application (AES-GCM, clé d'environnement MAIL_TOKEN_KEY) : la base
--    refuse mécaniquement toute valeur qui n'a pas le format chiffré « v1.… » ;
--  * « connected » n'est possible qu'après une réception RÉELLE (déclencheur) ;
--  * droit par offre (colonne mail_connect, Entrepreneur et plus — aligné sur
--    email_inbound), contrôlé côté serveur ;
--  * la déconnexion révoque la connexion ET efface les jetons, dans la même
--    transaction.

-- ── 1. Inclusion par offre ───────────────────────────────────────────────────
-- null = pas encore réglé (traité comme refus) ; une valeur posée par le
-- propriétaire n'est jamais réécrite (mise à jour uniquement si null).
alter table public.plan_entitlements
  add column if not exists mail_connect boolean;
comment on column public.plan_entitlements.mail_connect is
  'Connexion directe d''une messagerie incluse (null = non réglé, traité comme false).';

update public.plan_entitlements p
   set mail_connect = v.flag
  from (values
    ('essentiel',            false),
    ('entrepreneur',         true),
    ('business-pme-20',      true),
    ('business-pme-50',      true),
    ('business-pme-pro',     true),
    ('business-pme-premium', true),
    ('business-pme-sur-mesure', false))
    as v(plan_id, flag)
 where p.plan_id = v.plan_id
   and p.mail_connect is null;

alter table public.entitlement_overrides
  add column if not exists mail_connect boolean;

-- ── 2. Connexions ────────────────────────────────────────────────────────────
create table if not exists public.mail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'microsoft')),
  -- adresse de la boîte : connue après l'échange OAuth ('' avant)
  address text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'paused', 'revoked', 'error')),
  -- Périmètre d'import explicite.
  import_since timestamptz not null default now(),
  history_import boolean not null default false,
  scope_label text,
  dossier_id uuid references public.dossiers (id) on delete set null,
  -- Curseur de reprise : historyId (Gmail) ou deltaLink (Microsoft Graph).
  sync_cursor text,
  -- Abonnement Microsoft Graph (identifiant) ; Gmail n'en a pas.
  subscription_id text,
  watch_expires_at timestamptz,
  last_sync_at timestamptz,
  last_received_at timestamptz,
  last_error text,
  paused_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mail_connections_one_active
  on public.mail_connections (user_id, provider) where status <> 'revoked';
-- Une boîte n'est reliée qu'à UN compte à la fois (routage des notifications).
create unique index if not exists mail_connections_mailbox_once
  on public.mail_connections (provider, lower(address))
  where status <> 'revoked' and address <> '';
create index if not exists mail_connections_subscription_idx
  on public.mail_connections (subscription_id) where subscription_id is not null;
alter table public.mail_connections enable row level security;
drop policy if exists "mail_connections_select_own" on public.mail_connections;
create policy "mail_connections_select_own" on public.mail_connections
  for select using (user_id = auth.uid());
-- Aucune écriture directe : RPC ci-dessous et rôle serveur uniquement.

-- ── 3. Jetons — table NON exposée ────────────────────────────────────────────
-- RLS active SANS aucune policy et privilèges retirés : ni anon ni
-- authenticated ne peuvent lire ou écrire. Le format « v1.<iv>.<chiffré> »
-- (AES-GCM applicatif) est imposé : un jeton en clair est refusé par la base.
create table if not exists public.mail_connection_tokens (
  connection_id uuid primary key references public.mail_connections (id) on delete cascade,
  refresh_token_enc text not null
    check (refresh_token_enc ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$'),
  access_token_enc text
    check (access_token_enc is null or access_token_enc ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$'),
  access_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mail_connection_tokens enable row level security;
revoke all on table public.mail_connection_tokens from public, anon, authenticated;

-- ── 4. Messages reçus (dédup, rattachement ou « à classer ») ─────────────────
-- Statuts : received (prise en charge en cours) · filtered (hors périmètre,
-- rien conservé d'autre que l'identifiant) · a_classer · queued (dossier choisi
-- par le titulaire, import à faire) · stored · rejected (aucune pièce
-- acceptable) · error · ignored (décision du titulaire).
create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mail_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'microsoft')),
  message_id text not null,
  thread_id text,
  internet_message_id text,
  from_addr text,
  subject text,
  received_at timestamptz,
  attachment_count integer not null default 0,
  stored_count integer not null default 0,
  dossier_id uuid references public.dossiers (id) on delete set null,
  suggested_dossier_id uuid references public.dossiers (id) on delete set null,
  suggestion_reason text,
  status text not null default 'received'
    check (status in ('received', 'filtered', 'a_classer', 'queued', 'stored', 'rejected', 'error', 'ignored')),
  error text,
  -- prises en charge successives (reprise bornée après un échec passager)
  attempts integer not null default 1,
  classified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Dédup : fournisseur + identifiant de message, par compte (les identifiants
  -- d'un fournisseur ne sont uniques qu'à l'intérieur d'une boîte).
  constraint mail_messages_dedup unique (user_id, provider, message_id)
);
create index if not exists mail_messages_connection_created_idx
  on public.mail_messages (connection_id, created_at desc);
create index if not exists mail_messages_thread_idx
  on public.mail_messages (connection_id, thread_id) where thread_id is not null;
alter table public.mail_messages enable row level security;
drop policy if exists "mail_messages_select_own" on public.mail_messages;
create policy "mail_messages_select_own" on public.mail_messages
  for select using (user_id = auth.uid());
-- Écriture : rôle serveur et RPC ci-dessous.

-- ── 5. Journal d'événements ──────────────────────────────────────────────────
create table if not exists public.mail_connection_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mail_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (length(type) between 1 and 60),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists mail_connection_events_conn_idx
  on public.mail_connection_events (connection_id, created_at desc);
alter table public.mail_connection_events enable row level security;
drop policy if exists "mail_connection_events_select_own" on public.mail_connection_events;
create policy "mail_connection_events_select_own" on public.mail_connection_events
  for select using (user_id = auth.uid());

-- ── 6. Garde : « connected » uniquement après une réception réelle ───────────
create or replace function public.mail_connection_has_reception(p_connection uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mail_messages m
     where m.connection_id = p_connection
       and m.status in ('a_classer', 'queued', 'stored', 'rejected', 'ignored'))
$$;
revoke execute on function public.mail_connection_has_reception(uuid) from public, anon, authenticated;
grant execute on function public.mail_connection_has_reception(uuid) to service_role;

create or replace function public.mail_connections_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'connected'
     and (tg_op = 'INSERT' or old.status is distinct from 'connected')
     and not public.mail_connection_has_reception(new.id) then
    raise exception 'MAIL_CONNECTED_REQUIRES_RECEPTION';
  end if;
  if tg_op = 'UPDATE' and old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'MAIL_CONNECTION_REVOKED';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists mail_connections_guard on public.mail_connections;
create trigger mail_connections_guard
  before insert or update on public.mail_connections
  for each row execute function public.mail_connections_guard();

-- ── 7. Droit par offre (serveur) ─────────────────────────────────────────────
create or replace function public.mail_connect_included(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select o.mail_connect
       from public.entitlement_overrides o
      where o.user_id = p_user and o.active and o.revoked_at is null
        and o.starts_at <= now()
        and (o.expires_at is null or o.expires_at > now())
        and o.mail_connect is not null
      order by o.created_at desc limit 1),
    (select pe.mail_connect
       from public.subscriptions s
       join public.plan_entitlements pe on pe.plan_id = s.plan_id
      where s.user_id = p_user
        and (s.status in ('active', 'trialing', 'past_due')
             or (s.status = 'canceled' and s.current_period_end > now()))
      order by s.current_period_end desc nulls last, s.updated_at desc limit 1),
    false)
$$;
revoke execute on function public.mail_connect_included(uuid) from public, anon, authenticated;
grant execute on function public.mail_connect_included(uuid) to service_role;

-- Sonde du titulaire (affichage seulement — le contrôle réel est refait par
-- la fonction mail-oauth avant toute autorisation).
create or replace function public.mail_connect_access()
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and (public.mail_connect_included(auth.uid()) or coalesce(public.is_admin(), false))
$$;
revoke execute on function public.mail_connect_access() from public, anon;
grant execute on function public.mail_connect_access() to authenticated;

-- ── 8. RPC titulaire : pause / reprise / déconnexion ─────────────────────────
create or replace function public.mail_connection_pause(p_connection uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row public.mail_connections%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.mail_connections where id = p_connection for update;
  if not found or v_row.user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_row.status = 'paused' then return; end if;
  if v_row.status = 'revoked' then raise exception 'MAIL_CONNECTION_REVOKED'; end if;
  update public.mail_connections
     set status = 'paused', paused_at = now()
   where id = p_connection;
  insert into public.mail_connection_events (connection_id, user_id, type, detail)
  values (p_connection, v_user, 'pause', 'Import suspendu par le titulaire');
end;
$$;
revoke execute on function public.mail_connection_pause(uuid) from public, anon;
grant execute on function public.mail_connection_pause(uuid) to authenticated;

-- Reprise : le périmètre repart de MAINTENANT (rien de ce qui est arrivé
-- pendant la pause n'est importé) ; le curseur et la surveillance sont remis à
-- zéro, la fonction mail-sync les rétablit à son prochain passage.
create or replace function public.mail_connection_resume(p_connection uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row public.mail_connections%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.mail_connections where id = p_connection for update;
  if not found or v_row.user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_row.status = 'revoked' then raise exception 'MAIL_CONNECTION_REVOKED'; end if;
  if v_row.status <> 'paused' then return; end if;
  if not (public.mail_connect_included(v_user) or coalesce(public.is_admin(), false)) then
    raise exception 'FEATURE_NOT_INCLUDED';
  end if;
  update public.mail_connections
     set status = case when public.mail_connection_has_reception(p_connection) then 'connected' else 'pending' end,
         paused_at = null,
         import_since = now(),
         sync_cursor = null,
         watch_expires_at = null,
         last_error = null
   where id = p_connection;
  insert into public.mail_connection_events (connection_id, user_id, type, detail)
  values (p_connection, v_user, 'reprise', 'Import repris à partir de maintenant');
end;
$$;
revoke execute on function public.mail_connection_resume(uuid) from public, anon;
grant execute on function public.mail_connection_resume(uuid) to authenticated;

-- Déconnexion : statut révoqué ET jetons effacés, dans la même transaction.
-- (La révocation côté fournisseur est faite avant par la fonction mail-oauth ;
-- cet appel direct reste possible si la fonction est injoignable : les jetons
-- disparaissent quand même de la base.) L'historique des messages est conservé.
create or replace function public.mail_connection_disconnect(p_connection uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row public.mail_connections%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.mail_connections where id = p_connection for update;
  if not found or (v_row.user_id <> v_user and not coalesce(public.is_admin(), false)) then
    raise exception 'FORBIDDEN';
  end if;
  delete from public.mail_connection_tokens where connection_id = p_connection;
  if v_row.status = 'revoked' then return; end if;
  update public.mail_connections
     set status = 'revoked', revoked_at = now(),
         sync_cursor = null, subscription_id = null, watch_expires_at = null
   where id = p_connection;
  insert into public.mail_connection_events (connection_id, user_id, type, detail)
  values (p_connection, v_row.user_id, 'deconnexion', 'Connexion révoquée, jetons effacés');
end;
$$;
revoke execute on function public.mail_connection_disconnect(uuid) from public, anon;
grant execute on function public.mail_connection_disconnect(uuid) to authenticated;

-- ── 9. RPC titulaire : classer / ignorer un message « à classer » ────────────
-- Classer met le message en file (queued) : la fonction mail-sync récupère alors
-- ses pièces autorisées et les dépose dans le dossier (chemin existant
-- dossier_documents → documents_ai_enqueue).
create or replace function public.mail_message_assign(p_message uuid, p_dossier uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_msg public.mail_messages%rowtype;
  v_owner uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_msg from public.mail_messages where id = p_message for update;
  if not found or v_msg.user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  select d.user_id into v_owner from public.dossiers d
   where d.id = p_dossier and d.deleted_at is null;
  if v_owner is null or v_owner <> v_user then raise exception 'FORBIDDEN'; end if;
  if coalesce(public.dossier_is_closed(p_dossier), false) then raise exception 'DOSSIER_CLOTURE'; end if;
  if v_msg.status not in ('a_classer', 'error') then raise exception 'MAIL_MESSAGE_NOT_PENDING'; end if;
  update public.mail_messages
     set dossier_id = p_dossier, status = 'queued', error = null,
         classified_at = now(), updated_at = now()
   where id = p_message;
end;
$$;
revoke execute on function public.mail_message_assign(uuid, uuid) from public, anon;
grant execute on function public.mail_message_assign(uuid, uuid) to authenticated;

create or replace function public.mail_message_ignore(p_message uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_msg public.mail_messages%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_msg from public.mail_messages where id = p_message for update;
  if not found or v_msg.user_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if v_msg.status <> 'a_classer' then raise exception 'MAIL_MESSAGE_NOT_PENDING'; end if;
  update public.mail_messages
     set status = 'ignored', classified_at = now(), updated_at = now()
   where id = p_message;
end;
$$;
revoke execute on function public.mail_message_ignore(uuid) from public, anon;
grant execute on function public.mail_message_ignore(uuid) to authenticated;
