# Audit PHASE 0 — Application authentifiée (espace client), côté frontend

**Projet** : ClairDossier — https://www.clair-dossier.com
**Dépôt audité** : `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com` (branche `main`, HEAD `865f86c`, arbre propre)
**Date** : 2026-08-23
**Mode** : lecture seule. Aucun fichier du dépôt modifié. Aucune commande git modifiant l'état. Aucun fichier `.env` lu (`.env.example` non lu non plus).

Tous les chemins ci-dessous sont relatifs à la racine du dépôt. Les numéros de ligne sont ceux des fichiers à HEAD.

---

## 0. Périmètre et méthode

### 0.1 Fichiers lus intégralement

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/lib/supabase.ts` | 25 | Client Supabase unique |
| `src/lib/auth.tsx` | 124 | Contexte d'authentification (`AuthProvider`, `useAuth`) |
| `src/components/RequireAuth.tsx` | 32 | Garde de route |
| `src/pages/Login.tsx` | 95 | Page `/connexion` |
| `src/pages/Signup.tsx` | 188 | Page `/inscription` |
| `src/pages/Account.tsx` | 197 | Page `/compte` (liste des dossiers) |
| `src/pages/DossierFlow.tsx` | 1067 | Page `/dossier/nouveau` (tunnel de création) |
| `src/pages/DossierDetail.tsx` | 825 | Page `/compte/dossier/:id` (détail) |
| `src/components/Nav.tsx` | 210 | Navigation (partie connectée incluse) |
| `src/data/statuses.ts` | 65 | Statuts « marketing » du cycle de vie |
| `src/vite-env.d.ts` | 1 | Référence de types Vite |
| `src/App.tsx` | 196 | Routage |
| `src/main.tsx` | 19 | Montage React + `AuthProvider` |
| `src/lib/whatsapp.ts` | 20 | Helper WhatsApp (utilisé par le tunnel) |
| `src/components/Layout.tsx` | 34 | Layout (Nav + Footer + Outlet) |
| `supabase/functions/notify-lead/index.ts` | 69 | Edge Function de notification (pour le point « notifications RGPD ») |

### 0.2 Fichiers lus partiellement (pour vérifier les dépendances backend du frontend)

| Fichier | Portions lues | Motif |
|---|---|---|
| `supabase/migrations/20260615201942_clair_dossier_init.sql` | l.1-63, 83-99, 100-115 | Tables `profiles`, `dossiers`, `dossier_documents`, RLS, bucket `documents`, trigger `handle_new_user` |
| `supabase/migrations/20260617110728_dossier_lead_notification.sql` | intégral (34 l.) | Trigger `notify_lead` |
| `supabase/migrations/20260621144123_admin_global_access.sql` | l.20-56 + grep | Fonction `is_admin()`, policies admin |
| `supabase/migrations/20260622062648_admin_user_emails.sql` | l.1-20 | Fonction `admin_user_emails()` |
| `supabase/migrations/20260628093000_dossier_deliverables.sql` | grep uniquement (l.14, 19, 23-29) | Colonne `kind`, policies insert admin |
| `supabase/migrations/20260701093000_admin_delete_documents.sql` | l.1-14 | Policies delete admin |
| `supabase/config.toml` | l.1-12, 146-172, 198-210 | Réglages auth **locaux** (CLI) |
| `.github/workflows/deploy.yml` | intégral | Variables d'env de build |
| `netlify.toml` | intégral | CSP, redirections |
| `package.json` | intégral | Dépendances, scripts |
| `scripts/create-stripe-products.mjs`, `scripts/add-annual-prices.mjs` | grep `after_completion` | Origine du paramètre `?paid=` |
| `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` | grep | Stockage par défaut de la session (l.225 : `globalThis.localStorage`) |

### 0.3 Ce qui n'a PAS été lu
- Le corps complet des migrations SQL (hors portions ci-dessus) et `supabase/config.toml` hors sections auth.
- Les pages marketing (`Home`, `Pricing`, `Contact`, etc.) hors greps ciblés.
- Le dossier `dist/` (artefact de build).
- Aucun fichier `.env*`.

### 0.4 Tests
Recherche `find` sur `*.test.*`, `*.spec.*`, `vitest.config.*`, `jest.config.*`, `playwright.config.*`, dossiers `__tests__`/`tests`/`test`/`e2e` (hors `node_modules`, `dist`) : **aucun résultat**. `package.json` l.6-12 ne déclare aucun script `test` et aucune dépendance de test (`vitest`, `jest`, `playwright`, `testing-library`). Le workflow `.github/workflows/deploy.yml` n'exécute que `npm ci` puis `npm run build` (l.39, 42). **Il n'existe aucun test automatisé dans ce dépôt.**

---

## 1. Architecture et routage de l'espace authentifié

### 1.1 Montage
- `src/main.tsx:11-19` : `<StrictMode><BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter></StrictMode>`. Le contexte d'auth englobe toute l'application, y compris les pages marketing.
- `src/components/Layout.tsx:24-33` : `Nav` + `<main>` + `Footer` pour toutes les routes ; scroll-to-top et focus sur `<main>` à chaque changement de `pathname` (l.13-22).

### 1.2 Routes (src/App.tsx)

| Route | Composant | Garde | Lazy | Lignes |
|---|---|---|---|---|
| `/inscription` | `Signup` | aucune | oui | 117-124 |
| `/connexion` | `Login` | aucune | oui | 125-132 |
| `/dossier/nouveau` | `DossierFlow` | `RequireAuth` | oui | 107-116 |
| `/compte` | `Account` | `RequireAuth` | oui | 133-142 |
| `/compte/dossier/:id` | `DossierDetail` | `RequireAuth` | oui | 143-152 |
| `*` | `NotFound` | — | oui | 185-192 |

Il n'existe **aucune route** `/mot-de-passe-oublie`, `/reset`, `/reinitialisation`, `/compte/profil`, `/compte/abonnement` ou `/admin` (App.tsx l.48-195 lu intégralement).

### 1.3 Garde de route — `src/components/RequireAuth.tsx`
- l.7 : lit `session`, `loading`, `configured` depuis `useAuth()`.
- l.10-22 : pendant `loading`, affiche « Chargement… » (`role="status"`).
- l.25-27 : **si `configured && !session`** → `<Navigate to="/connexion?next=<pathname+search encodé>" replace />`.
- l.24 (commentaire) + l.25 : **si Supabase n'est pas configuré (`configured === false`), la garde laisse passer** : les pages protégées s'affichent sans session (« on ne bloque pas la démo »).
- Aucune vérification de rôle, d'abonnement ou d'e-mail confirmé dans la garde.

---

## 2. Flux d'authentification

### 2.1 Client Supabase — `src/lib/supabase.ts`

| Élément | Valeur | Ligne |
|---|---|---|
| URL | `import.meta.env.VITE_SUPABASE_URL` | 3 |
| Clé | `import.meta.env.VITE_SUPABASE_ANON_KEY` | 4 |
| `isSupabaseConfigured` | `Boolean(url && anonKey)` | 6 |
| Avertissement console en DEV si manquant | oui | 8-13 |
| Client créé **même sans config** | `createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', …)` | 17 |
| `persistSession` | `true` | 19 |
| `autoRefreshToken` | `true` | 20 |
| `detectSessionInUrl` | `true` | 21 |
| `storageKey` | `'clairdossier-auth'` | 22 |

Le stockage de session n'est pas surchargé : supabase-js 2.108.2 utilise `globalThis.localStorage` par défaut en navigateur (`node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:225`) et un `BroadcastChannel` nommé d'après `storageKey` (l.242) pour synchroniser les onglets.

