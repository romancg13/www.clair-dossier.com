-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 10 du plan de build : agent ATLAS — inventaire,
-- classification, renommage normalisé, quasi-doublons, pièces illisibles
-- (PARTIE 4.2, 7.1 étape 9, 5.1 seuil 0,85 ; D-011).
--
-- Additive et rejouable.
--   * quasi_doublon_de_id / similarite : rapprochement d'une pièce avec une pièce
--     antérieure du même dossier au contenu presque identique (la pièce reste
--     analysée, contrairement au doublon strict) ;
--   * categorie_humaine : un reclassement saisi par le client n'est jamais
--     écrasé par une réanalyse (F11) ;
--   * enregistrer_classification (serveur uniquement) ; mise en file « atlas »
--     dès qu'une pièce est analysée par VERITAS.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.dossier_documents add column if not exists quasi_doublon_de_id uuid references public.dossier_documents (id) on delete set null;
alter table public.dossier_documents add column if not exists similarite numeric(4,3);
alter table public.dossier_documents add column if not exists categorie_humaine boolean not null default false;
alter table public.dossier_documents drop constraint if exists dossier_documents_similarite_check;
alter table public.dossier_documents add constraint dossier_documents_similarite_check
  check (similarite is null or (similarite >= 0 and similarite <= 1));

-- Un reclassement par le client marque la catégorie comme humaine ; les autres
-- colonnes ajoutées sont réservées au serveur.
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
    or new.quasi_doublon_de_id is distinct from old.quasi_doublon_de_id
    or new.similarite is distinct from old.similarite
    or new.confiance_classification is distinct from old.confiance_classification
    or new.mime is distinct from old.mime
    or new.pages is distinct from old.pages
    or new.score_ocr is distinct from old.score_ocr
    or new.version is distinct from old.version
    or new.parent_version_id is distinct from old.parent_version_id
    or new.statut_ingestion is distinct from old.statut_ingestion
    or new.ingestion_erreur is distinct from old.ingestion_erreur
    or new.created_at is distinct from old.created_at then
    raise exception 'METADONNEES_PIECE_SERVEUR_UNIQUEMENT: ces colonnes de dossier_documents sont réservées au serveur'
      using errcode = 'insufficient_privilege';
  end if;
  if new.categorie is distinct from old.categorie then
    new.categorie_humaine := true;
    new.confiance_classification := 1;
  elsif new.categorie_humaine is distinct from old.categorie_humaine then
    raise exception 'METADONNEES_PIECE_SERVEUR_UNIQUEMENT: categorie_humaine est posé par la base'
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

-- Écriture de la classification par l'agent : la catégorie humaine prime toujours.
create or replace function public.enregistrer_classification(
  p_document_id uuid,
  p_categorie text,
  p_confiance numeric,
  p_nom_normalise text,
  p_quasi_doublon_de_id uuid default null,
  p_similarite numeric default null,
  p_trace_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.dossier_documents%rowtype; v_categorie_appliquee boolean;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_classification est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.dossier_documents where id = p_document_id for update;
  if not found then
    raise exception 'DOCUMENT_INCONNU: %', p_document_id using errcode = 'no_data_found';
  end if;
  if p_quasi_doublon_de_id is not null and not exists (
    select 1 from public.dossier_documents q where q.id = p_quasi_doublon_de_id and q.dossier_id = d.dossier_id and q.id <> d.id
  ) then
    raise exception 'QUASI_DOUBLON_INCOHERENT: la pièce de référence n''est pas dans le même dossier' using errcode = 'check_violation';
  end if;
  v_categorie_appliquee := not d.categorie_humaine;
  update public.dossier_documents
     set categorie = case when d.categorie_humaine then categorie else p_categorie end,
         confiance_classification = case when d.categorie_humaine then confiance_classification else p_confiance end,
         nom_normalise = coalesce(p_nom_normalise, nom_normalise),
         quasi_doublon_de_id = p_quasi_doublon_de_id,
         similarite = p_similarite
   where id = p_document_id;
  perform public.journaliser('document.classe', 'dossier_document', d.id, d.tenant_id, d.dossier_id,
    jsonb_build_object('categorie', d.categorie, 'confiance_classification', d.confiance_classification),
    jsonb_build_object('categorie', case when d.categorie_humaine then d.categorie else p_categorie end,
                       'confiance_classification', p_confiance, 'categorie_humaine', d.categorie_humaine,
                       'nom_normalise', p_nom_normalise, 'quasi_doublon_de_id', p_quasi_doublon_de_id, 'similarite', p_similarite),
    'agent', p_trace_id);
  return jsonb_build_object('categorie_appliquee', v_categorie_appliquee, 'categorie_humaine', d.categorie_humaine);
end;
$$;
revoke all on function public.enregistrer_classification(uuid, text, numeric, text, uuid, numeric, uuid) from public, anon, authenticated;

-- Mise en file d'ATLAS dès que VERITAS a analysé la pièce.
create or replace function public.dossier_documents_planifier_atlas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut_ingestion = 'analyse' and old.statut_ingestion is distinct from 'analyse' and new.supprime_le is null then
    perform public.planifier_travail('atlas', new.tenant_id, new.dossier_id, new.id, '{}'::jsonb, 5);
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_documents_planifier_atlas on public.dossier_documents;
create trigger dossier_documents_planifier_atlas after update of statut_ingestion on public.dossier_documents
  for each row execute function public.dossier_documents_planifier_atlas();

create or replace function public.travaux_reveiller_executant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('ingestion', 'indexation', 'veritas', 'atlas') then
    perform net.http_post(
      url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/ingest-document',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U'
      ),
      body := jsonb_build_object('source', 'travaux', 'travail_id', new.id, 'type', new.type)
    );
  end if;
  return new;
end;
$$;
