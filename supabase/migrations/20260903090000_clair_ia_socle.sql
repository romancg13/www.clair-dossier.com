-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 3 du plan de build : socle de données de l'IA
-- (docs/MASTER-PROMPT-IA-CLAIRDOSSIER.md, PARTIE 7.2 ; DECISIONS.md D-004, D-005).
--
-- Règles de cette migration :
--   * ADDITIVE et REJOUABLE : aucune table, colonne, policy ou fonction existante
--     n'est supprimée ni modifiée de façon incompatible. Tout est « if not exists »
--     ou « create or replace » / « drop ... if exists » + « create ».
--   * Le cloisonnement existant par user_id (policies *_own) est CONSERVÉ. Un
--     cloisonnement par tenant est AJOUTÉ à côté : chaque utilisateur existant
--     reçoit un tenant « personnel » dont il est propriétaire ; les dossiers
--     existants y sont rattachés (backfill) ; les nouveaux dossiers y sont
--     rattachés automatiquement (trigger) sans changer le code client (I11).
--   * Aucune entité, aucun événement, aucune échéance ne peut exister sans au
--     moins une source (I2) : contraintes différées vérifiées au commit.
--   * audit_log est en écriture seule : insert via fonction SECURITY DEFINER,
--     update/delete interdits par trigger, même pour service_role.
--   * Une correction humaine n'est jamais écrasée par un agent (I5, F11) :
--     verrou « verrouille_humain » + trigger.
--   * Les droits d'abonnement sont portés par tenants.plan / statut_abonnement
--     (I7) : lecture serveur uniquement, écriture réservée (aucune policy client).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Extensions ────────────────────────────────────────────────────────────
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- ── 1. Tenants et appartenance ──────────────────────────────────────────────
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  raison_sociale text,
  type text not null default 'personnel'
    check (type in ('personnel', 'organisation')),
  plan text not null default 'gratuit',
  statut_abonnement text not null default 'aucun'
    check (statut_abonnement in ('aucun', 'actif', 'suspendu', 'resilie')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'proprietaire'
    check (role in ('proprietaire', 'administrateur', 'membre', 'lecteur')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_members_user_id_idx on public.tenant_members (user_id);

drop trigger if exists tenants_touch on public.tenants;
create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

-- Helpers d'accès (SECURITY DEFINER : contournent la RLS de tenant_members pour
-- éviter toute récursion ; ne renvoient qu'un booléen / un rôle pour l'appelant).
create or replace function public.is_tenant_member(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = t and m.user_id = auth.uid()
  );
$$;

-- Variante VOLATILE, réservée aux policies d'INSERT : elle voit les lignes créées
-- par les triggers BEFORE de la même instruction (tenant personnel créé à la volée),
-- ce qu'une fonction STABLE, qui lit le snapshot de début d'instruction, ne voit pas.
create or replace function public.is_tenant_member_now(t uuid)
returns boolean language sql security definer volatile set search_path = public as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = t and m.user_id = auth.uid()
  );
$$;

create or replace function public.tenant_role(t uuid)
returns text language sql security definer stable set search_path = public as $$
  select m.role from public.tenant_members m
  where m.tenant_id = t and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_write_tenant(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.tenant_role(t) in ('proprietaire', 'administrateur', 'membre'), false);
$$;

create or replace function public.can_admin_tenant(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.tenant_role(t) in ('proprietaire', 'administrateur'), false);
$$;

