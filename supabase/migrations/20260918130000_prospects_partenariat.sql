-- ClairDossier — demandes « Devenir partenaire » (chantier 14, 2026-09-18)
--
-- MIGRATION ADDITIVE, idempotente et rejouable. Dépend de
-- 20260829120000_prospects.sql (capture des demandes, facultative) : sans la
-- table public.prospects, ce fichier ne fait RIEN (simple NOTICE) — le
-- rejouer après 20260829. À appliquer AVANT de déployer la version de
-- l'Edge Function submit-prospect qui écrit client_request_id.
--
-- Objet :
--   1. nouvelle nature de demande 'partenariat' (topic) et routage dédié
--      'partenariat' : les listes fermées sont ÉLARGIES, aucune valeur retirée,
--      toutes les lignes existantes restent valides ;
--   2. colonnes facultatives partner_type (liste fermée) et site_url (http/https
--      uniquement, 300 caractères au plus), cohérentes avec la nature : un
--      partenariat a toujours un type ; aucune autre demande n'en porte ;
--   3. idempotence : client_request_id (UUID généré par le navigateur, unique)
--      — un double envoi ne crée jamais deux demandes ;
--   4. l'administrateur ne peut plus modifier QUE le statut : les données
--      déclarées et le journal d'audit deviennent intangibles depuis l'API ;
--      chaque changement de statut est ajouté au journal (audit_log) ;
--   5. lecture et mise à jour réservées à l'admin en session AAL2 (ré-affirmé
--      ici si 20260829 a été appliquée APRÈS 20260918100000).
--
-- Modèle d'accès inchangé : AUCUNE écriture anon/authenticated (seule l'Edge
-- Function submit-prospect écrit, en service role). Aucune donnée modifiée,
-- aucune table détruite. Les statuts existants (nouveau, contacte, converti,
-- clos) sont conservés tels quels.

-- Journal des changements de statut (fonction autonome : créée même sans la
-- table, rattachée plus bas seulement si la table existe).
create or replace function public.prospects_statut_journal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statut is distinct from old.statut then
    new.audit_log := coalesce(old.audit_log, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'ts', now(),
        'actor', coalesce(auth.uid()::text, 'service'),
        'resource', 'prospects',
        'action', 'statut',
        'de', old.statut,
        'vers', new.statut
      )
    );
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.prospects') is null then
    raise notice 'public.prospects absente (20260829 non appliquée) : rien à faire — rejouer ce fichier après 20260829.';
    return;
  end if;

  -- 2 et 3. Colonnes facultatives (aucune valeur par défaut, aucune réécriture).
  alter table public.prospects add column if not exists partner_type text;
  alter table public.prospects add column if not exists site_url text;
  alter table public.prospects add column if not exists client_request_id uuid;

  -- 1. Listes fermées élargies (mêmes noms de contraintes qu'en 20260829).
  alter table public.prospects drop constraint if exists prospects_topic_check;
  alter table public.prospects add constraint prospects_topic_check check (
    topic in ('demo', 'commercial', 'support', 'presse', 'rendez-vous', 'devis', 'partenariat')
  );
  alter table public.prospects drop constraint if exists prospects_routage_check;
  alter table public.prospects add constraint prospects_routage_check check (
    routage in ('libre-service', 'demonstration', 'devis', 'partenariat')
  );

  alter table public.prospects drop constraint if exists prospects_partner_type_check;
  alter table public.prospects add constraint prospects_partner_type_check check (
    partner_type is null
    or partner_type in ('prescripteur', 'integration', 'cabinet-expert', 'autre')
  );
  alter table public.prospects drop constraint if exists prospects_site_url_check;
  alter table public.prospects add constraint prospects_site_url_check check (
    site_url is null
    or (char_length(site_url) <= 300 and site_url ~ '^https?://[^[:space:]]+$')
  );
  alter table public.prospects drop constraint if exists prospects_partenariat_coherence;
  alter table public.prospects add constraint prospects_partenariat_coherence check (
    ((topic = 'partenariat') = (partner_type is not null))
    and (site_url is null or topic = 'partenariat')
  );

  -- 3. Idempotence (les NULL restent autorisés et distincts).
  create unique index if not exists prospects_client_request_id_key
    on public.prospects (client_request_id);
  -- Filtres de la console (nature, statut, plus récentes d'abord).
  create index if not exists prospects_topic_statut_idx
    on public.prospects (topic, statut, created_at desc);

  -- 4. L'admin ne met à jour que le statut (privilège par colonne).
  revoke update on public.prospects from authenticated;
  grant update (statut) on public.prospects to authenticated;

  drop trigger if exists prospects_statut_journal on public.prospects;
  create trigger prospects_statut_journal
    before update of statut on public.prospects
    for each row execute function public.prospects_statut_journal();

  -- 5. Lecture / statut : admin en session MFA vérifiée (AAL2) si disponible.
  if to_regprocedure('public.admin_aal2()') is not null then
    drop policy if exists "prospects_select_admin" on public.prospects;
    create policy "prospects_select_admin" on public.prospects
      for select using (public.admin_aal2());
    drop policy if exists "prospects_update_admin" on public.prospects;
    create policy "prospects_update_admin" on public.prospects
      for update using (public.admin_aal2()) with check (public.admin_aal2());
  end if;
end $$;
