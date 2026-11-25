# Connexion directe d'une messagerie — proposition de recette (2026-11-25)

> Statut : **implémenté, NON VÉRIFIÉ de bout en bout**. Aucun identifiant OAuth Google ni
> Microsoft n'existe sur cette machine : tout ce qui parle réellement à Google ou à Microsoft
> n'a jamais été exécuté. La logique est prouvée par tests unitaires (réseau simulé) et le
> schéma par tests SQL réels (PGlite). Sans les mises en service ci-dessous, rien ne change
> pour personne : triple garde (build `VITE_MAIL_CONNECT=1`, migration, fonctions déployées).

## Architecture

```
Compte ClairDossier ── « Connecter Gmail / Outlook » (src/components/account/MailConnect.tsx)
  ──► mail-oauth start   : offre vérifiée côté serveur, connexion « pending », URL officielle
                            (state signé 10 min + PKCE S256 ; gmail.readonly | Mail.Read + offline_access)
  ──► Google / Microsoft : consentement de l'utilisateur
  ──► mail-oauth (GET)   : state vérifié, simple relais vers ClairDossier (fragment d'URL)
  ──► mail-oauth finish  : jeton du titulaire exigé, le state doit être celui de CE compte ;
                            échange du code ; jetons chiffrés AES-256-GCM (MAIL_TOKEN_KEY) ;
                            users.watch (Gmail → Pub/Sub) ou abonnement Graph (created, boîte de réception)
Nouveau message
  ──► Gmail : Pub/Sub push (jeton OIDC vérifié)      ┐
  ──► Graph : notification (clientState vérifié)      ├─► mail-sync : relit la boîte DEPUIS LE CURSEUR
  ──► passage planifié (rattrapage, renouvellement)   ┘   (historyId / deltaLink), dédup, périmètre
  ──► dossier certain → pièces autorisées déposées (dossier_documents → documents_ai_enqueue existant)
      sinon → « à classer » + proposition ; rien n'est téléchargé avant le choix du titulaire
```

- **Lecture seule** : aucune permission d'écriture ou d'envoi n'est demandée ; aucun e-mail
  n'est modifié, déplacé, supprimé ni envoyé ; aucun lien contenu dans un e-mail n'est suivi.
  Le contenu d'un e-mail est une **donnée**, jamais une instruction.