En production, les variables sont injectées au build par `.github/workflows/deploy.yml:44-47` (`VITE_SUPABASE_URL=https://buzgokfmxpmyceppvjpp.supabase.co` et la clé anon, écrites en clair dans le workflow). `vite-env.d.ts:1` ne déclare que `/// <reference types="vite/client" />` : **aucun typage explicite des variables `VITE_*`** (d'où les casts `as string | undefined` l.3-4).

### 2.2 État d'authentification — `src/lib/auth.tsx`

| Élément | Détail | Lignes |
|---|---|---|
| Contexte | `AuthContext` (`session`, `user`, `loading`, `configured`, `signUp`, `signIn`, `signOut`) | 27-37, 106-114 |
| État React | `session` (`Session | null`), `loading` (`true` initial) | 52-53 |
| Hydratation | `supabase.auth.getSession()` au montage ; si non configuré, `loading=false` sans appel | 55-65 |
| Écoute | `supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))` ; désabonnement au démontage | 66-72 |
| `user` | dérivé : `session?.user ?? null` | 108 |
| Hook | `useAuth()` lève une erreur hors provider | 119-123 |

Il n'y a **aucun état global supplémentaire** (pas de Redux/Zustand, pas de profil chargé dans le contexte). Le profil (`profiles`) n'est jamais lu pour l'utilisateur courant ; seul l'admin lit la table `profiles` (voir §4.4).

### 2.3 Inscription — `/inscription`, `src/pages/Signup.tsx` + `auth.tsx:75-91`

**Champs du formulaire** (Signup.tsx) :

| Champ (`name`) | Type | Obligatoire | Valeur par défaut | Lignes |
|---|---|---|---|---|
| `companyType` | `<select>` parmi `pme`, `artisan`, `entreprise-individuelle`, `profession-liberale`, `particulier`, `autre` | non (défaut) | `pme` | 7-14, 79-89 |
| `companyName` | text, `autoComplete="organization"` | non (« optionnel ») | vide | 91-98 |
| `fullName` | text, `autoComplete="name"` | non (pas de `required`) | vide | 99-106 |
| `email` | email, `required` | oui (HTML seulement, formulaire `noValidate` l.75) | — | 107-115 |
| `password` | password, `required`, `minLength={8}` | oui | — | 116-125 |

**Traitement** (`onSubmit`, l.24-49) :
1. `e.preventDefault()`, lecture via `FormData` (l.27-32) ; `companyType` retombe sur `"autre"` si vide (l.32).
2. Validation côté client : `password.length < 8` → message « Mot de passe trop court (8 caractères minimum). » (l.33-36). **Aucune validation du format d'e-mail côté JS** (le formulaire est `noValidate`, l.75 ; l'erreur « Adresse email invalide » vient de Supabase via `translateError`, auth.tsx:45).
3. `signUp(email, password, { fullName, companyName, companyType })` (l.38-42).
4. `auth.tsx:77-87` : `supabase.auth.signUp({ email, password, options: { data: { full_name, company_name, company_type } } })` — les 3 champs passent en **user metadata** (`raw_user_meta_data`). Côté base, le trigger `on_auth_user_created` → `handle_new_user()` (`…_init.sql:83-99`) copie ces métadonnées dans `public.profiles`.
5. Si erreur → message traduit (auth.tsx:88). Si `data.session` existe → `setSession(data.session)` (l.89).
6. Retour `{ error: null }` **dans tous les cas sans erreur**, y compris quand `data.session` est `null` (cas « confirmation e-mail requise »).
7. Signup.tsx:48 : `navigate(next, { replace: true })` avec `next = params.get("next") || "/compte"` (l.20).

**Confirmation e-mail obligatoire ?**
- Le frontend **ne gère pas** ce cas : aucun écran « vérifiez votre boîte mail », aucun test sur `data.session === null` ou `data.user.identities`. Après inscription il navigue vers `/compte` (l.48) ; si la session est absente, `RequireAuth` renvoie vers `/connexion?next=%2Fcompte` sans explication. Le seul indice pour l'utilisateur serait, à la tentative de connexion, le message « Email non confirmé. Vérifiez votre boîte mail. » (auth.tsx:47).
- Côté configuration : `supabase/config.toml:205` `enable_confirmations = true` — mais ce fichier est la **config locale du CLI** (`project_id = "clair-dossier"`, l.5). **Le réglage réel du projet hébergé n'est pas lisible depuis le dépôt ; je ne peux pas affirmer si la confirmation est active en production.**
- Message affiché si non configuré : « Le service de comptes est en cours de configuration. » (Signup.tsx:136-140) — mais le bouton reste actif ; `signUp` renvoie alors l'erreur « Le service de comptes n'est pas configuré. » (auth.tsx:76).
- Texte marketing sur la page : « Gratuit. Vous pourrez créer vos dossiers immédiatement — un abonnement n'est nécessaire que pour aller plus loin. » (l.67-70).
- Aucune case « J'accepte les CGV / politique de confidentialité », aucun lien vers ces pages depuis le formulaire (l.72-152 lus).

### 2.4 Connexion — `/connexion`, `src/pages/Login.tsx` + `auth.tsx:93-99`

| Élément | Détail | Lignes |
|---|---|---|
| Champs | `email` (email, `required`, `autoComplete="email"`), `password` (password, `required`, `autoComplete="current-password"`) ; formulaire `noValidate` | 51-63 |
| Traitement | `FormData` → `signIn(email, password)` → `supabase.auth.signInWithPassword` | 15-29 ; auth.tsx:95 |
| Succès | `setSession(data.session)` puis `navigate(next, { replace: true })` | auth.tsx:97 ; Login.tsx:28 |
| `next` | `params.get('next') || '/compte'` | 11 |
| Erreur | affichée dans `<p role="alert">` | 65-69 |
| Lien vers inscription | conserve `?next=` si différent de `/compte` | 81-89 |
| Lien « mot de passe oublié » | **absent** | — |
| Bouton désactivé pendant `loading` | oui | 71-78 |

### 2.5 Déconnexion
- `auth.tsx:101-104` : `supabase.auth.signOut()` puis `setSession(null)`. Aucune gestion d'erreur (le `await` n'est pas enveloppé ; l'erreur éventuelle de `signOut` est ignorée).
- Déclencheur unique : bouton « Se déconnecter » dans `Account.tsx:121-127` → `handleSignOut` (l.79-82) → `signOut()` puis `navigate('/')`.
- `Nav.tsx` ne propose **pas** de déconnexion (l.70-84 et 167-183 : uniquement « Mon compte » et « Créer un dossier » quand `session` est non nul).

### 2.6 Session
- Persistée en `localStorage` sous la clé `clairdossier-auth` (§2.1), rafraîchie automatiquement (`autoRefreshToken: true`).
- `detectSessionInUrl: true` (supabase.ts:21) : un lien magique / lien de confirmation / lien de récupération Supabase renvoyant vers le site serait détecté et la session établie — **mais aucune page ne réagit spécifiquement à l'événement** (ex. `PASSWORD_RECOVERY`) : `onAuthStateChange` (auth.tsx:66-68) ignore `_event`.
- Aucune déconnexion automatique sur expiration côté UI (le refresh est délégué à supabase-js).

### 2.7 Réinitialisation de mot de passe
**Inexistante côté frontend.** Grep `resetPassword|mot de passe oubli|forgot` sur `src/` : aucune occurrence (hors blog). Aucun appel à `supabase.auth.resetPasswordForEmail`, `updateUser`, `verifyOtp`, `signInWithOtp`, `signInWithOAuth` (tableau §3 exhaustif). Pas de changement d'e-mail ni de mot de passe depuis l'espace client.

### 2.8 Redirections

