-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 5 du plan de build : stockage documentaire immuable +
-- empreinte SHA-256 (pipeline 7.1, étapes 2 EMPREINTE et 3 STOCKAGE ; D-006).
--
-- Additive et rejouable. Aucun modèle : la détection de doublon strict est une
-- comparaison d'empreintes en SQL (règle 0.2 : jamais un modèle pour ce qu'une
-- requête résout de façon déterministe).
--
--   * L'empreinte est calculée par le client au dépôt (WebCrypto) et transmise
--     avec la ligne ; le serveur la recalcule et la confirme (hash_verifie_le)
--     lors de l'ingestion (étape 6). Un client ne peut nuire qu'à lui-même : au
--     pire il marque sa propre pièce comme doublon.
--   * Un doublon strict n'est pas rejeté : il est ENREGISTRÉ (statut « doublon »,
--     doublon_de_id) pour être montré au client, et ne déclenche aucun traitement.
--   * Une pièce déposée n'est jamais détruite par l'application (I3) : suppression
--     logique (supprime_le) côté client, suppression physique réservée au serveur
--     (purge RGPD). Le bucket refuse la suppression des originaux ; aucune policy
--     de mise à jour n'existe sur le bucket (pas d'écrasement).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Colonnes ─────────────────────────────────────────────────────────────
alter table public.dossier_documents add column if not exists doublon_de_id uuid references public.dossier_documents (id) on delete set null;
alter table public.dossier_documents add column if not exists hash_verifie_le timestamptz;
alter table public.dossier_documents add column if not exists supprime_le timestamptz;
alter table public.dossier_documents add column if not exists supprime_par uuid references auth.users (id) on delete set null;

create index if not exists dossier_documents_doublon_de_idx on public.dossier_documents (doublon_de_id) where doublon_de_id is not null;
create index if not exists dossier_documents_actifs_idx on public.dossier_documents (dossier_id, created_at) where supprime_le is null;

-- ── 2. Détection de doublon strict ──────────────────────────────────────────
-- Périmètre : les pièces (kind = 'piece') actives d'un MÊME dossier. L'original
-- est la pièce la plus ancienne portant la même empreinte qui n'est pas elle-même
-- un doublon : les copies ne s'enchaînent pas, elles pointent toutes l'original.
create or replace function public.dossier_documents_detecter_doublon()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_original uuid;
  v_tenant uuid;
begin
  if new.kind is distinct from 'piece' or new.hash_sha256 is null or new.supprime_le is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.hash_sha256 is not distinct from old.hash_sha256 then
    return new;
  end if;
  select d.id into v_original
    from public.dossier_documents d
   where d.dossier_id = new.dossier_id
     and d.kind = 'piece'
     and d.hash_sha256 = new.hash_sha256
     and d.supprime_le is null
     and d.statut_ingestion <> 'doublon'
     and d.id <> new.id
   order by d.created_at, d.id
   limit 1;
  if v_original is not null then
    new.statut_ingestion := 'doublon';
    new.doublon_de_id := v_original;
    select tenant_id into v_tenant from public.dossiers where id = new.dossier_id;
    perform public.journaliser('document.doublon', 'dossier_document', new.id, v_tenant, new.dossier_id,
      null, jsonb_build_object('doublon_de_id', v_original, 'hash_sha256', new.hash_sha256, 'file_name', new.file_name));
  elsif new.statut_ingestion = 'doublon' then
    -- L'empreinte vérifiée par le serveur ne correspond plus à rien : la pièce
    -- redevient une pièce à traiter.
    new.statut_ingestion := 'recu';
    new.doublon_de_id := null;
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_documents_detecter_doublon on public.dossier_documents;
create trigger dossier_documents_detecter_doublon before insert or update of hash_sha256 on public.dossier_documents
  for each row execute function public.dossier_documents_detecter_doublon();

-- ── 3. Original jamais détruit par l'application (I3) ───────────────────────
create or replace function public.dossier_documents_original_immuable()
returns trigger language plpgsql as $$
begin
  if public.est_appel_client() and old.kind is distinct from 'deliverable' then
    raise exception 'PIECE_ORIGINALE_CONSERVEE: une pièce déposée n''est jamais détruite par l''application (I3) ; utilisez la suppression logique (supprime_le)'
      using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;
drop trigger if exists dossier_documents_original_immuable on public.dossier_documents;
create trigger dossier_documents_original_immuable before delete on public.dossier_documents
  for each row execute function public.dossier_documents_original_immuable();

