-- Application mobile (2026-09-16) — MIGRATION ADDITIVE, rétrocompatible.
--
-- Une seule table nouvelle : les jetons d'appareil pour d'éventuelles
-- notifications à distance. Aucune table, colonne, policy ou donnée existante
-- n'est modifiée ; le site web est strictement inchangé et l'application
-- mobile fonctionne à l'identique tant que cette migration n'est pas appliquée
-- (la capacité est détectée à l'exécution).
--
-- Important : ClairDossier n'ÉMET aujourd'hui aucune notification automatique
-- (voir /etat-du-produit). Cette table prépare l'infrastructure ; l'envoi
-- éventuel se fera côté serveur, avec une clé privilégiée, jamais depuis
-- l'appareil.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Jeton Expo/APNs/FCM. Unique : un appareil réinstallé écrase son entrée.
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

-- Cloisonnement strict : chacun ne voit et ne gère que SES appareils.
-- (Aucun accès administrateur ici : l'envoi serveur utilisera la clé de service.)
drop policy if exists "push_tokens_select_own" on public.device_push_tokens;
create policy "push_tokens_select_own" on public.device_push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on public.device_push_tokens;
create policy "push_tokens_insert_own" on public.device_push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update_own" on public.device_push_tokens;
create policy "push_tokens_update_own" on public.device_push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on public.device_push_tokens;
create policy "push_tokens_delete_own" on public.device_push_tokens
  for delete using (auth.uid() = user_id);

comment on table public.device_push_tokens is
  'Jetons de notification par appareil (application mobile). Consentement explicite de l''utilisateur ; révocable depuis Compte → Notifications et à la déconnexion.';
