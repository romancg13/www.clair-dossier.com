-- Automatisation client/admin (2026-09-17) — MIGRATION ADDITIVE, idempotente.
--
-- À appliquer APRÈS 20260915120000, 20260915150000 et 20260916120000.
-- Aucune donnée existante n'est supprimée ; aucune table existante n'est
-- recréée. Le site détecte ces capacités à l'exécution : il fonctionne à
-- l'identique tant que cette migration n'est pas appliquée.
--
-- Contenu :
--   1. profils : prénom / nom séparés, téléphone facultatif, e-mail de
--      facturation, suspension (champs protégés contre l'auto-modification) ;
--   2. abonnements synchronisés depuis Stripe (écriture serveur uniquement) ;
--   3. exceptions de quota (overrides) — écriture par RPC super admin + AAL2 ;
--   4. registre de consommation (ne décrémente jamais) ;
--   5. garde de soumission des dossiers : quota ATOMIQUE (verrou consultatif
--      par utilisateur, dans la transaction d'écriture), e-mail vérifié,
--      limitation de débit, champs serveur immuables — quelle que soit la
--      voie d'écriture (site, application mobile, appel API direct) ;
--   6. notifications administrateur idempotentes (une par dossier) ;
--   7. RPC de lecture/gestion des droits ;
--   8. exception permanente j.gomes@avocats-gojuris.fr (illimité).

-- ── 1. Profils ────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists billing_email text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

-- Contraintes NOT VALID : les lignes existantes ne sont pas contrôlées
-- rétroactivement (aucun échec d'application), les nouvelles écritures le sont.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_phone_format') then
    alter table public.profiles add constraint profiles_phone_format
      check (phone is null or phone ~ '^\+?[0-9][0-9 .()-]{7,22}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_billing_email_format') then
    alter table public.profiles add constraint profiles_billing_email_format
      check (billing_email is null or billing_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_names_length') then
    alter table public.profiles add constraint profiles_names_length
      check (coalesce(length(first_name), 0) <= 80 and coalesce(length(last_name), 0) <= 80) not valid;
  end if;
end $$;

-- Profil créé à l'inscription : prénom, nom, téléphone désormais conservés.
-- Valeurs invalides ignorées (jamais d'échec d'inscription à cause d'une
-- métadonnée mal formée).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_first text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  v_last text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
  v_full text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_type text := new.raw_user_meta_data ->> 'company_type';
  v_phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
begin
  if v_type is not null and v_type not in
    ('pme', 'artisan', 'entreprise-individuelle', 'profession-liberale', 'particulier', 'autre') then
    v_type := null;
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9][0-9 .()-]{7,22}$' then
    v_phone := null;
  end if;
  insert into public.profiles (id, full_name, first_name, last_name, company_name, company_type, phone)
  values (
    new.id,
    coalesce(v_full, nullif(concat_ws(' ', v_first, v_last), '')),
    left(v_first, 80),
    left(v_last, 80),
    nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''),
    v_type,
    v_phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Suspension : jamais modifiable par le titulaire du profil (ni à l'insertion
-- ni à la mise à jour), seulement par un super admin ou le serveur.
create or replace function public.profiles_protect_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not coalesce(public.is_super_admin(), false) then
    if tg_op = 'INSERT' then
      new.suspended_at := null;
      new.suspension_reason := null;
    else
      new.suspended_at := old.suspended_at;
      new.suspension_reason := old.suspension_reason;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_fields on public.profiles;
create trigger profiles_protect_admin_fields
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_admin_fields();

-- Le super admin peut corriger un profil client (AAL2 exigée).
drop policy if exists "profiles_update_super" on public.profiles;
create policy "profiles_update_super" on public.profiles
  for update using (public.is_super_admin() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
  with check (public.is_super_admin() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2');

-- ── 2. Offres et abonnements (Stripe = source de vérité financière) ──────────
create table if not exists public.plan_entitlements (
  plan_id text primary key,
  label text not null,
  -- null = illimité
  dossier_limit integer check (dossier_limit is null or dossier_limit >= 0),
  updated_at timestamptz not null default now()
);

-- Quotas publiés sur /tarifs (src/data/pricing.ts). Jamais écrasés s'ils ont
-- été ajustés depuis dans la base.
insert into public.plan_entitlements (plan_id, label, dossier_limit) values
  ('essentiel', 'Essentiel', 5),
  ('entrepreneur', 'Entrepreneur', 10),
  ('business-pme-20', 'Business PME 20', 20),
  ('business-pme-50', 'Business PME 50', 50),
  ('business-pme-pro', 'Business / PME Pro', null),
  ('business-pme-premium', 'Business / PME Premium', null),
  ('business-pme-sur-mesure', 'Business / PME personnalisée', null)
on conflict (plan_id) do nothing;

alter table public.plan_entitlements enable row level security;
drop policy if exists "plans_select_authenticated" on public.plan_entitlements;
create policy "plans_select_authenticated" on public.plan_entitlements
  for select to authenticated using (true);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_id text references public.plan_entitlements (plan_id) on delete set null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
-- Lecture : le titulaire et l'administration. AUCUNE écriture applicative :
-- seul le webhook Stripe (clé de service, côté serveur) écrit ici.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id or public.is_admin());

-- Idempotence du webhook : un événement Stripe n'est traité qu'une fois.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.stripe_events enable row level security;
-- Aucune policy : réservé au serveur.

-- ── 3. Exceptions de quota ────────────────────────────────────────────────────
create table if not exists public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('unlimited', 'custom_limit', 'bonus')),
  dossier_limit integer check (dossier_limit is null or dossier_limit >= 0),
  reason text not null check (length(trim(reason)) > 0),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  constraint entitlement_overrides_limit_coherent check (
    (mode = 'unlimited' and dossier_limit is null) or (mode <> 'unlimited' and dossier_limit is not null)
  )
);
-- Au plus une exception active par utilisateur.
create unique index if not exists entitlement_overrides_one_active
  on public.entitlement_overrides (user_id) where active;

alter table public.entitlement_overrides enable row level security;
-- Lecture : le titulaire (transparence) et le super admin. AUCUNE écriture
-- applicative : uniquement via admin_set_dossier_override() (super admin, AAL2).
drop policy if exists "overrides_select" on public.entitlement_overrides;
create policy "overrides_select" on public.entitlement_overrides
  for select using (auth.uid() = user_id or public.is_super_admin());

-- ── 4. Registre de consommation ───────────────────────────────────────────────
-- Une ligne par dossier validé. Survit à la suppression ou à l'archivage du
-- dossier (dossier_id passe à null) : supprimer un dossier ne recrédite rien.
create table if not exists public.dossier_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dossier_id uuid unique references public.dossiers (id) on delete set null,
  submitted_at timestamptz not null default now()
);
create index if not exists dossier_submissions_user_time_idx
  on public.dossier_submissions (user_id, submitted_at desc);