-- Suppression logique par le client : supprime_le passe de NULL à maintenant, une
-- seule fois, et supprime_par est l'utilisateur authentifié. Les colonnes
-- d'empreinte et de doublon rejoignent les métadonnées réservées au serveur.
create or replace function public.dossier_documents_proteger_metadonnees()
returns trigger language plpgsql as $$
begin
  if not public.est_appel_client() then
    return new;
  end if;
  if new.kind is distinct from old.kind
    or new.file_path is distinct from old.file_path
    or new.user_id is distinct from old.user_id
    or new.size_bytes is distinct from old.size_bytes
    or new.hash_sha256 is distinct from old.hash_sha256
    or new.hash_verifie_le is distinct from old.hash_verifie_le
    or new.doublon_de_id is distinct from old.doublon_de_id
    or new.mime is distinct from old.mime
    or new.pages is distinct from old.pages
    or new.score_ocr is distinct from old.score_ocr
    or new.confiance_classification is distinct from old.confiance_classification
    or new.version is distinct from old.version
    or new.parent_version_id is distinct from old.parent_version_id
    or new.statut_ingestion is distinct from old.statut_ingestion
    or new.ingestion_erreur is distinct from old.ingestion_erreur
    or new.created_at is distinct from old.created_at then
    raise exception 'METADONNEES_PIECE_SERVEUR_UNIQUEMENT: ces colonnes de dossier_documents sont réservées au serveur'
      using errcode = 'insufficient_privilege';
  end if;
  if new.supprime_le is distinct from old.supprime_le then
    if old.supprime_le is not null then
      raise exception 'SUPPRESSION_LOGIQUE_IRREVERSIBLE: une pièce retirée ne se restaure pas côté client'
        using errcode = 'insufficient_privilege';
    end if;
    new.supprime_le := now();
    new.supprime_par := auth.uid();
  elsif new.supprime_par is distinct from old.supprime_par then
    raise exception 'METADONNEES_PIECE_SERVEUR_UNIQUEMENT: supprime_par est posé par la base'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Journal : le retrait logique d'une pièce est une action sensible.
create or replace function public.audit_dossier_documents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.journaliser('document.depose', 'dossier_document', new.id, new.tenant_id, new.dossier_id,
      null, jsonb_build_object('file_name', new.file_name, 'kind', new.kind, 'size_bytes', new.size_bytes, 'hash_sha256', new.hash_sha256));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.supprime_le is not null and old.supprime_le is null then
      perform public.journaliser('document.retire', 'dossier_document', new.id, new.tenant_id, new.dossier_id,
        jsonb_build_object('file_name', new.file_name, 'kind', new.kind), jsonb_build_object('supprime_par', new.supprime_par));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.journaliser('document.supprime', 'dossier_document', old.id, old.tenant_id, old.dossier_id,
      jsonb_build_object('file_name', old.file_name, 'kind', old.kind, 'file_path', old.file_path, 'hash_sha256', old.hash_sha256), null);
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists audit_dossier_documents on public.dossier_documents;
create trigger audit_dossier_documents after insert or update of supprime_le or delete on public.dossier_documents
  for each row execute function public.audit_dossier_documents();

-- ── 4. Bucket : pas d'écrasement, pas de suppression d'original ─────────────
-- Aucune policy UPDATE n'existe sur storage.objects pour le bucket « documents »
-- (vérifié par test) : un objet déposé ne peut pas être remplacé. La suppression
-- d'un objet du bucket n'est possible que pour un livrable (flux admin existant).
drop policy if exists "docs_storage_delete_originaux_conserves" on storage.objects;
create policy "docs_storage_delete_originaux_conserves" on storage.objects as restrictive
  for delete using (
    bucket_id <> 'documents'
    or exists (
      select 1 from public.dossier_documents d
      where d.file_path = objects.name and d.kind = 'deliverable'
    )
  );

-- ── 5. Empreinte vérifiée par le serveur (appelée par le pipeline, étape 6) ──
-- Recalcul côté serveur : confirme ou corrige l'empreinte transmise par le client,
-- journalise toute divergence, et relance la détection de doublon (trigger).
create or replace function public.enregistrer_empreinte(
  p_document_id uuid,
  p_hash_sha256 text,
  p_mime text default null,
  p_size_bytes bigint default null,
  p_pages integer default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_doc public.dossier_documents%rowtype;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_empreinte est réservée au pipeline'
      using errcode = 'insufficient_privilege';
  end if;
  if p_hash_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'EMPREINTE_INVALIDE: SHA-256 hexadécimal minuscule attendu' using errcode = 'check_violation';
  end if;
  select * into v_doc from public.dossier_documents where id = p_document_id for update;
  if not found then
    raise exception 'DOCUMENT_INCONNU: %', p_document_id using errcode = 'no_data_found';
  end if;
  if v_doc.hash_sha256 is not null and v_doc.hash_sha256 <> p_hash_sha256 then
    perform public.journaliser('document.empreinte_divergente', 'dossier_document', v_doc.id, v_doc.tenant_id, v_doc.dossier_id,
      jsonb_build_object('hash_client', v_doc.hash_sha256), jsonb_build_object('hash_serveur', p_hash_sha256), 'systeme');
  end if;
  update public.dossier_documents
     set hash_sha256 = p_hash_sha256,
         hash_verifie_le = now(),
         mime = coalesce(p_mime, mime),
         size_bytes = coalesce(p_size_bytes, size_bytes),
         pages = coalesce(p_pages, pages)
   where id = p_document_id;
end;
$$;
revoke all on function public.enregistrer_empreinte(uuid, text, text, bigint, integer) from public, anon, authenticated;

-- ── 6. Purge serveur explicite ──────────────────────────────────────────────
-- Complément de l'étape 4 : lorsqu'une pièce est physiquement supprimée par le
-- serveur en contexte « systeme » (purge RGPD, droit à l'effacement), les
-- analyses qu'elle fondait sont supprimées même si un humain les avait
-- verrouillées — l'effacement prime, et il est journalisé. Hors de ce contexte,
-- le comportement de l'étape 4 est inchangé.
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
  if (parent ->> 'verrouille_humain')::boolean
     and coalesce(current_setting('clair.acteur', true), '') <> 'systeme' then
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
