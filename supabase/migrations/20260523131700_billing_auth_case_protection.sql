create table if not exists public.plans (
  id text primary key,
  name text not null,
  slug text not null unique,
  monthly_price numeric(10, 2),
  yearly_price numeric(10, 2),
  yearly_discount_percent integer not null default 10,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

drop policy if exists "public_select_active_plans" on public.plans;
create policy "public_select_active_plans" on public.plans for select to anon, authenticated using (active = true);

alter table public.profiles add column if not exists account_type text;

insert into public.plans (id, name, slug, monthly_price, yearly_price, yearly_discount_percent, features, active)
values
  ('discovery', 'Découverte', 'decouverte', 0, 0, 10, '["1 dossier de test", "Check-list documentaire", "Accès blog et ressources", "Paiement non requis"]'::jsonb, true),
  ('client-essential', 'Client Essentiel', 'client-essentiel', 19, 205.20, 10, '["3 dossiers actifs", "Messagerie dossier", "Upload documents", "Notifications de statut"]'::jsonb, true),
  ('business', 'Business / PME', 'business-pme', 79, 853.20, 10, '["Dossiers illimités PME", "Contrats et recouvrement", "Tableau de bord priorités", "Accès multi-utilisateurs"]'::jsonb, true),
  ('cabinet-solo', 'Cabinet Solo', 'cabinet-solo', 99, 1069.20, 10, '["Pipeline dossiers", "Demandes clients entrantes", "Validation avocat", "Facturation Stripe préparée"]'::jsonb, true),
  ('cabinet-pro', 'Cabinet Pro', 'cabinet-pro', 249, 2689.20, 10, '["Gestion clients", "Tâches cabinet", "Rôles équipe", "Audit logs et reporting"]'::jsonb, true),
  ('cabinet-premium', 'Cabinet Premium', 'cabinet-premium', null, null, 10, '["Onboarding dédié", "Paramétrage sécurité", "Support prioritaire", "Intégrations sur demande"]'::jsonb, true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  yearly_discount_percent = excluded.yearly_discount_percent,
  features = excluded.features,
  active = excluded.active;

alter table public.subscriptions add column if not exists billing_period text not null default 'monthly';
alter table public.subscriptions add column if not exists current_period_start timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_billing_period_check') then
    alter table public.subscriptions add constraint subscriptions_billing_period_check check (billing_period in ('monthly', 'yearly')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_status_check') then
    alter table public.subscriptions add constraint subscriptions_status_check check (status in ('active', 'canceled', 'incomplete', 'past_due')) not valid;
  end if;
end $$;

alter table public.payments add column if not exists plan_id text;
alter table public.payments add column if not exists billing_period text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_billing_period_check') then
    alter table public.payments add constraint payments_billing_period_check check (billing_period is null or billing_period in ('monthly', 'yearly')) not valid;
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, account_type, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'account_type',
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'client')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    account_type = excluded.account_type,
    role = excluded.role,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "public_insert_cases" on public.cases;
create policy "authenticated_insert_cases" on public.cases
  for insert to authenticated
  with check (terms_accepted = true and created_by = auth.uid());

drop policy if exists "public_insert_case_answers" on public.case_intake_answers;
create policy "authenticated_insert_case_answers" on public.case_intake_answers
  for insert to authenticated
  with check (
    consent_given = true
    and exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.created_by = auth.uid()
    )
  );