-- Tenant personnel d'un utilisateur (créé à la volée si absent).
create or replace function public.personal_tenant_id(u uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select m.tenant_id
  from public.tenant_members m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = u and t.type = 'personnel' and m.role = 'proprietaire'
  order by m.created_at
  limit 1;
$$;

create or replace function public.ensure_personal_tenant(u uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t uuid;
  libelle text;
begin
  if u is null then
    return null;
  end if;
  t := public.personal_tenant_id(u);
  if t is not null then
    return t;
  end if;
  select coalesce(nullif(p.company_name, ''), nullif(p.full_name, ''))
    into libelle
    from public.profiles p where p.id = u;
  insert into public.tenants (type, raison_sociale) values ('personnel', libelle)
    returning id into t;
  insert into public.tenant_members (tenant_id, user_id, role)
    values (t, u, 'proprietaire')
    on conflict (tenant_id, user_id) do nothing;
  return t;
end;
$$;

revoke all on function public.is_tenant_member(uuid) from public, anon;
revoke all on function public.is_tenant_member_now(uuid) from public, anon;
grant execute on function public.is_tenant_member_now(uuid) to authenticated;
revoke all on function public.tenant_role(uuid) from public, anon;
revoke all on function public.can_write_tenant(uuid) from public, anon;
revoke all on function public.can_admin_tenant(uuid) from public, anon;
revoke all on function public.personal_tenant_id(uuid) from public, anon;
revoke all on function public.ensure_personal_tenant(uuid) from public, anon, authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.tenant_role(uuid) to authenticated;
grant execute on function public.can_write_tenant(uuid) to authenticated;
grant execute on function public.can_admin_tenant(uuid) to authenticated;
grant execute on function public.personal_tenant_id(uuid) to authenticated;

-- Création automatique du tenant personnel à l'inscription (après le profil).
create or replace function public.handle_new_profile_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_personal_tenant(new.id);
  return new;
end;
$$;
drop trigger if exists on_new_profile_tenant on public.profiles;
create trigger on_new_profile_tenant after insert on public.profiles
  for each row execute function public.handle_new_profile_tenant();

-- Backfill : un tenant personnel pour chaque utilisateur existant.
do $$
declare r record;
begin
  for r in select u.id from auth.users u loop
    perform public.ensure_personal_tenant(r.id);
  end loop;
end $$;

-- Policies tenants / tenant_members (lecture pour les membres, admin global en lecture).
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

drop policy if exists "tenants_select_member" on public.tenants;
create policy "tenants_select_member" on public.tenants
  for select using (public.is_tenant_member(id));
drop policy if exists "tenants_update_admin_tenant" on public.tenants;
create policy "tenants_update_admin_tenant" on public.tenants
  for update using (public.can_admin_tenant(id)) with check (public.can_admin_tenant(id));
drop policy if exists "tenants_select_admin" on public.tenants;
create policy "tenants_select_admin" on public.tenants
  for select using (public.is_admin());

drop policy if exists "tenant_members_select_member" on public.tenant_members;
create policy "tenant_members_select_member" on public.tenant_members
  for select using (public.is_tenant_member(tenant_id));
drop policy if exists "tenant_members_write_admin_tenant" on public.tenant_members;
create policy "tenant_members_write_admin_tenant" on public.tenant_members
  for all using (public.can_admin_tenant(tenant_id)) with check (public.can_admin_tenant(tenant_id));
drop policy if exists "tenant_members_select_admin" on public.tenant_members;
create policy "tenant_members_select_admin" on public.tenant_members
  for select using (public.is_admin());

-- Un appel « client » est un appel porteur d'une identité utilisateur ou d'un rôle
-- client (anon / authenticated), quel que soit le chemin (PostgREST pose le rôle,
-- le JWT porte la revendication). Le rôle de service (Edge Functions, webhooks)
-- n'en est pas un : c'est lui qui écrit ce que le client n'a pas le droit d'écrire.
create or replace function public.est_appel_client()
returns boolean language sql stable as $$
  select auth.uid() is not null
      or current_user in ('anon', 'authenticated')
      or coalesce(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           '') in ('anon', 'authenticated');
$$;

-- Le plan, le statut d'abonnement et le type du tenant ne sont modifiables que
-- côté serveur (I7) : la policy d'update ci-dessus ne doit pas permettre de
-- changer ces colonnes.
create or replace function public.tenants_protect_plan()
returns trigger language plpgsql as $$
begin
  if public.est_appel_client()
     and (new.plan is distinct from old.plan
          or new.statut_abonnement is distinct from old.statut_abonnement
          or new.type is distinct from old.type) then
    raise exception 'ABONNEMENT_SERVEUR_UNIQUEMENT: plan, statut_abonnement et type ne sont pas modifiables par le client (I7)'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists tenants_protect_plan on public.tenants;
create trigger tenants_protect_plan before update on public.tenants
  for each row execute function public.tenants_protect_plan();

-- Gouvernance des membres : seul un propriétaire nomme ou touche un propriétaire ;
-- le dernier propriétaire d'un tenant ne peut être ni rétrogradé ni retiré par un
-- client. (Vérifié par exécution : un « administrateur » pouvait se promouvoir puis
-- retirer le propriétaire.) Le serveur n'est pas soumis à ces gardes (suppression
-- de compte en cascade, support).
create or replace function public.tenant_members_garde()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_role text;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- Amorçage : le premier membre d'un tenant encore vide est son propriétaire
  -- (tenant personnel créé à la volée par ensure_personal_tenant, dans le contexte
  -- d'un utilisateur authentifié). Un client ne peut pas créer de tenant lui-même.
  if tg_op = 'INSERT' and not exists (select 1 from public.tenant_members m where m.tenant_id = new.tenant_id) then
    return new;
  end if;
  v_tenant := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;
  v_role := public.tenant_role(v_tenant);
  if v_role is distinct from 'proprietaire' and (
       (tg_op in ('INSERT', 'UPDATE') and new.role = 'proprietaire')
    or (tg_op in ('UPDATE', 'DELETE') and old.role = 'proprietaire')) then
    raise exception 'ROLE_PROPRIETAIRE_RESERVE: seul un propriétaire peut nommer ou modifier un propriétaire'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'proprietaire'
     and (tg_op = 'DELETE' or new.role <> 'proprietaire' or new.user_id <> old.user_id or new.tenant_id <> old.tenant_id)
     and not exists (
       select 1 from public.tenant_members m
       where m.tenant_id = old.tenant_id and m.role = 'proprietaire' and m.user_id <> old.user_id
     ) then
    raise exception 'DERNIER_PROPRIETAIRE: un tenant conserve au moins un propriétaire'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists tenant_members_garde on public.tenant_members;
create trigger tenant_members_garde before insert or update or delete on public.tenant_members
  for each row execute function public.tenant_members_garde();

-- ── 2. Dossiers : rattachement au tenant + champs cibles ────────────────────
alter table public.dossiers add column if not exists tenant_id uuid references public.tenants (id) on delete restrict;
alter table public.dossiers add column if not exists priorite text not null default 'normale';
alter table public.dossiers add column if not exists objectif text;
alter table public.dossiers add column if not exists parties jsonb not null default '[]'::jsonb;

alter table public.dossiers drop constraint if exists dossiers_priorite_check;
alter table public.dossiers add constraint dossiers_priorite_check
  check (priorite in ('basse', 'normale', 'haute', 'urgente'));

create index if not exists dossiers_tenant_id_idx on public.dossiers (tenant_id);

update public.dossiers d
   set tenant_id = public.ensure_personal_tenant(d.user_id)
 where d.tenant_id is null;

-- Nouveaux dossiers : tenant personnel par défaut, sans changer le code client.
create or replace function public.dossiers_default_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    new.tenant_id := public.ensure_personal_tenant(new.user_id);
  end if;
  return new;
end;
$$;
drop trigger if exists dossiers_default_tenant on public.dossiers;
create trigger dossiers_default_tenant before insert on public.dossiers
  for each row execute function public.dossiers_default_tenant();

alter table public.dossiers alter column tenant_id set not null;

-- Policies tenant sur dossiers, ADDITIVES aux policies *_own existantes.
drop policy if exists "dossiers_select_tenant" on public.dossiers;
create policy "dossiers_select_tenant" on public.dossiers
  for select using (public.is_tenant_member(tenant_id));
drop policy if exists "dossiers_insert_tenant" on public.dossiers;
create policy "dossiers_insert_tenant" on public.dossiers
  for insert with check (public.can_write_tenant(tenant_id) and user_id = auth.uid());
drop policy if exists "dossiers_update_tenant" on public.dossiers;
create policy "dossiers_update_tenant" on public.dossiers
  for update using (public.can_write_tenant(tenant_id)) with check (public.can_write_tenant(tenant_id));
drop policy if exists "dossiers_delete_tenant" on public.dossiers;
create policy "dossiers_delete_tenant" on public.dossiers
  for delete using (public.can_admin_tenant(tenant_id));

-- Policies RESTRICTIVES : les policies permissives historiques (*_own) s'additionnent
-- par OU ; sans garde-fou, un utilisateur pourrait insérer ou déplacer SON dossier
-- dans un tenant dont il n'est pas membre. L'appartenance au tenant est donc exigée
-- en plus (ET), pour insert et update. La lecture reste inchangée.
drop policy if exists "dossiers_tenant_coherent_insert" on public.dossiers;
create policy "dossiers_tenant_coherent_insert" on public.dossiers as restrictive
  for insert with check (public.is_tenant_member_now(tenant_id));
drop policy if exists "dossiers_tenant_coherent_update" on public.dossiers;
create policy "dossiers_tenant_coherent_update" on public.dossiers as restrictive
  for update using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

-- Le tenant d'un dossier est immuable : un membre de deux tenants pouvait déplacer
-- un dossier en laissant pièces, chunks et entités dans l'ancien tenant (vérifié
-- par exécution). Un transfert de dossier sera une procédure serveur atomique
-- (roadmap), pas une mise à jour de colonne. Le créateur (user_id) n'est pas
-- réassignable par un client.
create or replace function public.dossiers_proteger_colonnes()
returns trigger language plpgsql as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'TENANT_DOSSIER_IMMUABLE: le tenant d''un dossier ne se modifie pas par mise à jour'
      using errcode = 'check_violation';
  end if;
  if public.est_appel_client() and new.user_id is distinct from old.user_id then
    raise exception 'CREATEUR_DOSSIER_IMMUABLE: user_id n''est pas réassignable par le client'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists dossiers_proteger_colonnes on public.dossiers;
create trigger dossiers_proteger_colonnes before update on public.dossiers
  for each row execute function public.dossiers_proteger_colonnes();

-- ── 3. Documents : métadonnées d'ingestion et versionnage (I3) ──────────────
alter table public.dossier_documents add column if not exists tenant_id uuid references public.tenants (id) on delete restrict;
alter table public.dossier_documents add column if not exists nom_normalise text;
alter table public.dossier_documents add column if not exists hash_sha256 text;
alter table public.dossier_documents add column if not exists mime text;
alter table public.dossier_documents add column if not exists pages integer;
alter table public.dossier_documents add column if not exists score_ocr numeric(4,3);
alter table public.dossier_documents add column if not exists categorie text;
alter table public.dossier_documents add column if not exists confiance_classification numeric(4,3);
alter table public.dossier_documents add column if not exists version integer not null default 1;
alter table public.dossier_documents add column if not exists parent_version_id uuid references public.dossier_documents (id) on delete set null;
alter table public.dossier_documents add column if not exists statut_ingestion text not null default 'recu';
alter table public.dossier_documents add column if not exists ingestion_erreur text;
alter table public.dossier_documents add column if not exists updated_at timestamptz not null default now();

alter table public.dossier_documents drop constraint if exists dossier_documents_hash_sha256_check;
alter table public.dossier_documents add constraint dossier_documents_hash_sha256_check
  check (hash_sha256 is null or hash_sha256 ~ '^[0-9a-f]{64}$');
alter table public.dossier_documents drop constraint if exists dossier_documents_score_ocr_check;
alter table public.dossier_documents add constraint dossier_documents_score_ocr_check
  check (score_ocr is null or (score_ocr >= 0 and score_ocr <= 1));
alter table public.dossier_documents drop constraint if exists dossier_documents_confiance_classification_check;
alter table public.dossier_documents add constraint dossier_documents_confiance_classification_check
  check (confiance_classification is null or (confiance_classification >= 0 and confiance_classification <= 1));
alter table public.dossier_documents drop constraint if exists dossier_documents_statut_ingestion_check;
alter table public.dossier_documents add constraint dossier_documents_statut_ingestion_check
  check (statut_ingestion in ('recu', 'doublon', 'extraction', 'qualite_insuffisante', 'decoupe', 'vectorise', 'analyse', 'termine', 'echec'));
alter table public.dossier_documents drop constraint if exists dossier_documents_version_check;
alter table public.dossier_documents add constraint dossier_documents_version_check check (version >= 1);

create index if not exists dossier_documents_user_id_idx on public.dossier_documents (user_id);
create index if not exists dossier_documents_tenant_id_idx on public.dossier_documents (tenant_id);
create index if not exists dossier_documents_hash_idx on public.dossier_documents (dossier_id, hash_sha256) where hash_sha256 is not null;

update public.dossier_documents dd
   set tenant_id = d.tenant_id
  from public.dossiers d
 where d.id = dd.dossier_id and dd.tenant_id is null;

drop trigger if exists dossier_documents_touch on public.dossier_documents;
create trigger dossier_documents_touch before update on public.dossier_documents
  for each row execute function public.touch_updated_at();

-- Les métadonnées d'ingestion et d'identité d'une pièce sont écrites par le
-- serveur (pipeline, admin côté service) : un client authentifié ne peut pas les
-- réécrire (vérifié par exécution : kind, statut_ingestion, hash, file_path étaient
-- modifiables). Restent modifiables par le client : file_name, nom_normalise,
-- categorie (reclassement humain).
create or replace function public.dossier_documents_proteger_metadonnees()
returns trigger language plpgsql as $$
begin
  if public.est_appel_client() and (
       new.kind is distinct from old.kind
    or new.file_path is distinct from old.file_path
    or new.user_id is distinct from old.user_id
    or new.size_bytes is distinct from old.size_bytes
    or new.hash_sha256 is distinct from old.hash_sha256
    or new.mime is distinct from old.mime
    or new.pages is distinct from old.pages
    or new.score_ocr is distinct from old.score_ocr
    or new.confiance_classification is distinct from old.confiance_classification
    or new.version is distinct from old.version
    or new.parent_version_id is distinct from old.parent_version_id
    or new.statut_ingestion is distinct from old.statut_ingestion
    or new.ingestion_erreur is distinct from old.ingestion_erreur
    or new.created_at is distinct from old.created_at) then
    raise exception 'METADONNEES_PIECE_SERVEUR_UNIQUEMENT: ces colonnes de dossier_documents sont réservées au serveur'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_documents_proteger_metadonnees on public.dossier_documents;
create trigger dossier_documents_proteger_metadonnees before update on public.dossier_documents
  for each row execute function public.dossier_documents_proteger_metadonnees();

-- ── 4. Cohérence tenant ↔ dossier (couche d'accès aux données) ──────────────
-- Toute ligne rattachée à un dossier porte le tenant_id de ce dossier ; la
-- valeur est imposée par trigger, jamais par le client.
create or replace function public.set_tenant_from_dossier()
returns trigger language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  -- Le dossier de rattachement est immuable : ses chunks, sources et analyses
  -- ne le suivraient pas.
  if tg_op = 'UPDATE' and new.dossier_id is distinct from old.dossier_id then
    raise exception 'DOSSIER_IMMUABLE: une ligne ne change pas de dossier' using errcode = 'check_violation';
  end if;
  select tenant_id into t from public.dossiers where id = new.dossier_id;
  if t is null then
    raise exception 'DOSSIER_INCONNU: % n''existe pas', new.dossier_id using errcode = 'foreign_key_violation';
  end if;
  if new.tenant_id is not null and new.tenant_id <> t then
    raise exception 'TENANT_INCOHERENT: la ligne ne porte pas le tenant de son dossier' using errcode = 'check_violation';
  end if;
  new.tenant_id := t;
  return new;
end;
$$;

drop trigger if exists dossier_documents_set_tenant on public.dossier_documents;
create trigger dossier_documents_set_tenant before insert or update of dossier_id, tenant_id on public.dossier_documents
  for each row execute function public.set_tenant_from_dossier();

-- ── 5. Chunks (découpage + index cloisonné) ─────────────────────────────────
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  document_id uuid not null references public.dossier_documents (id) on delete cascade,
  page integer not null check (page >= 1),
  offset_debut integer not null check (offset_debut >= 0),
  offset_fin integer not null,
  texte text not null,
  texte_tsv tsvector generated always as (to_tsvector('french', texte)) stored,
  embedding extensions.vector,
  embedding_modele text,
  created_at timestamptz not null default now(),
  constraint document_chunks_offsets_check check (offset_fin > offset_debut),
  constraint document_chunks_unique_span unique (document_id, page, offset_debut)
);
create index if not exists document_chunks_dossier_id_idx on public.document_chunks (dossier_id);
create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);
create index if not exists document_chunks_tsv_idx on public.document_chunks using gin (texte_tsv);
-- L'index vectoriel (hnsw) sera créé à l'étape 7, une fois la dimension du
-- modèle d'embedding fixée : un index hnsw exige une dimension déclarée.

