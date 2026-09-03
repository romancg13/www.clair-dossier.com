-- ─────────────────────────────────────────────────────────────────────────────
-- CLAIR-IA v3.0 — Étape 6 du plan de build : pipeline d'ingestion, étapes 1 à 5
-- (réception, empreinte, stockage, extraction, qualité) — PARTIE 7.1 et 7.4 ; D-007.
--
-- Additive et rejouable. Le pipeline lui-même est du code serveur
-- (supabase/functions/_shared/pipeline, exécuté par l'Edge Function
-- ingest-document) ; cette migration lui fournit :
--   * une file de travaux persistante (priorités, reprise, backoff, verrou
--     expirable, idempotence : un seul travail actif par document et par type) ;
--   * le texte extrait page par page (document_pages), lisible par le tenant,
--     écrit par le serveur uniquement ;
--   * les limites par plan (plan_limites) et le contrôle de quota côté serveur (I7) ;
--   * des procédures réservées au serveur pour avancer l'ingestion et tracer
--     chaque exécution dans agent_runs (trace_id de bout en bout, PARTIE 11).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. File de travaux ──────────────────────────────────────────────────────
create table if not exists public.travaux (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  dossier_id uuid references public.dossiers (id) on delete cascade,
  document_id uuid references public.dossier_documents (id) on delete cascade,
  type text not null,
  charge jsonb not null default '{}'::jsonb,
  priorite integer not null default 5 check (priorite between 1 and 9),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'en_cours', 'termine', 'echec')),
  tentatives integer not null default 0,
  max_tentatives integer not null default 3,
  prochaine_tentative_le timestamptz not null default now(),
  verrou_par text,
  verrou_le timestamptz,
  trace_id uuid not null default gen_random_uuid(),
  resultat jsonb,
  erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists travaux_a_prendre_idx on public.travaux (type, priorite, created_at)
  where statut = 'en_attente';
create index if not exists travaux_dossier_idx on public.travaux (dossier_id, statut);
-- Idempotence : un même document n'a jamais deux travaux actifs du même type.
create unique index if not exists travaux_actif_unique_idx on public.travaux (type, document_id)
  where document_id is not null and statut in ('en_attente', 'en_cours');

drop trigger if exists travaux_touch on public.travaux;
create trigger travaux_touch before update on public.travaux
  for each row execute function public.touch_updated_at();

alter table public.travaux enable row level security;
-- Le tenant voit l'avancement de ses travaux (« Analyse en cours — 42 pièces sur 150 »),
-- l'admin global aussi ; personne n'écrit hors du serveur.
drop policy if exists "travaux_select_tenant" on public.travaux;
create policy "travaux_select_tenant" on public.travaux
  for select using (public.is_tenant_member(tenant_id));
drop policy if exists "travaux_select_admin" on public.travaux;
create policy "travaux_select_admin" on public.travaux
  for select using (public.is_admin());
do $$
declare s text := pg_get_serial_sequence('public.travaux', 'id');
begin
  if s is not null then
    execute format('revoke all on sequence %s from public, anon, authenticated', s);
  end if;
end $$;

