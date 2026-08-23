# Audit PHASE 0 — Cartographie SUPABASE (backend) — ClairDossier

**Périmètre** : lecture seule du dépôt `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com` (branche `main`, commit `865f86c`, arbre propre).
**Fichiers lus intégralement** : `supabase/config.toml` (384 l.), `supabase/.gitignore` (8 l.), `supabase/functions/notify-lead/index.ts` (69 l.), les 6 migrations `supabase/migrations/*.sql` (113 + 34 + 53 + 19 + 29 + 11 lignes). Croisement ponctuel avec `.github/workflows/deploy.yml`, `netlify.toml`, `.gitignore`, `.env.example`, `src/lib/auth.tsx`, `src/lib/supabase.ts`, `src/pages/Account.tsx`, `src/pages/DossierFlow.tsx`, `src/pages/DossierDetail.tsx` (extraits cités).
**Non lu / non fait** : aucun fichier `.env` (seul `.env.example` existe dans le dépôt, il ne contient que des placeholders), aucun accès au projet Supabase live, aucune commande git modifiant l'état. Tout ce qui relève de l'état réel de la base de production est marqué **« à vérifier sur le projet live »**.

Toutes les références sont au format `fichier:ligne` (chemins relatifs à la racine du dépôt).

---

## 1. Projet Supabase et configuration

### 1.1 Identification du projet

