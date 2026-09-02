# INVENTAIRE DE L'EXISTANT — ClairDossier

**Référence :** PARTIE 3 du `docs/MASTER-PROMPT-IA-CLAIRDOSSIER.md` (CLAIR-IA v3.0)
**Date de l'inventaire :** 2026-09-02
**Dépôt :** `romancg13/www.clair-dossier.com` — branche de travail `claude/clairdossier-master-prompt-bjvhlz`, HEAD = `main` = `b9c48cd` (2026-08-26)
**Méthode :** lecture intégrale des fichiers cités ; exécution réelle de `npm ci`, `npm run typecheck`, `npm run build` ; inspection de `dist/` ; sondes HTTP en lecture seule sur la production (GitHub Pages, Netlify, Supabase) ; lecture de l'historique GitHub Actions ; cinq lecteurs parallèles (écrans, données, build, contenu, logique métier) recoupés par un critique de complétude et sept lectures ciblées, puis vérification directe des constats critiques.
**Légende :** `[constaté]` lu ou mesuré · `[déduit]` inféré de plusieurs constats · `[à vérifier]` non vérifiable depuis le dépôt ou la session.

Toute affirmation cite `fichier:ligne`. Aucune valeur n'est estimée.

---

## 0. Synthèse exécutive

1. **Site vitrine devenu application légère** : SPA Vite 6 / React 19 / TypeScript strict / Tailwind v4 / Motion / React Router 7, adossée à Supabase (Auth, Postgres, Storage, une Edge Function). Aucun serveur applicatif propre, aucun ORM, aucun type de base généré, aucun runner de tests, aucun lint (`package.json:6-34`, `src/lib/supabase.ts:17`).
2. **Aucune ligne de code IA, OCR, embedding ou extraction** dans `src/` ni `supabase/`. Les mots « IA », « OCR », « GPT » sont des libellés, slugs, identifiants hérités ou contenus marketing (`src/data/features.ts:37-40`, `src/data/pricing.ts:27-30`, `src/pages/DossierFlow.tsx:187-188,943-960`). La case « question IA préparatoire » ne fait que poser `legal_review_requested = true` (`DossierFlow.tsx:347`).
3. **Modèle de données réel : 4 tables** (`profiles`, `dossiers`, `dossier_documents`, `app_admins`), 1 bucket privé, cloisonnement strictement `user_id = auth.uid()`. Aucune notion de tenant, de rôle, de plan, d'échéance, d'événement, d'entité, de journal d'audit. Sur les 17 entités du modèle cible (PARTIE 7.2), 4 existent partiellement et 13 sont absentes.
4. **Aucun prompt système, aucun `prompts/`, `tests/`, `DECISIONS.md`, `CLAUDE.md`** avant cette session. Un document « cahier directeur » est cité quatre fois dans le code et deux fois dans l'historique, mais **n'existe pas dans le dépôt**.
5. **Typecheck et build passent** (`tsc` exit 0, `vite build` exit 0, 2,53 s). Mais le build produit un `dist/` **sans aucun fichier statique** à cause de `publicDir: 'publique'` (`vite.config.ts:23`, commit `b9c48cd`), et ce build est **en production** : `www.clair-dossier.com/robots.txt`, `/favicon.svg`, `/sitemap.xml`, `/llms.txt`, `/brochure-clairdossier.pdf` répondent 404 (sondes du 2026-09-02, `last-modified` de la page d'accueil = run n° 59 du 2026-08-26).
6. **Déploiement** : GitHub Pages sur push `main` (59 runs, les 5 derniers en succès), Netlify en parallèle avec un build daté entre le 2026-06-18 et le 2026-07-01 alimenté par un auto-deploy hors dépôt, Supabase projet `buzgokfmxpmyceppvjpp` actif (Edge Function répond 401 sans JWT), douze Payment Links Stripe live.
7. **Droits d'abonnement : aucun contrôle nulle part.** Le bandeau « Abonnement confirmé » s'affiche sur simple présence de `?paid=` dans l'URL (`src/pages/Account.tsx:31,89-98`). Les quotas 5/10/20/50 dossiers et 1/2/5/15 utilisateurs n'existent ni en base ni en RLS. Violation directe de I7.
8. **Promesses non tenues encore publiées** malgré le réalignement du 2026-06-26 (`417708f`) : la couche markdown pour crawlers (`public/index.md`, `page.md`, `securite.md`, `llms.txt`), l'image de partage `og-default.svg`, les métadonnées de `index.html`, la carte d'exemple du Hero, la section « Six statuts », le JSON-LD Organization, le bloc devis de la page Tarifs et quatre articles de blog présentent OVH France, AES-256, 2FA obligatoire, HDS, ISO 27001, GPT-5.5, relances automatiques, extraction automatique des dates, validation par un professionnel, API/SSO/SDK comme disponibles. Violations de I10 et I12. **Corriger `publicDir` sans corriger ces contenus republierait des allégations fausses.**
9. **Sécurité** : RLS hermétique pour les clients (lue policy par policy), mais Edge Function déclenchable avec la clé anon publique et `record.id` injecté sans validation, trigger qui exfiltre `to_jsonb(new)` complet, policies admin sans contrainte de chemin, MFA désactivée, aucune expiration de session, aucun AuditLog, aucune CSP sur l'hôte réellement servi (GitHub Pages).
10. **À préserver (I11)** : tunnel 5 étapes avec nom obligatoire, dépôt de pièces sous `<user_id>/<dossier_id>/`, page dossier à 4 onglets avec frise 5 étapes cliquables, livraison de livrables par l'admin, téléchargement groupé, transmission e-mail/WhatsApp déclenchée par l'utilisateur, typologies et clés `answers` héritées des anciens dossiers, décisions du « cahier directeur » (§ 7).

---

## 1. Stack réellement présente

### 1.1 Versions résolues (`package-lock.json`, lockfileVersion 3)

| Composant | Déclaré (`package.json`) | Résolu | Source |
|---|---|---|---|
| Node.js | non épinglé (aucun `engines`, aucun `.nvmrc`) | 22.22.2 dans la session ; `22` imposé en CI | `netlify.toml:8`, `.github/workflows/deploy.yml:30`, `node --version` |
| npm | — | 10.9.7 | `npm --version` |
| vite | ^6.0.0 | 6.4.2 | `package.json:33` |
| react / react-dom | ^19.0.0 | 19.2.6 | `package.json:20-21` |
| react-router-dom | ^7.1.0 | 7.15.1 | `package.json:22` |
| typescript | ^5.7.0 | 5.9.3 | `package.json:32` |
| tailwindcss / @tailwindcss/vite | ^4.0.0 | 4.3.0 | `package.json:25,31` |
| motion | ^11.15.0 | 11.18.2 | `package.json:19` |
| @supabase/supabase-js | ^2.108.2 | 2.108.2 | `package.json:17` |
| fflate | ^0.8.3 | 0.8.3 | `package.json:18` |
| tsx | ^4.19.0 | 4.22.4 | `package.json:31` |
| @vitejs/plugin-react | ^4.3.4 | 4.7.0 | `package.json:29` |
| @fontsource cormorant-garamond / inter / jetbrains-mono | ^5.2.5 | 5.2.5 | `package.json:14-16` |

`[constaté]` **Absents** du `package.json` et du lockfile : `stripe` (importé par `scripts/create-stripe-products.mjs:16` et `scripts/add-annual-prices.mjs:9`), `vitest`, `jest`, `playwright`, `eslint`, `prettier`, `husky`, `@testing-library/*`, CLI `supabase`.

### 1.2 Architecture logicielle

| Question | Réponse | Source |
|---|---|---|
| Framework front | React 19 SPA, `StrictMode` > `BrowserRouter` > `AuthProvider` > `App` | `src/main.tsx:11-19` |
| Routage | 18 routes déclarées, Home eager, reste en `lazy` + `Suspense` | `src/App.tsx:7-44,50-192` |
| Styles | Tailwind v4 via `@theme` dans `src/index.css`, fonts self-hosted | `src/index.css:1-62` |
| Backend applicatif | **Aucun.** Navigateur → Supabase (PostgREST, Auth, Storage) sous RLS | `src/lib/supabase.ts:17-24` |
| ORM / typage base | **Aucun.** `createClient` sans générique `<Database>`, aucun `supabase gen types`, types de lignes redéfinis à la main et divergents (`DossierRow` à 6 champs dans `Account.tsx:8-15`, à 8 champs dans `DossierDetail.tsx:9-18`), casts manuels partout | `src/lib/supabase.ts:17`, `Account.tsx:56,71`, `DossierDetail.tsx:249,277,320`, `DossierFlow.tsx:358` |
| Base de données | Supabase Postgres, `major_version = 17` en config locale (version prod `[à vérifier]`) | `supabase/config.toml` `[db]` |
| Fonctions serveur | 1 Edge Function Deno `notify-lead` + 5 fonctions SQL | `supabase/functions/notify-lead/index.ts`, migrations |
| Gestionnaire de paquets | npm (lockfile v3), `npm ci` en CI | `.github/workflows/deploy.yml:35` |
| Runner de tests | **Aucun.** Aucun script `test`, aucun `*.test.*` / `*.spec.*`, aucun `tests/` | `package.json:6-12`, `find` racine |
| Lint / format | **Aucun.** Un `eslint-disable-next-line` orphelin | `src/lib/supabase.ts:9` |
| Scripts de build | `gen:md` (tsx) → `tsc -p tsconfig.json` → `vite build` | `package.json:8-9` |
| Typecheck | `tsc --noEmit`, `strict`, `noUnusedLocals`, `noUnusedParameters` ; périmètre `src` + `vite.config.ts` seulement (`scripts/` et `supabase/functions` hors périmètre) | `tsconfig.json:17-21,28` |
| Variables Vite | `ImportMetaEnv` non augmentée, casts `as string \| undefined` | `src/vite-env.d.ts:1`, `src/lib/supabase.ts:3-4` |

### 1.3 Mesures exécutées le 2026-09-02

```
npm ci                 → exit 0, 110 packages
npm run typecheck      → exit 0 (0 erreur)
npm run build          → exit 0, ✓ built in 2.53s
ls dist/               → 404.html  index.html  assets/        (AUCUN fichier de public/)
```

`[constaté]` Le `dist/` local a été construit **sans `.env`** : le chunk `index-DOvyzgrX.js` embarque `https://placeholder.supabase.co` et `isSupabaseConfigured = false` ; aucune occurrence de `buzgokfmxpmyceppvjpp`. Il n'est **pas représentatif du bundle live** (le workflow injecte l'URL réelle, `deploy.yml:42-43`) et ne doit pas servir à juger les écrans authentifiés. Il est en revanche représentatif pour l'absence des fichiers statiques (même `vite.config.ts`).