- **Périmètre explicite** : seuls les e-mails reçus **à partir de la connexion** (`import_since`),
  dans la boîte de réception (ou le libellé/dossier `scope_label`). L'historique global est
  désactivé (`history_import = false`, aucun code ne l'active — DIFFÉRÉ). Indésirables,
  corbeille, brouillons et envoyés sont écartés ; d'un message hors périmètre, seul
  l'identifiant est gardé.
- **Rattachement automatique seulement s'il est certain** : dossier cible choisi pour la
  connexion, message adressé à l'adresse de réception d'un dossier, ou suite d'un fil déjà
  rattaché. Sinon « à classer », avec au mieux une proposition (expéditeur déjà classé,
  titre du dossier dans le sujet).
- **Statuts** : `pending` → `connected` **uniquement après une première réception réelle**
  (garde en base : déclencheur `mail_connections_guard`) ; `paused` (aucun appel au
  fournisseur ; à la reprise le périmètre repart de maintenant) ; `error` (échec passager,
  curseur inchangé, nouvel essai au passage suivant) ; `revoked` (terminal — autorisation
  retirée chez le fournisseur ou déconnexion : jetons effacés).
- **Jetons** : table `mail_connection_tokens` sans aucune policy ni privilège client ; la base
  refuse toute valeur qui n'a pas le format chiffré `v1.<iv>.<chiffré>` ; le chiffré est lié
  à sa connexion (donnée associée AES-GCM).
- **Offre** : `plan_entitlements.mail_connect` (Entrepreneur et plus, aligné sur
  `email_inbound` ; dérogation par compte), vérifié côté serveur au démarrage, à la
  finalisation, à la reprise et à chaque synchronisation (offre perdue → pause).

## Fichiers

| Rôle | Fichier |
|---|---|
| Schéma, RLS, RPC pause / reprise / déconnexion / classement | `supabase/migrations/20261125130000_messagerie_directe.sql` |
| Retour arrière niveau 1 (jetons effacés, historique conservé) | `supabase/rollback/20261125130000_messagerie_directe.down.sql` |
| Logique pure (URL, state, PKCE, chiffrement, notifications, machine d'état, choix du dossier) | `supabase/functions/_shared/mail-connect.ts` |
| Cœur de synchronisation (réseau et base injectés) | `supabase/functions/_shared/mail-sync-core.ts` |
| Accès base (rôle serveur) | `supabase/functions/_shared/mail-store.ts` |
| Autorisation OAuth | `supabase/functions/mail-oauth/index.ts` |
| Notifications, rattrapage, renouvellement | `supabase/functions/mail-sync/index.ts` |
| Interface | `src/components/account/MailConnect.tsx` (non montée — voir « Montage ») |
| Tests | `tests/mail-connect.test.ts` · `tests/sql/migrations.pglite.mjs` (« Messagerie directe ») |

## Secrets nécessaires (noms seulement — valeurs dans les secrets Supabase, jamais dans le code)

`MAIL_TOKEN_KEY` (32 octets aléatoires en base64 — sa perte rend tous les jetons illisibles,
sa fuite avec la base les expose : la conserver hors de la base) · `MAIL_STATE_SECRET` ·
`MAIL_CRON_SECRET` · `GOOGLE_OAUTH_CLIENT_ID` · `GOOGLE_OAUTH_CLIENT_SECRET` ·
`GMAIL_PUBSUB_TOPIC` · `GMAIL_PUBSUB_AUDIENCE` · `GMAIL_PUBSUB_SERVICE_ACCOUNT` ·
`MICROSOFT_OAUTH_CLIENT_ID` · `MICROSOFT_OAUTH_CLIENT_SECRET` · `MAIL_GRAPH_NOTIFICATION_URL` ·
`MAIL_OAUTH_REDIRECT_URL` · `MAIL_CONNECT_RETURN_URL` · `INBOUND_EMAIL_DOMAIN` (facultatif).

## ACTIONS PROPRIÉTAIRE (dans l'ordre)

**A. Google (Gmail / Workspace)**
1. Créer un projet Google Cloud, activer **Gmail API** et **Cloud Pub/Sub**.
2. Écran de consentement OAuth : type « Externe », nom ClairDossier, domaine
   `clair-dossier.com`, liens vers la politique de confidentialité et les CGV, portée
   `https://www.googleapis.com/auth/gmail.readonly` uniquement.
3. Identifiants → « ID client OAuth » de type **Application Web**, URI de redirection
   = `https://<projet>.supabase.co/functions/v1/mail-oauth`.
4. Pub/Sub : créer un sujet ; donner le rôle **Publisher** sur ce sujet à
   `gmail-api-push@system.gserviceaccount.com` ; créer un abonnement **push** vers
   `https://<projet>.supabase.co/functions/v1/mail-sync?source=gmail` avec
   **authentification** activée (compte de service dédié + audience de votre choix).
5. **Validation OAuth — point bloquant pour l'ouverture au public.** D'après la page
   officielle « Choose Gmail API scopes » consultée le 2026-11-25, `gmail.readonly` est une
   portée **restreinte** : elle exige la *vérification OAuth des portées restreintes* et,
   parce que ClairDossier stocke/transmet ces données sur des serveurs, une **évaluation de
   sécurité** (« If you store restricted scope data on servers (or transmit), then you must
   go through a security assessment »). Tant que l'application n'est pas validée, seuls les
   comptes ajoutés comme « utilisateurs test » peuvent se connecter (écran « application non
   vérifiée »). Coût, délai et périodicité de l'évaluation : **non vérifiés ici**, à lire
   dans la console Google au moment de la demande.

**B. Microsoft (Outlook / Microsoft 365)**
1. Centre d'administration Microsoft Entra → Inscriptions d'applications → nouvelle
   inscription, comptes pris en charge : « tout annuaire + comptes personnels ».
2. Plateforme **Web**, URI de redirection = `https://<projet>.supabase.co/functions/v1/mail-oauth`.
3. Autorisations **déléguées** Microsoft Graph : `Mail.Read`, `offline_access`, plus
   `openid` et `email` (identité seule : affichage de l'adresse connectée). Aucune
   autorisation d'application, aucune écriture.
4. Créer un secret client (noter sa date d'expiration : à renouveler avant échéance).
5. Consentement : `Mail.Read` délégué est consenti par l'utilisateur ; certains locataires
   d'entreprise imposent un **consentement administrateur** (réglage du client, hors de
   notre contrôle). La vérification d'éditeur Microsoft est recommandée pour éviter
   l'avertissement « non vérifié » — exigences exactes **non vérifiées ici**.

**C. Supabase**
1. Appliquer la migration (comprise dans `scripts/mise-en-service-supabase.mjs`).
2. Poser les secrets ci-dessus ; `MAIL_GRAPH_NOTIFICATION_URL` =
   `https://<projet>.supabase.co/functions/v1/mail-sync?source=graph`,
   `MAIL_OAUTH_REDIRECT_URL` = `https://<projet>.supabase.co/functions/v1/mail-oauth`,
   `MAIL_CONNECT_RETURN_URL` = page du site où `MailConnect` est monté.
3. `supabase functions deploy mail-oauth --no-verify-jwt` puis
   `supabase functions deploy mail-sync --no-verify-jwt`.
4. Planifier le passage (toutes les 15 minutes suffit — Gmail exige un renouvellement du
   `watch` au moins tous les 7 jours, Graph un abonnement « message » de moins de 7 jours) :
   ```sql
   select cron.schedule('clairdossier-mail-sync', '*/15 * * * *', $$
     select net.http_post(
       url := 'https://<projet>.supabase.co/functions/v1/mail-sync?action=tick',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-mail-cron-secret',
         (select decrypted_secret from vault.decrypted_secrets where name = 'clairdossier_mail_cron_secret' limit 1)),
       body := '{}'::jsonb) $$);
   ```
5. Build : ajouter `VITE_MAIL_CONNECT: '1'` au workflow de déploiement — avant cela,
   l'interface n'affiche rien.

## Montage de l'interface

`MailConnect` n'est monté nulle part (fichiers gelés non modifiés). Point d'ancrage :
`src/pages/Account.tsx`, sous `ProfilePanel` — `import { MailConnect } from
'../components/account/MailConnect';` puis `<MailConnect />`. `MAIL_CONNECT_RETURN_URL` doit
pointer vers cette page (`https://www.clair-dossier.com/compte`).

## Autorisation OAuth ≠ base légale RGPD

Le consentement OAuth est une **autorisation technique** donnée au fournisseur : il prouve que
l'utilisateur a permis à ClairDossier de lire sa boîte, pas que le traitement est licite. Il
reste à documenter, avant toute ouverture aux clients : la base légale (exécution du contrat
pour le titulaire ; les **tiers** expéditeurs ou cités dans les e-mails ne consentent à rien —
intérêt légitime à motiver ou autre base), l'information des personnes, la minimisation
(déjà en place : périmètre daté, lecture seule, rien avant le choix du dossier), la durée de
conservation, l'inscription au registre, les sous-traitants (Google, Microsoft, Supabase) et
la nécessité d'une AIPD (accès à une messagerie = risque élevé probable). Textes CGV /
confidentialité à faire relire. Aucune de ces démarches n'est faite par ce code.

## Secours : Resend Inbound

La réception par transfert (`docs/recette/EMAIL_ENTRANT.md`, adresse `d-<32 hex>` par
dossier) reste indépendante : elle ne demande ni validation Google ni application Entra et
n'ouvre aucun accès à la boîte. C'est le chemin à proposer tant que la validation Google
n'est pas obtenue, quand un locataire Microsoft refuse le consentement, ou quand un client
préfère ne pas connecter sa messagerie.

## À confirmer au premier essai réel

- Échange du code, `users.watch`, création d'abonnement Graph (validationToken renvoyé en
  moins de 10 s), notifications réelles : jamais exécutés.
- URL des clés Google (`https://www.googleapis.com/oauth2/v3/certs`) : absente de la page
  « Authenticate push subscriptions » consultée — valeur usuelle, à confirmer.
- Code d'erreur d'un jeton delta périmé (traité : 410, puis reprise bornée) : non lu dans
  la page « delta-query-messages » consultée.
- Microsoft n'offre pas de point de révocation OAuth pour un jeton de rafraîchissement : la
  déconnexion supprime l'abonnement et efface les jetons ; l'autorisation reste visible
  dans le compte Microsoft de l'utilisateur jusqu'à ce qu'il la retire.
- Travail en arrière-plan après la réponse 202 à Graph (`EdgeRuntime.waitUntil`) : à observer.
- Non couvert : plusieurs boîtes du même fournisseur par compte, choix du libellé/dossier
  dans l'interface (colonne `scope_label` prête), import de l'historique.