| Élément | Valeur | Source |
|---|---|---|
| `project_id` local (CLI) | `clair-dossier` | `supabase/config.toml:5` |
| Ref du projet hébergé | `buzgokfmxpmyceppvjpp` | `.github/workflows/deploy.yml:42` (`VITE_SUPABASE_URL: https://buzgokfmxpmyceppvjpp.supabase.co`), `netlify.toml:26` (CSP `connect-src`), `supabase/migrations/20260617110728_dossier_lead_notification.sql:15` (URL de l'edge function) |
| Clé anon (publique) | JWT HS256 ; claims décodés : `iss=supabase`, `ref=buzgokfmxpmyceppvjpp`, `role=anon`, `iat=1781549969`, `exp=2097125969` | `.github/workflows/deploy.yml:43` et **en dur dans le SQL** `supabase/migrations/20260617110728_dossier_lead_notification.sql:18` |
| Version Postgres majeure attendue | 17 | `supabase/config.toml:36` |
| Hébergement front | GitHub Pages (domaine) + Netlify (`clair-dossier.netlify.app`) | `.github/workflows/deploy.yml:3-6`, `netlify.toml:1-2` |

**Point important** : le pipeline CI (`.github/workflows/deploy.yml:22-58`) ne fait que `npm ci` / `npm run build` / déploiement Pages. **Aucune étape `supabase db push`, `supabase functions deploy` ou `supabase config push`** n'existe dans le dépôt. L'application des migrations et le déploiement de l'edge function sont donc manuels → l'état effectif du schéma, des policies et de la fonction en production est **à vérifier sur le projet live** (la correspondance dépôt ↔ prod n'est pas garantie par le code).

### 1.2 `supabase/.gitignore`

| Ligne | Motif ignoré |
|---|---|
| `supabase/.gitignore:2` | `.branches` |
| `supabase/.gitignore:3` | `.temp` |
| `supabase/.gitignore:6` | `.env.keys` |
| `supabase/.gitignore:7` | `.env.local` |
| `supabase/.gitignore:8` | `.env.*.local` |

Le `.gitignore` racine (`.gitignore:12-14`) ignore en plus `.env` et `.env.*` (sauf `.env.example`). Aucun fichier `.env` n'est suivi par git (`git ls-files | grep .env` → uniquement `.env.example`).

### 1.3 Configuration Auth (`[auth]`, `config.toml`)

> Rappel : `config.toml` est le fichier de la CLI (stack locale). Il ne s'applique au projet hébergé que si `supabase config push` a été exécuté — **à vérifier sur le projet live** (Dashboard > Authentication).

| Paramètre | Valeur | Source |
|---|---|---|
| `site_url` | `https://www.clair-dossier.com` | `supabase/config.toml:150` |
| `additional_redirect_urls` | `https://www.clair-dossier.com`, `https://clair-dossier.com`, `https://clair-dossier.netlify.app`, `http://localhost:5173`, `http://127.0.0.1:5173` | `supabase/config.toml:152` |
| `jwt_expiry` | 3600 s | `supabase/config.toml:154` |
| `enable_refresh_token_rotation` / `refresh_token_reuse_interval` | `true` / 10 s | `supabase/config.toml:160,163` |
| `enable_signup` | `true` | `supabase/config.toml:165` |
| `enable_anonymous_sign_ins` | `false` | `supabase/config.toml:167` |
| `enable_manual_linking` | `false` | `supabase/config.toml:169` |
| `minimum_password_length` | 8 | `supabase/config.toml:171` |
| `password_requirements` | `""` (aucune exigence de complexité) | `supabase/config.toml:174` |
| Rate limits | `email_sent=30/h`, `sms_sent=30`, `anonymous_users=30`, `token_refresh=150/5min`, `sign_in_sign_ups=30/5min`, `token_verifications=30/5min`, `web3=30` | `supabase/config.toml:176-190` |
| Captcha | section commentée → **désactivé** | `supabase/config.toml:192-196` |
| `[auth.email].enable_signup` | `true` | `supabase/config.toml:200` |
| `[auth.email].double_confirm_changes` | `true` | `supabase/config.toml:203` |
| `[auth.email].enable_confirmations` | **`true`** (confirmation e-mail obligatoire avant connexion) | `supabase/config.toml:205` |
| `[auth.email].secure_password_change` | `false` | `supabase/config.toml:207` |
| `[auth.email].max_frequency` | `1s` | `supabase/config.toml:209` |
| `otp_length` / `otp_expiry` | 6 / 3600 s | `supabase/config.toml:211,213` |
| **SMTP** `[auth.email.smtp]` | `enabled=true`, `host=smtp.resend.com`, `port=465`, `user=resend`, `pass=env(RESEND_SMTP_PASSWORD)`, `admin_email=noreply@clair-dossier.com`, `sender_name=ClairDossier` | `supabase/config.toml:215-223` |
| Templates e-mail personnalisés | sections commentées → templates par défaut | `supabase/config.toml:225-234` |
| `[auth.sms]` | signup `false`, confirmations `false`; Twilio `enabled=false` | `supabase/config.toml:236-244,268-273` |
| Sessions (`timebox`, `inactivity_timeout`) | commentées → illimitées | `supabase/config.toml:250-255` |
| Auth hooks (`before_user_created`, `custom_access_token`) | commentés → **aucun hook** (pas de claims personnalisés, pas de claim `is_admin` dans le JWT) | `supabase/config.toml:257-265` |
| MFA | `max_enrolled_factors=10`, TOTP `enroll/verify=false`, phone `false`, WebAuthn commenté | `supabase/config.toml:275-296` |
| OAuth externe | seul bloc présent : `apple` avec `enabled=false` ; aucun Google/GitHub… | `supabase/config.toml:298-314` |
| Web3 Solana, third-party (Firebase/Auth0/Cognito/Clerk), OAuth server | tous `enabled=false` | `supabase/config.toml:316-351` |

Le front envoie à `signUp` les metadata `full_name`, `company_name`, `company_type` (`src/lib/auth.tsx:77-86`), consommées par le trigger `handle_new_user` (cf. §4).

### 1.4 Autres sections notables de `config.toml`

| Section | Valeur | Source | Remarque |
|---|---|---|---|
| `[api]` | `schemas=["public","graphql_public"]`, `extra_search_path=["public","extensions"]`, `max_rows=1000` | `supabase/config.toml:13-18` | — |
| `[db]` | `major_version=17`, pooler `enabled=false` | `supabase/config.toml:36-39` | — |
| `[db.migrations]` | `enabled=true`, `schema_paths=[]` | `supabase/config.toml:53-58` | migrations classiques |
| `[db.seed]` | `enabled=true`, `sql_paths=["./seed.sql"]` | `supabase/config.toml:60-65` | **`supabase/seed.sql` n'existe pas** dans le dépôt (vérifié par `ls`) |
| `[db.network_restrictions]` | `enabled=false`, `0.0.0.0/0` et `::/0` | `supabase/config.toml:67-75` | aucune restriction réseau gérée par la CLI |
| `[realtime]` | `enabled=true` | `supabase/config.toml:77-78` | aucune table n'est ajoutée à la publication realtime dans les migrations |
| `[studio]` | `openai_api_key=env(OPENAI_API_KEY)` | `supabase/config.toml:91` | local uniquement |
| `[inbucket]` | `enabled=true` port 54324 | `supabase/config.toml:95-98` | serveur mail de test local |
| **`[storage]`** | `enabled=true`, **`file_size_limit="50MiB"`** (global) | `supabase/config.toml:105-108` | aucun bucket déclaré dans le toml (bloc commenté `:110-115`) ; le bucket est créé par migration (§5) |
| `[storage.s3_protocol]` | `enabled=true` | `supabase/config.toml:118-119` | — |
| `[storage.analytics]` / `[storage.vector]` | `enabled=false` | `supabase/config.toml:127-141` | — |
| `[edge_runtime]` | `enabled=true`, `policy="per_worker"`, `deno_version=2`, secrets commentés | `supabase/config.toml:353-365` | **aucune section `[functions.notify-lead]`** → `verify_jwt` au défaut (true) — à vérifier sur le projet live |
| `[analytics]` | `enabled=true`, backend `postgres` | `supabase/config.toml:367-371` | — |
| `[experimental]` | `s3_host/region/access_key/secret_key = env(...)` | `supabase/config.toml:374-384` | valeurs par défaut du template |

---

## 2. Tables

Aucun type `enum` Postgres n'est créé ; toutes les contraintes de domaine sont des `check`. Aucune vue. Schéma `public` uniquement (+ bucket `storage`).

### 2.1 `public.profiles`

Créée par `supabase/migrations/20260615201942_clair_dossier_init.sql:5-17`.

| Colonne | Type | Null | Default | Contraintes | Source |
|---|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | **PK**, FK → `auth.users(id) ON DELETE CASCADE` | `…init.sql:6` |
| `full_name` | `text` | NULL | — | — | `…init.sql:7` |
| `company_name` | `text` | NULL | — | — | `…init.sql:8` |
| `company_type` | `text` | NULL | — | `check (company_type in ('pme','artisan','entreprise-individuelle','profession-liberale','particulier','autre'))` | `…init.sql:9-13` |
| `phone` | `text` | NULL | — | — (jamais renseignée par `handle_new_user`) | `…init.sql:14` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — | `…init.sql:15` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | maintenue par trigger | `…init.sql:16` |

- Index : PK seulement.
- RLS : activée `…init.sql:48`.
- Triggers : `profiles_touch` (BEFORE UPDATE → `touch_updated_at`) `…init.sql:74-76` ; `on_new_profile_notify` (AFTER INSERT → `notify_lead`) `…20260617110728_dossier_lead_notification.sql:26-29`.
- Alimentation : trigger `on_auth_user_created` sur `auth.users` (§4).
- Historique : M1 (création, RLS, trigger) → M2 (trigger notification) → M3 (policy `profiles_select_admin`).

### 2.2 `public.dossiers`

Créée par `…init.sql:20-30`.

| Colonne | Type | Null | Default | Contraintes | Source |
|---|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK | `…init.sql:21` |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users(id) ON DELETE CASCADE` | `…init.sql:22` |
| `typology` | `text` | NOT NULL | — | **aucune contrainte de valeur** | `…init.sql:23` |
| `title` | `text` | NULL | — | — | `…init.sql:24` |
| `status` | `text` | NOT NULL | `'brouillon'` | **aucune contrainte de valeur** (le front insère `'transmis'` : `src/pages/DossierFlow.tsx:348`) | `…init.sql:25` |
| `answers` | `jsonb` | NOT NULL | `'{}'::jsonb` | — | `…init.sql:26` |
| `legal_review_requested` | `boolean` | NOT NULL | `false` | — | `…init.sql:27` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — | `…init.sql:28` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | trigger | `…init.sql:29` |

- Index : PK ; `dossiers_user_id_idx` sur `(user_id)` `…init.sql:32`.
- RLS : activée `…init.sql:49`.
- Triggers : `dossiers_touch` (BEFORE UPDATE) `…init.sql:78-80` ; `on_new_dossier_notify` (AFTER INSERT → `notify_lead`) `…lead_notification.sql:31-34`.
- Historique : M1 → M2 (trigger) → M3 (policy `dossiers_select_admin`).

### 2.3 `public.dossier_documents`

Créée par `…init.sql:35-43`, modifiée par `…20260628093000_dossier_deliverables.sql:13-19`.

| Colonne | Type | Null | Default | Contraintes | Source |
|---|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK | `…init.sql:36` |
| `dossier_id` | `uuid` | NOT NULL | — | FK → `public.dossiers(id) ON DELETE CASCADE` | `…init.sql:37` |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users(id) ON DELETE CASCADE` | `…init.sql:38` |
| `file_path` | `text` | NOT NULL | — | chemin dans le bucket `documents` (non validé en SQL) | `…init.sql:39` |
| `file_name` | `text` | NOT NULL | — | — | `…init.sql:40` |
| `size_bytes` | `bigint` | NULL | — | — | `…init.sql:41` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — | `…init.sql:42` |
| `kind` | `text` | NOT NULL | `'piece'` | `dossier_documents_kind_check check (kind in ('piece','deliverable'))` | `…deliverables.sql:13-19` |

- Index : PK ; `dossier_documents_dossier_id_idx` sur `(dossier_id)` `…init.sql:45`. **Pas d'index sur `user_id`** (colonne pourtant utilisée par toutes les policies `_own`).
- Pas de colonne `updated_at`, pas de trigger.
- RLS : activée `…init.sql:50`.
- Historique : M1 → M3 (`docs_select_admin`) → M5 (colonne `kind` + `docs_insert_admin`) → M6 (`docs_delete_admin`).

### 2.4 `public.app_admins`

Créée par `…20260621144123_admin_global_access.sql:11-14`.

| Colonne | Type | Null | Default | Contraintes | Source |
|---|---|---|---|---|---|
| `user_id` | `uuid` | NOT NULL | — | PK, FK → `auth.users(id) ON DELETE CASCADE` | `…admin_global_access.sql:12` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — | `…admin_global_access.sql:13` |

- RLS activée `…admin_global_access.sql:15`, **aucune policy**, `revoke all on public.app_admins from anon, authenticated` `…admin_global_access.sql:17`.
- Peuplée une seule fois par `insert … select id from auth.users where email = 'prestige.seller@icloud.com' on conflict do nothing` `…admin_global_access.sql:20-22`.
- Historique : M3 uniquement.

### 2.5 Récapitulatif de l'historique des migrations

| # | Fichier | Objets touchés |
|---|---|---|
| M1 | `supabase/migrations/20260615201942_clair_dossier_init.sql` | tables `profiles`, `dossiers`, `dossier_documents` ; 2 index ; RLS + 10 policies ; fonctions `touch_updated_at`, `handle_new_user` ; triggers `profiles_touch`, `dossiers_touch`, `on_auth_user_created` ; bucket `documents` ; 3 policies storage |
| M2 | `supabase/migrations/20260617110728_dossier_lead_notification.sql` | extension `pg_net` ; fonction `notify_lead` ; triggers `on_new_profile_notify`, `on_new_dossier_notify` |
| M3 | `supabase/migrations/20260621144123_admin_global_access.sql` | table `app_admins` ; fonction `is_admin` ; policies `dossiers_select_admin`, `docs_select_admin`, `profiles_select_admin`, `docs_storage_select_admin` |
| M4 | `supabase/migrations/20260622062648_admin_user_emails.sql` | fonction `admin_user_emails` |
| M5 | `supabase/migrations/20260628093000_dossier_deliverables.sql` | colonne `dossier_documents.kind` + check ; policies `docs_insert_admin`, `docs_storage_insert_admin` |
| M6 | `supabase/migrations/20260701093000_admin_delete_documents.sql` | policies `docs_delete_admin`, `docs_storage_delete_admin` |

---

## 3. Policies RLS (texte exact)

Toutes les policies sont **PERMISSIVE** (défaut, aucune `as restrictive`) et **sans clause `to <role>`** → s'appliquent à tous les rôles (`anon`, `authenticated`, …) ; elles se combinent en **OR**.

### 3.1 `public.profiles`

| Nom | Commande | Rôle | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| `profiles_select_own` | SELECT | (tous) | `auth.uid() = id` | — | `…init.sql:52` |
| `profiles_insert_own` | INSERT | (tous) | — | `auth.uid() = id` | `…init.sql:53` |
| `profiles_update_own` | UPDATE | (tous) | `auth.uid() = id` | `auth.uid() = id` | `…init.sql:54` |
| `profiles_select_admin` | SELECT | (tous) | `public.is_admin()` | — | `…admin_global_access.sql:46-48` |

Pas de policy DELETE (suppression uniquement par cascade depuis `auth.users`). Pas d'UPDATE admin.

### 3.2 `public.dossiers`

| Nom | Commande | Rôle | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| `dossiers_select_own` | SELECT | (tous) | `auth.uid() = user_id` | — | `…init.sql:56` |
| `dossiers_insert_own` | INSERT | (tous) | — | `auth.uid() = user_id` | `…init.sql:57` |
| `dossiers_update_own` | UPDATE | (tous) | `auth.uid() = user_id` | `auth.uid() = user_id` | `…init.sql:58` |
| `dossiers_delete_own` | DELETE | (tous) | `auth.uid() = user_id` | — | `…init.sql:59` |
| `dossiers_select_admin` | SELECT | (tous) | `public.is_admin()` | — | `…admin_global_access.sql:38-40` |

**Pas de policy UPDATE/DELETE admin** : l'admin ne peut pas modifier `status`, `title`, `answers`, ni supprimer un dossier client via l'API (seul le client le peut). Le front ne fait d'ailleurs aucun `.update(` sur Supabase (grep `src/pages`, `src/lib` : 0 occurrence).

### 3.3 `public.dossier_documents`

| Nom | Commande | Rôle | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| `docs_select_own` | SELECT | (tous) | `auth.uid() = user_id` | — | `…init.sql:61` |
| `docs_insert_own` | INSERT | (tous) | — | `auth.uid() = user_id` | `…init.sql:62` |
| `docs_delete_own` | DELETE | (tous) | `auth.uid() = user_id` | — | `…init.sql:63` |
| `docs_select_admin` | SELECT | (tous) | `public.is_admin()` | — | `…admin_global_access.sql:42-44` |
| `docs_insert_admin` | INSERT | (tous) | — | `public.is_admin()` | `…deliverables.sql:22-24` |
| `docs_delete_admin` | DELETE | (tous) | `public.is_admin()` | — | `…admin_delete_documents.sql:5-7` |

**Aucune policy UPDATE** (ni own, ni admin) : une ligne de `dossier_documents` est immuable via l'API.

### 3.4 `public.app_admins`

RLS activée, **zéro policy** (`…admin_global_access.sql:15-17`). Accès uniquement via `service_role`/owner et, indirectement, via `is_admin()` (SECURITY DEFINER).

### 3.5 `storage.objects` (bucket `documents`)

| Nom | Commande | Rôle | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| `docs_storage_select_own` | SELECT | (tous) | `bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]` | — | `…init.sql:108-109` |
| `docs_storage_insert_own` | INSERT | (tous) | — | `bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]` | `…init.sql:110-111` |
| `docs_storage_delete_own` | DELETE | (tous) | `bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]` | — | `…init.sql:112-113` |
| `docs_storage_select_admin` | SELECT | (tous) | `bucket_id = 'documents' and public.is_admin()` | — | `…admin_global_access.sql:51-53` |
| `docs_storage_insert_admin` | INSERT | (tous) | — | `bucket_id = 'documents' and public.is_admin()` | `…deliverables.sql:27-29` |
| `docs_storage_delete_admin` | DELETE | (tous) | `bucket_id = 'documents' and public.is_admin()` | — | `…admin_delete_documents.sql:9-11` |

Aucune policy UPDATE sur `storage.objects` (le front uploade avec `upsert: false` : `src/pages/DossierFlow.tsx:362`, `src/pages/DossierDetail.tsx:346`).

---

## 4. Fonctions SQL, triggers, vues, grants, extensions, cron, webhooks

### 4.1 Fonctions

| Fonction | Langage | SECURITY | Volatilité | `search_path` | Grants | Rôle | Source |
|---|---|---|---|---|---|---|---|
| `public.touch_updated_at()` → `trigger` | plpgsql | **INVOKER** (défaut) | (défaut) | (non fixé) | défauts Supabase (non modifiés) | `new.updated_at = now()` | `…init.sql:66-72` |
| `public.handle_new_user()` → `trigger` | plpgsql | **DEFINER** | — | `public` | défauts | insère `profiles(id, full_name, company_name, company_type)` depuis `new.raw_user_meta_data`, `on conflict (id) do nothing` | `…init.sql:83-96` |
| `public.notify_lead()` → `trigger` | plpgsql | **DEFINER** | — | `public` | défauts | `perform net.http_post(url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/notify-lead', headers := {Content-Type, Authorization: Bearer <ANON JWT en dur>}, body := {'table': tg_table_name, 'record': to_jsonb(new)})` | `…lead_notification.sql:7-24` |
| `public.is_admin()` → `boolean` | sql | **DEFINER** | `stable` | `public` | `revoke all … from public, anon` ; `grant execute … to authenticated` | `exists (select 1 from public.app_admins where user_id = auth.uid())` | `…admin_global_access.sql:25-35` |
| `public.admin_user_emails()` → `table(id uuid, email text)` | sql | **DEFINER** | `stable` | `public, auth` | `revoke all … from public, anon` ; `grant execute … to authenticated` | `select u.id, u.email::text from auth.users u where public.is_admin()` | `…admin_user_emails.sql:6-19` |

### 4.2 Triggers

| Trigger | Table | Moment | Fonction | Source |
|---|---|---|---|---|
| `profiles_touch` | `public.profiles` | BEFORE UPDATE, row | `touch_updated_at` | `…init.sql:74-76` |
| `dossiers_touch` | `public.dossiers` | BEFORE UPDATE, row | `touch_updated_at` | `…init.sql:78-80` |
| `on_auth_user_created` | **`auth.users`** | AFTER INSERT, row | `handle_new_user` | `…init.sql:98-100` |
| `on_new_profile_notify` | `public.profiles` | AFTER INSERT, row | `notify_lead` | `…lead_notification.sql:26-29` |
| `on_new_dossier_notify` | `public.dossiers` | AFTER INSERT, row | `notify_lead` | `…lead_notification.sql:31-34` |

Chaîne d'inscription : `auth.users INSERT` → `on_auth_user_created` → `handle_new_user` → `profiles INSERT` → `on_new_profile_notify` → `notify_lead` → `net.http_post` → edge function `notify-lead` → Resend → `prestige.seller@icloud.com`.

### 4.3 Vues, grants, extensions, cron, webhooks

| Élément | Constat | Source |
|---|---|---|
| Vues | **aucune** | (6 migrations lues) |
| Extensions | `create extension if not exists pg_net` (seule extension explicite) | `…lead_notification.sql:5` |
| `pg_cron` / jobs planifiés | **aucun** | — |
| Database Webhooks Supabase (`supabase_functions.http_request`) | **aucun** ; le mécanisme est un trigger custom `notify_lead` + `pg_net` | `…lead_notification.sql` |
| Grants sur tables | `revoke all on public.app_admins from anon, authenticated` uniquement ; les autres tables gardent les privilèges par défaut Supabase (anon/authenticated ont les DML, filtrés par RLS) | `…admin_global_access.sql:17` |
| Grants sur fonctions | `is_admin` et `admin_user_emails` : revoke `public, anon`, grant `authenticated` | `…admin_global_access.sql:34-35`, `…admin_user_emails.sql:18-19` |
| Realtime publication | aucune table ajoutée | — |
| Schéma `graphql_public` exposé | oui (config) | `supabase/config.toml:13` |

### 4.4 Mécanisme de notification de lead (résumé)

1. Déclencheur : INSERT sur `public.profiles` ou `public.dossiers` (`…lead_notification.sql:26-34`).
2. `notify_lead()` (SECURITY DEFINER) appelle `net.http_post` (asynchrone, via worker pg_net) vers `https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/notify-lead` avec `Authorization: Bearer <clé anon>` **codée en dur dans la migration** (`…lead_notification.sql:15-18`). Le corps contient `tg_table_name` et **la ligne entière** `to_jsonb(new)` (`…lead_notification.sql:20`) — donc pour `dossiers` : `answers` complet, `title`, `typology` ; pour `profiles` : `full_name`, `company_name`, `phone`.
3. L'edge function ne lit que `payload.table` et `record.id` (`supabase/functions/notify-lead/index.ts:13-14,21`), construit un e-mail **minimisé RGPD** (pas de nom, pas de typologie ni montant : `index.ts:16-19`) avec un lien vers `/compte` ou `/compte/dossier/<id>` (`index.ts:24-33`) et l'envoie via l'API Resend (`index.ts:49-56`).

---

## 5. Buckets Storage

| Bucket | `public` | Limite taille / MIME (niveau bucket) | Convention de chemin | Source |
|---|---|---|---|---|
| `documents` | `false` (privé) | **non définis** dans la migration (`insert into storage.buckets (id, name, public)` seulement) ; seule la limite globale locale `50MiB` de `config.toml:108` existe — limite réelle du projet hébergé **à vérifier sur le projet live** | `<user_id>/<dossier_id>/<timestamp>-<nom>` (pièces client : `src/pages/DossierFlow.tsx:360`) et `<client_user_id>/<dossier_id>/deliverable-<timestamp>-<nom>` (livrables admin : `src/pages/DossierDetail.tsx:343`) | `…init.sql:103-105` |

Policies : voir §3.5 (6 policies, toutes sur `storage.objects`, filtre `bucket_id = 'documents'`). L'isolation repose sur `(storage.foldername(name))[1] = auth.uid()::text`, c.-à-d. le **premier segment du chemin**. Aucune policy sur `storage.buckets`.

---

## 6. Administration globale

| Aspect | Constat | Source |
|---|---|---|
| Définition de l'admin | Ligne dans `public.app_admins` ; insérée par migration pour l'utilisateur `auth.users` dont `email = 'prestige.seller@icloud.com'` au moment où M3 est appliquée (`on conflict do nothing`). **Si le compte n'existait pas encore à l'exécution, la table reste vide** → à vérifier sur le projet live. | `…admin_global_access.sql:1,20-22` |
| Ajout d'un autre admin | Impossible via l'API (RLS sans policy + revoke) ; uniquement SQL avec `service_role`/owner | `…admin_global_access.sql:15-17` |
| Test côté client | `supabase.rpc('is_admin')` | `src/pages/Account.tsx:42`, `src/pages/DossierDetail.tsx:253` |
| Claim JWT | **aucun** (pas de custom access token hook) → le statut est recalculé par requête SQL via `is_admin()` | `supabase/config.toml:262-265` |
| Droits admin — lecture | SELECT sur tous `profiles`, `dossiers`, `dossier_documents` ; SELECT de tous les objets du bucket `documents` ; e-mails de **tous** les `auth.users` via `admin_user_emails()` | M3 `:38-53`, M4 `:6-16` |
| Droits admin — écriture | INSERT `dossier_documents` pour n'importe quel `user_id`/`dossier_id` (livrables) ; INSERT d'objets n'importe où dans le bucket ; DELETE de n'importe quelle ligne `dossier_documents` et de n'importe quel objet du bucket | M5 `:22-29`, M6 `:5-11` |
| Droits admin — **absents** | UPDATE/DELETE sur `dossiers` (statut, titre, réponses) ; UPDATE/DELETE/INSERT sur `profiles` d'autrui ; UPDATE `dossier_documents` ; toute écriture sur `app_admins` | (aucune policy correspondante dans M1–M6) |
| Usage front | L'admin voit la liste de tous les dossiers avec nom d'entreprise + e-mail du propriétaire (`Account.tsx:46-64`) ; dépose des livrables sous `user_id` du client (`DossierDetail.tsx:334-359`) ; supprime des documents (`DossierDetail.tsx:414-418`) | — |

---

## 7. Edge function `notify-lead`

| Aspect | Constat | Source |
|---|---|---|
| Runtime | Deno (`Deno.serve`), Deno 2 (config) | `index.ts:10`, `supabase/config.toml:362` |
| Déclencheur | HTTP POST depuis le trigger Postgres `notify_lead` (pg_net) ; payload `{ table: 'profiles' | 'dossiers', record }` | `index.ts:2-4`, `…lead_notification.sql:14-21` |
| Authentification entrante | Aucun contrôle dans le code ; s'appuie sur la vérification JWT de la plateforme (par défaut `verify_jwt=true`, pas de surcharge dans `config.toml`) ; l'appelant utilise la **clé anon** (publique) | `index.ts` (aucune vérification), `…lead_notification.sql:3,18` |
| Secrets attendus (noms) | `RESEND_API_KEY` (via `Deno.env.get`, valeur vide par défaut `''` si absent) | `index.ts:6` |
| Fournisseur e-mail | Resend, `POST https://api.resend.com/emails` | `index.ts:49` |
| Expéditeur | `ClairDossier <noreply@clair-dossier.com>` | `index.ts:7` |
| **Destinataire (en dur)** | `prestige.seller@icloud.com` | `index.ts:8` |
| Contenu | Objet `ClairDossier — nouveau compte` / `— nouveau dossier` ; corps : phrase générique, `Référence : <8 premiers caractères de record.id>…`, lien vers `https://www.clair-dossier.com/compte[/dossier/<id>]` | `index.ts:20-47` |
| Tables autres | réponse `{ skipped: true, table }` 200 | `index.ts:34-39` |
| Gestion d'erreur | renvoie le statut/corps Resend tel quel ; `catch` → 400 `{ error }` | `index.ts:58-67` |
| Déploiement | aucun `supabase functions deploy` en CI → manuel, **état live à vérifier** | `.github/workflows/deploy.yml` |

---

## 8. Analyse critique

### 8.1 Isolation multi-tenant (un utilisateur A peut-il lire les données de B ?)

| Vecteur | Verdict d'après le code | Justification |
|---|---|---|
| Lecture `dossiers`/`profiles`/`dossier_documents` de B par A | **Non** (hermétique) | policies `_own` strictes `auth.uid() = user_id` / `= id` (`…init.sql:52-63`) ; policies admin conditionnées à `is_admin()` qui ne lit que `app_admins`, table inaccessible aux utilisateurs (`…admin_global_access.sql:15-17,25-33`) |
| Lecture d'un fichier de B (URL signée, download, list) par A | **Non** | `docs_storage_select_own` impose `(storage.foldername(name))[1] = auth.uid()` (`…init.sql:108-109`) ; le front range tout sous `<user_id>/…` (`DossierFlow.tsx:360`, `DossierDetail.tsx:343`) |
| Auto-promotion admin | **Non** via API | aucune policy sur `app_admins` + revoke (`…admin_global_access.sql:15-17`) ; `is_admin` ne renvoie qu'un booléen |
| Fuite d'e-mails via `admin_user_emails()` | **Non** pour un non-admin (0 ligne) | `where public.is_admin()` (`…admin_user_emails.sql:15`) |
| **Intégrité croisée** : A insère une ligne `dossier_documents` avec `user_id = A` mais `dossier_id` = un dossier de B | **Possible** (défaut de contrainte) | `docs_insert_own` vérifie seulement `auth.uid() = user_id` (`…init.sql:62`), pas la propriété du `dossier_id` ; A doit connaître l'UUID du dossier de B (non énumérable, mais ex. via un lien partagé). Conséquence : pollution de la vue admin du dossier de B (la requête admin filtre par `dossier_id` : `DossierDetail.tsx:272`) ; pas de fuite de confidentialité (le `file_path` éventuellement usurpé reste inaccessible à A en storage). |
| `file_path` non cohérent avec le storage | **Possible** | aucune contrainte/trigger ne valide `file_path` ↔ objet storage ↔ `user_id` |
| Rôle `anon` et policies appelant `is_admin()` | **À vérifier sur le projet live** | `anon` n'a pas EXECUTE sur `is_admin()` (`…admin_global_access.sql:34`) alors que les policies `*_select_admin`/`docs_storage_*_admin` s'appliquent à tous les rôles : une requête anonyme sur ces tables peut lever « permission denied for function is_admin » au lieu de renvoyer 0 ligne. Pas de fuite, mais comportement d'erreur à confirmer. |
| Livrables supprimables par le client | **Oui, par conception** | le livrable est sous `user_id` du client → `docs_delete_own` + `docs_storage_delete_own` s'appliquent (`…deliverables.sql:4-10`) ; aucune protection du `kind='deliverable'` contre la suppression client |

**Conclusion** : l'isolation en lecture entre clients est correcte d'après le code. Le modèle est **mono-utilisateur par tenant** (pas de notion d'organisation, d'équipe ni de délégation : un dirigeant et son comptable ne peuvent pas partager un dossier).

### 8.2 Tables / mécanismes manquants pour un SaaS par abonnement

| Besoin | État dans le dépôt | Source / constat |
|---|---|---|
| Abonnements (`subscriptions`, `plans`, `prices`) | **Absents**. Le paiement passe par des Stripe Payment Links statiques (`https://buy.stripe.com/...`) définis dans `src/data/pricing.ts:45-182` ; `netlify.toml:26` autorise `form-action https://buy.stripe.com`. | Aucune table, aucun webhook Stripe, aucune edge function `stripe-webhook` |
| Lien client Stripe ↔ `auth.users` (`stripe_customers`) | **Absent** | — |
| Droits / entitlements (`entitlements`, quotas de dossiers, fonctionnalités par plan) | **Absents** ; aucune policy ne dépend d'un plan ; un compte confirmé peut créer un nombre illimité de dossiers | `…init.sql:57` |
| Facturation (`invoices`) | **Absent** | — |
| Journal d'audit (`audit_log`) | **Absent** ; pas de trace des lectures admin, des livraisons, des suppressions (suppression de document définitive, `DossierDetail.tsx:406-418`) | — |
| Historique de statut de dossier / workflow | **Absent** ; `status` texte libre sans contrainte, et **aucune policy permettant à l'admin de le faire évoluer** | `…init.sql:25` ; §3.2 |
| Organisations / multi-utilisateurs par entreprise | **Absent** ; `profiles` est 1:1 avec `auth.users` | `…init.sql:5-17` |
| Rôles multiples (support, juriste partenaire…) | **Absent** ; un seul admin global, désigné par e-mail en dur | `…admin_global_access.sql:1,21` |
| Table des notifications / e-mails envoyés | **Absent** ; les appels `net.http_post` sont fire-and-forget (trace uniquement dans `net._http_response`, rétention courte — à vérifier sur le projet live) | `…lead_notification.sql:14` |
| Demande de relecture juridique (suivi) | Seul un booléen `legal_review_requested` | `…init.sql:27` |
| Suppression de compte / droit à l'effacement | Uniquement la cascade FK depuis `auth.users` ; **les objets storage ne sont pas supprimés par cascade** (`storage.objects` n'a pas de FK vers `dossier_documents`) → fichiers orphelins possibles | `…init.sql:6,22,38` |
| Seed | `config.toml:65` référence `./seed.sql`, fichier inexistant | — |

### 8.3 Risques identifiés

| # | Risque | Gravité (estimation) | Source | Remarque |
|---|---|---|---|---|
| R1 | **Edge function `notify-lead` appelable publiquement** avec la clé anon (publique, présente dans le bundle et dans `deploy.yml:43`) : n'importe qui peut POSTer `{table:'dossiers', record:{id:'x'}}` et déclencher des e-mails à volonté vers `prestige.seller@icloud.com` (spam / épuisement du quota Resend). Le code ne vérifie ni l'origine ni un secret partagé. | Moyenne | `index.ts:10-14`, `…lead_notification.sql:3,18` | Mitigation possible : secret d'en-tête dédié vérifié dans la fonction, ou appel avec `service_role` via Vault — non présent dans le code |
| R2 | **Clé anon et URL du projet codées en dur dans une migration SQL** (`notify_lead`) : couplage fort au projet `buzgokfmxpmyceppvjpp`, impossible à rejouer sur un autre environnement sans éditer la migration ; rotation de clé = nouvelle migration. | Moyenne | `…lead_notification.sql:15-18` | Supabase recommande `vault.decrypted_secrets` |
| R3 | **Couplage inscription ↔ notification** : `on_new_profile_notify` s'exécute dans la transaction de création de l'utilisateur (via `handle_new_user`). Si `pg_net` est absent/indisponible ou si `net.http_post` lève une erreur, **l'inscription échoue**. De même, une valeur `company_type` hors liste dans les metadata de signup fait échouer `handle_new_user` (check `…init.sql:9-13`) et donc le signup. | Moyenne | `…init.sql:83-100`, `…lead_notification.sql:26-29` | Le front n'envoie que des valeurs contrôlées (`src/lib/auth.tsx:84`), mais l'API Auth est publique |
| R4 | **Payload complet envoyé à l'edge function** (`to_jsonb(new)` : `answers`, `full_name`, `phone`, `company_name`) alors que seul `id` est utilisé. Minimisation RGPD incomplète côté base (les données transitent vers le runtime edge et ses logs éventuels). | Faible/Moyenne | `…lead_notification.sql:20`, `index.ts:14,21` | — |
| R5 | **Aucun droit d'écriture admin sur `dossiers`** : impossible de faire évoluer le `status` d'un dossier (traitement, livré…) sans `service_role`/SQL direct. Manque fonctionnel pour l'exploitation. | Moyenne (fonctionnel) | §3.2 | — |
| R6 | **`docs_insert_own` ne vérifie pas la propriété de `dossier_id`** (intégrité croisée, cf. §8.1). | Faible | `…init.sql:62` | Ajouter `exists (select 1 from dossiers d where d.id = dossier_id and d.user_id = auth.uid())` |
| R7 | **Admin unique désigné par e-mail dans une migration** ; si le compte n'existait pas à l'application de M3, `app_admins` est vide et l'espace admin est inopérant ; aucun moyen applicatif d'ajouter/retirer un admin. | Moyenne (opérationnel) | `…admin_global_access.sql:20-22` | **À vérifier sur le projet live** : contenu de `app_admins` |
| R8 | **`admin_user_emails()` lit `auth.users` en SECURITY DEFINER** et renvoie tous les e-mails à l'admin ; la barrière repose entièrement sur `is_admin()`. Conception acceptable mais sensible (toute régression sur `app_admins` expose la base d'e-mails). | Faible | `…admin_user_emails.sql:6-16` | — |
| R9 | **Pas de contrainte de limite de taille / MIME au niveau du bucket** ni de quota par utilisateur ; un utilisateur authentifié peut uploader sans limite sous son préfixe. | Moyenne | `…init.sql:103-105` | Limite globale réelle **à vérifier sur le projet live** (Dashboard > Storage) |
| R10 | **Fichiers storage orphelins** à la suppression d'un compte/dossier (cascade SQL seulement, pas de nettoyage storage) ; suppression front = 2 appels non atomiques (`storage.remove` puis `delete` SQL, `DossierDetail.tsx:414-418`). | Faible | `…init.sql:6,22,37-38` | — |
| R11 | `anon` sans EXECUTE sur `is_admin()` alors que les policies admin s'appliquent à tous les rôles → erreurs 42501 possibles pour des requêtes anonymes sur `dossiers`/`profiles`/`dossier_documents`/`storage.objects` (pas de fuite ; bruit d'erreurs). | Faible | `…admin_global_access.sql:34-53` | **À vérifier sur le projet live** |
| R12 | **Aucune automatisation de déploiement backend** (migrations/fonction) → dérive possible entre dépôt et prod ; `seed.sql` référencé mais absent. | Moyenne (gouvernance) | `.github/workflows/deploy.yml`, `supabase/config.toml:65` | **À vérifier sur le projet live** : `supabase migration list` |
| R13 | `password_requirements = ""`, pas de captcha, pas de MFA, sessions illimitées (si le `config.toml` reflète la prod). | Faible/Moyenne | `supabase/config.toml:174,192-196,250-255,281-283` | **À vérifier sur le projet live** (paramètres Auth du Dashboard) |
| R14 | `dossiers.status` et `dossiers.typology` sans contrainte de valeurs ; `kind` contraint mais non modifiable (pas de policy UPDATE). | Faible | `…init.sql:23,25`, `…deliverables.sql:19` | — |
| R15 | Policies sans clause `to authenticated` : elles sont évaluées aussi pour `anon` (inoffensif grâce à `auth.uid()` null, mais contraire aux bonnes pratiques Supabase et cause de R11). | Faible | toutes les policies M1–M6 | — |

### 8.4 Points non déterminables depuis le code (à vérifier sur le projet live)

- Migrations effectivement appliquées et ordre (`supabase_migrations.schema_migrations`).
- Contenu réel de `public.app_admins` (l'admin existe-t-il ?).
- Paramètres Auth du Dashboard (confirmation e-mail, SMTP Resend, redirect URLs, rate limits, captcha, MFA, templates) : le `config.toml` peut ne pas refléter l'état hébergé.
- Secrets de l'edge function (`RESEND_API_KEY`) et paramètre `verify_jwt` de `notify-lead`.
- Version déployée de `notify-lead` (identique au fichier du dépôt ?).
- Limites de taille / MIME réelles du bucket `documents` ; présence d'objets orphelins.
- Existence éventuelle d'objets créés hors migrations (tables, policies, webhooks, cron) directement via le Dashboard.
- Rétention de `net._http_response` et taux d'échec des appels pg_net.