drop trigger if exists document_chunks_set_tenant on public.document_chunks;
create trigger document_chunks_set_tenant before insert or update of dossier_id, tenant_id on public.document_chunks
  for each row execute function public.set_tenant_from_dossier();

-- ── 6. Entités, événements, échéances (ancrage obligatoire, I2 / I6) ────────
create table if not exists public.entites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  type text not null,
  valeur_normalisee text not null,
  valeur_brute text,
  nature text not null default 'piece'
    check (nature in ('piece', 'declaration_client', 'deduction', 'a_verifier')),
  confiance numeric(4,3) not null check (confiance >= 0 and confiance <= 1),
  verrouille_humain boolean not null default false,
  modifie_par uuid references auth.users (id) on delete set null,
  modifie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entites_dossier_id_idx on public.entites (dossier_id);
create index if not exists entites_type_valeur_idx on public.entites (dossier_id, type, valeur_normalisee);

create table if not exists public.entite_sources (
  entite_id uuid not null references public.entites (id) on delete cascade,
  chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  extrait text,
  offset_debut integer,
  offset_fin integer,
  primary key (entite_id, chunk_id)
);

create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  date date not null,
  date_precision text not null default 'certaine'
    check (date_precision in ('certaine', 'probable', 'a_confirmer')),
  nature text not null,
  description text not null,
  nature_assertion text not null default 'piece'
    check (nature_assertion in ('piece', 'declaration_client', 'deduction', 'a_verifier')),
  confiance numeric(4,3) not null check (confiance >= 0 and confiance <= 1),
  verrouille_humain boolean not null default false,
  modifie_par uuid references auth.users (id) on delete set null,
  modifie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evenements_dossier_date_idx on public.evenements (dossier_id, date);