| Situation | Comportement | Source |
|---|---|---|
| Accès à une route protégée sans session (Supabase configuré) | `/connexion?next=<route>` (replace) | RequireAuth.tsx:25-27 |
| Accès à une route protégée sans session (Supabase NON configuré) | page affichée quand même | RequireAuth.tsx:24-25 |
| Connexion réussie | `next` ou `/compte` (replace) | Login.tsx:11, 28 |
| Inscription réussie (avec ou sans session) | `next` ou `/compte` (replace) | Signup.tsx:20, 48 |
| Déconnexion | `/` | Account.tsx:81 |
| Utilisateur déjà connecté visitant `/connexion` ou `/inscription` | **aucune redirection** : les formulaires s'affichent | Login.tsx / Signup.tsx (aucun test de `session`) |
| Dossier introuvable | carte « Dossier introuvable » + lien `/compte` (pas de redirection) | DossierDetail.tsx:448-463 |
| Fin de tunnel | lien `/compte` ou « Créer un autre dossier » | DossierFlow.tsx:1031-1044 |

Le paramètre `next` n'est **pas validé** : `navigate(next)` accepte n'importe quelle chaîne. React Router `navigate` reste interne à l'application (pas de redirection vers un domaine externe), mais une valeur comme `//evil.com` est traitée comme chemin interne par le routeur — non testé ici, simple observation de l'absence de validation (Login.tsx:11, 28 ; Signup.tsx:20, 48).

### 2.9 Gestion des erreurs
- `translateError` (auth.tsx:39-49) : mapping par sous-chaînes vers 6 messages français ; sinon **le message brut Supabase (en anglais) est affiché tel quel** (l.48).
- Le message de longueur minimale côté Supabase dit « 6 caractères minimum » (auth.tsx:44) alors que le formulaire exige 8 (Signup.tsx:33-34, 121) — incohérence de libellé (sans impact tant que la validation client à 8 s'applique d'abord).
- `signOut` : pas de gestion d'erreur (l.102).
- Les écrans `Account` et `DossierDetail` **ignorent `error`** des réponses Supabase (Account.tsx:42, 47-50, 55, 61 ; DossierDetail.tsx:241-247, 253, 261, 271-275) : en cas d'échec réseau/RLS, la liste est vide ou « Dossier introuvable » sans message d'erreur.

### 2.10 Où est stocké l'état

| État | Emplacement | Source |
|---|---|---|
| Session Supabase (access/refresh token, user) | `localStorage["clairdossier-auth"]` | supabase.ts:19-22 ; GoTrueClient.js:225 |
| Session en mémoire | `useState` dans `AuthProvider` | auth.tsx:52 |
| Brouillon du tunnel | `localStorage["clairdossier_draft"]` | DossierFlow.tsx:38, 233 |
| Fichiers sélectionnés dans le tunnel | `useState<File[]>` uniquement (non persistés) | DossierFlow.tsx:202 |
| Flag admin | `useState` local à `Account` et à `DossierDetail`, recalculé par RPC à chaque montage | Account.tsx:33, 42 ; DossierDetail.tsx:221, 253 |
| Onglet actif, étape ouverte | `useState` local | DossierDetail.tsx:225, 229 |

---

## 3. Tableau EXHAUSTIF des appels Supabase dans le frontend

Obtenu par `grep -rn -E "supabase\.|\.rpc\(|\.from\(|storage\."` sur `src/` puis lecture de chaque site. Aucun autre fichier de `src/` n'importe `supabase` (seuls `auth.tsx`, `Account.tsx`, `DossierFlow.tsx`, `DossierDetail.tsx` l'importent ; `Contact.tsx` n'utilise pas Supabase — vérifié par grep).

