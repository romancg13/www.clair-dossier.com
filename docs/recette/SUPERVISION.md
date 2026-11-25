# Centre de supervision fondateur — recette (2026-11-25)

> Statut : **PROPOSITION DE RECETTE.** Rien n'est appliqué en production : la migration
> n'est installée sur aucun projet Supabase distant, aucun serveur n'est déployé.
> Implémentation : `supabase/migrations/20261125140000_supervision_fondateur.sql`
> (retour arrière : `supabase/rollback/20261125140000_supervision_fondateur.down.sql`),
> écran `src/components/admin/AdminSupervision.tsx` (onglet « Supervision » de `/admin`),
> logique pure `src/lib/supervision.ts`, tests `tests/supervision.test.ts` et
> `tests/sql/migrations.pglite.mjs` (blocs « Supervision »).

## Ce qui existait déjà (inchangé, non dupliqué)

| Besoin | Où |
|---|---|
| File et états par dossier, validation, rejet, relance d'un travail | onglet « IA privée » (`ai_admin_overview`, `ai_retry_job`) |
| Bilan de santé quotidien, coût global du mois | « IA privée » (`ai_health_reports`, `ai_admin_month_cost`) |
| Abonnements par client, dérogations | onglet « Abonnements » (`admin_list_entitlements`, super admin) |
| Journal d'audit complet | onglet « Activité » (`audit_logs`, super admin) |
| Arrêt d'urgence serveur | secret `AI_ENGINE_PAUSED=1` de la fonction `ai-worker` |

## Ce que la supervision ajoute

Une seule lecture, `admin_supervision_overview()` (security definer, `search_path` fixé,
`is_admin()` exigé, refus `FORBIDDEN` sinon ; `anon` n'a pas le droit d'exécution) :

- **file** : travaux par statut et par type, bloqués (même définition que le bilan quotidien),
  reprises en cours, échecs 24 h, tentatives épuisées sur 7 jours, dossiers à échecs multiples,
  échecs sur 30 jours **par catégorie** (budget ou quota / interruption / autre) ;
- **traitements du mois** : extractions (réussies, non prises en charge, en erreur), pages lues, analyses ;
- **e-mails entrants** : reçus, stockés, rejetés, en erreur (30 jours), adresses actives ;
- **abonnements (lecture)** : lignes par statut, abonnements en cours par offre, résiliations programmées,
  dérogations actives (super admin seulement) ;
- **par compte** (200 premiers, tri coût → quota → volume) : offre, statut, coût IA du mois, pages et
  actions consommées / plafond, pourcentage de quota, octets stockés, fichiers, dossiers ;
- **alertes** : `QUOTA_80`, `QUOTA_ATTEINT`, `BUDGET_GLOBAL_80`, `BUDGET_GLOBAL_ATTEINT`, `PAUSES_BUDGET`,
  `FILE_BLOQUEE`, `ECHECS_REPETES`, `EMAILS_EN_ERREUR`, `MOTEUR_EN_PAUSE` — chacune est un constat mesuré ;
- **actions d'administration** : 30 dernières et décompte sur 30 jours — **super admin seulement**
  (même règle que la policy `audit_select_super`), sans les métadonnées.

**Jamais renvoyé** : contenu ou nom de pièce, titre de dossier, texte extrait, analyse, libellé d'erreur,
objet ou expéditeur d'e-mail, adresse e-mail de compte, motif de pause, identifiant Stripe. Les comptes
sont désignés par leur identifiant ; la console associe l'e-mail avec `admin_user_emails`, déjà existante.

### Pause des traitements