create table if not exists public.evenement_sources (
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  extrait text,
  offset_debut integer,
  offset_fin integer,
  primary key (evenement_id, chunk_id)
);

create table if not exists public.echeances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  date date not null,
  nature text not null,
  criticite text not null default 'normale'
    check (criticite in ('normale', 'importante', 'urgente')),
  base_de_calcul text not null,
  confiance numeric(4,3) not null check (confiance >= 0 and confiance <= 1),
  verifiee_humain boolean not null default false,
  verifiee_par uuid references auth.users (id) on delete set null,
  verifiee_le timestamptz,
  statut text not null default 'a_venir'
    check (statut in ('a_venir', 'echue', 'traitee', 'ecartee')),
  verrouille_humain boolean not null default false,
  modifie_par uuid references auth.users (id) on delete set null,
  modifie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists echeances_dossier_date_idx on public.echeances (dossier_id, date);
create index if not exists echeances_tenant_date_idx on public.echeances (tenant_id, date) where statut = 'a_venir';

create table if not exists public.echeance_sources (
  echeance_id uuid not null references public.echeances (id) on delete cascade,
  chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  extrait text,
  offset_debut integer,
  offset_fin integer,
  primary key (echeance_id, chunk_id)
);

-- Ancrage obligatoire : au commit, chaque entité / événement / échéance a ≥ 1 source
-- (sauf nature « declaration_client » ou « deduction », qui le disent explicitement).
create or replace function public.verifier_ancrage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  src_table text := tg_argv[0];
  fk text := tg_argv[1];
  n integer;
  nature_val text;
begin
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

-- Suppression d'une source :
--   * si le passage (chunk) existe encore, on retire un ancrage à la main : refusé
--     dès que c'est le dernier (I2) ;
--   * si le passage a disparu (pièce supprimée, cascade), l'assertion n'a plus de
--     preuve : elle est supprimée et journalisée (I1, I2) — sauf si un humain l'a
--     verrouillée : la suppression de la pièce est alors refusée (I3, F11), il faut
--     d'abord lever ou retirer la correction.
create or replace function public.verifier_ancrage_restant()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent_table text := tg_argv[0];
  fk text := tg_argv[1];
  parent_id uuid := (to_jsonb(old) ->> fk)::uuid;
  n integer;
  parent jsonb;
  nature_val text;
  chunk_exists boolean;
