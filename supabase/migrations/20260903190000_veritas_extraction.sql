-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 9 du plan de build : agent VERITAS, extraction ancrée
-- (PARTIE 4.2, 7.1 étape 8, 5.1 seuils, 6 schéma ; D-010).
--
-- Additive et rejouable. Le code de l'agent est serveur (supabase/functions/
-- _shared/agents) ; cette migration lui fournit :
--   * l'idempotence des entités et événements (index uniques : réanalyser ne
--     duplique rien — 7.1 « un même document réinjecté ne doit jamais produire
--     de doublon d'entité ») ;
--   * enregistrer_entites / enregistrer_evenements : écriture atomique avec leurs
--     sources, en contexte « agent » (le verrou humain F11 s'applique : une ligne
--     verrouillée n'est jamais réécrite, ses nouvelles sources sont ajoutées) ;
--   * la mise en file du travail « veritas » dès qu'une pièce est vectorisée.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Idempotence ──────────────────────────────────────────────────────────
create unique index if not exists entites_unique_idx on public.entites (dossier_id, type, valeur_normalisee);
create unique index if not exists evenements_unique_idx on public.evenements (dossier_id, date, nature, md5(description));

-- ── 2. Écriture des entités et de leurs sources (serveur uniquement) ────────
-- p_entites : [{ "type": "date", "valeur_normalisee": "2026-01-12", "valeur_brute": "12 janvier 2026",
--                "nature": "piece", "confiance": 0.99,
--                "sources": [{ "chunk_id": "...", "extrait": "...", "offset_debut": 10, "offset_fin": 25 }] }, …]
-- Retourne, par entité, l'identifiant créé ou existant et si la ligne était verrouillée.
-- (Noms de sortie préfixés : un nom identique à une colonne rendrait « on conflict » ambigu en PL/pgSQL.)
create or replace function public.enregistrer_entites(p_dossier_id uuid, p_entites jsonb)
returns table (id_entite uuid, type_entite text, valeur_entite text, verrouillee boolean, creee boolean)
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  s jsonb;
  v_id uuid;
  v_verrou boolean;
  v_creee boolean;
  v_tenant uuid;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_entites est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select tenant_id into v_tenant from public.dossiers where id = p_dossier_id;
  if v_tenant is null then
    raise exception 'DOSSIER_INCONNU: %', p_dossier_id using errcode = 'no_data_found';
  end if;
  perform set_config('clair.acteur', 'agent', true);
  for e in select * from jsonb_array_elements(coalesce(p_entites, '[]'::jsonb)) loop
    if jsonb_array_length(coalesce(e -> 'sources', '[]'::jsonb)) = 0
       and coalesce(e ->> 'nature', 'piece') not in ('declaration_client', 'deduction') then
      raise exception 'ANCRAGE_REQUIS: entité % « % » sans source (I2)', e ->> 'type', e ->> 'valeur_normalisee'
        using errcode = 'check_violation';
    end if;
    select id, verrouille_humain into v_id, v_verrou
      from public.entites
     where dossier_id = p_dossier_id and entites.type = e ->> 'type' and entites.valeur_normalisee = e ->> 'valeur_normalisee';
    v_creee := v_id is null;
    if v_creee then
      insert into public.entites (dossier_id, type, valeur_normalisee, valeur_brute, nature, confiance)
      values (p_dossier_id, e ->> 'type', e ->> 'valeur_normalisee', e ->> 'valeur_brute',
              coalesce(e ->> 'nature', 'piece'), (e ->> 'confiance')::numeric)
      returning id, verrouille_humain into v_id, v_verrou;
    elsif not v_verrou then
      -- Ligne non verrouillée : on garde la meilleure confiance et la nature la plus sûre déjà acquise.
      update public.entites
         set confiance = greatest(confiance, (e ->> 'confiance')::numeric),
             valeur_brute = coalesce(valeur_brute, e ->> 'valeur_brute'),
             nature = case when nature = 'a_verifier' and coalesce(e ->> 'nature', 'piece') = 'piece' then 'piece' else nature end
       where id = v_id;
    end if;
    for s in select * from jsonb_array_elements(coalesce(e -> 'sources', '[]'::jsonb)) loop
      insert into public.entite_sources (entite_id, chunk_id, extrait, offset_debut, offset_fin)
      values (v_id, (s ->> 'chunk_id')::uuid, s ->> 'extrait', (s ->> 'offset_debut')::integer, (s ->> 'offset_fin')::integer)
      on conflict (entite_id, chunk_id) do nothing;
    end loop;
    id_entite := v_id; type_entite := e ->> 'type'; valeur_entite := e ->> 'valeur_normalisee';
    verrouillee := v_verrou; creee := v_creee;
    return next;
  end loop;
  return;
end;
$$;

-- p_evenements : [{ "date": "2026-02-20", "date_precision": "certaine", "nature": "mise_en_demeure",
--                   "description": "...", "nature_assertion": "piece", "confiance": 0.97, "sources": [...] }, …]
create or replace function public.enregistrer_evenements(p_dossier_id uuid, p_evenements jsonb)
returns table (id_evenement uuid, verrouillee boolean, creee boolean)
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  s jsonb;
  v_id uuid;
  v_verrou boolean;
  v_creee boolean;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_evenements est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.dossiers where id = p_dossier_id) then
    raise exception 'DOSSIER_INCONNU: %', p_dossier_id using errcode = 'no_data_found';
  end if;
  perform set_config('clair.acteur', 'agent', true);
  for e in select * from jsonb_array_elements(coalesce(p_evenements, '[]'::jsonb)) loop
    if jsonb_array_length(coalesce(e -> 'sources', '[]'::jsonb)) = 0
       and coalesce(e ->> 'nature_assertion', 'piece') not in ('declaration_client', 'deduction') then
      raise exception 'ANCRAGE_REQUIS: événement % du % sans source (I2)', e ->> 'nature', e ->> 'date'
        using errcode = 'check_violation';
    end if;
    select id, verrouille_humain into v_id, v_verrou
      from public.evenements
     where dossier_id = p_dossier_id and evenements.date = (e ->> 'date')::date
       and evenements.nature = e ->> 'nature' and md5(evenements.description) = md5(e ->> 'description');
    v_creee := v_id is null;
    if v_creee then
      insert into public.evenements (dossier_id, date, date_precision, nature, description, nature_assertion, confiance)
      values (p_dossier_id, (e ->> 'date')::date, coalesce(e ->> 'date_precision', 'certaine'), e ->> 'nature',
              e ->> 'description', coalesce(e ->> 'nature_assertion', 'piece'), (e ->> 'confiance')::numeric)
      returning id, verrouille_humain into v_id, v_verrou;
    elsif not v_verrou then
      update public.evenements set confiance = greatest(confiance, (e ->> 'confiance')::numeric) where id = v_id;
    end if;
    for s in select * from jsonb_array_elements(coalesce(e -> 'sources', '[]'::jsonb)) loop
      insert into public.evenement_sources (evenement_id, chunk_id, extrait, offset_debut, offset_fin)
      values (v_id, (s ->> 'chunk_id')::uuid, s ->> 'extrait', (s ->> 'offset_debut')::integer, (s ->> 'offset_fin')::integer)
      on conflict (evenement_id, chunk_id) do nothing;
    end loop;
    id_evenement := v_id; verrouillee := v_verrou; creee := v_creee;
    return next;
  end loop;
  return;
end;
$$;

revoke all on function public.enregistrer_entites(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.enregistrer_evenements(uuid, jsonb) from public, anon, authenticated;

-- ── 3. Mise en file de VERITAS dès que la pièce est vectorisée ──────────────
create or replace function public.dossier_documents_planifier_veritas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut_ingestion = 'vectorise' and old.statut_ingestion is distinct from 'vectorise' and new.supprime_le is null then
    perform public.planifier_travail('veritas', new.tenant_id, new.dossier_id, new.id, '{}'::jsonb, 5);
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_documents_planifier_veritas on public.dossier_documents;
create trigger dossier_documents_planifier_veritas after update of statut_ingestion on public.dossier_documents
  for each row execute function public.dossier_documents_planifier_veritas();

create or replace function public.travaux_reveiller_executant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('ingestion', 'indexation', 'veritas') then
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