---

## 2. Modèles de données existants et relations

### 2.1 Tables (schéma `public`)

| Table | Colonnes | Contraintes / index | Source |
|---|---|---|---|
| `profiles` | `id uuid PK → auth.users(id) ON DELETE CASCADE`, `full_name text`, `company_name text`, `company_type text CHECK IN ('pme','artisan','entreprise-individuelle','profession-liberale','particulier','autre')`, `phone text`, `created_at`, `updated_at` | aucun index secondaire | `20260615201942_clair_dossier_init.sql:5-17` |
| `dossiers` | `id uuid PK gen_random_uuid()`, `user_id uuid NOT NULL → auth.users`, `typology text NOT NULL` (sans CHECK), `title text`, `status text NOT NULL DEFAULT 'brouillon'` (sans CHECK), `answers jsonb NOT NULL DEFAULT '{}'`, `legal_review_requested boolean NOT NULL DEFAULT false`, `created_at`, `updated_at` | `dossiers_user_id_idx (user_id)` | `…init.sql:20-32` |
| `dossier_documents` | `id uuid PK`, `dossier_id uuid NOT NULL → dossiers ON DELETE CASCADE`, `user_id uuid NOT NULL → auth.users`, `file_path text NOT NULL`, `file_name text NOT NULL`, `size_bytes bigint`, `created_at`, **`kind text NOT NULL DEFAULT 'piece' CHECK IN ('piece','deliverable')`** | `dossier_documents_dossier_id_idx (dossier_id)` ; aucun index sur `user_id` alors que les policies filtrent dessus | `…init.sql:35-45`, `20260628093000_dossier_deliverables.sql:13-19` |
| `app_admins` | `user_id uuid PK → auth.users`, `created_at` | RLS activée **sans policy**, `REVOKE ALL` pour `anon`, `authenticated` | `20260621144123_admin_global_access.sql:11-17` |

### 2.2 Relations

```
auth.users 1 ──── 1 profiles            (trigger handle_new_user à l'inscription)
auth.users 1 ──── n dossiers            (dossiers.user_id)
dossiers   1 ──── n dossier_documents   (dossier_id, cascade)
auth.users 1 ──── n dossier_documents   (user_id — redondant avec dossiers.user_id, non contraint en cohérence)
auth.users 0..1 ─ app_admins            (admin global unique, désigné par e-mail en dur)
storage.objects (bucket 'documents')    chemin <user_id>/<dossier_id>/<timestamp>-<nom>   (convention client, non contrainte en base)
```

### 2.3 Fonctions SQL, triggers, bucket

| Objet | Nature | Détail | Source |
|---|---|---|---|
| `touch_updated_at()` | trigger BEFORE UPDATE | `profiles_touch`, `dossiers_touch` | `…init.sql:66-80` |
| `handle_new_user()` | SECURITY DEFINER, AFTER INSERT ON `auth.users` | copie `raw_user_meta_data` → `profiles` | `…init.sql:83-100` |
| `notify_lead()` | SECURITY DEFINER, AFTER INSERT ON `profiles` et `dossiers` | `net.http_post` vers l'Edge Function avec **clé anon JWT en dur** et **`to_jsonb(new)` complet** | `20260617110728_dossier_lead_notification.sql:7-34` |
| `is_admin()` | SQL SECURITY DEFINER STABLE | `exists(select 1 from app_admins where user_id = auth.uid())`, exécutable par `authenticated` | `20260621144123…sql:25-35` |
| `admin_user_emails()` | SQL SECURITY DEFINER | lit `auth.users`, renvoie 0 ligne si non admin | `20260622062648_admin_user_emails.sql:6-19` |
| bucket `documents` | `public = false`, sans `file_size_limit` ni `allowed_mime_types` | limite globale locale `50MiB` | `…init.sql:103-105`, `config.toml` `[storage]` |

### 2.4 Policies RLS (22 au total)