begin
  execute format('select to_jsonb(p) from public.%I p where id = $1', parent_table)
    into parent using parent_id;
  if parent is null then
    return null; -- parent supprimé (cascade) : rien à protéger
  end if;
  nature_val := coalesce(parent ->> 'nature', parent ->> 'nature_assertion');
  if nature_val in ('declaration_client', 'deduction') then
    return null;
  end if;
  execute format('select count(*) from public.%I where %I = $1', tg_table_name, fk)
    into n using parent_id;
  if n > 0 then
    return null;
  end if;
  select exists (select 1 from public.document_chunks c where c.id = old.chunk_id) into chunk_exists;
  if chunk_exists then
    raise exception 'ANCRAGE_REQUIS: % % perdrait sa dernière source (I2)', parent_table, parent_id
      using errcode = 'check_violation';
  end if;
  if (parent ->> 'verrouille_humain')::boolean then
    raise exception 'PIECE_FONDE_CORRECTION_HUMAINE: % % a été corrigé par un humain et repose sur un passage supprimé ; levez ou retirez la correction avant de retirer la pièce (I3, F11)',
      parent_table, parent_id using errcode = 'check_violation';
  end if;
  execute format('delete from public.%I where id = $1', parent_table) using parent_id;
  perform public.journaliser('analyse.orpheline_supprimee', parent_table, parent_id,
    (parent ->> 'tenant_id')::uuid, (parent ->> 'dossier_id')::uuid,
    parent - 'tenant_id' - 'dossier_id', null);
  return null;
end;
$$;

drop trigger if exists entites_ancrage on public.entites;
create constraint trigger entites_ancrage after insert on public.entites
  deferrable initially deferred for each row
  execute function public.verifier_ancrage('entite_sources', 'entite_id');
drop trigger if exists entite_sources_ancrage_restant on public.entite_sources;
create constraint trigger entite_sources_ancrage_restant after delete on public.entite_sources
  deferrable initially deferred for each row
  execute function public.verifier_ancrage_restant('entites', 'entite_id');

drop trigger if exists evenements_ancrage on public.evenements;
create constraint trigger evenements_ancrage after insert on public.evenements
  deferrable initially deferred for each row
  execute function public.verifier_ancrage('evenement_sources', 'evenement_id');
drop trigger if exists evenement_sources_ancrage_restant on public.evenement_sources;
create constraint trigger evenement_sources_ancrage_restant after delete on public.evenement_sources
  deferrable initially deferred for each row
  execute function public.verifier_ancrage_restant('evenements', 'evenement_id');

drop trigger if exists echeances_ancrage on public.echeances;
create constraint trigger echeances_ancrage after insert on public.echeances
  deferrable initially deferred for each row
  execute function public.verifier_ancrage('echeance_sources', 'echeance_id');
drop trigger if exists echeance_sources_ancrage_restant on public.echeance_sources;
create constraint trigger echeance_sources_ancrage_restant after delete on public.echeance_sources
  deferrable initially deferred for each row
  execute function public.verifier_ancrage_restant('echeances', 'echeance_id');

-- Les échéances sont des déductions de calcul : leur « nature » est portée par
-- base_de_calcul ; elles n'ont pas de colonne nature → ancrage toujours requis.

-- ── 7. Contradictions et pièces manquantes (F1, F2) ─────────────────────────
create table if not exists public.contradictions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  type text not null,
  gravite text not null default 'moyenne'
    check (gravite in ('faible', 'moyenne', 'haute')),
  statut text not null default 'possible'
    check (statut in ('possible', 'confirmee', 'ecartee')),
  enonce text not null,
  source_a jsonb not null,
  source_b jsonb not null,
  chunk_a_id uuid references public.document_chunks (id) on delete set null,
  chunk_b_id uuid references public.document_chunks (id) on delete set null,
  confiance numeric(4,3) not null check (confiance >= 0 and confiance <= 1),
  verrouille_humain boolean not null default false,
  modifie_par uuid references auth.users (id) on delete set null,
  modifie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contradictions_dossier_id_idx on public.contradictions (dossier_id);

create table if not exists public.pieces_manquantes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  designation text not null,
  criticite text not null default 'normale'
    check (criticite in ('normale', 'importante', 'urgente')),
  statut text not null default 'a_fournir'
    check (statut in ('a_fournir', 'fournie', 'ecartee')),
  document_fourni_id uuid references public.dossier_documents (id) on delete set null,
  confiance numeric(4,3) not null check (confiance >= 0 and confiance <= 1),
  verrouille_humain boolean not null default false,
  modifie_par uuid references auth.users (id) on delete set null,
  modifie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pieces_manquantes_dossier_id_idx on public.pieces_manquantes (dossier_id);

-- « cite_dans[] » : les passages qui citent la pièce absente.
create table if not exists public.piece_manquante_sources (
  piece_manquante_id uuid not null references public.pieces_manquantes (id) on delete cascade,
  chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  extrait text,
  primary key (piece_manquante_id, chunk_id)
);

drop trigger if exists pieces_manquantes_ancrage on public.pieces_manquantes;
create constraint trigger pieces_manquantes_ancrage after insert on public.pieces_manquantes
  deferrable initially deferred for each row
  execute function public.verifier_ancrage('piece_manquante_sources', 'piece_manquante_id');
drop trigger if exists piece_manquante_sources_ancrage_restant on public.piece_manquante_sources;
create constraint trigger piece_manquante_sources_ancrage_restant after delete on public.piece_manquante_sources
  deferrable initially deferred for each row
  execute function public.verifier_ancrage_restant('pieces_manquantes', 'piece_manquante_id');

-- ── 8. Productions (I4) et exécutions d'agents ──────────────────────────────
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid references public.dossiers (id) on delete cascade,
  agent text not null,
  version text not null default '1.0',
  trace_id uuid not null,
  entree_hash text not null,
  statut text not null default 'en_cours'
    check (statut in ('en_cours', 'ok', 'partiel', 'escalade', 'echec')),
  confiance numeric(4,3) check (confiance is null or (confiance >= 0 and confiance <= 1)),
  modele text,
  tokens_entree integer,
  tokens_sortie integer,
  duree_ms integer,
  sortie jsonb,
  escalades jsonb not null default '[]'::jsonb,
  incertitudes jsonb not null default '[]'::jsonb,
  erreur text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_dossier_id_idx on public.agent_runs (dossier_id);
