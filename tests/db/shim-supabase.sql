-- Shim minimal de l'environnement Supabase pour appliquer les migrations sur un
-- Postgres 16 local (tests). Reproduit uniquement ce dont les migrations et les
-- policies ont besoin : rôles applicatifs, schémas auth / storage / extensions / net,
-- auth.uid() piloté par un paramètre de session, storage.foldername(), stub pg_net.
--
-- Ce fichier n'est JAMAIS appliqué en production : Supabase fournit le vrai socle.
-- Usage : tests/db/apply-migrations.sh

-- ── Rôles applicatifs ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase : privilèges par défaut sur les objets créés par les migrations.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ── Schémas ───────────────────────────────────────────────────────────────────
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create schema if not exists net;
grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

-- ── auth ──────────────────────────────────────────────────────────────────────
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid() lit le claim "sub" posé par les tests :
--   select set_config('request.jwt.claim.sub', '<uuid>', true);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

-- ── storage ───────────────────────────────────────────────────────────────────
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

-- Comme Supabase : segments du chemin sans le nom de fichier.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- ── net (stub pg_net) ────────────────────────────────────────────────────────
-- pg_net n'est pas installable en local : http_post ne fait rien et renvoie 1.
create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint
language sql as $$ select 1::bigint $$;