alter table public.dossier_submissions enable row level security;
drop policy if exists "submissions_select_own" on public.dossier_submissions;
create policy "submissions_select_own" on public.dossier_submissions
  for select using (auth.uid() = user_id or public.is_admin());

-- ── 5. Dossiers : soumission, idempotence, suivi administrateur ──────────────
alter table public.dossiers
  add column if not exists submitted_at timestamptz,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists client_request_id uuid,
  add column if not exists current_step smallint,
  add column if not exists admin_seen_at timestamptz,
  add column if not exists taken_by uuid references auth.users (id) on delete set null,
  add column if not exists taken_at timestamptz,
  -- déjà créées par 20260915150000 ; répétées ici sans effet si présentes
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id),
  add column if not exists delete_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dossiers_current_step_range') then
    alter table public.dossiers add constraint dossiers_current_step_range
      check (current_step is null or current_step between 1 and 5);
  end if;
end $$;

-- Double clic, double onglet, réseau instable : une même requête client ne
-- crée jamais deux dossiers.
create unique index if not exists dossiers_client_request_uidx
  on public.dossiers (user_id, client_request_id) where client_request_id is not null;
create index if not exists dossiers_submitted_idx
  on public.dossiers (submitted_at desc) where submitted_at is not null;

-- Historique : les dossiers déjà validés avant cette migration sont réputés
-- soumis à leur date de création (fait avéré, pas une supposition). Ils ne
-- déclenchent donc ni notification ni consommation rétroactive.
-- (updated_at des dossiers historiques préservé : déclencheur de mise à jour
-- suspendu le temps de ce rattrapage).
alter table public.dossiers disable trigger dossiers_touch;
update public.dossiers
  set submitted_at = created_at
  where submitted_at is null and status in ('complete', 'transmis', 'en-cours', 'valide');
