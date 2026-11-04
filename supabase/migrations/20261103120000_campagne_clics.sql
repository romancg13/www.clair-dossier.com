-- Lien court de campagne /v (Village de la Justice, 2026-11-03) — MIGRATION
-- ADDITIVE, idempotente et rejouable. Aucune donnée existante modifiée.
--
-- Compteur AGRÉGÉ de clics par jour (Europe/Paris) et par source :
--   * aucune donnée personnelle : ni IP, ni user-agent, ni cookie, ni identifiant ;
--   * un clic = un chargement de /v par un navigateur exécutant JavaScript, hors
--     robots et prévisualisations connus (filtrés par la page) — ce ne sont PAS
--     des visiteurs uniques ;
--   * écriture uniquement par record_campaign_click() (source sur liste fermée) ;
--   * lecture réservée à l'administrateur (is_admin(), table app_admins).

create table if not exists public.campaign_clicks (
  source text not null,
  day date not null,
  clicks integer not null default 0 check (clicks >= 0),
  primary key (source, day)
);

alter table public.campaign_clicks enable row level security;
revoke all on public.campaign_clicks from public, anon, authenticated;
grant select on public.campaign_clicks to authenticated;

drop policy if exists campaign_clicks_admin_read on public.campaign_clicks;
create policy campaign_clicks_admin_read on public.campaign_clicks
  for select to authenticated
  using (public.is_admin());

-- ponytail: aucun plafond par client (rien d'identifiant n'est stocké) — un appel
-- direct à la RPC peut gonfler le compteur ; borné à 5 000 par jour et par source.
-- Chiffres indicatifs, à recouper. (L'hébergeur Supabase journalise techniquement
-- les requêtes HTTP, IP comprise, selon la rétention de son offre.)
create or replace function public.record_campaign_click(p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source is null or p_source not in ('village-justice') then
    return; -- source inconnue : ignorée sans erreur (la redirection ne dépend jamais du comptage)
  end if;
  insert into public.campaign_clicks (source, day, clicks)
  values (p_source, (now() at time zone 'Europe/Paris')::date, 1)
  on conflict (source, day) do update set clicks = public.campaign_clicks.clicks + 1
    where public.campaign_clicks.clicks < 5000;
end;
$$;
revoke all on function public.record_campaign_click(text) from public;
grant execute on function public.record_campaign_click(text) to anon, authenticated;
comment on function public.record_campaign_click(text) is
  'Incrémente le compteur agrégé du jour pour une source de campagne autorisée. Aucune donnée personnelle.';