| Table | Policy | Op. | Expression | Source |
|---|---|---|---|---|
| profiles | `profiles_select_own` / `insert_own` / `update_own` | S / I / U | `auth.uid() = id` | `…init.sql:52-54` |
| profiles | `profiles_select_admin` | S | `is_admin()` | `…admin_global_access.sql:46-48` |
| dossiers | `dossiers_select_own` / `insert_own` / `update_own` / `delete_own` | S / I / U / D | `auth.uid() = user_id` (UPDATE sans restriction de colonnes) | `…init.sql:56-59` |
| dossiers | `dossiers_select_admin` | S | `is_admin()` | `…admin_global_access.sql:38-40` |
| dossier_documents | `docs_select_own` / `insert_own` / `delete_own` | S / I / D | `auth.uid() = user_id` (INSERT **ne vérifie pas** que `dossier_id` appartient à l'utilisateur) | `…init.sql:61-63` |
| dossier_documents | `docs_select_admin` / `docs_insert_admin` / `docs_delete_admin` | S / I / D | `is_admin()` (INSERT sans cohérence `user_id ↔ dossiers.user_id`) | `…admin_global_access.sql:42-44`, `…deliverables.sql:22-24`, `…admin_delete_documents.sql:5-7` |
| storage.objects | `docs_storage_select_own` / `insert_own` / `delete_own` | S / I / D | `bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]` | `…init.sql:108-113` |
| storage.objects | `docs_storage_select_admin` / `insert_admin` / `delete_admin` | S / I / D | `bucket_id = 'documents' AND is_admin()` — **aucune contrainte de chemin** | `…admin_global_access.sql:51-53`, `…deliverables.sql:27-29`, `…admin_delete_documents.sql:9-11` |

`[constaté]` Aucune policy UPDATE sur `dossier_documents` ni sur `storage.objects` ; aucune policy DELETE sur `profiles` ; aucune policy UPDATE/DELETE admin sur `dossiers` (l'admin ne peut pas faire évoluer un statut côté serveur).

### 2.5 Valeurs métier réellement utilisées

| Champ | Valeurs écrites | Valeurs lues / affichées | Écart | Source |
|---|---|---|---|---|
| `dossiers.status` | `'transmis'` (seule valeur écrite par l'app) ; défaut SQL `'brouillon'` jamais utilisé | `brouillon`, `transmis`, `en-cours`, `valide`, `archive` (`STATUS_LABELS` dupliqué) | `src/data/statuses.ts` (marketing, 6 ids : `brouillon, complete, attente-avocat, validation, valide, archive`) : **deux vocabulaires incompatibles** ; aucun `.update(` dans `src/` : le statut ne change jamais après l'insertion ; `currentStep` mappe `transmis`/`en-cours` → 3, `valide` → 4, `archive` → 5, **l'étape 2 est inatteignable** | `DossierFlow.tsx:348`, `DossierDetail.tsx:27-33,92-106`, `Account.tsx:19-25`, `statuses.ts:12-57` |
| `dossiers.typology` | `dossier-client`, `facture-paiement`, `impaye-precontentieux`, `administratif`, `comptable`, `rh`, `autre` | idem + héritées `litige-commercial`, `recouvrement`, `bail`, `consommation`, `prud-hommes`, `divorce`, `succession` | typologies héritées conservées pour les anciens dossiers — **à préserver** | `DossierFlow.tsx:17-24,70-106`, `DossierDetail.tsx:35-52` |
| `dossiers.answers` (jsonb) | objet plat `Record<string,string>` : `profil` (artisan / independant / profession-liberale / entreprise-pme / autre) + `counterparty`, `startDate`, `amount`, `deadline`, `situation` (libellés surchargés pour `impaye-precontentieux` ; `rh` sans `amount`) ; aucun champ requis, aucune validation | Onglet Échéances : clés matchant `/date\|deadline\|echeance\|échéance/i` + `situation`, valeur brute ISO, sans tri ni calcul | `counterparty`, `amount`, `profil` ne sont affichés nulle part ; `ANSWER_LABELS` a 22 clés dont 16 héritées, `startDate` étiqueté « Date d'entrée dans les lieux », `counterparty` « Partie adverse » ; référentiel `profil` (5 valeurs) ≠ `profiles.company_type` (6 valeurs) | `DossierFlow.tsx:10-24,115-185,271-286,336-339`, `DossierDetail.tsx:109-141,300-303` |
| `dossier_documents.kind` | `'piece'` (client) / `'deliverable'` (admin) | filtre UI `kind !== 'deliverable'` | tout nouveau `kind` tomberait dans « Pièces » | `DossierDetail.tsx:309-310,354` |

### 2.6 Écart avec le modèle cible (PARTIE 7.2)

| Entité cible | État | Ce qui existe | Ce qui manque |
|---|---|---|---|
| Tenant | **ABSENT** | — | table, `plan`, `statut_abonnement`, rattachement des users |
| User | PARTIEL | `auth.users` + `profiles` | `tenant_id`, `role` (seul booléen `app_admins`), `mfa_actif` (MFA désactivée, `config.toml` `[auth.mfa]`) |
| Dossier | PARTIEL | `typology≈type`, `status≈statut` (texte libre), `title`, `answers` | `tenant_id`, `priorite`, `parties[]`, `objectif`, CHECK sur `status`/`type` |
| Document | PARTIEL | `file_path`, `file_name`, `size_bytes`, `kind` | `hash`, `mime`, `pages`, `score_ocr`, `categorie`, `confiance_classification`, `version`, `parent_version_id`, `nom_normalise` |
| Chunk | **ABSENT** | — | tout (pgvector non activé : `[storage.vector] enabled = false`, aucune extension `vector`) |
| Entite / EntiteSource | **ABSENT** | — | tout |
| Evenement / EvenementSource | **ABSENT** | — | tout |
| Echeance | **ABSENT** | clés jsonb `deadline`/`startDate`, aucune date calculée | table, `base_de_calcul`, `criticite`, `confiance`, `verifiee_humain` |
| Contradiction | **ABSENT** | — | tout |
| PieceManquante | **ABSENT** | — | tout |
| Production | PARTIEL | `kind = 'deliverable'` déposé manuellement | `agent`, `type`, `contenu`, `statut_validation`, `valide_par`, `valide_le` |
| AgentRun | **ABSENT** | — | tout |
| AuditLog | **ABSENT** | — | tout |
| Consentement | **ABSENT** | aucune case CGU/RGPD à l'inscription (`Signup.tsx:77-126`) | tout |

---

## 3. Routes API existantes, entrées/sorties, protections

`[constaté]` **Aucune API applicative propre.** Les « routes » sont les opérations Supabase appelées depuis le navigateur avec la clé anon + JWT utilisateur, protégées **exclusivement par RLS**. Aucune Edge Function n'est appelée depuis le client.

| Appel | Écran | Entrée | Sortie | Protection serveur | Source |
|---|---|---|---|---|---|
| `auth.signUp({email, password, options.data{full_name, company_name, company_type}})` | /inscription | formulaire | session ou `null` si confirmation e-mail requise | Supabase Auth, `enable_confirmations = true` (local), mdp ≥ 8, rate limit auth | `src/lib/auth.tsx:75-91` |
| `auth.signInWithPassword` / `signOut` / `getSession` / `onAuthStateChange` | /connexion, global | — | session | Supabase Auth | `auth.tsx:55-104` |
| `INSERT dossiers {user_id, typology, title, answers, legal_review_requested, status:'transmis'} RETURNING id` | /dossier/nouveau étape 5 | brouillon local | `id` | `dossiers_insert_own` | `DossierFlow.tsx:340-351` |
| `storage.upload('documents', '<uid>/<dossierId>/<ts>-<nom>')` puis `INSERT dossier_documents` | idem | `File[]` | — (**`up.error` et le résultat de l'INSERT ignorés**) | `docs_storage_insert_own` (préfixe uid imposé), `docs_insert_own` | `DossierFlow.tsx:359-373` |
| `rpc('is_admin')` | /compte, /compte/dossier/:id | — | booléen | SECURITY DEFINER, `authenticated` | `Account.tsx:42`, `DossierDetail.tsx:253` |
| `SELECT dossiers(...) ORDER BY created_at DESC` | /compte | — | liste (tout pour l'admin), **non paginée** (`max_rows = 1000` local) | `dossiers_select_own` ∪ `dossiers_select_admin` | `Account.tsx:47-50` |
| `SELECT profiles(id,company_name,full_name)` + `rpc('admin_user_emails')` | /compte (admin) | — | tous les profils / tous les e-mails | `profiles_select_admin`, `WHERE is_admin()` | `Account.tsx:55-61` |
| `SELECT dossiers … .eq('id', id).maybeSingle()` | /compte/dossier/:id | `id` URL | ligne ou `null` | RLS (aucun filtre `user_id` côté client) | `DossierDetail.tsx:241-247` |
| `SELECT dossier_documents(...) .eq('dossier_id')` + `createSignedUrl(path, 3600)` × n | idem | — | liens signés 1 h, **non rafraîchis à expiration** | `docs_select_own` ∪ `docs_select_admin` | `DossierDetail.tsx:271-291` |
| `storage.upload('<owner_uid>/<dossierId>/deliverable-…')` + `INSERT dossier_documents{kind:'deliverable', user_id: owner}` | idem (admin) | `FileList` (sans `accept`) | — | `docs_storage_insert_admin` (**sans contrainte de chemin**), `docs_insert_admin` | `DossierDetail.tsx:336-364,725-734` |
| `storage.remove([path])` + `DELETE dossier_documents .eq('id')` | idem (admin, livrables seulement) | — | — (erreur `remove` non contrôlée) | `docs_storage_delete_admin`, `docs_delete_admin` | `DossierDetail.tsx:404-426` |
| `fetch(signedUrl)` × n → `zipSync` (fflate, level 0) | idem | liens signés | `.zip` côté client | liens signés | `DossierDetail.tsx:366-401` |
| **Edge Function `POST /functions/v1/notify-lead`** | trigger SQL uniquement | `{table, record}` entièrement contrôlé par l'appelant | e-mail Resend vers `prestige.seller@icloud.com` | passerelle : JWT du projet requis (**401 `UNAUTHORIZED_NO_AUTH_HEADER` sans en-tête**, fonction inexistante → 404 : donc déployée avec `verify_jwt`) ; **la clé anon publique suffit** ; aucun contrôle interne (`req.headers` jamais lu) ; `record.id` interpolé dans le lien sans validation UUID ni échappement | `notify-lead/index.ts:10-14,21,33,44-45,49-56` |
| `mailto:contact.clairdossier@icloud.com` / `https://wa.me/33782983644?text=…` | /dossier/nouveau, /contact, /tarifs | synthèse texte (profil, titre, réponses, e-mail du compte) | — | aucune (application tierce ; **destinataire fixe = ClairDossier**, pas « de votre choix ») | `DossierFlow.tsx:39,308-330,381-391`, `src/lib/whatsapp.ts:5-20`, `Contact.tsx:96-101` |
| Stripe Payment Links (12 liens) | /tarifs | — | redirection `/compte?paid=<planId>` | **aucune** : aucun webhook, aucune table, aucun lien avec `user_id` | `pricing.ts:45-182`, `create-stripe-products.mjs:80-93` |

**Protections côté client (non opposables) :** `RequireAuth` redirige vers `/connexion?next=` si pas de session, mais **rend la route protégée sans session quand Supabase n'est pas configuré** (`RequireAuth.tsx:24-28`) ; `isAdmin` ne sert qu'à afficher/masquer de l'interface.

---

## 4. Écrans existants et état fonctionnel réel

Le caractère « fonctionnel » est établi par lecture du code + `tsc` (exit 0) ; **aucune exécution en navigateur ni test contre le projet Supabase réel** n'a été faite dans cette session (aucun `.env`, aucun outil de capture).

| Route | Composant | État | Données / effets | Remarques | Source |
|---|---|---|---|---|---|
| `/` | `Home` (11 sections) | Statique | JSON-LD SoftwareApplication (19 €) + FAQPage ; `orgSchema` décrit des dossiers « validés par des professionnels habilités » ; Seo cite « cabinets d'avocats » | Hero : carte « Exemple » avec « Validation pro (option) », « Sous 24 h ouvrées », « Chronologie : 4 évènements datés », timeline 6 statuts (`Hero.tsx:7-21,151-160`) ; `Workflow.tsx:28` « Six statuts » ; `DossierLifecycle.tsx:25,30,64-66` « relances préparées à date », « paiement suivi » ; `FinalCTA.tsx:33-36` « validé par un professionnel » ; `FeaturesGrid.tsx:17` « Huit briques » (9 fiches) ; `BlogPreview.tsx:20,33` « Trois lectures » (7 rendues) | `Home.tsx:1-63`, `seo.tsx:91-92`, `Home.tsx:47` |
| `/fonctionnalites`, `/fonctionnalites/:slug` | `FeaturesIndex`, `FeatureDetail` | Statique | 9 fiches, textes réalignés | slugs hérités trompeurs : `pieces-ocr`, `validation-avocat`, `coffre-fort`, `messagerie-securisee`, `calendrier-relances`, `reponse-auto-mails` ; icône `timeline` utilisée deux fois ; promesse « destinataire de votre choix » (`features.ts:88-94`) contredite par le code | `features.ts:37-202` |
| `/tarifs` | `Pricing` | Statique + Stripe externe | toggle mensuel/annuel local ; 7 plans | FAQ « fonctions IA avancées » (`:72`), « résiliables… depuis l'espace facturation » (`:54`, espace inexistant) ; `DEVIS_CAPABILITIES` marque blanche / API + webhooks + SDK Node & Python / SSO SAML 2.0 & OIDC / onboarding sur site (`:30-47`) ; « Vos données restent en France » (`:379`) ; matrice comparative marquant ✗ des capacités que tout compte gratuit possède (`pricing.ts:24-33,52-61,79-88,107-116`) | `Pricing.tsx:91,142-186` |
| `/securite` | `Security` | Statique | 6 piliers prudents, 4 badges « Conçu pour / Transit & repos / Par utilisateur / Sur demande » | titre « Du navigateur jusqu'à vos sauvegardes » sans politique de sauvegarde décrite (`:119`) ; icônes `HostingFranceIcon`, `ComplianceRinIcon` héritées | `Security.tsx:14-75,200-219` |
| `/blog`, `/blog/:slug` | `BlogIndex`, `BlogPost` | Statique | 7 articles, auteur collectif unique | « Articles écrits par des avocats, des juristes IT » (`BlogIndex.tsx:52-53`), « relectures par des avocats » (`authors.ts:9-17`) ; allégations produit fausses dans 4 articles (§ 10 B2) ; tri « descendant » non respecté (`blog/index.ts:10-19`) | `src/data/blog/*` |
| `/contact` | `Contact` | **Simulé** : compose un texte, ouvre WhatsApp | aucune persistance ; `noValidate` sans validation JS ; `?topic=`/`?plan=` ignorés ; `<a href>` au lieu de `Link` | « réponse en moyenne sous 1 h », « démo la même semaine » non vérifiables | `Contact.tsx:17,96-101,124-190` |
| `/inscription` | `Signup` | Fonctionnel (Supabase Auth) | metadata → `profiles` par trigger | aucune case de consentement ; pas de message « vérifiez votre e-mail » si `session = null` ; accessible connecté | `Signup.tsx:24-49,77-140` |
| `/connexion` | `Login` | Fonctionnel | — | pas de « mot de passe oublié », pas de MFA ; accessible connecté | `Login.tsx:11-29` |
| `/dossier/nouveau` | `DossierFlow` (1066 l.) | **Fonctionnel** (RequireAuth) | brouillon `localStorage['clairdossier_draft']` (non lié au user, non purgé par `signOut`, sans les fichiers) ; étape 5 → INSERT `'transmis'` + uploads + WhatsApp/mailto ; `done = true` même si l'INSERT échoue | 5 étapes : profil (5) → nature (7) + **nom obligatoire** → informations (5 champs, `noValidate`, aucun requis) → pièces (`accept` client seulement, pas de taille max, « glissez-déposez » sans `onDrop`, input `hidden` non focusable) → récapitulatif ; case « question IA préparatoire » si `impaye-precontentieux` ; aucune mention RGPD dans le tunnel | `DossierFlow.tsx:27-106,202,258-269,332-399,806-823,943-960` |
| `/compte` | `Account` | **Fonctionnel** | liste des dossiers ; vue admin avec propriétaire + e-mail | bandeau « Abonnement confirmé » sur `?paid=` **sans vérification** | `Account.tsx:30-31,89-98` |
| `/compte/dossier/:id` | `DossierDetail` (824 l.) | **Fonctionnel** | 4 onglets (Vue d'ensemble / Pièces / Échéances / DashBoard ClairDossier) ; frise 5 étapes cliquables (panneau local, rien persisté) ; liens signés 1 h ; zip ; livraison et suppression admin (livrables seulement) ; aucune retransmission, aucune édition, aucune suppression client | onglets `role=tab` sans `tabpanel`/`aria-controls`/clavier alors que `ui/Tabs.tsx` les fournit ; input fichier `hidden` ; `window.confirm` natif ; bandeau « Aucun envoi ne sera effectué sans votre confirmation » | `DossierDetail.tsx:145-151,229,336-426,502-522,797-808` |
| `/mentions-legales`, `/cgv`, `/politique-confidentialite`, `/cookies` | `LegalPage` | Statique | `src/data/legal.ts` (465 l.) | mentions légales : site hébergé **GitHub Pages (GitHub Inc., États-Unis)**, données chez « un sous-traitant technique conforme au RGPD » non nommé (`:72,76`) ; CGV : « aucune lecture, extraction ou analyse automatique des documents » (`:202`), facturation « mensuelle » seulement (`:168`), « société ClairDossier » pour un entrepreneur individuel (`:86`) ; cookies : décrit session/préférence/CSRF alors que tout est en `localStorage` (`:417-419`) | `LegalPage.tsx:16-18` |
| `*` | `NotFound` | Statique, `noindex` | — | — | `NotFound.tsx` |

### 4.1 Composants et primitives (`src/components`)

| Constat | Source |
|---|---|
| **5 composants jamais importés (code mort)** : `ui/Button.tsx`, `ui/Card.tsx`, `ui/Pill.tsx`, `primitives/Magnetic.tsx`, `primitives/Marquee.tsx` ; les pages écrivent leurs boutons/cartes en Tailwind inline | grep import/JSX sur `src/` |
| `ui/Tabs.tsx` (tablist/tab/tabpanel liés, roving tabindex) n'est utilisé que par `WorkspacesTabs.tsx` ; `aria-label` figé « Espaces dédiés » ; pas de navigation flèches | `Tabs.tsx:24,28-36,56-61` |
| `Accordion` et `Tabs` ignorent `useReducedMotion` (les autres primitives le respectent) | `Accordion.tsx:41-52`, `Tabs.tsx:42-46` |
| `Reveal` : prop `amount` déclarée mais inerte ; `SplitWords` : `aria-label` absent si `segments` sans `text` | `Reveal.tsx:14,18-33`, `SplitWords.tsx:48-50` |
| `icons.tsx` : 23 icônes, registre `FEATURE_ICONS` (8 clés, toutes typées) ; registre `SECURITY_ICONS` + `SecurityIconKey` **jamais importés** | `icons.tsx:269-291` |
| `Counter.tsx` annoncé dans `PLAN.md:65` n'existe pas | `ls src/components/primitives` |

**Responsive :** breakpoints `sm:/md:/lg:` sur tous les écrans lus ; rendu réel `[à vérifier]`.
**Accessibilité :** skip-nav, focus sur `<main>` au changement de route, `prefers-reduced-motion`, `aria-*` sur nav et accordéons (`Layout.tsx:13-31`, `index.css:100-116,358`) ; lacunes en § 10.

**Écrans cibles PARTIE 12.2 :** sur les 10 écrans attendus, **2 existent partiellement** (« Dossier », « Pièces » sans doublons/illisibles/manquantes), **1 est un embryon** (« Échéances » = liste de clés jsonb), **7 sont absents** (tableau de bord, chronologie, synthèse, contradictions, productions, recherche, journal).

---

## 5. Prompts systèmes existants

`[constaté]` **Aucun.** Aucun dossier `prompts/`, aucun `*.system.md`. `rg -i 'prompt|openai|anthropic|claude|gpt-|mistral|embedding|tesseract|ocr|pgvector'` sur `src/` (66 fichiers) et `supabase/` ne renvoie que : le paramètre Studio `openai_api_key = "env(OPENAI_API_KEY)"` (`config.toml:91`), la section `[storage.vector]` désactivée (`config.toml:136-144`), le slug/icône `pieces-ocr` / `scan-ocr` (`features.ts:37-40`, `icons.tsx:32,271`), une mention rédactionnelle (`blog/rgpd-legaltech.ts:48`), le texte `AI_OPTION_TEXT` (`DossierFlow.tsx:187-188`), la FAQ tarifs (`Pricing.tsx:72`), et hors `src` : `create-stripe-products.mjs:44` (« IA avancée (GPT-5.5) ») et `public/llms.txt:60`.

Le seul artefact IA persistant est le booléen `dossiers.legal_review_requested`. Le bloc de contrôle du master prompt (`docs/MASTER-PROMPT-IA-CLAIRDOSSIER.md:594-595`) référence un « prompt système CLAIR-Agent v1.1 » et un répertoire `~/clair-agent` : **absents de ce dépôt, `[à vérifier]` auprès de l'émetteur.** Les 10 prompts `prompts/<agent>.system.md` sont intégralement à créer (étapes 9-18).

Remarque : l'Annexe A du master prompt numérote les guardrails F1-F10, ce qui entre en collision avec les fonctionnalités F1-F12 de la PARTIE 8 ; les prompts produits préfixeront les guardrails (`FB1…`) pour lever l'ambiguïté sans modifier le master prompt.

---

## 6. Tests existants

| Élément | État | Source |
|---|---|---|
| Runner (vitest/jest/playwright) | **absent** | `package.json`, lockfile (grep = 0) |
| Fichiers de test | **aucun** | `find` racine hors `node_modules` |
| Lint / format | **absents** | aucun `eslint.config*`, `.prettierrc*`, `.editorconfig` |
| CI de qualité | **absente** : le seul workflow construit et déploie | `deploy.yml:35-43` |
| Typecheck | passe (exit 0) — seul garde-fou | mesure 2026-09-02 |
| Couverture | **non mesurable** | — |
| Preuves historiques | commits `f960ef2`, `271ac1b` mentionnent des simulations RLS « JWT psql = 0 ligne » manuelles, **non versionnées** | `git log` |

---

## 7. Décisions d'architecture consignées

`[constaté]` **Aucun `DECISIONS.md`, ADR, `CLAUDE.md` ni `AGENTS.md`** avant cette session. `README.md` (2026-05-25) et `PLAN.md` décrivent un « showcase sans backend » et **contredisent le code sur 8 points** : « Pas de backend » (`PLAN.md:5`), flow 3 étapes (`PLAN.md:119`, `README.md:43`), contact simulé + localStorage (`PLAN.md:114`), 3 plans (`PLAN.md:83,112`), 8 fonctionnalités (`PLAN.md:82`), 3 articles (`PLAN.md:90-92`), H1 « juridique » (`PLAN.md:143` vs `Hero.tsx:64`), 6 statuts (`PLAN.md:84`). Restent valides : stack, palette/tokens, primitives, contraintes éditoriales (`PLAN.md:5-7,45-72,137-144`).

**« Cahier directeur »** : cité dans `DossierDetail.tsx:55,143`, `DossierFlow.tsx:258`, `notify-lead/index.ts:16` et dans les commits `ddeabac` et `417708f` (2026-06-26). Il fonde quatre décisions : frise 5 étapes cliquables avec panneau et message dynamique ; pièces dans un seul onglet (page à 4 onglets) ; nom de dossier obligatoire sous les catégories ; minimisation de l'e-mail de notification. **Aucun fichier de ce nom n'existe dans le dépôt** (`find -iname '*cahier*'` : 0) ; le master prompt (02/09/2026) lui est postérieur et ne reprend pas ces décisions : il n'en tient pas lieu. `[à vérifier]` auprès de l'éditeur ; à défaut, ces décisions sont transcrites dans `DECISIONS.md` (D-000, H-11) avec les commits pour seule source.

Décisions implicites reconstituées (reportées dans `DECISIONS.md` D-000) :

| Décision | Source |
|---|---|
| SPA sans serveur, Supabase direct sous RLS | `src/lib/supabase.ts`, `PLAN.md:5` |
| Cloisonnement par `user_id` ; policies admin additives (lecture seule, puis INSERT/DELETE) sans toucher aux `_own` | `…admin_global_access.sql:1-8`, `…deliverables.sql:4-10`, `…admin_delete_documents.sql:1-3` |
| Admin global unique désigné par e-mail ; `app_admins` inaccessible ; `is_admin()` SECURITY DEFINER | `…admin_global_access.sql:10-35` |
| Livrables sous le `user_id` du client | `…deliverables.sql:5-8`, `DossierDetail.tsx:334-350` |
| Notification de lead par trigger `pg_net` → Edge → Resend, e-mail minimisé | `…lead_notification.sql`, `notify-lead/index.ts:15-19`, commit `ddeabac` |
| Transmission jamais automatique (e-mail/WhatsApp par l'utilisateur), formulaire Contact vers WhatsApp | `features.ts:79-98`, commit `7364a97` |
| Réalignement du site public sur le produit réel (HTML seulement) | commit `417708f` |
| Remplacement de l'application Supabase « legacy » par le showcase v2 sur `main` ; branche `legacy/legaltech-supabase` non présente en local | commit `4a2dedc`, `git branch -a` |
| Déploiement : suppression du workflow Pages (`1defbc9`, 25/05) → Netlify (`32db65d`, 11/06) → retour Pages « tant que le DNS n'est pas basculé » (`86f7593`, 15/06) ; cible définitive laissée ouverte | `git log -- .github/workflows/deploy.yml`, `deploy.yml:3-6` |
| Fonts self-hosted, tokens `@theme`, CSP stricte sur Netlify | `PLAN.md:5`, `index.css:15-43`, `netlify.toml:26` |
| `publicDir: 'publique'` : changement de configuration **sans justification** dans le message de commit | commit `b9c48cd` |

---

## 8. Variables d'environnement

| Variable | Lue dans | Contexte | Documentée dans `.env.example` | Statut |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts:3` | build Vite (publique) | oui | valeur en clair dans `deploy.yml:42` |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts:4` | build Vite (publique) | oui | valeur en clair dans `deploy.yml:43` et `…lead_notification.sql:18` (JWT `role: anon`, exp. 2036-06-11) |
| `VITE_BASE_PATH` | `vite.config.ts:20` | build (défaut `/`) | **non** | fixée dans `deploy.yml:40` |
| `STRIPE_SECRET_KEY` | `scripts/create-stripe-products.mjs:18`, `scripts/add-annual-prices.mjs:11` | scripts locaux | **non** | jamais dans le dépôt (grep `sk_live|rk_live|sk_test` → commentaires seulement) |
| `RESEND_API_KEY` | `notify-lead/index.ts:6` | secret Edge Function | **non** | défaut `''` silencieux ; présence en prod `[à vérifier]` |
| `RESEND_SMTP_PASSWORD` | `config.toml` `[auth.email.smtp]` | SMTP Auth | **non** | — |
| `OPENAI_API_KEY`, `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`, `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`, `S3_*` | `config.toml` | Studio / providers désactivés | non | template Supabase |

`[constaté]` Aucun `.env` local (seul `.env.example`) : l'application locale tourne en mode « non configuré ». `.env.example:1` annonce « valeurs réelles dans les variables d'env Netlify » alors que le workflow Pages les code en dur. Aucun secret réel dans le dépôt (grep `service_role|whsec_|re_[A-Za-z0-9]{20,}` → 0).

**Variables manquantes pour la cible IA :** `ANTHROPIC_API_KEY` (serveur uniquement), secret dédié pour `notify-lead`, budgets de tokens, paramètres de conservation, région d'hébergement documentée.

---

## 9. État du déploiement

| Cible | État | Preuve |
|---|---|---|
| **GitHub Pages** (`www.clair-dossier.com`) | **En production.** 59 runs du workflow ; #55 à #59 en `success` ; #59 = `b9c48cd` (2026-08-26 17:38:26Z → 17:39:02Z) ; `last-modified` de la page d'accueil = 26 Aug 2026 17:38:54 GMT : la version live est celle du run #59 | GitHub Actions ; `curl -sI https://www.clair-dossier.com/` |
| — assets statiques | **cassés** : `/robots.txt`, `/sitemap.xml`, `/favicon.svg`, `/llms.txt`, `/brochure-clairdossier.pdf` → **404** (corps = SPA) ; `/404.html` → 200 | sondes 2026-09-02 |
| — en-têtes de sécurité | **aucun** (ni CSP, ni HSTS, ni X-Frame-Options ; GitHub Pages ne permet pas d'en-têtes personnalisés ; `index.html` sans meta CSP) | `curl -sI` ; `index.html:1-40` |
| — statut HTTP des routes SPA | 404 (mécanisme `404.html`) | `curl /tarifs` ; `vite.config.ts:7-17` |
| — paramètres Pages (source, domaine, HTTPS) | `[à vérifier]` : API `/pages` bloquée par le proxy de session ; le domaine tient au réglage du dépôt puisque `CNAME` n'est plus dans l'artefact | — |
| **Netlify** (`clair-dossier.netlify.app`) | déployé, **build antérieur** : sert `/robots.txt`, `/sitemap.xml`, `/favicon.svg`, `/llms.txt` en 200 mais pas la brochure ; CSS sans `premium-ambient-sweep` (commit `24e1e2b`, 02/07) et `<title>` avec « administratif » (`9d63b0a`, 18/06) → build entre `9d63b0a` et `271ac1b` inclus, postérieur au dernier run CI Netlify (#46, 15/06) : **auto-deploy Netlify hors dépôt, arrêté ou désactivé début juillet** `[déduit]` ; CSP + HSTS + X-Frame-Options actifs | sondes ; `netlify.toml` |
| **DNS** | `www` → CNAME `romancg13.github.io` ; apex → 4 IP GitHub Pages, 301 vers www ; zone chez whois.com `[à vérifier]` | `getent hosts`, `deploy.yml:3-6` |
| **Supabase** projet `buzgokfmxpmyceppvjpp` | actif : Edge Function `notify-lead` **déployée derrière `verify_jwt`** (401 sans JWT ; fonction inexistante → 404) ; REST fermé sans clé (401) ; `verify_jwt` **non déclaré** dans `config.toml` (aucune section `[functions.*]`) donc réglé hors dépôt ; migrations appliquées en prod, région, plan, secrets : **`[à vérifier]`** (`x-sb-edge-region: us-east-1` est la région edge de la requête, pas celle du projet) | sondes 2026-09-02 ; `config.toml:353-365` |
| **Stripe** | 6 produits × (mensuel + annuel) Payment Links live ; retour `/compte?paid=<planId>` ; aucun webhook ; description produit « IA avancée (GPT-5.5) » dans le script de création | `pricing.ts:45-182`, `create-stripe-products.mjs:44,80-93` |
| **Resend** | expéditeur `noreply@clair-dossier.com`, SMTP Auth via `RESEND_SMTP_PASSWORD` ; vérification du domaine `[à vérifier]` | `notify-lead/index.ts:6-8`, commit `268576a` |
| **Supabase local** | `config.toml` référence `./seed.sql` qui **n'existe pas** | `config.toml` `[db.seed]` |

Conclusion : **le produit est en production** avec des utilisateurs potentiels réels. Toute migration doit être additive et rejouable ; toute modification d'interface doit préserver les parcours du § 11.

---

## 10. Anomalies visibles immédiatement (consolidées, dédoublonnées)

Grille CLAIR-VERIF : BLOQUANT = défaut constaté en production ou empêchant la mission ; MAJEUR = correction avant livraison ; MINEUR = correction planifiée ; OBSERVATION. L'écart structurel avec le modèle cible est traité à part (§ 10.1) : ce n'est pas un dysfonctionnement de l'existant mais l'objet même des étapes 3 à 26.

### BLOQUANT

| # | Anomalie | Preuve | Correction minimale |
|---|---|---|---|
| B1 | **`publicDir: 'publique'` exclut tout `public/` du build**, en production depuis le run #59 : favicon absent, partages sociaux et logos JSON-LD (`seo.tsx:90`, `BlogPost.tsx:56`) en 404, Search Console sans robots/sitemap, GEO neutralisée, brochure introuvable. Le domaine tient au réglage Pages, pas au fichier `CNAME`. | `vite.config.ts:23` ; `git show b9c48cd` ; `ls dist` ; sondes 404 | Retirer la ligne (défaut `public`, cohérent avec `gen-markdown.ts:31`) **dans le même lot que B2**. |
| B2 | **Allégations non tenues encore publiées** (I10, I12). **Couche GEO / statiques** : « 100 % conforme RGPD — hébergement OVH France », « relances automatiques », « projets de réponse aux e-mails », « 6 statuts » (`gen-markdown.ts:62-70` → `public/index.md:11-17`, `page.md:11-17`) ; OVH Roubaix/Strasbourg, bare-metal, bastion/WAF, AES-256, KMS 90 j, 2FA admin, DPIA réalisée, HDS, RPO 15 min / RTO < 4 h, pentest annuel, « RGPD : conforme » (`gen-markdown.ts:381-438` → `public/securite.md:3,13-50`) ; `public/llms.txt:3,7,11,19,23,56-74` (résumé IA, rédaction IA, réponse automatisée, « IA avancée GPT-5.5 », validation « par un avocat inscrit au barreau », « 4 étapes », OVHcloud, AES-256, HSTS preload, 2FA obligatoire, sauvegardes 3-2-1, HDS 2026 T3, ISO 27001 2027, notification CNIL) ; `public/og-default.svg:31,34-35,38` (« OVH France · RGPD natif », « CABINETS », ancien H1) ; `index.html:17,25` (meta « relances à échéance, projets de réponse aux e-mails », og « Hébergement UE, RGPD natif »). **HTML** : `Hero.tsx:7-21,151-160` (carte « Validation pro (option) », « Sous 24 h ouvrées », « Chronologie : 4 évènements datés », timeline 6 statuts) ; `Workflow.tsx:28` + `statuses.ts` (« Six statuts ») ; `DossierLifecycle.tsx:25,30,64-66` (« relances préparées à date », « paiement suivi ») ; `FinalCTA.tsx:33-36` (« validé par un professionnel ») ; `seo.tsx:91-92` (« validés par des professionnels habilités ») ; `Home.tsx:47` (« cabinets d'avocats ») ; `Pricing.tsx:30-47,54,72,78,379` et `pricing.ts:148-149,176-177` (IA avancée, marque blanche, API/webhooks/SDK, SSO, onboarding sur site, espace facturation, « données en France ») ; `faq.ts:24,30`, `features.ts:88-94`, `workspaces.ts:30` (« destinataire de votre choix » alors que le code n'envoie qu'à ClairDossier) ; `BlogIndex.tsx:52-53`, `authors.ts:9-17` (« écrits / relus par des avocats »). **Blog** : `chronologie-prud-homale.ts:78,87` (« extrait automatiquement les dates », cas « 47 jours »), `ia-droit.ts:75,83,100,113` (outputs IA réservés à l'avocat, signature électronique), `rgpd-legaltech.ts:99,103` (OVH exclusif, AES-256, DPIA, pentest, export ZIP), `mise-en-demeure.ts:83,99` (« dizaines de dossiers reçus », « relue par des avocats partenaires »). **Stripe** : `create-stripe-products.mjs:44` (« IA avancée (GPT-5.5) », `[à vérifier]` sur la page de paiement). L'hébergeur réel est GitHub Pages (US) + Supabase (région `[à vérifier]`) + Resend, comme le disent d'ailleurs les mentions légales (`legal.ts:72,76`). | fichiers cités | Réaligner sur les formulations prudentes de `Security.tsx` / `features.ts` ; régénérer `public/*.md` ; corriger la description Stripe (dashboard : action humaine). |

### 10.1 Écart structurel avec la cible (objet de la mission, non un défaut de l'existant)

| # | Écart | Preuve |
|---|---|---|
| E1 | 13 entités cibles sur 17 absentes, aucun `tenant_id`, aucun rôle au-delà d'un booléen admin, aucun plan en base, aucun ancrage source, aucun AuditLog. | § 2.6 |
| E2 | 7 écrans cibles sur 10 absents ; CGV (`legal.ts:202`) excluent explicitement toute analyse automatique : **révision contractuelle humaine requise avant toute IA**. | § 4 |
| E3 | Aucun prompt, aucun test, aucun jeu d'essai, aucune observabilité. | § 5, 6 |

### MAJEUR

| # | Anomalie | Preuve |
|---|---|---|
| M1 | **Aucun droit d'abonnement vérifié** (I7) : bandeau sur `?paid=`, aucune table, aucun webhook, quotas non appliqués, plans « utilisateurs » sans notion d'équipe ; matrice comparative incohérente (capacités gratuites marquées ✗). | `Account.tsx:30-31,89-98`, `pricing.ts:24-33,45-182` |
| M2 | **Edge Function `notify-lead` déclenchable par tout détenteur de la clé anon** (bundle, workflow, migration) : `req.headers` jamais lu, aucun secret ; `record.id` interpolé dans `href` et dans le HTML sans validation UUID ni échappement (lien forgeable, injection HTML dans l'e-mail interne, spam, quota Resend, réputation du domaine). `verify_jwt` effectif non déclaré dans le dépôt. | `notify-lead/index.ts:10-14,21,33,44-45`, `config.toml` (aucune `[functions.*]`) |
| M3 | **Minimisation RGPD incomplète** : l'e-mail sortant est bien minimisé, mais le trigger envoie `to_jsonb(new)` complet (profil : nom, société, téléphone ; dossier : `answers` avec contrepartie, montant, situation, salarié) à une fonction qui n'utilise que `record.id` ; transit par la file `pg_net` et le runtime Edge (rétention logs `[à vérifier]`). | `…lead_notification.sql:20`, `notify-lead/index.ts:15-21` |
| M4 | **Aucun AuditLog** : lectures, zips, livraisons, suppressions admin non tracés ; suppressions définitives. | `…admin_global_access.sql:38-53`, `DossierDetail.tsx:367-426` |
| M5 | **Policies admin storage sans contrainte de chemin ; `docs_insert_admin` sans cohérence `user_id ↔ dossiers.user_id`** : la convention `<owner>/<dossier>/` ne tient que par le code client. | `…deliverables.sql:22-29`, `…admin_delete_documents.sql:5-11`, `DossierDetail.tsx:343-355` |
| M6 | **Statut `'transmis'` à trois volets** : écrit avant l'envoi effectif (l'utilisateur peut fermer WhatsApp sans envoyer) ; jamais mis à jour ensuite (aucun `.update(`, admin sans policy UPDATE) → frise figée à l'étape 3, étape 2 inatteignable ; `done = true` et ouverture du canal même si l'INSERT échoue. Deux vocabulaires de statuts incompatibles. | `DossierFlow.tsx:348,352-357,381-399`, `DossierDetail.tsx:92-106`, `statuses.ts:12-57` |
| M7 | **Échecs d'upload silencieux, dans les deux sens** : `up.error` sans `else`, résultat de l'INSERT `dossier_documents` jamais lu (upload réussi + INSERT échoué = fichier orphelin) ; l'écran de succès et la synthèse annoncent N pièces déposées. | `DossierFlow.tsx:359-373,315-317` |
| M8 | **Aucun test, aucun lint, aucune CI de qualité** ; scripts Stripe non exécutables (`stripe` absent du lockfile), `add-annual-prices.mjs` non idempotent ; **modèle non typé côté client** (pas de `Database` généré, `DossierRow` divergent, `STATUS_LABELS` dupliqué) : une modification de schéma n'est détectée ni par `tsc` ni par le build. | § 6 ; `supabase.ts:17` ; `Account.tsx:8-25` ; `DossierDetail.tsx:9-33` |
| M9 | **Aucune CSP ni en-tête de sécurité sur l'hôte servi** (GitHub Pages) ; jetons en `localStorage` sans CSP ; routes SPA en HTTP 404 ; **deux déploiements divergents** (Pages = `b9c48cd`, Netlify = fin juin) alimentés par des mécanismes différents. | `curl -sI` ; `netlify.toml:19-26` |
| M10 | **Données personnelles de tiers transmises en clair** (contrepartie, salarié, montant, situation, e-mail du compte) dans l'URL `wa.me` (Meta) ou le `mailto`, sans information dans l'interface ; brouillon en clair en `localStorage`, partagé entre comptes d'un même navigateur, non purgé par `signOut`. | `DossierFlow.tsx:38,209-237,308-330`, `auth.tsx:101-104` |
| M11 | **Document « cahier directeur » absent du dépôt** alors que quatre décisions produit s'y réfèrent ; **README/PLAN contredisent le code sur 8 points**. | § 7 |

### MINEUR

| # | Anomalie | Preuve |
|---|---|---|
| m1 | `docs_insert_own` ne vérifie pas que `dossier_id` appartient à l'utilisateur. | `…init.sql:62` |
| m2 | `dossiers_update_own` sans restriction de colonnes ; aucun CHECK sur `status`/`typology`. | `…init.sql:23-25,58` |
| m3 | Clé anon + URL projet en dur (migration, `deploy.yml`) : rotation impossible sans commit, migration non portable ; `.env.example` contredit le workflow. | `…lead_notification.sql:15-18`, `deploy.yml:41-43` |
| m4 | MFA désactivée, aucune expiration de session, pas de captcha, `password_requirements = ""` ; valeurs prod `[à vérifier]`. | `config.toml` `[auth*]` |
| m5 | Aucune limite applicative (dossiers, uploads) ; bucket sans `file_size_limit`/`allowed_mime_types` ; `accept` client seulement ; livraison admin sans `accept`. | `…init.sql:103-105`, `DossierFlow.tsx:816`, `DossierDetail.tsx:725-734` |
| m6 | Aucune case de consentement, aucune suppression de compte/dossier/pièce en libre-service, `profiles` sans DELETE, cascade sans purge storage (orphelins) ; politique cookies inexacte (décrit session/préférence/CSRF, ignore `localStorage`). | `Signup.tsx:77-126`, `legal.ts:417-419` |
| m7 | `/contact` : `noValidate` sans validation, `?topic=`/`?plan=` ignorés, `<a href>`. | `Contact.tsx:17,124,148-178,173` |
| m8 | `DossierDetail` n'affiche ni `counterparty`, ni `amount`, ni `profil` ; `ANSWER_LABELS` hérités faux ; référentiel `profil` ≠ `company_type` ; libellés non partagés entre tunnel et détail. | `DossierDetail.tsx:109-141,300-303`, `DossierFlow.tsx:10-15,115-181` |
| m9 | URLs signées 1 h générées au chargement, non rafraîchies ; génération dupliquée ; `storage.remove` non contrôlé. | `DossierDetail.tsx:281-291,322-331,414-419` |
| m10 | Inputs fichier `hidden` non focusables ; « glissez-déposez » sans `onDrop` ; onglets sans `tabpanel`/clavier ; boutons à état sans `aria-pressed` ; `window.confirm`. | `DossierFlow.tsx:806-823`, `DossierDetail.tsx:502-522,716-735` |
| m11 | `translateError` « 6 caractères » vs règle 8 ; `/connexion` et `/inscription` accessibles connecté ; scénario « confirmation e-mail » non géré. | `auth.tsx:44`, `Signup.tsx:33-36`, `App.tsx:117-132` |
| m12 | `.env.example` incomplet ; `ImportMetaEnv` non typée ; `scripts/` hors typecheck ; aucun `engines`/`.nvmrc` ; `RESEND_API_KEY` vide toléré. | `.env.example`, `vite-env.d.ts:1`, `tsconfig.json:28`, `notify-lead/index.ts:6` |
| m13 | Liste admin non paginée ; `admin_user_emails()` renvoie tout pour un seul e-mail. | `Account.tsx:47-50`, `DossierDetail.tsx:261-267` |
| m14 | `seed.sql` référencé mais absent ; e-mail personnel de l'admin dans une migration et l'Edge Function ; trois adresses « équipe » différentes. | `config.toml` `[db.seed]`, `…admin_global_access.sql:21`, `notify-lead/index.ts:7-8`, `DossierFlow.tsx:39` |
| m15 | **Charte** : les 13 valeurs de référence sont **exactes** dans `index.css:17-35` et les 3 typographies conformes (`:41-43`). Écarts : tokens hors référence `navy-600 #2a3960`, `gold-300 #f0d99a`, `sky-marker` (`:20,24,37-38`) ; `#25D366` en dur (`Contact.tsx:75`, `Pricing.tsx:284`) ; gradients hex (`BlogIndex.tsx:75`, `BlogPost.tsx:142`, `BlogPreview.tsx:45`) ; palette Tailwind par défaut `emerald`/`red`/`amber` dans 7 fichiers ; `#64748b` dans l'e-mail. La signature « L'IA organise. Vous décidez. » **n'apparaît nulle part** — et ne doit pas apparaître tant qu'aucune fonction IA n'est livrée (I10). | grep `#[0-9a-fA-F]{6}` ; grep signature |
| m16 | 5 composants morts (`Button`, `Card`, `Pill`, `Magnetic`, `Marquee`), registre `SECURITY_ICONS` mort, `Tabs` non réutilisé par `DossierDetail`, `Accordion`/`Tabs` sans `useReducedMotion`, prop `amount` inerte, icône `timeline` dupliquée ; comptages faux (« Huit briques », « Trois lectures »), tri blog non conforme. | § 4.1 |
| m17 | Slugs d'URL hérités trompeurs (`pieces-ocr`, `validation-avocat`, `coffre-fort`, `messagerie-securisee`, `calendrier-relances`, `reponse-auto-mails`) : tout renommage exige des redirections 301 et une mise à jour du sitemap. | `features.ts:37,58,79,121,142,163,183` |
| m18 | CGV : facturation « mensuelle » seulement alors que l'annuel est vendu ; « société ClairDossier » ; « équipes habilitées » vs admin unique. | `legal.ts:86,168,317` |

### OBSERVATION

- `vite.config.ts:13` utilise `__dirname` en ESM (shim Vite).
- `storage.s3_protocol` activé en local ; `[storage.vector]` désactivé.
- Le tableau des bundles du README est périmé.
- Le trigger `notify_lead` se déclenchera aussi sur tout INSERT futur du pipeline IA : un e-mail à l'admin par dossier créé automatiquement.

---

## 11. Points d'extension pour l'IA et comportements à préserver (I11)

### 11.1 À préserver sans régression

1. Tunnel `/dossier/nouveau` : 5 étapes, 5 profils, 7 catégories, **nom obligatoire sous les catégories**, brouillon restaurable, récapitulatif, transmission e-mail/WhatsApp déclenchée par l'utilisateur.
2. Convention de stockage `<user_id>/<dossier_id>/<timestamp>-<nom>` et policies storage `_own` : tout écrivain serveur (IA) doit s'y conformer, le livrable admin en est le précédent.
3. Page dossier : 4 onglets, frise 5 étapes cliquables avec panneaux, livrables `kind = 'deliverable'`, zip client, liens signés, bandeau « Aucun envoi ne sera effectué sans votre confirmation ».
4. Vue admin `/compte`, livraison/suppression admin, `is_admin()` et policies additives.
5. Typologies héritées et clés `answers` héritées : des dossiers réels peuvent les porter ; `currentStep(status)` reste le repli pour les anciens dossiers.
6. Charte : tokens `@theme`, H1 immuable, pas d'emoji, or 5-8 %.
7. Notification de lead (à durcir, pas à supprimer) ; décisions du cahier directeur (§ 7).

### 11.2 Points d'insertion naturels

| Besoin cible | Point d'ancrage existant | Approche additive |
|---|---|---|
| Ingestion documentaire (PARTIE 7.1) | `dossier_documents` + bucket ; aucun trigger sur `dossier_documents` aujourd'hui | colonnes `hash`, `mime`, `pages`, `score_ocr`, `categorie`, `confiance_classification`, `version`, `parent_version_id` ; trigger AFTER INSERT → file de travaux (même patron que `notify_lead`, avec secret dédié) ; original jamais modifié |
| Tenant | `profiles` / `dossiers.user_id` | `tenants` + `tenant_members(user_id, role)` ; `tenant_id` nullable + backfill « 1 user = 1 tenant » ; policies `tenant` à côté des `_own` jusqu'au test d'isolation vert |
| Échéances / chronologie | onglet Échéances (`DossierDetail.tsx:750-795`) | tables `evenements`, `echeances` ancrées ; l'onglet lit les tables puis retombe sur `answers` |
| Productions / brouillons IA | livrables `kind = 'deliverable'` ; `TABS` `as const` + blocs conditionnels | étendre le CHECK `kind` **et** le filtre UI `kind !== 'deliverable'` ; table `productions` avec `statut_validation` (I4) ; un onglet = une entrée + un bloc |
| Journal | aucun | `audit_log` append-only (trigger interdisant UPDATE/DELETE) |
| Abonnement (I7) | `/compte?paid=` | `subscriptions` alimentée par webhook Stripe signé (Edge Function), `plan_actuel()` SECURITY DEFINER, quotas en policy/trigger |
| Couche serveur IA | aucune | Edge Functions ou service séparé ; la clé Anthropic ne transite jamais côté client |
| Typage | aucun | `supabase gen types` → `src/lib/database.types.ts`, `createClient<Database>`, types partagés |

---

## 12. Ce qui nécessite une intervention humaine (non déductible du code)

1. **Région d'hébergement et plan du projet Supabase** `buzgokfmxpmyceppvjpp`, localisation des sauvegardes, rétention des logs : conditionnent toute formulation « hébergement UE » et le § 9.4 du master prompt.
2. **Réglages de production Supabase** : Auth (MFA, expiration de session, captcha, rate limits), `verify_jwt` de `notify-lead`, présence de `RESEND_API_KEY`, migrations effectivement appliquées.
3. **Cible de déploiement définitive** (GitHub Pages sans en-têtes vs Netlify) et bascule DNS ; état de l'auto-deploy Netlify.
4. **Document « cahier directeur »** : le fournir pour versionnement sous `docs/`, ou valider la transcription D-000/H-11 de `DECISIONS.md`.
5. **« Prompt système CLAIR-Agent v1.1 » et `~/clair-agent`** cités par le master prompt : existent-ils ? Doivent-ils être versionnés ici ?
6. **Révision des CGV, mentions légales, politique de confidentialité et cookies** avant toute IA (`legal.ts:72,76,168,202,417-419`), sous-traitants IA, AIPD.
7. **Description des produits Stripe** (« IA avancée (GPT-5.5) ») et libellés commerciaux (IA avancée, API, SSO, marque blanche) : reformuler ou retirer — décision commerciale.
8. **Constitution du dossier étalon** (PARTIE 10) avec données fictives.
9. **Inventaire des valeurs réellement présentes en base** (`status`, `typology`, clés `answers`) avant tout CHECK ou migration de statut.

---

## 13. Réponses courtes aux 10 questions de la PARTIE 3

| # | Question | Réponse |
|---|---|---|
| 1 | Stack | Vite 6.4.2 / React 19.2.6 / TS 5.9.3 strict / Tailwind 4.3.0 / Motion 11.18.2 / RR 7.15.1 / supabase-js 2.108.2 ; Supabase Postgres 17 (local) ; npm ; **aucun ORM, aucun type généré, aucun runner de tests, aucun lint** |
| 2 | Modèles | `profiles`, `dossiers`, `dossier_documents(kind)`, `app_admins` ; relations par `user_id`/`dossier_id` ; 13/17 entités cibles absentes ; modèle non typé côté client |
| 3 | Routes API | aucune API propre ; opérations Supabase directes sous RLS ; 1 Edge Function déclenchée par trigger (clé anon suffisante) ; Stripe/WhatsApp/mailto externes |
| 4 | Écrans | 18 routes ; 5 réellement fonctionnelles contre Supabase (`/inscription`, `/connexion`, `/dossier/nouveau`, `/compte`, `/compte/dossier/:id`) ; `/contact` simulé ; 7 écrans cibles sur 10 absents ; 5 composants morts |
| 5 | Prompts | aucun ; « CLAIR-Agent v1.1 » / `~/clair-agent` hors dépôt |
| 6 | Tests | aucun ; typecheck et build passent |
| 7 | Décisions | aucun `DECISIONS.md` avant cette session ; « cahier directeur » cité 4 fois, absent ; PLAN/README périmés sur 8 points ; décisions implicites reconstituées |
| 8 | Env | 2 documentées / 6 attendues ; aucun secret dans le dépôt ; clé anon en dur ; aucun `.env` local |
| 9 | Déploiement | **en production** (GitHub Pages run #59 + Supabase + Stripe) ; Netlify parallèle périmé par auto-deploy hors dépôt |
| 10 | Bloquants | B1 `publicDir`, B2 allégations résiduelles ; écart structurel E1-E3 |

---

── CONTRÔLE CLAIRDOSSIER ──
Niveau appliqué      : N3
Vérifié              : lecture intégrale des 6 migrations, `config.toml`, Edge Function, `App.tsx`, `auth.tsx`, `supabase.ts`, `RequireAuth.tsx`, `Account.tsx`, `DossierDetail.tsx`, `DossierFlow.tsx`, `features.ts`, `pricing.ts`, `faq.ts`, `workspaces.ts`, `statuses.ts`, `legal.ts`, sections Home, composants ui/primitives/icons, `llms.txt`, `gen-markdown.ts`, `index.css`, `package.json`, `vite.config.ts`, `tsconfig.json`, `netlify.toml`, `deploy.yml`, `.env.example`, `.gitignore`, `README.md`, `PLAN.md`, master prompt en entier ; `npm ci`, `typecheck`, `build`, contenu de `dist/` ; sondes HTTP production (Pages, Netlify, Supabase, fonction inexistante témoin) ; historique GitHub Actions (59 runs) ; 5 lecteurs + critique + 7 compléments recoupés, 5 constats critiques revérifiés directement sans erreur factuelle détectée.
Non vérifiable       : région/plan/réglages Auth/`verify_jwt`/secrets/migrations appliquées du projet Supabase ; configuration Netlify et son auto-deploy ; paramètres GitHub Pages (API bloquée) ; zone DNS ; visibilité du dépôt ; rendu responsive et comportement en navigateur (aucune exécution) ; existence du « cahier directeur », de « CLAIR-Agent v1.1 » et de `~/clair-agent` ; contenu réel des pages de paiement Stripe.
Anomalies corrigées  : aucune (inventaire seul, conformément à la PARTIE 3 : aucune ligne de code applicatif écrite).
Points restants      : étape 2 (`CLAUDE.md`, `DECISIONS.md`) ; correctif B1 + B2 en un seul lot (D-003) avant l'étape 3 ; § 12 (9 points humains).
Validation humaine   : § 12.
Verdict              : PRÊT SOUS RÉSERVE (les 10 questions sont couvertes ; réserves = « Non vérifiable »).