create index if not exists agent_runs_trace_id_idx on public.agent_runs (trace_id);
-- Cache par entrée : un même document ne repasse pas deux fois dans le même agent.
create index if not exists agent_runs_cache_idx on public.agent_runs (agent, version, entree_hash) where statut = 'ok';

create table if not exists public.productions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  agent text not null,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  type text not null,
  titre text,
  contenu jsonb not null default '{}'::jsonb,
  contenu_texte text,
  statut_validation text not null default 'brouillon_ia'
    check (statut_validation in ('brouillon_ia', 'a_relire', 'a_valider_juridiquement', 'valide_humainement', 'envoye')),
  valide_par uuid references auth.users (id) on delete set null,
  valide_le timestamptz,
  envoye_le timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists productions_dossier_id_idx on public.productions (dossier_id);
create index if not exists productions_statut_idx on public.productions (tenant_id, statut_validation);

-- Validation humaine obligatoire (I5) : impossible de passer « valide_humainement »
-- ou « envoye » sans un validateur humain identifié ; côté client, le validateur
-- est l'utilisateur authentifié lui-même (vérifié par exécution : valide_par
-- pouvait désigner un tiers). Une production validée ou envoyée ne change plus de
-- contenu (I3 : nouvelle version), et « envoye » est irréversible.
create or replace function public.productions_validation_humaine()
returns trigger language plpgsql as $$
begin
  if new.statut_validation in ('valide_humainement', 'envoye') then
    if new.valide_par is null then
      raise exception 'VALIDATION_HUMAINE_REQUISE: statut % sans valide_par (I5)', new.statut_validation
        using errcode = 'check_violation';
    end if;
    if new.valide_le is null then
      new.valide_le := now();
    end if;
  end if;
  if auth.uid() is not null
     and new.valide_par is not null
     and new.valide_par <> auth.uid()
     and (tg_op = 'INSERT' or new.valide_par is distinct from old.valide_par) then
    raise exception 'VALIDATEUR_INCOHERENT: valide_par doit être l''utilisateur authentifié (I5)'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' then
    if old.statut_validation = 'envoye' and new.statut_validation <> 'envoye' then
      raise exception 'ENVOI_IRREVERSIBLE: une production envoyée reste envoyée (I4)'
        using errcode = 'check_violation';
    end if;
    if old.statut_validation in ('valide_humainement', 'envoye') and (
         new.contenu is distinct from old.contenu
      or new.contenu_texte is distinct from old.contenu_texte
      or new.titre is distinct from old.titre
      or new.type is distinct from old.type
      or new.agent is distinct from old.agent) then
      raise exception 'PRODUCTION_VALIDEE_IMMUABLE: créez une nouvelle version au lieu de modifier une production validée (I3, I4)'
        using errcode = 'check_violation';
    end if;
  end if;
  if new.statut_validation = 'envoye' and new.envoye_le is null then
    new.envoye_le := now();
  end if;
  return new;
end;
$$;
drop trigger if exists productions_validation_humaine on public.productions;
create trigger productions_validation_humaine before insert or update on public.productions
  for each row execute function public.productions_validation_humaine();

-- ── 9. Journal d'audit en écriture seule ────────────────────────────────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id) on delete set null,
  dossier_id uuid,
  acteur uuid,
  acteur_type text not null default 'utilisateur'
    check (acteur_type in ('utilisateur', 'admin', 'agent', 'systeme')),
  action text not null,
  objet_type text not null,
  objet_id uuid,
  avant jsonb,
  apres jsonb,
  trace_id uuid,
  ip inet,
  horodatage timestamptz not null default now()
);
create index if not exists audit_log_tenant_horodatage_idx on public.audit_log (tenant_id, horodatage desc);
create index if not exists audit_log_dossier_idx on public.audit_log (dossier_id, horodatage desc);
create index if not exists audit_log_objet_idx on public.audit_log (objet_type, objet_id);

-- Immuable : aucune modification ni suppression, quel que soit le rôle.
create or replace function public.audit_log_immuable()
returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_LOG_IMMUABLE: % interdit sur audit_log', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;
drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.audit_log_immuable();
drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.audit_log_immuable();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_immuable();

