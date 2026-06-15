-- ClairDossier — schema initial (comptes + dossiers + documents)
-- Cible : PME, artisans, entreprises individuelles, professions libérales.

-- ── profiles : profil pro rattaché à l'utilisateur auth ───────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company_name text,
  company_type text check (
    company_type in (
      'pme', 'artisan', 'entreprise-individuelle', 'profession-liberale', 'particulier', 'autre'
    )
  ),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── dossiers : un dossier administratif/juridique structuré ───────────────────
create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  typology text not null,
  title text,
  status text not null default 'brouillon',
  answers jsonb not null default '{}'::jsonb,
  legal_review_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dossiers_user_id_idx on public.dossiers (user_id);

-- ── documents : métadonnées des pièces (fichiers dans le bucket 'documents') ───
create table if not exists public.dossier_documents (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists dossier_documents_dossier_id_idx on public.dossier_documents (dossier_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.dossiers enable row level security;
alter table public.dossier_documents enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "dossiers_select_own" on public.dossiers for select using (auth.uid() = user_id);
create policy "dossiers_insert_own" on public.dossiers for insert with check (auth.uid() = user_id);
create policy "dossiers_update_own" on public.dossiers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dossiers_delete_own" on public.dossiers for delete using (auth.uid() = user_id);

create policy "docs_select_own" on public.dossier_documents for select using (auth.uid() = user_id);
create policy "docs_insert_own" on public.dossier_documents for insert with check (auth.uid() = user_id);
create policy "docs_delete_own" on public.dossier_documents for delete using (auth.uid() = user_id);

-- ── updated_at auto ───────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists dossiers_touch on public.dossiers;
create trigger dossiers_touch before update on public.dossiers
  for each row execute function public.touch_updated_at();

-- ── profil auto-créé à l'inscription (lit les metadata du signup) ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, company_name, company_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'company_type'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── bucket privé pour les pièces déposées ─────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- chaque fichier vit sous <user_id>/... → l'utilisateur ne voit que ses fichiers
create policy "docs_storage_select_own" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "docs_storage_insert_own" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "docs_storage_delete_own" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
