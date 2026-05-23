create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'client' check (role in ('client', 'lawyer', 'cabinet_admin', 'admin')),
  cabinet_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'lawyer', 'cabinet_admin')
  );
$$;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  request_type text not null,
  message text not null,
  consent_given boolean not null default false,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  consent_given boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text not null,
  users_count integer,
  message text,
  preferred_slot timestamptz,
  consent_given boolean not null default false,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  assigned_lawyer_id uuid references auth.users(id) on delete set null,
  cabinet_id uuid,
  title text not null,
  client_type text,
  legal_domain text,
  description text,
  urgency text,
  status text not null default 'reçu' check (status in ('reçu', 'incomplet', 'en analyse', 'en attente de pièces', 'en attente validation avocat', 'clôturé')),
  terms_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_intake_answers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  consent_given boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  file_path text not null,
  file_name text not null,
  confidentiality text not null default 'private',
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  recipient_id uuid references auth.users(id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount_total integer,
  currency text default 'eur',
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_id text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.blog_categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  meta_title text,
  meta_description text,
  summary text,
  content jsonb not null default '{}'::jsonb,
  author text,
  keywords text[] not null default array[]::text[],
  faq jsonb not null default '[]'::jsonb,
  status text not null default 'brouillon' check (status in ('brouillon', 'publié')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.contact_requests enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.demo_requests enable row level security;
alter table public.cases enable row level security;
alter table public.case_intake_answers enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "public_insert_contact_requests" on public.contact_requests for insert to anon, authenticated with check (consent_given = true);
create policy "admin_select_contact_requests" on public.contact_requests for select to authenticated using (public.is_admin());
create policy "admin_update_contact_requests" on public.contact_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public_insert_newsletter" on public.newsletter_subscribers for insert to anon, authenticated with check (consent_given = true);
create policy "admin_select_newsletter" on public.newsletter_subscribers for select to authenticated using (public.is_admin());

create policy "public_insert_demo_requests" on public.demo_requests for insert to anon, authenticated with check (consent_given = true);
create policy "admin_select_demo_requests" on public.demo_requests for select to authenticated using (public.is_admin());

create policy "public_insert_cases" on public.cases for insert to anon, authenticated with check (terms_accepted = true and (created_by is null or created_by = auth.uid()));
create policy "cases_select_owner_or_admin" on public.cases for select to authenticated using (created_by = auth.uid() or assigned_lawyer_id = auth.uid() or public.is_admin());
create policy "cases_update_owner_lawyer_or_admin" on public.cases for update to authenticated using (created_by = auth.uid() or assigned_lawyer_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or assigned_lawyer_id = auth.uid() or public.is_admin());

create policy "public_insert_case_answers" on public.case_intake_answers for insert to anon, authenticated with check (consent_given = true);
create policy "case_answers_select_related" on public.case_intake_answers for select to authenticated using (exists (select 1 from public.cases c where c.id = case_id and (c.created_by = auth.uid() or c.assigned_lawyer_id = auth.uid() or public.is_admin())));

create policy "documents_select_related" on public.documents for select to authenticated using (owner_id = auth.uid() or exists (select 1 from public.cases c where c.id = case_id and (c.created_by = auth.uid() or c.assigned_lawyer_id = auth.uid() or public.is_admin())));
create policy "documents_insert_owner" on public.documents for insert to authenticated with check (owner_id = auth.uid() or public.is_admin());
create policy "documents_update_related" on public.documents for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

create policy "messages_select_related" on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());
create policy "messages_insert_sender" on public.messages for insert to authenticated with check (sender_id = auth.uid() or public.is_admin());
create policy "messages_update_recipient" on public.messages for update to authenticated using (recipient_id = auth.uid() or public.is_admin()) with check (recipient_id = auth.uid() or public.is_admin());

create policy "payments_select_owner_or_admin" on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "subscriptions_select_owner_or_admin" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "public_select_blog_categories" on public.blog_categories for select to anon, authenticated using (true);
create policy "public_select_published_blog_posts" on public.blog_posts for select to anon, authenticated using (status = 'publié');
create policy "admin_manage_blog_categories" on public.blog_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_manage_blog_posts" on public.blog_posts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin_select_audit_logs" on public.audit_logs for select to authenticated using (public.is_admin());
create policy "admin_insert_audit_logs" on public.audit_logs for insert to authenticated with check (public.is_admin());

insert into public.blog_categories (name, slug) values
  ('Droit du travail', 'droit-du-travail'),
  ('Recouvrement', 'recouvrement'),
  ('Bail et immobilier', 'bail-et-immobilier'),
  ('Contrats', 'contrats'),
  ('Droit des sociétés', 'droit-des-societes'),
  ('RGPD', 'rgpd'),
  ('IA et droit', 'ia-et-droit'),
  ('Conseils pratiques', 'conseils-pratiques')
on conflict (slug) do nothing;