-- Écriture uniquement par fonction (SECURITY DEFINER).
--   * Identité humaine (auth.uid() présent) : le type d'acteur est DÉDUIT (admin /
--     utilisateur), jamais fourni par l'appelant ; un appel direct (RPC, hors
--     trigger) ne peut journaliser que dans un tenant dont l'appelant est membre,
--     sur un dossier de ce tenant. Vérifié par exécution : sans ces gardes, un
--     client pouvait forger des entrées « admin » dans le journal d'un autre tenant.
--   * Sans identité humaine (service, agents) : p_acteur_type, sinon 'agent' si
--     `clair.acteur = 'agent'`, sinon 'systeme'.
create or replace function public.journaliser(
  p_action text,
  p_objet_type text,
  p_objet_id uuid default null,
  p_tenant_id uuid default null,
  p_dossier_id uuid default null,
  p_avant jsonb default null,
  p_apres jsonb default null,
  p_acteur_type text default null,
  p_trace_id uuid default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_acteur uuid := auth.uid();
  v_direct boolean := pg_trigger_depth() = 0;
  v_type text;
begin
  if v_acteur is not null then
    v_type := case when public.is_admin() then 'admin' else 'utilisateur' end;
    if v_direct and not public.is_admin() then
      if p_tenant_id is null or not public.is_tenant_member_now(p_tenant_id) then
        raise exception 'AUDIT_TENANT_INTERDIT: journalisation hors de ses tenants'
          using errcode = 'insufficient_privilege';
      end if;
      if p_dossier_id is not null and not exists (
        select 1 from public.dossiers d where d.id = p_dossier_id and d.tenant_id = p_tenant_id
      ) then
        raise exception 'AUDIT_DOSSIER_INCOHERENT: le dossier n''appartient pas au tenant indiqué'
          using errcode = 'check_violation';
      end if;
    end if;
  else
    v_type := coalesce(nullif(p_acteur_type, ''),
      case when coalesce(current_setting('clair.acteur', true), '') = 'agent' then 'agent' else 'systeme' end);
  end if;
  insert into public.audit_log (tenant_id, dossier_id, acteur, acteur_type, action, objet_type, objet_id, avant, apres, trace_id)
  values (p_tenant_id, p_dossier_id, v_acteur, v_type, p_action, p_objet_type, p_objet_id, p_avant, p_apres, p_trace_id)
  returning id into v_id;
  return v_id;
end;
$$;

alter table public.audit_log enable row level security;
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
-- La séquence de l'identité n'est pas transactionnelle : un `setval()` par un client
-- ferait échouer toutes les écritures suivantes (clé dupliquée) — vérifié par
-- exécution. Aucun privilège pour les rôles clients ; journaliser() (DEFINER) suffit.
do $$
declare s text := pg_get_serial_sequence('public.audit_log', 'id');
begin
  if s is not null then
    execute format('revoke all on sequence %s from public, anon, authenticated', s);
  end if;
end $$;
drop policy if exists "audit_log_select_tenant" on public.audit_log;
create policy "audit_log_select_tenant" on public.audit_log
  for select using (tenant_id is not null and public.is_tenant_member(tenant_id));
drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select using (public.is_admin());
revoke all on function public.journaliser(text, text, uuid, uuid, uuid, jsonb, jsonb, text, uuid) from public, anon;
grant execute on function public.journaliser(text, text, uuid, uuid, uuid, jsonb, jsonb, text, uuid) to authenticated;

-- Journalisation automatique des actions sensibles existantes.
create or replace function public.audit_dossier_documents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.journaliser('document.depose', 'dossier_document', new.id, new.tenant_id, new.dossier_id,
      null, jsonb_build_object('file_name', new.file_name, 'kind', new.kind, 'size_bytes', new.size_bytes));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.journaliser('document.supprime', 'dossier_document', old.id, old.tenant_id, old.dossier_id,
      jsonb_build_object('file_name', old.file_name, 'kind', old.kind, 'file_path', old.file_path), null);
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists audit_dossier_documents on public.dossier_documents;
create trigger audit_dossier_documents after insert or delete on public.dossier_documents
  for each row execute function public.audit_dossier_documents();

create or replace function public.audit_dossiers()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.journaliser('dossier.cree', 'dossier', new.id, new.tenant_id, new.id,
      null, jsonb_build_object('typology', new.typology, 'status', new.status));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform public.journaliser('dossier.statut', 'dossier', new.id, new.tenant_id, new.id,
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.journaliser('dossier.supprime', 'dossier', old.id, old.tenant_id, old.id,
      jsonb_build_object('typology', old.typology, 'title', old.title), null);
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists audit_dossiers on public.dossiers;
create trigger audit_dossiers after insert or update or delete on public.dossiers
  for each row execute function public.audit_dossiers();

create or replace function public.audit_productions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.journaliser('production.creee', 'production', new.id, new.tenant_id, new.dossier_id,
      null, jsonb_build_object('agent', new.agent, 'type', new.type, 'statut_validation', new.statut_validation));
  elsif new.statut_validation is distinct from old.statut_validation then
    perform public.journaliser('production.statut', 'production', new.id, new.tenant_id, new.dossier_id,
      jsonb_build_object('statut_validation', old.statut_validation),
      jsonb_build_object('statut_validation', new.statut_validation, 'valide_par', new.valide_par));
  end if;
  return new;
end;
$$;
drop trigger if exists audit_productions on public.productions;
create trigger audit_productions after insert or update on public.productions
  for each row execute function public.audit_productions();

create or replace function public.audit_tenant_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.journaliser('membre.retire', 'tenant_member', old.user_id, old.tenant_id, null,
      jsonb_build_object('role', old.role), null);
    return old;
  end if;
  perform public.journaliser(case when tg_op = 'INSERT' then 'membre.ajoute' else 'membre.role' end,
    'tenant_member', new.user_id, new.tenant_id, null,
    case when tg_op = 'UPDATE' then jsonb_build_object('role', old.role) end,
    jsonb_build_object('role', new.role));
  return new;
end;
$$;
drop trigger if exists audit_tenant_members on public.tenant_members;
create trigger audit_tenant_members after insert or update or delete on public.tenant_members
  for each row execute function public.audit_tenant_members();

-- ── 10. Consentements (RGPD) ────────────────────────────────────────────────
create table if not exists public.consentements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  finalite text not null,
  base_legale text not null
    check (base_legale in ('consentement', 'contrat', 'obligation_legale', 'interet_legitime')),
  accorde boolean not null default true,
  date timestamptz not null default now(),
  retire_le timestamptz,
  preuve jsonb not null default '{}'::jsonb
);
create index if not exists consentements_tenant_idx on public.consentements (tenant_id, finalite);

-- ── 11. Protection des corrections humaines (F11) ───────────────────────────
-- Fermé par défaut : sans identité humaine (auth.uid() absent) l'acteur est réputé
-- « agent », sauf déclaration explicite `set local clair.acteur = 'humain' |
-- 'systeme'` (action humaine relayée par le serveur, purge RGPD). Une ligne
-- verrouillée par un humain rejette alors toute modification ET toute suppression
-- (vérifié par exécution : un DELETE, ou une écriture serveur sans contexte,
-- contournait le verrou).
create or replace function public.proteger_correction_humaine()
returns trigger language plpgsql as $$
declare
  v_acteur text := coalesce(nullif(current_setting('clair.acteur', true), ''),
                            case when auth.uid() is not null then 'humain' else 'agent' end);
begin
  if old.verrouille_humain and v_acteur not in ('humain', 'systeme') then
    raise exception 'CORRECTION_HUMAINE_PROTEGEE: % % a été corrigé par un humain (% refusé, I5, F11)', tg_table_name, old.id, tg_op
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.verrouille_humain and (not old.verrouille_humain or v_acteur = 'humain') then
    new.modifie_par := coalesce(auth.uid(), new.modifie_par);
    new.modifie_le := now();
  end if;
  return new;
end;
$$;

-- ── 12. Triggers communs, tenant, RLS sur toutes les tables du dossier ─────
do $$
declare
  t text;
  tables_dossier text[] := array[
    'document_chunks', 'entites', 'evenements', 'echeances', 'contradictions',
    'pieces_manquantes', 'productions'
  ];
  tables_verrou text[] := array['entites', 'evenements', 'echeances', 'contradictions', 'pieces_manquantes'];
  tables_touch text[] := array['entites', 'evenements', 'echeances', 'contradictions', 'pieces_manquantes', 'productions'];
begin
  foreach t in array tables_dossier loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_tenant', t);
    execute format(
      'create trigger %I before insert or update of dossier_id, tenant_id on public.%I
         for each row execute function public.set_tenant_from_dossier()',
      t || '_set_tenant', t);

    -- Lecture : membres du tenant et admin global. Insertion : SERVEUR UNIQUEMENT
    -- (aucune policy client) — les chunks sont extraits des pièces, les entités,
    -- événements, échéances, contradictions, pièces manquantes et productions sont
    -- produits par les agents ; un client ne fabrique pas de preuve (I1). Les
    -- corrections humaines passent par UPDATE (verrou F11) ; la suppression est
    -- réservée aux administrateurs du tenant, sauf les chunks (preuves, jamais
    -- supprimés à la main).
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_tenant', t);
    execute format('create policy %I on public.%I for select using (public.is_tenant_member(tenant_id))',
      t || '_select_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_tenant', t);
    if t <> 'document_chunks' then
      execute format('create policy %I on public.%I for update using (public.can_write_tenant(tenant_id)) with check (public.can_write_tenant(tenant_id))',
        t || '_update_tenant', t);
      execute format('create policy %I on public.%I for delete using (public.can_admin_tenant(tenant_id))',
        t || '_delete_tenant', t);
    end if;
    execute format('drop policy if exists %I on public.%I', t || '_select_admin', t);
    execute format('create policy %I on public.%I for select using (public.is_admin())',
      t || '_select_admin', t);
  end loop;

  foreach t in array tables_touch loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t);
  end loop;

  foreach t in array tables_verrou loop
    execute format('drop trigger if exists %I on public.%I', t || '_verrou_humain', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.proteger_correction_humaine()',
      t || '_verrou_humain', t);
  end loop;
