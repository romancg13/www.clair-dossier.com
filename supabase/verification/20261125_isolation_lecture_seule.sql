-- ClairDossier — diagnostic d'isolation, LECTURE SEULE (uniquement des SELECT).
-- À coller dans Supabase → SQL Editor du projet de production, bloc par bloc.
-- Ne modifie rien. Ne renvoie aucun contenu de pièce : seulement des définitions et des comptages.
-- Mode d'emploi et interprétation : docs/recette/SECURITE_ISOLATION.md

-- [1] Le correctif 20261125150000 est-il appliqué ? Attendu : 3 lignes, correctif_applique = true.
select tablename, policyname, cmd,
       (coalesce(with_check, '') ilike '%dossiers%') as correctif_applique,
       with_check as definition
from pg_policies
where schemaname = 'public'
  and policyname in ('docs_insert_own', 'docs_update_own', 'deadlines_update_own')
order by policyname;

-- [2] Pièces rattachées au dossier d'un AUTRE compte (hors administrateurs). Attendu : 0.
select count(*) as pieces_hors_proprietaire,
       count(distinct x.user_id) as comptes_auteurs,
       count(distinct d.user_id) as comptes_touches,
       min(x.created_at) as premiere, max(x.created_at) as derniere
from public.dossier_documents x
join public.dossiers d on d.id = x.dossier_id
where d.user_id <> x.user_id
  and x.user_id not in (select user_id from public.app_admins);

-- [3] Échéances rattachées au dossier d'un AUTRE compte (hors administrateurs). Attendu : 0.
select count(*) as echeances_hors_proprietaire,
       count(distinct x.user_id) as comptes_auteurs,
       count(distinct d.user_id) as comptes_touches
from public.dossier_deadlines x
join public.dossiers d on d.id = x.dossier_id
where d.user_id <> x.user_id
  and x.user_id not in (select user_id from public.app_admins);

-- [4] Pièces dont le chemin de fichier ne commence pas par l'identifiant de leur titulaire
--     (hors administrateurs). Attendu : 0.
select count(*) as chemins_hors_titulaire
from public.dossier_documents x
where x.file_path not like x.user_id::text || '/%'
  and x.user_id not in (select user_id from public.app_admins);

-- [5] Règles d'accès de toutes les tables du schéma public : aucune table sans RLS.
--     Attendu : rls_active = true partout.
select c.relname as table_name, c.relrowsecurity as rls_active,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as nb_regles
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- [6] Règles du stockage des fichiers. Attendu : uniquement des règles « own » (dossier = identifiant
--     du compte) et « admin » sur le bucket documents ; aucune règle ouverte à anon.
select policyname, cmd, roles, qual as lecture, with_check as ecriture
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- [7] Fonctions exécutées avec les droits de leur propriétaire (SECURITY DEFINER) et appelables
--     par un visiteur (anon) ou un compte connecté (authenticated). À relire une par une.
select p.proname as fonction,
       has_function_privilege('anon', p.oid, 'execute') as visiteur,
       has_function_privilege('authenticated', p.oid, 'execute') as compte_connecte
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by p.proname;

-- [8] Rôles qui contournent les règles d'accès. Attendu : seulement des rôles techniques Supabase
--     (postgres, service_role, supabase_admin…), jamais anon ni authenticated.
select rolname, rolbypassrls, rolsuper from pg_roles where rolbypassrls or rolsuper order by rolname;