create or replace function public.planifier_travail(
  p_type text,
  p_tenant_id uuid,
  p_dossier_id uuid default null,
  p_document_id uuid default null,
  p_charge jsonb default '{}'::jsonb,
  p_priorite integer default 5
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  -- Appel direct par un client refusé ; autorisé depuis un trigger (dépôt d'une
  -- pièce par le client : la base met elle-même la pièce en file).
  if public.est_appel_client() and pg_trigger_depth() = 0 then
    raise exception 'SERVEUR_UNIQUEMENT: planifier_travail est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  insert into public.travaux (type, tenant_id, dossier_id, document_id, charge, priorite)
  values (p_type, p_tenant_id, p_dossier_id, p_document_id, coalesce(p_charge, '{}'::jsonb), coalesce(p_priorite, 5))
  on conflict (type, document_id) where document_id is not null and statut in ('en_attente', 'en_cours') do nothing
  returning id into v_id;
  if v_id is null and p_document_id is not null then
    select id into v_id from public.travaux
     where type = p_type and document_id = p_document_id and statut in ('en_attente', 'en_cours')
     order by id desc limit 1;
  end if;
  return v_id;
end;
$$;

-- Prend le prochain travail disponible (priorité puis ancienneté), sans bloquer
-- les autres exécutants (SKIP LOCKED). Un verrou plus vieux que p_verrou_max
-- est considéré perdu (exécutant disparu) et le travail redevient disponible.
create or replace function public.prendre_travail(
  p_types text[],
  p_executant text,
  p_verrou_max interval default interval '10 minutes'
) returns setof public.travaux language plpgsql security definer set search_path = public as $$
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: prendre_travail est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  update public.travaux
     set statut = 'en_attente', verrou_par = null, verrou_le = null,
         erreur = coalesce(erreur, '') || ' [verrou expiré]'
   where statut = 'en_cours' and verrou_le < now() - p_verrou_max and type = any (p_types);
  return query
    update public.travaux t
       set statut = 'en_cours', verrou_par = p_executant, verrou_le = now(), tentatives = t.tentatives + 1
     where t.id = (
       select id from public.travaux
        where statut = 'en_attente' and prochaine_tentative_le <= now() and type = any (p_types)
        order by priorite, created_at
        for update skip locked
        limit 1)
    returning t.*;
end;
$$;

create or replace function public.terminer_travail(p_id bigint, p_resultat jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: terminer_travail est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  update public.travaux
     set statut = 'termine', resultat = p_resultat, finished_at = now(), verrou_par = null, verrou_le = null
   where id = p_id and statut = 'en_cours';
end;
$$;

-- Échec : nouvelle tentative avec backoff exponentiel (30 s, 60 s, 120 s…) tant
-- que max_tentatives n'est pas atteint ; sinon échec définitif, journalisé.
create or replace function public.echouer_travail(p_id bigint, p_erreur text, p_definitif boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v travaux%rowtype;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: echouer_travail est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into v from public.travaux where id = p_id for update;
  if not found then return; end if;
  if p_definitif or v.tentatives >= v.max_tentatives then
    update public.travaux
       set statut = 'echec', erreur = p_erreur, finished_at = now(), verrou_par = null, verrou_le = null
     where id = p_id;
    perform public.journaliser('travail.echec', 'travail', null, v.tenant_id, v.dossier_id,
      null, jsonb_build_object('travail_id', v.id, 'type', v.type, 'document_id', v.document_id, 'tentatives', v.tentatives, 'erreur', left(p_erreur, 500)),
      'systeme', v.trace_id);
  else
    update public.travaux
       set statut = 'en_attente', erreur = p_erreur, verrou_par = null, verrou_le = null,
           prochaine_tentative_le = now() + (interval '30 seconds' * power(2, greatest(v.tentatives - 1, 0)))
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.planifier_travail(text, uuid, uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.prendre_travail(text[], text, interval) from public, anon, authenticated;
revoke all on function public.terminer_travail(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.echouer_travail(bigint, text, boolean) from public, anon, authenticated;

-- ── 2. Texte extrait, page par page ─────────────────────────────────────────
create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  document_id uuid not null references public.dossier_documents (id) on delete cascade,
  page integer not null check (page >= 1),
  texte text not null default '',
  nb_caracteres integer not null default 0,
  methode text not null default 'natif' check (methode in ('natif', 'ocr', 'ocr_requis')),
  score_qualite numeric(4,3) check (score_qualite is null or (score_qualite >= 0 and score_qualite <= 1)),
  created_at timestamptz not null default now(),
  constraint document_pages_unique unique (document_id, page)
);
create index if not exists document_pages_document_idx on public.document_pages (document_id, page);

drop trigger if exists document_pages_set_tenant on public.document_pages;
create trigger document_pages_set_tenant before insert or update of dossier_id, tenant_id on public.document_pages
  for each row execute function public.set_tenant_from_dossier();

alter table public.document_pages enable row level security;
drop policy if exists "document_pages_select_tenant" on public.document_pages;
create policy "document_pages_select_tenant" on public.document_pages
  for select using (public.is_tenant_member(tenant_id));
drop policy if exists "document_pages_select_admin" on public.document_pages;
create policy "document_pages_select_admin" on public.document_pages
  for select using (public.is_admin());

-- ── 3. Limites par plan et quota côté serveur (I7) ──────────────────────────
-- Les valeurs commerciales (pièces par dossier, pages) sont une décision produit
-- (inventaire § 12) : seule une limite technique de taille par pièce est posée
-- par défaut (ligne '*'). Une ligne par plan la remplace quand elle existe.
create table if not exists public.plan_limites (
  plan text primary key,
  max_octets_par_piece bigint,
  max_pieces_par_dossier integer,
  max_pages_par_piece integer,
  updated_at timestamptz not null default now()
);
insert into public.plan_limites (plan, max_octets_par_piece, max_pieces_par_dossier, max_pages_par_piece)
values ('*', 26214400, null, null)
on conflict (plan) do nothing;
alter table public.plan_limites enable row level security;
-- Lecture ouverte aux utilisateurs authentifiés (afficher la limite), écriture serveur.
drop policy if exists "plan_limites_select" on public.plan_limites;
create policy "plan_limites_select" on public.plan_limites for select using (auth.uid() is not null);

create or replace function public.limites_du_tenant(t uuid)
returns public.plan_limites language sql security definer stable set search_path = public as $$
  select l.* from public.plan_limites l
  where l.plan = coalesce((select plan from public.tenants where id = t), '*')
  union all
  select l.* from public.plan_limites l where l.plan = '*'
  limit 1;
$$;

create or replace function public.verifier_quota_ingestion(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.dossier_documents%rowtype;
  l public.plan_limites%rowtype;
  n_pieces integer;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: verifier_quota_ingestion est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.dossier_documents where id = p_document_id;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'DOCUMENT_INCONNU');
  end if;
  l := public.limites_du_tenant(d.tenant_id);
  if l.max_octets_par_piece is not null and d.size_bytes is not null and d.size_bytes > l.max_octets_par_piece then
    return jsonb_build_object('ok', false, 'motif', 'TAILLE_MAX_DEPASSEE', 'limite', l.max_octets_par_piece, 'valeur', d.size_bytes);
  end if;
  if l.max_pieces_par_dossier is not null then
    select count(*) into n_pieces from public.dossier_documents
     where dossier_id = d.dossier_id and kind = 'piece' and supprime_le is null and statut_ingestion <> 'doublon';
    if n_pieces > l.max_pieces_par_dossier then
      return jsonb_build_object('ok', false, 'motif', 'PIECES_MAX_DEPASSEES', 'limite', l.max_pieces_par_dossier, 'valeur', n_pieces);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'plan', coalesce(l.plan, '*'), 'max_pages_par_piece', l.max_pages_par_piece);
end;
$$;
revoke all on function public.limites_du_tenant(uuid) from public, anon;
grant execute on function public.limites_du_tenant(uuid) to authenticated;
revoke all on function public.verifier_quota_ingestion(uuid) from public, anon, authenticated;

-- ── 4. Procédures serveur d'avancement de l'ingestion ───────────────────────
create or replace function public.marquer_ingestion(
  p_document_id uuid,
  p_statut text,
  p_erreur text default null,
  p_pages integer default null,
  p_trace_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare d public.dossier_documents%rowtype;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: marquer_ingestion est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.dossier_documents where id = p_document_id for update;
  if not found then
    raise exception 'DOCUMENT_INCONNU: %', p_document_id using errcode = 'no_data_found';
  end if;
  update public.dossier_documents
     set statut_ingestion = p_statut,
         ingestion_erreur = p_erreur,
         pages = coalesce(p_pages, pages)
   where id = p_document_id;
  perform public.journaliser('document.ingestion', 'dossier_document', d.id, d.tenant_id, d.dossier_id,
    jsonb_build_object('statut_ingestion', d.statut_ingestion),
    jsonb_build_object('statut_ingestion', p_statut, 'erreur', p_erreur, 'pages', coalesce(p_pages, d.pages)),
    'systeme', p_trace_id);
end;
$$;

-- p_pages : [{ "page": 1, "texte": "...", "methode": "natif", "score_qualite": 0.93 }, …]
create or replace function public.enregistrer_pages(p_document_id uuid, p_pages jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare d public.dossier_documents%rowtype; n integer;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: enregistrer_pages est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.dossier_documents where id = p_document_id;
  if not found then
    raise exception 'DOCUMENT_INCONNU: %', p_document_id using errcode = 'no_data_found';
  end if;
  insert into public.document_pages (dossier_id, document_id, page, texte, nb_caracteres, methode, score_qualite)
  select d.dossier_id, d.id, (p ->> 'page')::integer, coalesce(p ->> 'texte', ''),
         length(coalesce(p ->> 'texte', '')), coalesce(p ->> 'methode', 'natif'), (p ->> 'score_qualite')::numeric
    from jsonb_array_elements(coalesce(p_pages, '[]'::jsonb)) p
  on conflict (document_id, page) do update
    set texte = excluded.texte, nb_caracteres = excluded.nb_caracteres,
        methode = excluded.methode, score_qualite = excluded.score_qualite;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.demarrer_run(
  p_agent text,
  p_tenant_id uuid,
  p_dossier_id uuid,
  p_trace_id uuid,
  p_entree_hash text,
  p_modele text default null,
  p_version text default '1.0'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: demarrer_run est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  insert into public.agent_runs (agent, version, tenant_id, dossier_id, trace_id, entree_hash, modele)
  values (p_agent, coalesce(p_version, '1.0'), p_tenant_id, p_dossier_id, p_trace_id, p_entree_hash, p_modele)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.terminer_run(
  p_run_id uuid,
  p_statut text,
  p_sortie jsonb default null,
  p_confiance numeric default null,
  p_duree_ms integer default null,
  p_erreur text default null,
  p_tokens_entree integer default null,
  p_tokens_sortie integer default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.est_appel_client() then
    raise exception 'SERVEUR_UNIQUEMENT: terminer_run est réservée au serveur' using errcode = 'insufficient_privilege';
  end if;
  update public.agent_runs
     set statut = p_statut,
         sortie = p_sortie,
         confiance = p_confiance,
         duree_ms = p_duree_ms,
         erreur = p_erreur,
         tokens_entree = p_tokens_entree,
         tokens_sortie = p_tokens_sortie,
         escalades = coalesce(p_sortie -> 'escalades', '[]'::jsonb),
         incertitudes = coalesce(p_sortie -> 'incertitudes', '[]'::jsonb),
         finished_at = now()
   where id = p_run_id;
end;
$$;

-- Cache par entrée (7.4) : dernière exécution réussie du même agent sur la même empreinte.
create or replace function public.run_en_cache(p_agent text, p_version text, p_entree_hash text)
returns uuid language sql security definer stable set search_path = public as $$
  select id from public.agent_runs
   where agent = p_agent and version = p_version and entree_hash = p_entree_hash and statut = 'ok'
   order by created_at desc limit 1;
$$;

revoke all on function public.marquer_ingestion(uuid, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.enregistrer_pages(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.demarrer_run(text, uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.terminer_run(uuid, text, jsonb, numeric, integer, text, integer, integer) from public, anon, authenticated;
revoke all on function public.run_en_cache(text, text, text) from public, anon, authenticated;

-- ── 5. Mise en file automatique au dépôt d'une pièce ────────────────────────
-- Toute pièce reçue (non doublon) entre dans la file « ingestion ». Le tenant_id a
-- été posé par le trigger BEFORE ; le statut « doublon » l'a été par la détection.
create or replace function public.dossier_documents_planifier_ingestion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'piece' and new.statut_ingestion = 'recu' and new.supprime_le is null then
    perform public.planifier_travail('ingestion', new.tenant_id, new.dossier_id, new.id,
      jsonb_build_object('file_path', new.file_path), 5);
  end if;
  return new;
end;
$$;
drop trigger if exists dossier_documents_planifier_ingestion on public.dossier_documents;
create trigger dossier_documents_planifier_ingestion after insert on public.dossier_documents
  for each row execute function public.dossier_documents_planifier_ingestion();

-- Réveil de l'exécutant : même mécanisme que notify-lead (pg_net, clé anon publique
-- protégée par la vérification JWT de la passerelle). L'Edge Function ne fait que
-- consommer la file : un appel superflu ne coûte qu'une requête vide.
create or replace function public.travaux_reveiller_executant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'ingestion' then
    perform net.http_post(
      url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/ingest-document',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U'
      ),
      body := jsonb_build_object('source', 'travaux', 'travail_id', new.id)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists travaux_reveiller_executant on public.travaux;
create trigger travaux_reveiller_executant after insert on public.travaux
  for each row execute function public.travaux_reveiller_executant();