end $$;

-- Tables de sources : lecture dérivée de la ligne parente (membre du tenant du
-- dossier) ; écriture SERVEUR UNIQUEMENT (un ancrage est une preuve, il n'est ni
-- ajouté ni retiré par un client).
create or replace function public.chunk_tenant_id(c uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select tenant_id from public.document_chunks where id = c;
$$;
revoke all on function public.chunk_tenant_id(uuid) from public, anon;
grant execute on function public.chunk_tenant_id(uuid) to authenticated;

do $$
declare
  t text;
  tables_sources text[] := array['entite_sources', 'evenement_sources', 'echeance_sources', 'piece_manquante_sources'];
begin
  foreach t in array tables_sources loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_tenant', t);
    execute format('create policy %I on public.%I for select using (public.is_tenant_member(public.chunk_tenant_id(chunk_id)))',
      t || '_select_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_write_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_admin', t);
    execute format('create policy %I on public.%I for select using (public.is_admin())',
      t || '_select_admin', t);
  end loop;
end $$;

-- agent_runs : lecture par les membres, écriture réservée au serveur (aucune
-- policy d'écriture pour authenticated) ; admin global en lecture.
alter table public.agent_runs enable row level security;
drop policy if exists "agent_runs_select_tenant" on public.agent_runs;
create policy "agent_runs_select_tenant" on public.agent_runs
  for select using (public.is_tenant_member(tenant_id));
drop policy if exists "agent_runs_select_admin" on public.agent_runs;
create policy "agent_runs_select_admin" on public.agent_runs
  for select using (public.is_admin());

-- consentements : l'utilisateur voit et enregistre les siens ; admin en lecture.
alter table public.consentements enable row level security;
drop policy if exists "consentements_select_tenant" on public.consentements;
create policy "consentements_select_tenant" on public.consentements
  for select using (public.is_tenant_member(tenant_id));
drop policy if exists "consentements_insert_own" on public.consentements;
create policy "consentements_insert_own" on public.consentements
  for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "consentements_update_own" on public.consentements;
create policy "consentements_update_own" on public.consentements
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
drop policy if exists "consentements_select_admin" on public.consentements;
create policy "consentements_select_admin" on public.consentements
  for select using (public.is_admin());

-- Policies tenant sur dossier_documents, ADDITIVES aux policies *_own / *_admin.
drop policy if exists "docs_select_tenant" on public.dossier_documents;
create policy "docs_select_tenant" on public.dossier_documents
  for select using (tenant_id is not null and public.is_tenant_member(tenant_id));
drop policy if exists "docs_update_tenant" on public.dossier_documents;
create policy "docs_update_tenant" on public.dossier_documents
  for update using (tenant_id is not null and public.can_write_tenant(tenant_id))
  with check (tenant_id is not null and public.can_write_tenant(tenant_id));

-- RESTRICTIF : une pièce ne peut être déposée ou modifiée que par un membre du
-- tenant du dossier (le tenant_id est imposé par trigger depuis dossier_id) ou par
-- l'admin global (livrables). Corrige aussi l'anomalie m1 de l'inventaire : un
-- utilisateur ne peut plus insérer une ligne dans le dossier d'un autre.
drop policy if exists "docs_tenant_coherent_insert" on public.dossier_documents;
create policy "docs_tenant_coherent_insert" on public.dossier_documents as restrictive
  for insert with check (public.is_admin() or public.is_tenant_member_now(tenant_id));
drop policy if exists "docs_tenant_coherent_update" on public.dossier_documents;
create policy "docs_tenant_coherent_update" on public.dossier_documents as restrictive
  for update using (public.is_admin() or public.is_tenant_member(tenant_id))
  with check (public.is_admin() or public.is_tenant_member(tenant_id));

-- ── 13. Vue de synthèse : droits d'abonnement lus côté serveur (I7) ────────
create or replace function public.plan_actuel(t uuid)
returns table (plan text, statut_abonnement text)
language sql security definer stable set search_path = public as $$
  select plan, statut_abonnement from public.tenants
  where id = t and public.is_tenant_member(t);
$$;
revoke all on function public.plan_actuel(uuid) from public, anon;
grant execute on function public.plan_actuel(uuid) to authenticated;
