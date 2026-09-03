-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 12 du plan de build : agent ECHO — RGPD, données
-- sensibles, traçabilité (PARTIE 4.2, 4.3, 5.2 E7, 9.3, 9.4, 11 ; D-013).
--
-- Additive et rejouable. « Privacy by design : les contrôles sont des tests
-- automatisés, pas des promesses » (9.3) : cette migration donne à ECHO ce que la
-- base peut garantir seule :
--   * finalités déclarées (chaque exécution d'agent en porte une) et base légale ;
--   * consentement exigible par finalité (décision juridique humaine : la valeur
--     par défaut, « non requis » sous base légale « contrat », est à confirmer) ;
--   * verdict ECHO porté par chaque exécution contrôlée ;
--   * politiques de conservation par type de dossier (durées à fixer par un humain :
--     NULL = aucune purge automatique) et purge journalisée, serveur uniquement ;
--   * export d'un dossier par son propriétaire (droit d'accès / portabilité).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Finalités et base légale ─────────────────────────────────────────────
create table if not exists public.finalites (
  code text primary key,
  description text not null,
  base_legale text not null check (base_legale in ('consentement', 'contrat', 'obligation_legale', 'interet_legitime')),
  consentement_requis boolean not null default false,
  categories_sensibles_admises text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.finalites (code, description, base_legale, consentement_requis, categories_sensibles_admises) values
  ('analyse_ia', 'Organisation et analyse des pièces d''un dossier par les agents ClairDossier (extraction, classement, chronologie, synthèse)', 'contrat', false, '{}'),
  ('notification_equipe', 'Notification interne d''une nouvelle activité (référence opaque, aucune donnée nominative)', 'interet_legitime', false, '{}'),
  ('transmission_professionnel', 'Transmission d''un dossier structuré à un professionnel choisi par l''utilisateur', 'consentement', true, '{}')
on conflict (code) do nothing;
alter table public.finalites enable row level security;
drop policy if exists "finalites_select" on public.finalites;
create policy "finalites_select" on public.finalites for select using (auth.uid() is not null);

alter table public.agent_runs add column if not exists finalite text references public.finalites (code);
update public.agent_runs set finalite = 'analyse_ia' where finalite is null;
alter table public.agent_runs alter column finalite set default 'analyse_ia';

-- ── 2. Verdict ECHO sur chaque exécution contrôlée ──────────────────────────
alter table public.agent_runs add column if not exists echo_run_id uuid references public.agent_runs (id) on delete set null;
alter table public.agent_runs add column if not exists echo_verdict text;
alter table public.agent_runs drop constraint if exists agent_runs_echo_verdict_check;
alter table public.agent_runs add constraint agent_runs_echo_verdict_check
  check (echo_verdict is null or echo_verdict in ('accepte', 'minimise', 'bloque'));

create or replace function public.enregistrer_controle_echo(p_run_id uuid, p_echo_run_id uuid, p_verdict text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_controle_echo est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  update public.agent_runs set echo_run_id = p_echo_run_id, echo_verdict = p_verdict where id = p_run_id;
end;
$$;
revoke all on function public.enregistrer_controle_echo(uuid, uuid, text) from public, anon, authenticated;

-- Consentement effectif d'un tenant pour une finalité (dernier enregistrement non retiré).
create or replace function public.consentement_effectif(p_tenant_id uuid, p_finalite text)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((
    select c.accorde and c.retire_le is null
      from public.consentements c
     where c.tenant_id = p_tenant_id and c.finalite = p_finalite
     order by c.date desc limit 1), false);
$$;
revoke all on function public.consentement_effectif(uuid, text) from public, anon;
grant execute on function public.consentement_effectif(uuid, text) to authenticated;

-- ── 3. Conservation et purge ────────────────────────────────────────────────
-- Durées NULL : aucune purge automatique tant qu'un humain n'a pas fixé la durée
-- par type de dossier (décision juridique, PARTIE 9.3 « conservation »).
create table if not exists public.politiques_conservation (
  typology text primary key,
  duree_jours_apres_archive integer check (duree_jours_apres_archive is null or duree_jours_apres_archive > 0),
  motif text,
  updated_at timestamptz not null default now()
);
insert into public.politiques_conservation (typology, duree_jours_apres_archive, motif)
select distinct typology, null::integer, 'durée à fixer (décision humaine)' from public.dossiers where typology is not null
on conflict (typology) do nothing;
insert into public.politiques_conservation (typology, duree_jours_apres_archive, motif) values ('*', null, 'valeur par défaut : aucune purge automatique')
on conflict (typology) do nothing;
alter table public.politiques_conservation enable row level security;
drop policy if exists "politiques_conservation_select" on public.politiques_conservation;
create policy "politiques_conservation_select" on public.politiques_conservation for select using (auth.uid() is not null);

-- Date d'archivage : posée quand le statut passe à « archive » (vocabulaire réel de la
-- colonne `status`), effacée s'il en sort ; un client ne la fixe pas lui-même.
alter table public.dossiers add column if not exists archive_le timestamptz;
create or replace function public.dossiers_dater_archivage()
returns trigger language plpgsql as $$
begin
  if new.status = 'archive' and (tg_op = 'INSERT' or old.status is distinct from 'archive') then
    new.archive_le := case when public.est_appel_client() then now() else coalesce(new.archive_le, now()) end;
  elsif new.status is distinct from 'archive' then
    new.archive_le := null;
  elsif tg_op = 'UPDATE' and public.est_appel_client() then
    new.archive_le := old.archive_le;
  end if;
  return new;
end;
$$;
drop trigger if exists dossiers_dater_archivage on public.dossiers;
create trigger dossiers_dater_archivage before insert or update of status, archive_le on public.dossiers
  for each row execute function public.dossiers_dater_archivage();
update public.dossiers set archive_le = coalesce(archive_le, updated_at) where status = 'archive' and archive_le is null;

-- Dossiers dont la durée de conservation après archivage est écoulée.
create or replace function public.dossiers_a_purger()
returns table (dossier_id uuid, tenant_id uuid, typology text, archive_le timestamptz, purge_prevue_le timestamptz)
language sql security definer stable set search_path = public as $$
  select d.id, d.tenant_id, d.typology, d.archive_le,
         d.archive_le + make_interval(days => coalesce(p.duree_jours_apres_archive, pd.duree_jours_apres_archive))
    from public.dossiers d
    left join public.politiques_conservation p on p.typology = d.typology
    left join public.politiques_conservation pd on pd.typology = '*'
   where d.archive_le is not null
     and coalesce(p.duree_jours_apres_archive, pd.duree_jours_apres_archive) is not null
     and d.archive_le + make_interval(days => coalesce(p.duree_jours_apres_archive, pd.duree_jours_apres_archive)) <= now();
$$;
revoke all on function public.dossiers_a_purger() from public, anon, authenticated;

-- Purge : suppression physique du dossier et de tout ce qui en dépend (cascade),
-- en contexte « systeme » (les corrections humaines n'y font pas obstacle : le droit
-- à l'effacement prime), journalisée AVANT la suppression avec identifiants seuls.
create or replace function public.purger_dossier(p_dossier_id uuid, p_motif text default 'conservation_expiree')
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.dossiers%rowtype; n_docs integer; n_entites integer;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: purger_dossier est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then
    raise exception 'DOSSIER_INCONNU: %', p_dossier_id using errcode = 'no_data_found';
  end if;
  select count(*) into n_docs from public.dossier_documents where dossier_id = d.id;
  select count(*) into n_entites from public.entites where dossier_id = d.id;
  perform set_config('clair.acteur', 'systeme', true);
  perform public.journaliser('dossier.purge', 'dossier', d.id, d.tenant_id, d.id,
    jsonb_build_object('typology', d.typology, 'archive_le', d.archive_le, 'nb_documents', n_docs, 'nb_entites', n_entites),
    jsonb_build_object('motif', p_motif), 'systeme');
  -- Parents d'abord (entités, événements) : la contrainte d'ancrage (I2) ne voit
  -- jamais une entité privée de ses sources ; puis pièces, puis dossier (cascades).
  delete from public.entites where dossier_id = d.id;
  delete from public.evenements where dossier_id = d.id;
  delete from public.dossier_documents where dossier_id = d.id;
  delete from public.dossiers where id = d.id;
  return jsonb_build_object('dossier_id', d.id, 'nb_documents', n_docs, 'nb_entites', n_entites, 'motif', p_motif);
end;
$$;
revoke all on function public.purger_dossier(uuid, text) from public, anon, authenticated;

-- Contrainte d'ancrage (socle, D-005) : l'événement différé « après insertion » est
-- rejoué au commit même si la ligne a été supprimée entre-temps dans la même
-- transaction (purge, orpheline retirée). Vérifié par exécution : une purge suivie
-- de la vérification des contraintes levait ANCRAGE_REQUIS sur des entités déjà
-- supprimées. Une ligne disparue n'a plus rien à prouver.
create or replace function public.verifier_ancrage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  src_table text := tg_argv[0];
  fk text := tg_argv[1];
  n integer;
  nature_val text;
  existe boolean;
begin
  execute format('select exists (select 1 from public.%I where id = $1)', tg_table_name) into existe using new.id;
  if not existe then
    return null; -- supprimée depuis l'insertion : rien à protéger
  end if;
  -- Les déclarations du client et les déductions sont exemptées (PARTIE 6).
  begin
    nature_val := to_jsonb(new) ->> 'nature';
    if nature_val is null then
      nature_val := to_jsonb(new) ->> 'nature_assertion';
    end if;
  exception when others then
    nature_val := null;
  end;
  if nature_val in ('declaration_client', 'deduction') then
    return null;
  end if;
  execute format('select count(*) from public.%I where %I = $1', src_table, fk)
    into n using new.id;
  if n = 0 then
    raise exception 'ANCRAGE_REQUIS: % % sans source (I2)', tg_table_name, new.id
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

-- ── 4. Droit d'accès et portabilité : export d'un dossier par son propriétaire ─
-- SECURITY INVOKER : la RLS du lecteur s'applique à chaque table lue.
create or replace function public.exporter_dossier(p_dossier_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'exporte_le', now(),
    'dossier', (select to_jsonb(d) - 'answers' || jsonb_build_object('answers', d.answers) from public.dossiers d where d.id = p_dossier_id),
    'pieces', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
                 from (select id, file_name, nom_normalise, kind, mime, size_bytes, pages, categorie, confiance_classification,
                              statut_ingestion, hash_sha256, doublon_de_id, quasi_doublon_de_id, supprime_le, created_at
                         from public.dossier_documents where dossier_id = p_dossier_id) x),
    'entites', (select coalesce(jsonb_agg(to_jsonb(x) order by x.type, x.valeur_normalisee), '[]'::jsonb)
                  from (select id, type, valeur_normalisee, valeur_brute, nature, confiance, verrouille_humain from public.entites where dossier_id = p_dossier_id) x),
    'evenements', (select coalesce(jsonb_agg(to_jsonb(x) order by x.date), '[]'::jsonb)
                     from (select id, date, date_precision, nature, description, nature_assertion, confiance from public.evenements where dossier_id = p_dossier_id) x),
    'echeances', (select coalesce(jsonb_agg(to_jsonb(x) order by x.date), '[]'::jsonb)
                    from (select id, date, nature, criticite, base_de_calcul, confiance, verifiee_humain, statut from public.echeances where dossier_id = p_dossier_id) x),
    'productions', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
                      from (select id, agent, type, titre, contenu_texte, statut_validation, valide_le, envoye_le, version, created_at from public.productions where dossier_id = p_dossier_id) x),
    'journal', (select coalesce(jsonb_agg(to_jsonb(x) order by x.horodatage), '[]'::jsonb)
                  from (select action, objet_type, objet_id, acteur_type, horodatage from public.audit_log where dossier_id = p_dossier_id) x)
  )
  where exists (select 1 from public.dossiers where id = p_dossier_id);
$$;
revoke all on function public.exporter_dossier(uuid) from public, anon;
grant execute on function public.exporter_dossier(uuid) to authenticated;
