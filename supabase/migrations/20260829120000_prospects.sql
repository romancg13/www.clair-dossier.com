-- ClairDossier — capture de prospects côté serveur (Vague 0 Lot 2.2 + chantier A1 v0)
--
-- Modèle d'accès (le point le plus sensible du lot) :
--   * TOUTE écriture passe par l'Edge Function submit-prospect (service role) :
--     AUCUNE policy insert pour anon/authenticated — un navigateur ne peut pas
--     écrire directement dans la table, même avec la clé anon.
--   * Lecture et mise à jour de statut réservées à l'admin global via
--     public.is_admin() (même modèle anti-escalade que app_admins).
--   * Par conception, aucun champ de donnée sensible (art. 9 RGPD).
--
-- Migration ADDITIVE : ne touche aucune table existante.

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Déclaré par le visiteur (validé par l'Edge Function, jamais brut)
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  organization text check (char_length(organization) <= 160),
  segment text not null check (
    segment in (
      'pme', 'artisan', 'independant', 'profession-liberale',
      'cabinet-avocats', 'expert-comptable', 'grand-compte',
      'particulier', 'autre'
    )
  ),
  topic text not null check (
    topic in ('demo', 'commercial', 'support', 'presse', 'rendez-vous', 'devis')
  ),
  message text not null check (char_length(message) <= 4000),
  creneaux text check (char_length(creneaux) <= 500),

  -- Contexte de navigation (minimisation : chemin interne + referrer)
  source_page text not null check (char_length(source_page) <= 300),
  referrer text check (char_length(referrer) <= 500),

  -- Qualification A1 v0 (déterministe — supabase/functions/submit-prospect/scoring.ts)
  score_potentiel int not null default 0,
  routage text not null default 'libre-service' check (
    routage in ('libre-service', 'demonstration', 'devis')
  ),
  human_flags jsonb not null default '[]'::jsonb,
  -- Journal d'audit écrit AVANT la réponse (règle commune n°4 des agents)
  audit_log jsonb not null default '[]'::jsonb,

  -- Suivi commercial (mis à jour par l'admin uniquement)
  statut text not null default 'nouveau' check (
    statut in ('nouveau', 'contacte', 'converti', 'clos')
  )
);

create index if not exists prospects_created_at_idx on public.prospects (created_at desc);
create index if not exists prospects_email_idx on public.prospects (email);

alter table public.prospects enable row level security;

-- Fermer les grants par défaut, puis ne rouvrir que le nécessaire :
-- l'admin (rôle authenticated + is_admin()) lit et met à jour le statut.
revoke all on public.prospects from anon, authenticated;
grant select, update on public.prospects to authenticated;

drop policy if exists "prospects_select_admin" on public.prospects;
create policy "prospects_select_admin" on public.prospects
  for select using (public.is_admin());

drop policy if exists "prospects_update_admin" on public.prospects;
create policy "prospects_update_admin" on public.prospects
  for update using (public.is_admin()) with check (public.is_admin());

drop trigger if exists prospects_touch on public.prospects;
create trigger prospects_touch before update on public.prospects
  for each row execute function public.touch_updated_at();

-- ── Journal de limitation de débit ────────────────────────────────────────────
-- Aucune donnée nominative : hachés salés (SHA-256) de l'IP et de l'e-mail.
-- Rétention courte : l'Edge Function purge les lignes de plus de 24 h.
create table if not exists public.prospect_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  email_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists prospect_rate_limits_ip_idx
  on public.prospect_rate_limits (ip_hash, created_at desc);
create index if not exists prospect_rate_limits_email_idx
  on public.prospect_rate_limits (email_hash, created_at desc);

alter table public.prospect_rate_limits enable row level security;
-- Aucune policy + revoke : table invisible et inaccessible aux rôles
-- applicatifs, seule la service role (Edge Function) y accède.
revoke all on public.prospect_rate_limits from anon, authenticated;