`ai_admin_set_pause(true, motif)` (motif ≥ 3 caractères, journalisé dans `audit_logs`) pose un drapeau dans
`ai_engine_control` ; `ai_claim_jobs` — même corps qu'en 20261023, précédé de ce seul contrôle — ne réclame
alors plus rien. Les travaux restent en file et repartent à `ai_admin_set_pause(false)`. Un travail déjà
en cours se termine. Le secret `AI_ENGINE_PAUSED` reste l'arrêt d'urgence prioritaire (il coupe aussi
l'appel lui-même). Pendant une pause, le bilan quotidien existant peut compter des travaux « bloqués » :
c'est attendu ; la supervision n'émet alors pas `FILE_BLOQUEE`.

### Budget global : limite connue

Le plafond réel (`AI_BUDGET_CENTS_GLOBAL_MONTH`) est un secret du worker que la base ne connaît pas.
L'alerte de budget repose donc sur un **repère de surveillance** saisi par l'administrateur
(`ai_admin_set_budget_alert`, journalisé) : 80 % puis 100 %. Sans repère, seule `PAUSES_BUDGET`
(travaux réellement suspendus ce mois) signale la saturation. Le repère ne bloque rien.

## État de vérification

| Élément | État |
|---|---|
| Migration, RPC, pause, retour arrière | VÉRIFIÉ sur PostgreSQL embarqué (PGlite) : non-admin et anonyme refusés, agrégats exacts sur données fictives, absence de contenu, pause/reprise, installation sans le moteur IA |
| Écran « Supervision » | IMPLÉMENTÉ, typé et compilé ; NON TESTÉ dans un navigateur contre une base réelle |
| Application à un projet Supabase | NON FAIT (décision du propriétaire) |
| Suivi depuis Claude Code / ChatGPT (MCP) | DIFFÉRÉ — spécification ci-dessous, aucun code, aucun déploiement |

## Suivi privé depuis Claude Code / ChatGPT — spécification d'un MCP minimal (DIFFÉRÉ)

But : permettre au fondateur de demander « où en est la plateforme ? » depuis son assistant, sans ouvrir
la console et sans donner à l'assistant un accès aux dossiers.

**Périmètre**

- Un seul outil, en lecture : `supervision_overview` (aucun paramètre) → renvoie tel quel le JSON de
  `admin_supervision_overview()`. Annoté lecture seule (`readOnlyHint: true`, `destructiveHint: false`).
- Aucun outil d'écriture : ni pause, ni reprise, ni relance, ni validation. Ces actions restent dans la
  console, derrière une session humaine.
- Aucun accès aux pièces, au stockage, aux tables : le serveur n'appelle **que** cette RPC.

**Authentification et droits**

- OAuth 2.1 avec PKCE, **client distinct** de l'application web (identifiant client propre, URI de
  redirection propres), découverte par les métadonnées standard du protocole MCP. Aucun jeton de la session
  web n'est réutilisé.
- Compte dédié à la supervision, inscrit dans `app_admins` avec le rôle `support` : il passe `is_admin()`
  mais pas `is_super_admin()` — l'historique des actions et les dérogations restent donc masqués.
- Le serveur MCP relaie le jeton de l'utilisateur vers PostgREST (`POST /rest/v1/rpc/admin_supervision_overview`)
  avec la clé publique anon. **Jamais de clé `service_role`** dans le serveur : le contrôle reste celui de
  la base (RLS et garde de la RPC), comme pour la console.
- Jetons d'accès courts (≤ 1 h), jeton de rafraîchissement à rotation.

**Révocation**

- Immédiate et côté base : retirer la ligne `app_admins` du compte de supervision (la RPC répond
  `FORBIDDEN` au prochain appel, même avec un jeton encore valide).
- Complémentaire : révoquer les sessions du compte dans Supabase Auth, puis supprimer le client OAuth.

**Sécurité de contenu**

- La réponse ne contient que des chiffres, des codes et des identifiants : rien qui provienne d'un document
  ou d'un e-mail ne peut y être injecté comme instruction. Si un champ texte y était ajouté un jour, il
  devrait rester traité comme une donnée.
- Journaliser chaque appel côté serveur MCP (horodatage, sujet du jeton) ; limiter le débit (par exemple
  30 appels par heure).

**Avant tout déploiement (décisions du propriétaire)**

1. Appliquer la migration 20261125140000 au projet (après export).
2. Créer le compte de supervision et choisir l'hébergement du serveur MCP.
3. Faire relire la configuration OAuth (URI de redirection, durée des jetons) avant d'y connecter un assistant.
