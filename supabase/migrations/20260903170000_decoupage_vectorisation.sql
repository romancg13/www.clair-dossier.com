-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 7 du plan de build : découpage + vectorisation + index
-- cloisonné + recherche hybride (PARTIE 7.1 étapes 6–7, PARTIE 7.3 ; D-008).
--
-- Additive et rejouable.
--   * La dimension des embeddings est fixée à 1024 (dimension de référence des
--     fournisseurs courants). Aucune ligne de production ne porte d'embedding :
--     les éventuelles lignes d'une autre dimension sont vidées avant le typage.
--   * Index HNSW (cosinus) sur les chunks ; le cloisonnement reste assuré par la
--     RLS ET par le filtre tenant + dossier explicite de la fonction de recherche
--     (7.3 : « au niveau de la requête, jamais après coup »).
--   * La recherche hybride fusionne les rangs lexical (tsvector français) et
--     vectoriel par Reciprocal Rank Fusion (k = 60), déterministe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Dimension et index vectoriel ─────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'document_chunks' and column_name = 'embedding'
      and udt_name = 'vector'
  ) then
    update public.document_chunks
       set embedding = null
     where embedding is not null and extensions.vector_dims(embedding) <> 1024;
    alter table public.document_chunks
      alter column embedding type extensions.vector(1024) using embedding::extensions.vector(1024);
  end if;
end $$;

create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ── 2. Enregistrement des chunks (serveur uniquement, idempotent) ───────────
-- p_chunks : [{ "page": 1, "offset_debut": 0, "offset_fin": 412, "texte": "...",
--               "embedding": "[0.01,...]" | null, "embedding_modele": "..." }, …]
create or replace function public.enregistrer_chunks(p_document_id uuid, p_chunks jsonb)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare d public.dossier_documents%rowtype; n integer;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_chunks est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.dossier_documents where id = p_document_id;
  if not found then
    raise exception 'DOCUMENT_INCONNU: %', p_document_id using errcode = 'no_data_found';
  end if;
  insert into public.document_chunks (dossier_id, document_id, page, offset_debut, offset_fin, texte, embedding, embedding_modele)
  select d.dossier_id, d.id,
         (c ->> 'page')::integer, (c ->> 'offset_debut')::integer, (c ->> 'offset_fin')::integer,
         c ->> 'texte',
         case when c ->> 'embedding' is null then null else (c ->> 'embedding')::extensions.vector(1024) end,
         c ->> 'embedding_modele'
    from jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb)) c
  on conflict (document_id, page, offset_debut) do update
    set offset_fin = excluded.offset_fin,
        texte = excluded.texte,
        embedding = excluded.embedding,
        embedding_modele = excluded.embedding_modele;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.enregistrer_chunks(uuid, jsonb) from public, anon, authenticated;

-- ── 3. Mise en file de l'indexation dès que le texte est prêt ───────────────
create or replace function public.dossier_documents_planifier_indexation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut_ingestion = 'extraction' and old.statut_ingestion is distinct from 'extraction' and new.supprime_le is null then
    perform public.planifier_travail('indexation', new.tenant_id, new.dossier_id, new.id, '{}'::jsonb, 5);
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_documents_planifier_indexation on public.dossier_documents;
create trigger dossier_documents_planifier_indexation after update of statut_ingestion on public.dossier_documents
  for each row execute function public.dossier_documents_planifier_indexation();

-- Le réveil pg_net couvre aussi l'indexation (même exécutant).
create or replace function public.travaux_reveiller_executant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('ingestion', 'indexation') then
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

-- ── 4. Recherche hybride, filtrée au niveau de la requête (7.3) ─────────────
-- SECURITY INVOKER : la RLS du lecteur s'applique ; le filtre tenant + dossier est
-- en plus explicite (le rôle de service contourne la RLS). Rangs lexical et
-- vectoriel fusionnés par Reciprocal Rank Fusion : score = Σ 1 / (k + rang).
create or replace function public.rechercher_chunks(
  p_tenant_id uuid,
  p_dossier_id uuid,
  p_requete text,
  p_embedding extensions.vector(1024) default null,
  p_limite integer default 10,
  p_k integer default 60
) returns table (
  chunk_id uuid,
  document_id uuid,
  file_name text,
  page integer,
  offset_debut integer,
  offset_fin integer,
  texte text,
  rang_lexical integer,
  rang_vectoriel integer,
  score_fusion double precision
) language sql stable security invoker set search_path = public, extensions as $$
  with requete as (
    select case when coalesce(trim(p_requete), '') = '' then null
                else websearch_to_tsquery('french', p_requete) end as q
  ),
  lex as (
    select c.id, row_number() over (order by ts_rank_cd(c.texte_tsv, r.q) desc, c.id) as rang
      from public.document_chunks c
      join public.dossier_documents d on d.id = c.document_id
      cross join requete r
     where r.q is not null
       and c.tenant_id = p_tenant_id and c.dossier_id = p_dossier_id
       and d.supprime_le is null
       and c.texte_tsv @@ r.q
     limit 50
  ),
  vec as (
    select c.id, row_number() over (order by c.embedding <=> p_embedding, c.id) as rang
      from public.document_chunks c
      join public.dossier_documents d on d.id = c.document_id
     where p_embedding is not null and c.embedding is not null
       and c.tenant_id = p_tenant_id and c.dossier_id = p_dossier_id
       and d.supprime_le is null
     order by c.embedding <=> p_embedding, c.id
     limit 50
  )
  select c.id, c.document_id, d.file_name, c.page, c.offset_debut, c.offset_fin, c.texte,
         lex.rang::integer, vec.rang::integer,
         coalesce(1.0 / (p_k + lex.rang), 0) + coalesce(1.0 / (p_k + vec.rang), 0) as score_fusion
    from public.document_chunks c
    join public.dossier_documents d on d.id = c.document_id
    left join lex on lex.id = c.id
    left join vec on vec.id = c.id
   where c.tenant_id = p_tenant_id and c.dossier_id = p_dossier_id
     and (lex.id is not null or vec.id is not null)
   order by score_fusion desc, c.id
   limit greatest(coalesce(p_limite, 10), 1);
$$;
revoke all on function public.rechercher_chunks(uuid, uuid, text, extensions.vector, integer, integer) from public, anon;
grant execute on function public.rechercher_chunks(uuid, uuid, text, extensions.vector, integer, integer) to authenticated;