alter table public.dossiers enable trigger dossiers_touch;

-- ── Résolution du droit effectif (fonction interne, jamais appelable par un client)
create or replace function public.dossier_entitlement(p_user uuid)
returns table (
  applies boolean,
  unlimited boolean,
  dossier_limit integer,
  plan_limit integer,
  used integer,
  period_start timestamptz,
  period_end timestamptz,
  plan_id text,
  subscription_status text,
  override_mode text,
  override_limit integer,
  blocked_reason text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_has_sub boolean := false;
  v_ov public.entitlement_overrides%rowtype;
  v_has_ov boolean := false;
  v_is_admin boolean;
  v_suspended timestamptz;
  v_plan_limit integer;
begin
  applies := false;
  unlimited := false;
  dossier_limit := null;
  plan_limit := null;
  period_start := now() - interval '30 days';
  period_end := null;
  plan_id := null;
  subscription_status := null;
  override_mode := null;
  override_limit := null;
  blocked_reason := null;

  select p.suspended_at into v_suspended from public.profiles p where p.id = p_user;
  if v_suspended is not null then
    blocked_reason := 'suspended';
  end if;

  select exists (select 1 from public.app_admins a where a.user_id = p_user) into v_is_admin;

  -- Abonnement courant : actif / essai / paiement en retard (période de grâce
  -- Stripe), ou résilié mais encore dans la période payée.
  select s.* into v_sub
  from public.subscriptions s
  where s.user_id = p_user
    and (s.status in ('active', 'trialing', 'past_due')
         or (s.status = 'canceled' and s.current_period_end > now()))
  order by s.current_period_end desc nulls last, s.updated_at desc
  limit 1;
  v_has_sub := found;

  if v_has_sub then
    applies := true;
    plan_id := v_sub.plan_id;
    subscription_status := v_sub.status;
    select pe.dossier_limit into v_plan_limit from public.plan_entitlements pe where pe.plan_id = v_sub.plan_id;
    plan_limit := v_plan_limit;
    if v_sub.plan_id is null or not exists (select 1 from public.plan_entitlements pe where pe.plan_id = v_sub.plan_id) then
      -- Offre inconnue : on n'invente pas de limite.
      applies := false;
    end if;
    if v_sub.current_period_start is not null then
      period_start := v_sub.current_period_start;
      period_end := v_sub.current_period_end;
      -- Période échue mais webhook de renouvellement pas encore reçu : on ne
      -- bloque pas le client sur une période passée.
      if v_sub.current_period_end is not null and v_sub.current_period_end <= now() then
        period_start := v_sub.current_period_end;
        period_end := null;
      end if;
    end if;
    if v_plan_limit is null and applies then
      unlimited := true;
    end if;
    dossier_limit := v_plan_limit;
  else
    -- Paiement en échec sans abonnement exploitable : création bloquée.
    select s.status into subscription_status
    from public.subscriptions s
    where s.user_id = p_user and s.status in ('unpaid', 'incomplete', 'paused')
    order by s.updated_at desc limit 1;
    if found and blocked_reason is null then
      blocked_reason := 'payment';
    end if;
  end if;

  select o.* into v_ov
  from public.entitlement_overrides o
  where o.user_id = p_user and o.active and o.starts_at <= now()
    and (o.expires_at is null or o.expires_at > now())
  limit 1;
  v_has_ov := found;

  if v_has_ov then
    override_mode := v_ov.mode;
    override_limit := v_ov.dossier_limit;
    if v_ov.mode = 'unlimited' then
      applies := true;
      unlimited := true;
      dossier_limit := null;
    elsif v_ov.mode = 'custom_limit' then
      applies := true;
      unlimited := false;
      dossier_limit := v_ov.dossier_limit;
    elsif v_ov.mode = 'bonus' and applies and not unlimited then
      dossier_limit := coalesce(v_plan_limit, 0) + v_ov.dossier_limit;
    end if;
  end if;

  -- Comptes internes de l'équipe : jamais limités en quantité.
  if v_is_admin then
    applies := true;
    unlimited := true;
    dossier_limit := null;
  end if;

  select count(*)::integer into used
  from public.dossier_submissions ds
  where ds.user_id = p_user
    and ds.submitted_at >= period_start
    and (period_end is null or ds.submitted_at < period_end);

  return next;
end;
$$;

revoke all on function public.dossier_entitlement(uuid) from public, anon, authenticated;

-- ── Garde de soumission (BEFORE) : champs serveur immuables + quota atomique ─
create or replace function public.dossiers_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
  v_ent record;
  v_recent integer;
begin
  if tg_op = 'INSERT' then
    new.submitted_at := null;
    new.admin_seen_at := null;
    new.taken_by := null;
    new.taken_at := null;
    new.created_by := coalesce(v_actor, new.user_id);
    if not v_admin then
      new.current_step := null;
      new.deleted_at := null;
      new.deleted_by := null;
      new.delete_reason := null;
    end if;
  else
    new.submitted_at := old.submitted_at;
    new.created_by := old.created_by;
    new.client_request_id := old.client_request_id;
    new.user_id := old.user_id;
    if not v_admin then
      new.admin_seen_at := old.admin_seen_at;
      new.taken_by := old.taken_by;
      new.taken_at := old.taken_at;
      new.current_step := old.current_step;
      new.deleted_at := old.deleted_at;
      new.deleted_by := old.deleted_by;
      new.delete_reason := old.delete_reason;
    end if;
  end if;

  -- Première validation (sortie de l'état brouillon) : contrôle et consommation.
  -- Statuts de progression : un brouillon archivé ou abandonné ne consomme rien.
  if new.status in ('complete', 'transmis', 'en-cours', 'valide') and new.submitted_at is null then
    -- Sérialise les validations d'un même utilisateur (double onglet, double
    -- clic, appels simultanés) jusqu'à la fin de la transaction.
    perform pg_advisory_xact_lock(hashtextextended('clairdossier:quota:' || new.user_id::text, 0));

    if not v_admin and v_actor is not null then
      if v_actor <> new.user_id then
        raise exception using errcode = '42501', message = 'FORBIDDEN';
      end if;

      if not exists (select 1 from auth.users u where u.id = v_actor and u.email_confirmed_at is not null) then
        raise exception using errcode = 'P0001', message = 'EMAIL_NOT_VERIFIED';
      end if;

      select count(*) into v_recent
      from public.dossier_submissions ds
      where ds.user_id = new.user_id and ds.submitted_at > now() - interval '10 minutes';
      if v_recent >= 10 then
        raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
      end if;

      select * into v_ent from public.dossier_entitlement(new.user_id);
      if v_ent.blocked_reason is not null then
        raise exception using errcode = 'P0001', message = 'SUBMISSION_BLOCKED',
          detail = v_ent.blocked_reason;
      end if;
      if v_ent.applies and not v_ent.unlimited and v_ent.dossier_limit is not null
         and v_ent.used >= v_ent.dossier_limit then
        raise exception using errcode = 'P0001', message = 'DOSSIER_QUOTA_EXCEEDED',
          detail = json_build_object(
            'limit', v_ent.dossier_limit,
            'used', v_ent.used,
            'period_end', v_ent.period_end
          )::text;
      end if;
    end if;

    new.submitted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists dossiers_guard on public.dossiers;
create trigger dossiers_guard
  before insert or update on public.dossiers
  for each row execute function public.dossiers_guard();

-- ── 6. Notifications administrateur ──────────────────────────────────────────
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  dossier_id uuid references public.dossiers (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by uuid references auth.users (id) on delete set null,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sending', 'sent', 'failed', 'not_configured')),
  sms_status text not null default 'pending'
    check (sms_status in ('pending', 'sending', 'sent', 'failed', 'not_configured')),
  retry_count integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  constraint admin_notifications_one_per_dossier unique (type, dossier_id)
);
create index if not exists admin_notifications_created_idx on public.admin_notifications (created_at desc);

alter table public.admin_notifications enable row level security;
-- Aucun accès client. Lecture et « marquer comme lu » : administration.
drop policy if exists "admin_notifications_select" on public.admin_notifications;
create policy "admin_notifications_select" on public.admin_notifications
  for select using (public.is_admin());
drop policy if exists "admin_notifications_update" on public.admin_notifications;
create policy "admin_notifications_update" on public.admin_notifications
  for update using (public.is_admin()) with check (public.is_admin());

-- APRÈS validation : registre de consommation + notification (même
-- transaction que la validation ; l'envoi réseau est asynchrone via pg_net et
-- ne peut JAMAIS annuler l'enregistrement du dossier).
create or replace function public.dossiers_after_submit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_notification uuid;
begin
  if new.submitted_at is not null
     and (tg_op = 'INSERT' or old.submitted_at is null) then
    insert into public.dossier_submissions (user_id, dossier_id, submitted_at)
    values (new.user_id, new.id, new.submitted_at)
    on conflict (dossier_id) do nothing;

    insert into public.admin_notifications (type, dossier_id, user_id)
    values ('dossier_submitted', new.id, new.user_id)
    on conflict (type, dossier_id) do nothing
    returning id into v_notification;

    if v_notification is not null then
      begin
        perform net.http_post(
          url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/notify-lead',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U'
          ),
          body := jsonb_build_object(
            'table', 'dossiers',
            'notification_id', v_notification,
            'record', jsonb_build_object('id', new.id)
          )
        );
      exception when others then
        -- L'appel réseau a échoué : la notification reste « pending », visible
        -- et relançable depuis /admin. Le dossier, lui, est enregistré.
        null;
      end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists dossiers_after_submit on public.dossiers;
create trigger dossiers_after_submit
  after insert or update on public.dossiers
  for each row execute function public.dossiers_after_submit();

-- L'ancien déclencheur notifiait chaque INSERT (y compris les brouillons de
-- l'application mobile, sans trace). Il est remplacé par la notification à la
-- validation ci-dessus. Le déclencheur « nouveau compte » est conservé.
drop trigger if exists on_new_dossier_notify on public.dossiers;

-- ── 7. RPC ────────────────────────────────────────────────────────────────────

-- Droits de l'utilisateur connecté (lecture seule, jamais d'un autre compte).
create or replace function public.get_my_dossier_entitlement()
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_ent record;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into v_ent from public.dossier_entitlement(auth.uid());
  return json_build_object(
    'applies', v_ent.applies,
    'unlimited', v_ent.unlimited,
    'dossier_limit', v_ent.dossier_limit,
    'used', v_ent.used,
    'period_start', v_ent.period_start,
    'period_end', v_ent.period_end,
    'plan_id', v_ent.plan_id,
    'subscription_status', v_ent.subscription_status,
    'blocked_reason', v_ent.blocked_reason
  );
