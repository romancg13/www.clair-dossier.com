-- Réception d'e-mails entrants (Resend) — adresse non devinable et révocable
-- PAR DOSSIER, routage par destinataire enregistré, provenance conservée.
-- Additive et idempotente. PROPOSITION DE RECETTE (2026-11-18) : sans la
-- fonction `email-inbound` déployée, un domaine de réception Resend (MX sur un
-- SOUS-DOMAINE dédié — jamais les MX principaux) et un build `VITE_EMAIL_INBOUND=1`,
-- rien ne change pour personne. docs/recette/EMAIL_ENTRANT.md décrit le flux.
--
-- Principes :
--  * l'adresse (d-<32 hex>@<sous-domaine>) appartient à UN dossier d'UN compte :
--    le routage se fait sur le destinataire, jamais sur l'expéditeur (non fiable,
--    enregistré à titre de provenance avec les verdicts SPF/DKIM/DMARC) ;
--  * les pièces jointes acceptées deviennent des pièces du dossier (mêmes règles
--    de type/taille que le dépôt manuel) : le pipeline existant (déclencheur
--    documents_ai_enqueue) fait le reste si le traitement du dossier est activé ;
--  * fonctionnalité incluse à partir de l'offre Entrepreneur (colonne
--    email_inbound, réglable par le propriétaire ; dérogation par compte) ;
--  * « Connecté » n'est affiché qu'après une réception RÉELLE (inbound_emails).

-- ── 1. Inclusion par offre ───────────────────────────────────────────────────
-- null = pas encore réglé (traité comme refus) ; false posé par le propriétaire
-- n'est jamais réécrit par cette migration (mise à jour uniquement si null).
alter table public.plan_entitlements
  add column if not exists email_inbound boolean;
comment on column public.plan_entitlements.email_inbound is
  'Réception d''e-mails entrants incluse (null = non réglé, traité comme false).';

update public.plan_entitlements p
   set email_inbound = v.flag
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
   and p.email_inbound is null;

alter table public.entitlement_overrides
  add column if not exists email_inbound boolean;

-- ── 2. Adresses de réception ─────────────────────────────────────────────────
create table if not exists public.inbound_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  -- partie locale non devinable, générée côté base, jamais choisie
  local_part text not null unique check (local_part ~ '^d-[0-9a-f]{32}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists inbound_addresses_one_active
  on public.inbound_addresses (dossier_id) where revoked_at is null;
create index if not exists inbound_addresses_user_idx on public.inbound_addresses (user_id);
alter table public.inbound_addresses enable row level security;
drop policy if exists "inbound_addresses_select_own" on public.inbound_addresses;
create policy "inbound_addresses_select_own" on public.inbound_addresses
  for select using (user_id = auth.uid() or coalesce(public.is_admin(), false));
-- Aucune écriture directe : uniquement les RPC ci-dessous et le rôle serveur.

-- ── 3. Journal des réceptions (provenance, anti-rejeu, débit) ────────────────
create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  address_id uuid references public.inbound_addresses (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  dossier_id uuid references public.dossiers (id) on delete set null,
  -- email_id Resend : unicité = idempotence du webhook (rejeu sans effet)
  provider_email_id text not null unique,
  message_id text,
  from_addr text,
  subject text,
  spf text,
  dkim text,
  dmarc text,
  attachment_count integer not null default 0,
  stored_count integer not null default 0,
  status text not null default 'received'
    check (status in ('received', 'stored', 'rejected', 'error')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists inbound_emails_address_created_idx
  on public.inbound_emails (address_id, created_at desc);
alter table public.inbound_emails enable row level security;
drop policy if exists "inbound_emails_select_own" on public.inbound_emails;
create policy "inbound_emails_select_own" on public.inbound_emails
  for select using (user_id = auth.uid() or coalesce(public.is_admin(), false));
-- Écriture : rôle serveur seul (fonction email-inbound).

-- ── 4. RPC titulaire ─────────────────────────────────────────────────────────
-- La fonctionnalité est-elle incluse pour ce compte ? (dérogation → offre)
create or replace function public.email_inbound_included(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select o.email_inbound
       from public.entitlement_overrides o
      where o.user_id = p_user and o.active and o.revoked_at is null
        and o.starts_at <= now()
        and (o.expires_at is null or o.expires_at > now())
        and o.email_inbound is not null
      order by o.created_at desc limit 1),
    (select pe.email_inbound
       from public.subscriptions s
       join public.plan_entitlements pe on pe.plan_id = s.plan_id
      where s.user_id = p_user
        and (s.status in ('active', 'trialing', 'past_due')
             or (s.status = 'canceled' and s.current_period_end > now()))
      order by s.current_period_end desc nulls last, s.updated_at desc limit 1),
    false)
$$;
revoke execute on function public.email_inbound_included(uuid) from public, anon, authenticated;
grant execute on function public.email_inbound_included(uuid) to service_role;

-- Crée (ou renvoie) l'adresse active du dossier. Erreurs : AUTH_REQUIRED,
-- FORBIDDEN (pas titulaire), DOSSIER_CLOTURE, FEATURE_NOT_INCLUDED.
create or replace function public.create_inbound_address(p_dossier uuid)
returns table (local_part text, created_at timestamptz)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_row public.inbound_addresses%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select d.user_id into v_owner from public.dossiers d
   where d.id = p_dossier and d.deleted_at is null;
  if v_owner is null or v_owner <> v_user then raise exception 'FORBIDDEN'; end if;
  if coalesce(public.dossier_is_closed(p_dossier), false) then raise exception 'DOSSIER_CLOTURE'; end if;
  if not (public.email_inbound_included(v_user) or coalesce(public.is_admin(), false)) then
    raise exception 'FEATURE_NOT_INCLUDED';
  end if;
  select * into v_row from public.inbound_addresses a
   where a.dossier_id = p_dossier and a.revoked_at is null;
  if not found then
    insert into public.inbound_addresses (user_id, dossier_id, local_part)
    values (v_user, p_dossier, 'd-' || replace(gen_random_uuid()::text, '-', ''))
    returning * into v_row;
  end if;
  local_part := v_row.local_part;
  created_at := v_row.created_at;
  return next;
end;
$$;
revoke execute on function public.create_inbound_address(uuid) from public, anon;
grant execute on function public.create_inbound_address(uuid) to authenticated;

-- Révoque l'adresse active du dossier (l'historique des réceptions est conservé).
create or replace function public.revoke_inbound_address(p_dossier uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select d.user_id into v_owner from public.dossiers d where d.id = p_dossier;
  if v_owner is null or (v_owner <> v_user and not coalesce(public.is_admin(), false)) then
    raise exception 'FORBIDDEN';
  end if;
  update public.inbound_addresses
     set revoked_at = now()
   where dossier_id = p_dossier and revoked_at is null;
end;
$$;
revoke execute on function public.revoke_inbound_address(uuid) from public, anon;
grant execute on function public.revoke_inbound_address(uuid) to authenticated;