| # | Fichier:ligne | Opération | Table / bucket / fonction | Filtres / options | Colonnes / payload | Utilisateur | Erreur gérée ? |
|---|---|---|---|---|---|---|---|
| 1 | `src/lib/auth.tsx:61` | `auth.getSession()` | — | — | — | tous | non (pas de `.catch`) |
| 2 | `src/lib/auth.tsx:66` | `auth.onAuthStateChange(cb)` | — | — | `nextSession` | tous | n/a |
| 3 | `src/lib/auth.tsx:77-87` | `auth.signUp()` | auth | — | `email`, `password`, `options.data = { full_name, company_name, company_type }` | visiteur | oui (traduit) |
| 4 | `src/lib/auth.tsx:95` | `auth.signInWithPassword()` | auth | — | `email`, `password` | visiteur | oui (traduit) |
| 5 | `src/lib/auth.tsx:102` | `auth.signOut()` | auth | — | — | client/admin | non |
| 6 | `src/pages/Account.tsx:42` | `rpc('is_admin')` | fonction `public.is_admin()` | — | retour booléen | client/admin | non |
| 7 | `src/pages/Account.tsx:47-50` | `select` | `dossiers` | `.order('created_at', { ascending: false })` — **aucun filtre `user_id`** (RLS) | `id,user_id,typology,title,status,created_at` | client/admin | non |
| 8 | `src/pages/Account.tsx:55` | `select` | `profiles` | aucun (RLS ; exécuté seulement si `admin`) | `id,company_name,full_name` | admin | non |
| 9 | `src/pages/Account.tsx:61` | `rpc('admin_user_emails')` | fonction `public.admin_user_emails()` | exécuté seulement si `admin` | retour `{ id, email }[]` | admin | non |
| 10 | `src/pages/DossierFlow.tsx:340-351` | `insert` + `.select('id').single()` | `dossiers` | — | `user_id`, `typology`, `title`, `answers` (jsonb), `legal_review_requested`, `status: "transmis"` | client (ou admin) | oui → `saveWarning` |
| 11 | `src/pages/DossierFlow.tsx:361-363` | `storage.upload` | bucket `documents` | `{ upsert: false }` | chemin `${user.id}/${dossierId}/${Date.now()}-${sanitizeName(file.name)}` | client | partielle (si `up.error`, l'insert DB est sauté **silencieusement**, l.364) |
| 12 | `src/pages/DossierFlow.tsx:365-371` | `insert` | `dossier_documents` | — | `dossier_id`, `user_id`, `file_path`, `file_name`, `size_bytes` (pas de `kind` → défaut SQL `'piece'`) | client | non (résultat ignoré) |
| 13 | `src/pages/DossierDetail.tsx:241-247` | `select` + `.maybeSingle()` | `dossiers` | `.eq('id', id)` | `id,user_id,typology,title,status,answers,legal_review_requested,created_at` | client/admin | non |
| 14 | `src/pages/DossierDetail.tsx:253` | `rpc('is_admin')` | `public.is_admin()` | — | booléen | client/admin | non |
| 15 | `src/pages/DossierDetail.tsx:261` | `rpc('admin_user_emails')` | `public.admin_user_emails()` | si admin et dossier d'un autre utilisateur | `{ id, email }[]` → `.find(e.id === row.user_id)` | admin | non |
| 16 | `src/pages/DossierDetail.tsx:271-275` | `select` | `dossier_documents` | `.eq('dossier_id', id)`, `.order('created_at', { ascending: true })` | `id,file_name,file_path,kind` | client/admin | non |
| 17 | `src/pages/DossierDetail.tsx:284-286` | `storage.createSignedUrl` | bucket `documents` | `(doc.file_path, 3600)` — 1 h, un appel par document, en `Promise.all` | `signedUrl` | client/admin | non (doc sans lien → « Lien indisponible », l.198) |
| 18 | `src/pages/DossierDetail.tsx:315-319` | `select` (rechargement) | `dossier_documents` | idem #16 | idem #16 | client/admin | non |
| 19 | `src/pages/DossierDetail.tsx:325-327` | `storage.createSignedUrl` (rechargement) | bucket `documents` | idem #17 | idem #17 | client/admin | non |
| 20 | `src/pages/DossierDetail.tsx:344-346` | `storage.upload` | bucket `documents` | `{ upsert: false }` | chemin `${dossier.user_id}/${dossier.id}/deliverable-${Date.now()}-${safe}` | admin (UI) | oui (`throw` → `deliverError`) |
| 21 | `src/pages/DossierDetail.tsx:348-355` | `insert` | `dossier_documents` | — | `dossier_id`, `user_id: dossier.user_id` (**le client**), `file_path`, `file_name`, `size_bytes`, `kind: "deliverable"` | admin (UI) | oui |
| 22 | `src/pages/DossierDetail.tsx:414` | `storage.remove` | bucket `documents` | `[doc.file_path]` | — | admin (UI) | **non** : résultat ignoré ; l'étape suivante s'exécute même si le fichier n'a pas été supprimé |
| 23 | `src/pages/DossierDetail.tsx:415-418` | `delete` | `dossier_documents` | `.eq('id', doc.id)` | — | admin (UI) | oui |
| 24 | `src/pages/DossierDetail.tsx:376` | `fetch(href)` (pas Supabase SDK, mais appel HTTP vers l'URL signée du storage) | bucket `documents` | URL signée | binaire | client/admin | partielle (`!res.ok` → document sauté) |

**Opérations Supabase jamais utilisées dans le frontend** : `update` sur `dossiers` (le statut n'est jamais modifié depuis l'UI), `delete` sur `dossiers`, `update`/`insert` sur `profiles`, `storage.download`, `storage.list`, `auth.resetPasswordForEmail`, `auth.updateUser`, `auth.getUser`, realtime/`channel`.

---

## 4. Fonctionnalités de l'espace client, une par une

### 4.1 Création de dossier — `/dossier/nouveau`, `src/pages/DossierFlow.tsx`

**Accès** : `RequireAuth` (App.tsx:110). `useAuth().user` utilisé (l.195) ; si `user` est `null` (cas « non configuré »), `persistDossier` retourne sans rien faire (l.333) et le tunnel fonctionne en pur local.

**Structure du brouillon** (`Draft`, l.29-36) : `profil?`, `typology?`, `title?`, `answers: Record<string,string>`, `step: 1|2|3|4|5`, `updatedAt`.

**Persistance localStorage** :
- Clé exacte : `STORAGE_KEY = "clairdossier_draft"` (l.38).
- Restauration au montage (l.209-229) : `JSON.parse`, reprise de `profil`, `typology`, `title`, `answers`, `step`, `updatedAt` ; flag `restored` → badge « Brouillon restauré depuis votre dernière visite » (l.431-436, affiché seulement à l'étape 1 avec un profil).
- Sauvegarde à **chaque changement de `draft`** (l.231-237), y compris au premier rendu (le brouillon vide `{answers:{}, step:1}` est écrit immédiatement).
- Suppression : `resetDraft` (l.297) et après `finalize` (l.395).
- **Les fichiers (`files`) et l'option `legalReview` ne sont pas persistés** (l.202-203 : `useState` simples). Au rechargement de la page à l'étape 4 ou 5, la liste de fichiers est vide.
- Le brouillon est **partagé entre comptes sur le même navigateur** (clé non suffixée par `user.id`).

**Étapes** (`draft.step`, titres l.419-428) :

| Étape | Titre | Composant | Champs / actions | Lignes |
|---|---|---|---|---|
| 1 | « Quel est votre profil ? » | `StepProfil` | 5 boutons : `artisan`, `independant`, `profession-liberale`, `entreprise-pme`, `autre` → `selectProfil` passe à l'étape 2 | 41-68, 239-246, 547-589 |
| 2 | « Quelle est la nature de votre dossier ? » | `StepCategory` | 7 catégories : `dossier-client`, `facture-paiement`, `impaye-precontentieux`, `administratif`, `comptable`, `rh`, `autre` (l.70-106) + champ texte **obligatoire** « Nom de votre dossier » (l.649-682, placeholder « Ex. Chantier Dupont — solde impayé »). `confirmCategory` bloque si titre vide avec message l.262-264 ; bouton « Continuer » désactivé sans catégorie (l.695). Retour « Changer de profil » (l.685-691) | 250-269, 591-704 |
| 3 | « Quelques informations pour structurer. » | `StepInfos` | Formulaire `noValidate` ; champs `COMMON_FIELDS` (l.115-144) : `counterparty` (text), `startDate` (date), `amount` (text), `deadline` (date), `situation` (textarea). Surcharges `FIELD_OVERRIDES` (l.147-181) pour `impaye-precontentieux` (mêmes ids, libellés « Débiteur », « Date de la facture », « Montant dû », « Échéance de paiement », « Historique des relances ») et `rh` (`counterparty`=« Salarié concerné », `startDate`=« Date d'embauche », `deadline`, `situation` — **pas de champ `amount`**). **Aucun champ obligatoire, aucune validation** (montant non numérique accepté). `handleInfoSubmit` (l.271-286) recopie toutes les entrées `FormData` dans `answers` + `answers.profil` | 706-780 |
| 4 | « Ajoutez vos documents. » | `StepDocuments` | `<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt">` (l.813-822) ; liste avec « Retirer » ; **aucune limite de taille ni de nombre, aucun contrôle MIME côté JS** ; le texte promet « glissez-déposez » (l.811) mais **aucun gestionnaire `onDrop`/`onDragOver` n'existe** (l.806-823) ; bouton « Continuer » / « Passer cette étape » | 782-864 |
| 5 | « Récapitulatif avant transmission. » | `StepRecap` | Récap nom, profil, champs, nombre de pièces ; badge « Brouillon » ; case « Option — question IA préparatoire » **uniquement si `typology === "impaye-precontentieux"`** (l.306, 944-960) ; encart « Transmission » ; bouton « ← Modifier » (retour étape 3) ; deux boutons d'envoi « E-mail » et « WhatsApp » | 866-1003 |

**Finalisation** (`finalize`, l.381-399) :
1. `setSubmitting(true)` ; `await persistDossier()`.
2. `persistDossier` (l.332-379) : `insert` dans `dossiers` avec `status: "transmis"` (l.348) — **jamais `brouillon`** : le dossier est créé directement au statut « Transmis » ; `title` retombe sur le libellé de catégorie si vide (l.345, défensif — le titre est déjà obligatoire à l'étape 2) ; `answers` = réponses + `profil` (l.336-339) ; `legal_review_requested = isPreContentieux && legalReview` (l.347).
3. Pour chaque fichier : `storage.upload` puis `insert dossier_documents` (l.359-373). Les uploads sont **séquentiels** (`for … await`). Un échec d'upload est **silencieux** (pas de `saveWarning`, fichier simplement absent).
4. Puis, **quel que soit le résultat**, `buildSynthesis()` (l.308-330) construit un texte contenant profil, nom du dossier, catégorie, toutes les réponses (dont `situation` et `amount`), nombre de pièces, option IA, et **l'e-mail du compte** (l.327) ; envoi via `openWhatsApp(synthesis)` (`src/lib/whatsapp.ts:12-20`, `wa.me/33782983644`) ou `mailto:contact.clairdossier@icloud.com` (l.39, 388-390).
5. `setDone(true)` ; suppression du brouillon localStorage (l.395).
6. Écran `SuccessCard` (l.1005-1048) : « Dossier enregistré et transmis » + éventuel `saveWarning` en ambre (« Le dossier n'a pas pu être enregistré dans votre compte, mais l'envoi a bien été préparé. », l.353-356, 375-377).

**Remarques factuelles** :
- Le titre de l'écran final dit « Dossier transmis. » (l.419) même si seule la persistance a eu lieu : la « transmission » réelle dépend de l'action de l'utilisateur dans WhatsApp / son client mail.
- Le bouton de l'étape 5 porte le badge « Brouillon » (l.898, 905) alors que l'insert se fait en `transmis`.
- `Seo` de la page n'a **pas** `noindex` (l.403-411), contrairement à `/connexion`, `/inscription`, `/compte` et au détail (Login.tsx:40, Signup.tsx:57, Account.tsx:86, DossierDetail.tsx:434).
- Aucun double-submit guard au-delà de `disabled={submitting}` (l.984, 992).

### 4.2 Liste des dossiers — `/compte`, `src/pages/Account.tsx`

| Élément | Détail | Lignes |
|---|---|---|
| Chargement | `rpc('is_admin')` → `select dossiers` (sans filtre, RLS) → si admin : `select profiles` + `rpc('admin_user_emails')` | 38-77 |
| Bannière « Abonnement confirmé » | affichée si `?paid=<qqch>` est présent dans l'URL — **aucune vérification** | 31, 89-98 |
| Bannière « Espace administrateur » | si `isAdmin` | 100-110 |
| En-tête | « Bonjour, {user.email} » ; bouton « Se déconnecter » | 112-128 |
| Titre de liste | « Tous les dossiers (N) » (admin) / « Vos dossiers » | 130-133 |
| CTA | « Créer un dossier » → `/dossier/nouveau` | 134-140 |
| État vide | texte différent admin / client | 145-152 |
| Ligne de dossier | lien `/compte/dossier/{id}` ; `title || typology` ; pour l'admin : `company_name || full_name` · e-mail (ou `user_id` tronqué à 8 car.) ; date `fr-FR` ; pastille statut | 154-190 |
| `STATUS_LABELS` | `brouillon`, `transmis`, `en-cours`, `valide`, `archive` ; sinon le code brut | 19-25, 178 |

Pas de pagination, pas de recherche, pas de filtre, pas de tri configurable, pas de suppression ni de renommage de dossier, pas d'édition du profil, pas d'information d'abonnement réelle.

### 4.3 Détail du dossier — `/compte/dossier/:id`, `src/pages/DossierDetail.tsx`

**Chargement** (l.232-298) : `select dossiers .eq('id', id).maybeSingle()` ; `rpc('is_admin')` ; si admin et propriétaire ≠ utilisateur courant, `rpc('admin_user_emails')` pour l'e-mail du propriétaire (l.257-268) ; `select dossier_documents` ; pré-génération d'**une URL signée 1 h par document** (l.280-291). Dossier absent (ou non autorisé par RLS) → « Dossier introuvable » (l.448-463).

**En-tête** (l.466-499) : catégorie (`TYPOLOGY_LABELS`, l.35-52, incluant 7 anciennes typologies `litige-commercial`, `recouvrement`, `bail`, `consommation`, `prud-hommes`, `divorce`, `succession` « conservées pour les dossiers déjà enregistrés »), titre, pour l'admin « Propriétaire · e-mail » (l.481-486), date de création, pastille statut.

**Onglets** (`TABS`, l.145-150, `role="tablist"` l.502-522) :

| Onglet (`id`) | Libellé | Contenu | Lignes |
|---|---|---|---|
| `apercu` | Vue d'ensemble | Frise « Avancement du dossier » 5 étapes (`TIMELINE`, l.56-62) cliquables → panneau `STEP_PANELS` (l.65-71) ; message dynamique `STEP_MESSAGES[step]` (l.74-80) ; carte « Ce que vous devez faire maintenant » `STEP_NEXT_ACTIONS[step]` (l.83-89) | 524-623 |
| `pieces` | Pièces | Liste des documents `kind !== 'deliverable'` (l.309) ; bouton admin « Télécharger toutes les pièces (N) » → zip (l.632-648) ; chaque ligne `DocLine` : « Visualiser » (URL signée, `target=_blank`) + « Télécharger » (même URL + `?download=<file_name>`) ; **pas de bouton Supprimer** sur les pièces client (l.656-662 : `onDelete` non passé) | 625-666 |
| `echeances` | Échéances | `dateEntries` = entrées d'`answers` dont la clé matche `/date|deadline|echeance|échéance/i` (l.139-141) ; libellés via `ANSWER_LABELS` (l.109-132) ; encart « Situation » ; badge « Préavis juridique demandé » si `legal_review_requested` | 750-795 |
| `dashboard` | DashBoard ClairDossier | Livrables `kind === 'deliverable'` ; bouton « Tout télécharger » si > 1 livrable (l.674-688, **visible client et admin**) ; `DocLine` avec « Supprimer » **admin seulement** (l.704-706) ; zone admin « Livrer le travail au client » (`<input type="file" multiple>`, sans `accept`, l.714-746) | 668-748 |

**Étape courante** (`currentStep`, l.92-106) : `brouillon`→1, `transmis`/`en-cours`→3, `valide`→4, `archive`→5, défaut 1. Comme tous les dossiers sont créés en `transmis` (§4.1) et qu'aucun `update` n'existe dans le frontend, **tout dossier s'affiche à l'étape 3 « Suivi du dossier »** tant que le statut n'est pas modifié hors application (SQL/console Supabase). Les étapes 1-2 apparaissent cochées d'office. Les libellés `ANSWER_LABELS` (l.109-132) correspondent majoritairement aux anciennes typologies : pour le tunnel actuel, `counterparty` est rendu « Partie adverse » (l.110) et `startDate` « Date d'entrée dans les lieux » (l.121) — y compris pour un dossier `rh` où le champ signifie « Date d'embauche » (DossierFlow.tsx:167).

**Visualisation / téléchargement unitaire** (`DocLine`, l.154-213) : URL signée 1 h ; le lien « Télécharger » ajoute `download=<nom>` (l.166-168). Les liens expirent après 1 h sans rafraîchissement automatique (pas de timer ; seul `reloadDocuments` les régénère, l.313-332).

**Téléchargement groupé** (`downloadZip`, l.367-401) : dépendance `fflate` (`zipSync`, l.3 ; `package.json:15` `fflate ^0.8.3`). Pour chaque document : `fetch(URL signée)` → `Uint8Array` ; doublons de nom préfixés `copie-` ; zip sans compression (`level: 0`, l.388) ; téléchargement via `<a download>` + `URL.createObjectURL` (l.389-397). Tout est **en mémoire navigateur** (pas de streaming). En cas d'échec total : `deliverError` « Téléchargement indisponible pour le moment. » (l.385) — affiché **uniquement dans l'onglet `dashboard`** (l.740-744), donc invisible si l'échec vient du bouton de l'onglet `pieces`.

**Livrables** (`handleDeliver`, l.336-364, UI admin) : upload sous `${dossier.user_id}/${dossier.id}/deliverable-…` puis insert `dossier_documents` avec `user_id = dossier.user_id` et `kind = 'deliverable'` — le fichier est rattaché au **client** pour que ses policies `_own` lui donnent accès (commentaire l.334-335, 350). Autorisé côté SQL par `docs_insert_admin` / `docs_storage_insert_admin` (`…_dossier_deliverables.sql:23-29`).

**Suppression** (`handleDelete`, l.403-426, UI admin) : `window.confirm` puis `storage.remove` (résultat ignoré) puis `delete dossier_documents .eq('id')`. Côté SQL : `docs_delete_admin` / `docs_storage_delete_admin` (`…_admin_delete_documents.sql:6-12`). Le bouton n'est proposé que sur les **livrables** (l.704-706) ; la suppression des pièces client n'est pas exposée dans l'UI (bien que la policy `docs_delete_own` existe côté SQL, `…_init.sql:63`). Aucune suppression de dossier entier.

**Bloc « Garanties »** (l.797-808) : texte « Aucun envoi ne sera effectué sans votre confirmation. … doit pouvoir être vérifiée ou validée par un professionnel habilité ».

### 4.4 Rôle admin

| Aspect | Détail | Source |
|---|---|---|
| Détection | `supabase.rpc('is_admin')` → `data === true` ; aucun claim JWT, aucun rôle dans `user.app_metadata` | Account.tsx:42-43 ; DossierDetail.tsx:253-254 |
| Définition SQL | `public.is_admin()` = `exists (select 1 from app_admins where user_id = auth.uid())`, `security definer`, exécutable par `authenticated` | `…_admin_global_access.sql:25-35` |
| Peuplement | un seul admin inséré par e-mail codé en dur dans la migration (`prestige.seller@icloud.com`) | `…_admin_global_access.sql:20-22` |
| Lecture de tous les dossiers | policy `dossiers_select_admin` (`using is_admin()`), idem `docs_select_admin`, `profiles_select_admin`, `docs_storage_select_admin` — le frontend ne change pas sa requête, c'est la RLS qui élargit | `…_admin_global_access.sql:39-53` ; Account.tsx:45-50 |
| E-mail du propriétaire | `admin_user_emails()` `security definer` sur `auth.users`, filtrée par `where is_admin()` | `…_admin_user_emails.sql:6-19` ; Account.tsx:60-64 ; DossierDetail.tsx:257-268 |
| Nom/société du propriétaire | `select profiles` | Account.tsx:55-59 |
| Livrer des fichiers | §4.3 | DossierDetail.tsx:336-364, 714-746 |
| Supprimer un livrable | §4.3 | DossierDetail.tsx:403-426 |
| Télécharger toutes les pièces (.zip) | bouton réservé admin dans l'onglet `pieces` | DossierDetail.tsx:632-648 |
| Ce que l'admin **ne peut pas** faire depuis l'UI | changer le statut d'un dossier, éditer/supprimer un dossier, gérer les comptes, voir les abonnements, supprimer une pièce client | absence de code (§3) |
| Route admin dédiée | aucune ; l'admin utilise `/compte` et `/compte/dossier/:id` avec bannière | App.tsx ; Account.tsx:100-110 |

Le flag admin est **purement cosmétique côté client** : les capacités réelles reposent sur les policies RLS et les fonctions `security definer`. Un client qui forcerait `isAdmin=true` verrait les boutons mais ses requêtes seraient bloquées par RLS (à condition que les policies soient bien déployées en production — non vérifiable ici).

### 4.5 Notifications (« notifications RGPD »)

Aucune notification n'est émise par le frontend. La chaîne est entièrement backend :
- Trigger `on_new_profile_notify` (after insert `profiles`) et `on_new_dossier_notify` (after insert `dossiers`) → `notify_lead()` → `net.http_post` vers l'Edge Function `notify-lead` avec **`record = to_jsonb(new)` complet** (`…_dossier_lead_notification.sql:7-34`). Le jeton `Authorization` est la clé anon, écrite en clair dans la migration (l.18).
- `supabase/functions/notify-lead/index.ts` : e-mail Resend vers `prestige.seller@icloud.com` (l.8), objet « nouveau compte » / « nouveau dossier » (l.27, 31), corps = intro générique + 8 premiers caractères de l'`id` + lien `/compte` ou `/compte/dossier/{id}` (l.21-33). Commentaire l.16-19 : minimisation RGPD volontaire (pas de nom, titre, typologie, montant dans l'e-mail).
- Le client, lui, **ne reçoit aucun e-mail transactionnel applicatif** (ni confirmation de création de dossier, ni notification de livrable). Seuls les e-mails Supabase Auth (confirmation d'inscription si activée) peuvent lui parvenir.
- Pas de bandeau cookies dans l'application (grep `consent|cookie` sur `src/` : occurrences uniquement dans `src/data/legal.ts` — page `/cookies` déclarant des cookies « strictement nécessaires » uniquement, l.394, 412).

### 4.6 Abonnement / paiement
- Tarifs : liens Stripe Payment Links codés en dur dans `src/data/pricing.ts:45-182` (`https://buy.stripe.com/…`).
- Retour Stripe : `after_completion.redirect.url = ${SITE_URL}/compte?paid=<planId>` (`scripts/create-stripe-products.mjs:82-84`, `scripts/add-annual-prices.mjs:53-55`).
- Côté application : `Account.tsx:31, 89-98` affiche « Abonnement confirmé … Votre abonnement est actif. » dès que `?paid` est présent. **Aucune table d'abonnement, aucun webhook, aucun champ de plan n'est lu dans le frontend** (grep `stripe|subscription|abonnement|checkout` sur `src/` : uniquement contenus marketing/légaux, `Signup.tsx:68-69` et `Account.tsx`). Toutes les fonctionnalités (création illimitée de dossiers, upload, détail) sont accessibles à tout compte connecté sans condition.

---

## 5. Tableau récapitulatif des fonctionnalités

| Fonctionnalité | Route + fichier | Utilisateur | Dépendances (tables / buckets / fonctions / libs) | État | Test existant |
|---|---|---|---|---|---|
| Inscription | `/inscription` — `src/pages/Signup.tsx`, `src/lib/auth.tsx:75-91` | visiteur | Supabase Auth `signUp` ; trigger `handle_new_user` → `profiles` ; trigger `notify_lead` | **Partiel** : fonctionne, mais cas « confirmation e-mail » non géré (redirige vers `/compte` sans session) | aucun |
| Connexion | `/connexion` — `src/pages/Login.tsx`, `auth.tsx:93-99` | visiteur | Supabase Auth `signInWithPassword` | Fonctionnel | aucun |
| Déconnexion | `/compte` — `src/pages/Account.tsx:79-82`, `auth.tsx:101-104` | client/admin | Supabase Auth `signOut` | Fonctionnel (sans gestion d'erreur) | aucun |
| Persistance / rafraîchissement de session | `src/lib/supabase.ts:17-24`, `auth.tsx:55-73` | tous | localStorage `clairdossier-auth` | Fonctionnel | aucun |
| Garde de route | `src/components/RequireAuth.tsx` | tous | contexte auth | Fonctionnel ; **désactivée si env manquante** | aucun |
| Réinitialisation mot de passe | — | — | — | **Inexistant** | — |
| Modification profil / e-mail / mot de passe | — | — | — | **Inexistant** | — |
| Nav connectée | `src/components/Nav.tsx:70-84, 167-183` | client/admin | `session` | Fonctionnel (pas de bouton déconnexion) | aucun |
| Tunnel création de dossier (5 étapes) | `/dossier/nouveau` — `src/pages/DossierFlow.tsx` | client/admin | localStorage `clairdossier_draft` ; `dossiers` (insert) ; bucket `documents` (upload) ; `dossier_documents` (insert) ; `src/lib/whatsapp.ts` ; `mailto:` | **Partiel** : persistance OK ; statut forcé `transmis` ; échec d'upload silencieux ; glisser-déposer annoncé mais non implémenté ; fichiers non persistés au rechargement | aucun |
| Transmission WhatsApp / e-mail | idem, l.381-399 | client | `wa.me`, `mailto:` | **Simulé / manuel** : l'app ouvre une app tierce avec un texte pré-rempli, l'envoi dépend de l'utilisateur ; l'écran affiche « Dossier transmis. » dans tous les cas | aucun |
| Option « question IA préparatoire » | idem, l.943-960 | client (typologie `impaye-precontentieux`) | colonne `dossiers.legal_review_requested` | **Simulé** : simple booléen stocké + mention dans la synthèse ; aucun traitement IA | aucun |
| Liste des dossiers | `/compte` — `src/pages/Account.tsx` | client | `dossiers` (select), RLS `dossiers_select_own` | Fonctionnel (pas de pagination) | aucun |
| Liste de tous les dossiers + identité propriétaire | `/compte` — `Account.tsx:41-65` | admin | `is_admin()`, `profiles`, `admin_user_emails()`, policies `*_select_admin` | Fonctionnel | aucun |
| Bannière « Abonnement confirmé » | `/compte?paid=…` — `Account.tsx:31, 89-98` | client | paramètre d'URL uniquement | **Simulé** (aucune vérification) | aucun |
| Détail — onglet Vue d'ensemble (frise 5 étapes, messages) | `/compte/dossier/:id` — `DossierDetail.tsx:524-623` | client/admin | `dossiers.status` | **Partiel** : frise fonctionnelle mais statut jamais mis à jour par l'app → toujours étape 3 | aucun |
| Détail — onglet Pièces (visualiser / télécharger) | `DossierDetail.tsx:625-666, 154-213` | client/admin | `dossier_documents`, bucket `documents` (`createSignedUrl` 1 h) | Fonctionnel (liens expirent après 1 h sans régénération) | aucun |
| Détail — zip de toutes les pièces | `DossierDetail.tsx:367-401, 632-648` | admin (UI) | `fflate`, `fetch` sur URL signées | Fonctionnel (en mémoire ; erreur affichée dans le mauvais onglet) | aucun |
| Détail — onglet Échéances | `DossierDetail.tsx:750-795` | client/admin | `dossiers.answers` | **Partiel** : détection par regex sur les clés ; libellés hérités d'anciennes typologies | aucun |
| Détail — onglet DashBoard (livrables, zip) | `DossierDetail.tsx:668-712` | client/admin | `dossier_documents.kind`, bucket | Fonctionnel | aucun |
| Livrer des fichiers au client | `DossierDetail.tsx:336-364, 714-746` | admin | bucket `documents` (insert admin), `dossier_documents` (insert admin), `is_admin()` | Fonctionnel | aucun |
| Supprimer un livrable | `DossierDetail.tsx:403-426` | admin | policies `docs_delete_admin`, `docs_storage_delete_admin` | Fonctionnel (erreur storage ignorée) | aucun |
| Supprimer une pièce client / un dossier | — | — | policies `docs_delete_own`, `dossiers_delete_own` existent côté SQL | **Inexistant dans l'UI** | — |
| Changer le statut d'un dossier | — | — | policy `dossiers_update_own` existe | **Inexistant dans l'UI** (ni client ni admin) | — |
| Notifications e-mail à l'équipe | backend : trigger `notify_lead` + `supabase/functions/notify-lead/index.ts` | équipe | `pg_net`, Resend | Fonctionnel (non vérifiable depuis le frontend) | aucun |
| Notifications e-mail au client | — | — | — | **Inexistant** | — |
| Export RGPD / suppression de compte | — (promis dans `src/data/faq.ts:48, 54` : « via le contact ») | — | — | **Inexistant dans l'UI** (processus manuel) | — |

---

## 6. Clés localStorage / sessionStorage

| Clé | Type | Contenu | Écrit par | Lu par | Supprimé par |
|---|---|---|---|---|---|
| `clairdossier-auth` | localStorage | Session Supabase (access token JWT, refresh token, `user` avec e-mail et `user_metadata` : `full_name`, `company_name`, `company_type`) | supabase-js (`storageKey`, `src/lib/supabase.ts:22`) | supabase-js (`getSession`, auth.tsx:61) | `signOut` (auth.tsx:102) |
| `clairdossier_draft` | localStorage | JSON `Draft` : `profil`, `typology`, `title`, `answers` (dont `counterparty`, `amount`, `situation`…), `step`, `updatedAt` | `DossierFlow.tsx:233` (à chaque changement) | `DossierFlow.tsx:211` | `DossierFlow.tsx:297` (reset), `:395` (finalisation) |
| BroadcastChannel `clairdossier-auth` | (pas un stockage) | synchro de session inter-onglets | supabase-js (GoTrueClient.js:242) | idem | — |

**`sessionStorage` : aucune utilisation** (grep `sessionStorage` sur `src/` : 0 résultat). Aucun cookie posé par le code applicatif (grep `document.cookie` : 0 résultat — vérifié implicitement par le grep `cookie` qui ne renvoie que `src/data/legal.ts`).

Note : supabase-js peut écrire d'autres clés dérivées de `storageKey` (ex. `-code-verifier` pour PKCE) ; je n'ai pas vérifié le flux (`flowType`) utilisé par défaut dans cette version — non lu.

---

## 7. Points de fragilité et risques

Classement indicatif : **H** (élevé), **M** (moyen), **B** (faible). Il s'agit d'observations sur le code lu ; l'état réel de la configuration Supabase/Stripe en production n'a pas été vérifié.

### 7.1 Sécurité et contrôle d'accès

| # | Niveau | Constat | Source |
|---|---|---|---|
| S1 | H | **Garde de route désactivée si les variables d'env manquent** : `RequireAuth` laisse passer quand `configured === false`. Un build sans `VITE_SUPABASE_*` expose `/compte`, `/dossier/nouveau`, `/compte/dossier/:id` sans authentification (sans données, mais avec l'UI). Le build GitHub Pages injecte les variables (deploy.yml:44-47) ; Netlify dépend de ses env vars (non vérifiables ici, `.gitignore:15` indique qu'elles vivent dans Netlify). | RequireAuth.tsx:24-27 ; supabase.ts:6, 17 |
| S2 | H | **Aucun gating d'abonnement** : tout compte connecté accède à tout ; la bannière « Abonnement confirmé » se déclenche sur un simple `?paid=x` dans l'URL, sans webhook ni table. Le texte marketing (Signup.tsx:68-69) annonce qu'un abonnement est « nécessaire pour aller plus loin », ce qui n'est pas implémenté. | Account.tsx:31, 89-98 ; scripts/create-stripe-products.mjs:82-84 |
| S3 | M | **Toute la sécurité des données repose sur la RLS** : les requêtes de liste ne filtrent pas par `user_id` (Account.tsx:47-50), et le détail ne vérifie pas `row.user_id === user.id` (DossierDetail.tsx:241-250). Correct si et seulement si les policies des migrations sont déployées à l'identique en production. | §3 #7, #13, #16 |
| S4 | M | **Admin = un seul e-mail codé en dur dans une migration** ; aucune interface de gestion ; `is_admin()` appelé à chaque page (2 RPC par visite du détail). | `…_admin_global_access.sql:20-22` |
| S5 | M | **Données personnelles dans la session localStorage** : `user_metadata` (nom, société) et e-mail sont lisibles par tout script s'exécutant sur l'origine. CSP `script-src 'self'` côté Netlify (netlify.toml:25) limite le risque ; **aucun en-tête de sécurité n'est défini pour le déploiement GitHub Pages** (deploy.yml ne configure rien, et Pages ne lit pas `netlify.toml`). Le domaine pointe sur Pages (deploy.yml:3-6). | supabase.ts:19-22 ; netlify.toml:19-25 ; deploy.yml:3-6 |
| S6 | M | **Brouillon localStorage non cloisonné par utilisateur** et contenant des données sensibles (`situation`, montant, contrepartie) ; il persiste après déconnexion (non effacé par `signOut`) et est lisible par le compte suivant sur le même navigateur. | DossierFlow.tsx:38, 233 ; auth.tsx:101-104 |
| S7 | M | **Synthèse envoyée à WhatsApp / mailto** contient l'e-mail du compte, le montant, la situation, le nom de la contrepartie : données personnelles transitant par des canaux tiers (Meta, client mail), à l'initiative de l'utilisateur. Le numéro WhatsApp (`33782983644`) et l'adresse (`contact.clairdossier@icloud.com`) sont codés en dur. | DossierFlow.tsx:39, 308-330, 385-391 ; whatsapp.ts:5 |
| S8 | M | **Clé anon Supabase écrite en clair dans le workflow CI et dans une migration SQL** (`notify_lead`, en-tête `Authorization`). C'est une clé publique par conception, mais l'Edge Function `notify-lead` accepte donc tout appel porteur de la clé anon : n'importe qui connaissant l'URL peut déclencher des e-mails vers l'adresse admin (pas de vérification de secret/signature dans `index.ts:10-14`). | deploy.yml:47 ; `…_dossier_lead_notification.sql:18` ; notify-lead/index.ts:10-14 |
| S9 | B | **Uploads sans contrôle de taille, de type MIME ni de nombre** côté client (`accept` seulement, contournable ; zone admin sans `accept` du tout). Limites éventuelles côté bucket non vérifiées. | DossierFlow.tsx:813-822 ; DossierDetail.tsx:725-734 |
| S10 | B | **`next` non validé** dans Login/Signup (redirection interne arbitraire). | Login.tsx:11, 28 ; Signup.tsx:20, 48 |
| S11 | B | URLs signées valables 1 h partagées telles quelles dans le DOM (`href`), copiables ; comportement attendu de Supabase mais sans révocation possible. | DossierDetail.tsx:166-168, 182-195, 284-286 |
| S12 | B | `window.confirm` natif pour une suppression définitive ; `storage.remove` non vérifié → possible orphelin (ligne DB supprimée / fichier restant, ou l'inverse). | DossierDetail.tsx:405-419 |

### 7.2 Fonctionnel / cohérence

| # | Niveau | Constat | Source |
|---|---|---|---|
| F1 | H | **Inscription avec confirmation e-mail non gérée** : pas d'écran intermédiaire, redirection vers `/compte` puis rebond vers `/connexion` sans message. Si la confirmation est active en prod (config locale : `enable_confirmations = true`), l'expérience est cassée pour chaque nouvel inscrit. | Signup.tsx:44-48 ; auth.tsx:88-90 ; config.toml:205 |
| F2 | H | **Statut de dossier jamais mis à jour** : insert en `transmis` (jamais `brouillon`), aucun `update` dans le frontend ni écran admin ; la frise d'avancement, les messages dynamiques et « Ce que vous devez faire maintenant » sont donc **figés à l'étape 3** pour tous les dossiers, sauf modification manuelle en base. | DossierFlow.tsx:348 ; DossierDetail.tsx:92-106 ; §3 |
| F3 | M | **Trois vocabulaires de statuts divergents** : (a) `src/data/statuses.ts:10-64` (marketing, utilisé par `src/components/sections/Workflow.tsx:9, 52, 61`) : `brouillon`, `complete`, `attente-avocat`, `validation`, `valide`, `archive` ; (b) `STATUS_LABELS` de l'app : `brouillon`, `transmis`, `en-cours`, `valide`, `archive` (Account.tsx:19-25 ; DossierDetail.tsx:27-33) ; (c) valeur SQL par défaut `brouillon` (`…_init.sql:25`) et valeur insérée `transmis`. Aucune contrainte `check` sur `dossiers.status` (colonne `text`, l.25). `statuses.ts` n'est pas utilisé par l'espace client. | fichiers cités |
| F4 | M | **Échec d'upload silencieux** dans le tunnel : si `storage.upload` échoue, le fichier est ignoré sans avertissement ; l'écran final annonce « N document(s) déposé(s) » dans la synthèse d'après `files.length` et non d'après les uploads réussis. | DossierFlow.tsx:359-373, 315-317 |
| F5 | M | **Glisser-déposer annoncé mais non implémenté** (« ou glissez-déposez ») : aucun `onDrop`. | DossierFlow.tsx:806-823 |
| F6 | M | **Fichiers et option IA perdus au rechargement** du tunnel (non persistés), alors que le badge « Brouillon restauré » suggère une restauration complète. | DossierFlow.tsx:202-203, 431-436 |
| F7 | M | **Libellés d'échéances/champs hérités** : `ANSWER_LABELS` mappe `counterparty` → « Partie adverse » et `startDate` → « Date d'entrée dans les lieux » pour toutes les typologies actuelles (y compris RH où c'est la date d'embauche). L'onglet Échéances n'affiche pas le profil (`answers.profil`) mais celui-ci n'est pas une date, donc sans effet. | DossierDetail.tsx:109-141 ; DossierFlow.tsx:117-181 |
| F8 | M | **Erreurs réseau/RLS non remontées** sur `/compte` et le détail (les `error` sont ignorés) : une panne s'affiche comme « Aucun dossier » ou « Dossier introuvable ». | Account.tsx:42-65 ; DossierDetail.tsx:241-291 |
| F9 | B | **Double `rpc('is_admin')`** (liste puis détail) et **`admin_user_emails()` renvoie tous les utilisateurs** pour n'en chercher qu'un (détail) — coût croissant avec le nombre de comptes. | DossierDetail.tsx:253, 261-264 ; Account.tsx:42, 61 |
| F10 | B | **Une URL signée par document générée au chargement** (N appels), même si l'utilisateur n'ouvre jamais l'onglet Pièces ; expiration 1 h sans régénération automatique. | DossierDetail.tsx:280-291 |
| F11 | B | **Zip en mémoire** (`zipSync`, `level: 0`) : risque de saturation mémoire navigateur sur de gros dossiers ; message d'erreur affiché dans l'onglet `dashboard` même quand l'action vient de l'onglet `pieces`. | DossierDetail.tsx:367-401, 740-744 |
| F12 | B | **Message d'erreur Supabase incohérent** : « 6 caractères minimum » (auth.tsx:44) vs exigence de 8 (Signup.tsx:33-34, 121 ; config.toml:171). Messages non traduits affichés bruts (auth.tsx:48). | fichiers cités |
| F13 | B | Utilisateur connecté pouvant revisiter `/connexion` et `/inscription` (pas de redirection) ; pas de bouton « Se déconnecter » dans la Nav. | Login.tsx ; Signup.tsx ; Nav.tsx:70-84 |
| F14 | B | `/dossier/nouveau` indexable (`Seo` sans `noindex`) alors qu'elle est derrière `RequireAuth`. | DossierFlow.tsx:403-411 |
| F15 | B | `isSupabaseConfigured` piloté par `import.meta.env` : un client « placeholder » est créé même sans config (supabase.ts:17) ; toute requête hors auth sur ce client échouerait silencieusement (erreurs ignorées, F8). | supabase.ts:17 |

### 7.3 Qualité / maintenabilité
- **Aucun test** (§0.4), aucun lint déclaré dans `package.json` (scripts l.6-12 : `dev`, `gen:md`, `build`, `preview`, `typecheck`).
- Types `DossierRow` dupliqués entre `Account.tsx:8-15` et `DossierDetail.tsx:9-18` ; `STATUS_LABELS` dupliqué (Account.tsx:19-25 / DossierDetail.tsx:27-33) ; `inputCls` dupliqué (Login.tsx:31-32, Signup.tsx:169-170, DossierFlow.tsx:718-719).
- Aucun typage généré des tables Supabase (appels non typés, casts `as DossierRow[] | null`).
- Pas de typage des variables d'environnement (`vite-env.d.ts:1`).

---

## 8. Synthèse

L'espace authentifié est un **MVP fonctionnel mais mince** : inscription/connexion par e-mail + mot de passe (sans reset, sans gestion de profil), un tunnel de création de dossier en 5 étapes persisté en `localStorage` (`clairdossier_draft`) puis inséré en base au statut `transmis` avec upload des pièces dans le bucket privé `documents`, une liste de dossiers, et une page détail à 4 onglets (frise d'avancement, pièces, échéances, livrables). Un administrateur unique (défini en SQL) voit tout via la RLS, obtient l'e-mail des propriétaires par RPC, peut livrer et supprimer des fichiers et zipper les pièces (fflate, côté client).

Les trois écarts les plus structurants pour la suite : (1) **aucun gating d'abonnement** et une bannière « abonnement confirmé » déclenchée par un simple paramètre d'URL ; (2) **statut de dossier jamais mis à jour** par l'application, rendant la frise d'avancement figée ; (3) **cas de confirmation e-mail non géré** à l'inscription. S'y ajoutent l'absence totale de tests, la garde de route qui se désactive sans variables d'env, et un brouillon localStorage non cloisonné contenant des données sensibles.