end;
$$;
revoke all on function public.get_my_dossier_entitlement() from public, anon;
grant execute on function public.get_my_dossier_entitlement() to authenticated;

-- Vue super admin : plan, exception, quota effectif, consommation, période.
create or replace function public.admin_list_entitlements()
returns table (
  user_id uuid,
  email text,
  suspended_at timestamptz,
  plan_id text,
  subscription_status text,
  stripe_customer_id text,
  plan_limit integer,
  override_mode text,
  override_limit integer,
  override_reason text,
  applies boolean,
  unlimited boolean,
  effective_limit integer,
  used integer,
  period_end timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return query
  select
    u.id,
    u.email::text,
    p.suspended_at,
    e.plan_id,
    e.subscription_status,
    (select s.stripe_customer_id from public.subscriptions s
       where s.user_id = u.id order by s.updated_at desc limit 1),
    e.plan_limit,
    e.override_mode,
    e.override_limit,
    (select o.reason from public.entitlement_overrides o where o.user_id = u.id and o.active limit 1),
    e.applies,
    e.unlimited,
    e.dossier_limit,
    e.used,
    e.period_end
  from auth.users u
  left join public.profiles p on p.id = u.id
  cross join lateral public.dossier_entitlement(u.id) e;
end;
$$;
revoke all on function public.admin_list_entitlements() from public, anon;
grant execute on function public.admin_list_entitlements() to authenticated;

-- Définir / retirer une exception de quota. Super admin + AAL2 + motif ;
-- ancienne et nouvelle valeur journalisées. Ne touche jamais à Stripe.
create or replace function public.admin_set_dossier_override(
  p_user uuid,
  p_mode text,
  p_limit integer,
  p_reason text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_old public.entitlement_overrides%rowtype;
  v_had_old boolean;
  v_new uuid;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception using errcode = '22023', message = 'REASON_REQUIRED';
  end if;
  if p_mode not in ('unlimited', 'custom_limit', 'bonus', 'remove') then
    raise exception using errcode = '22023', message = 'INVALID_MODE';
  end if;
  if p_mode in ('custom_limit', 'bonus') and (p_limit is null or p_limit < 0) then
    raise exception using errcode = '22023', message = 'INVALID_LIMIT';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception using errcode = '22023', message = 'UNKNOWN_USER';
  end if;

  select * into v_old from public.entitlement_overrides o where o.user_id = p_user and o.active limit 1;
  v_had_old := found;

  if v_had_old then
    update public.entitlement_overrides
      set active = false, revoked_at = now(), revoked_by = auth.uid()
      where id = v_old.id;
  end if;

  if p_mode <> 'remove' then
    insert into public.entitlement_overrides (user_id, mode, dossier_limit, reason, expires_at, created_by)
    values (
      p_user,
      p_mode,
      case when p_mode = 'unlimited' then null else p_limit end,
      trim(p_reason),
      p_expires_at,
      auth.uid()
    )
    returning id into v_new;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
  values (
    auth.uid(),
    'super_admin',
    case when p_mode = 'remove' then 'quota_override_retire' else 'quota_override_modifie' end,
    'utilisateur',
    p_user::text,
    p_user,
    jsonb_build_object(
      'ancienne_valeur', case when v_had_old
        then v_old.mode || coalesce(':' || v_old.dossier_limit::text, '') else 'aucune' end,
      'nouvelle_valeur', case when p_mode = 'remove' then 'aucune'
        else p_mode || coalesce(':' || p_limit::text, '') end,
      'motif', trim(p_reason)
    )
  );

  return v_new;
end;
$$;
revoke all on function public.admin_set_dossier_override(uuid, text, integer, text, timestamptz) from public, anon;
grant execute on function public.admin_set_dossier_override(uuid, text, integer, text, timestamptz) to authenticated;

-- Suppression DÉFINITIVE d'un dossier : super admin ET session AAL2.
drop policy if exists "dossiers_delete_super" on public.dossiers;
create policy "dossiers_delete_super" on public.dossiers
  for delete using (public.is_super_admin() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2');

-- ── 8. Exception permanente : j.gomes@avocats-gojuris.fr ─────────────────────
-- Résolution par e-mail UNE fois, puis rattachement à l'identifiant durable.
-- Dossiers illimités quelle que soit l'offre Stripe ; l'abonnement lui-même
-- n'est ni modifié ni simulé.
insert into public.entitlement_overrides (user_id, mode, dossier_limit, reason, expires_at, created_by)
select u.id, 'unlimited', null,
  'Exception commerciale permanente — dossiers illimités quel que soit l''abonnement',
  null, null
from auth.users u
where lower(u.email) = 'j.gomes@avocats-gojuris.fr'
  and not exists (
    select 1 from public.entitlement_overrides o where o.user_id = u.id and o.active
  );

insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, target_user_id, metadata)
select a.user_id, 'system', 'quota_override_cree', 'utilisateur', u.id::text, u.id,
  jsonb_build_object(
    'ancienne_valeur', 'aucune',
    'nouvelle_valeur', 'unlimited',
    'motif', 'Exception commerciale permanente (migration 20260917120000)'
  )
from auth.users u
cross join lateral (
  select aa.user_id from public.app_admins aa order by aa.created_at limit 1
) a
where lower(u.email) = 'j.gomes@avocats-gojuris.fr'
  and not exists (
    select 1 from public.audit_logs l
    where l.action = 'quota_override_cree' and l.target_user_id = u.id
  );

do $$
begin
  if exists (
    select 1 from public.entitlement_overrides o
    join auth.users u on u.id = o.user_id
    where lower(u.email) = 'j.gomes@avocats-gojuris.fr' and o.active and o.mode = 'unlimited'
  ) then
    raise notice 'ClairDossier : exception illimitée active pour j.gomes@avocats-gojuris.fr.';
  else
    raise warning 'ClairDossier : compte j.gomes@avocats-gojuris.fr introuvable — exception NON créée. Réexécuter ce bloc après la création du compte.';
  end if;
end $$;
