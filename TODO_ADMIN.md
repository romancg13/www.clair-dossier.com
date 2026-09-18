# TODO_ADMIN — informations à fournir ou décisions à prendre (humain)

Généré le 2026-09-14 (passe optimisation). Rien de ce qui suit n'a été inventé dans le site : chaque point est affiché comme « à confirmer » ou absent tant qu'il n'est pas renseigné.

## RGPD / confidentialité (src/data/trust.ts, src/data/legal.ts)
- [ ] Région cloud exacte du projet Supabase (base, stockage) — à afficher sur /securite et dans la politique de confidentialité (« données en France » ne doit être écrit que si vérifié).
- [ ] Référence du cadre de sous-traitance (DPA) Supabase et Resend — liens à publier.
- [ ] Encadrement des transferts hors UE pour Resend (clauses contractuelles types) et durée de conservation des journaux d'envoi.
- [ ] DPA ClairDossier téléchargeable (lien /securite#dpa).

## Contenus / positionnement
- [ ] Contradiction résiduelle à arbitrer : le brief d'optimisation décrit « analyse IA, synthèse, relances » ; le produit n'a aucune lecture automatique des pièces (engagement CGV). Le site reste aligné sur le produit réel (/etat-du-produit). Décider : maintenir l'engagement CGV, ou planifier des fonctions d'assistance et mettre à jour CGV + état du produit.
- [ ] `foundingDate: 2025` (src/lib/seo.tsx) — à confirmer.
- [ ] Journal : les articles « chronologie prud'homale » et « IA et droit » ont été alignés sur le produit réel ; relecture par un professionnel du droit recommandée avant toute communication.

## Mise en ligne
- [ ] Bascule DNS vers Netlify (docs/GO-LIVE-NETLIFY.md) : la production GitHub Pages ne sert pas les en-têtes de sécurité (CSP, HSTS) ni les redirections 301.
- [ ] Compte Plausible (mesure sans cookie) : variable VITE_PLAUSIBLE_DOMAIN à définir au build ; sans elle, aucune mesure n'est chargée.
- [ ] Activation de la capture des demandes (VITE_ENABLE_PROSPECT_CAPTURE) après application de la migration et déploiement de l'Edge Function.

## Ajouts 2026-09-15 (passe simplification/juridique)
- **TVA** : le site est désormais harmonisé sur « TVA non applicable, art. 293 B du CGI » (déjà publié dans les mentions légales). Confirmer que la franchise en base est bien le régime actuel et surveiller les seuils ; si dépassement, mettre à jour CGV + FAQ tarifs + facturation Stripe.
- **TODO_LEGAL — juridiction CGV** : clause réécrite prudemment (droit commun ; entre commerçants, tribunaux du siège à Marseille). Faire valider par un professionnel du droit.
- **Stripe / LB13 (vérification côté dashboard, impossible depuis le code)** : confirmer que le coupon LB13 = −20 % pendant 4 mois, expiration 21 septembre, s'applique aux 7 Payment Links mensuels ; vérifier qu'aucun prix Stripe n'est configuré avec TVA 20 % automatique contradictoire avec le 293 B.
- **API / SSO / marque blanche** : reformulés « sur cadrage » sur /tarifs — valider que c'est bien l'engagement commercial souhaité.

## Migration base de données à appliquer (2026-09-15 — gestion documentaire)
- Fichier : `supabase/migrations/20260915120000_gestion_documentaire.sql` (ADDITIF : catégorie+corbeille sur les pièces, tables échéances et journal d'activité, politique UPDATE propriétaire). À exécuter dans le SQL Editor du dashboard Supabase (projet buzgokfmxpmyceppvjpp). Le site fonctionne à l'identique tant qu'elle n'est pas appliquée ; les nouvelles fonctions (corbeille, reclassement, échéances gérées, activité enrichie) s'activent automatiquement après.
- Après application : tester avec deux comptes que A ne voit jamais les échéances/événements de B.
- Paiement : la page /tarifs exige désormais une connexion avant d'ouvrir Stripe (garde frontend). Une vraie imposition côté serveur (Checkout Sessions + webhooks + droits) reste à cadrer — architecture non déployable sans clés (voir rapport).

## Migration super admin à appliquer (2026-09-15)
- Fichier : `supabase/migrations/20260915150000_super_admin.sql` (ADDITIF : rôle super_admin sur app_admins, journal d'audit immuable, notes internes, corbeille + corrections admin sur dossiers/documents/échéances). À exécuter APRÈS la migration « gestion documentaire », dans le SQL Editor Supabase. La console /admin fonctionne en lecture avant ; corbeille/statuts/notes/audit s'activent automatiquement après.
- Non couvert sans backend dédié (service_role côté serveur — à cadrer) : suspension de comptes, création de client par invitation, impersonation réelle « voir comme le client », MFA imposée aux admins, comparaison Storage↔base fichier par fichier, actions Stripe depuis l'admin. L'admin voit déjà tout dossier client via l'espace normal (bandeau « Propriétaire · e-mail »).

## Finalisation production (2026-09-15)
- **Sauvegardes** : vérifier dans le dashboard Supabase que les backups automatiques (PITR ou daily) sont actifs pour le projet ; aucune stratégie de sauvegarde n'est pilotable depuis ce dépôt — ne pas supposer qu'elle existe.
- **En-têtes de sécurité** : GitHub Pages ne permet PAS de définir CSP/HSTS/X-Frame-Options (seuls `<meta>` referrer sont posés). Si besoin d'en-têtes complets, basculer sur Netlify (netlify.toml prêt) qui les supporte.
- **Rate limiting** : ceux de Supabase Auth s'appliquent ; rien d'additionnel possible côté site statique.
- **PWA** : manifest installable ajouté, volontairement SANS service worker (aucun cache hors ligne de documents sensibles).

## MFA super admin (2026-09-15)
- La console /admin exige désormais une session AAL2 : au premier accès, enrôlement TOTP (QR + clé) via le MFA natif Supabase, ensuite code à 6 chiffres à chaque nouvelle session. Prévoir une app d'authentification (ex. Google Authenticator). En cas de perte du facteur : le retirer via le dashboard Supabase (Authentication → Users → votre compte → Factors) puis ré-enrôler.
- Vérifier dans le dashboard Supabase que la MFA (TOTP) est bien AUTORISÉE : Authentication → Sign In / Up → Multi-Factor. Sans cela, l'enrôlement échouera avec un message « Réessayer ».
- Correctif 2026-09-17 : l'écran « Vérification en deux étapes » affiche désormais la cause réelle (TOTP désactivé côté Supabase, session expirée, réseau, code incorrect/expiré…) au lieu du message générique ; le QR d'enrôlement (doublement encodé) est réparé ; l'accès n'est accordé qu'après re-contrôle AAL2. Config locale alignée (`supabase/config.toml` → `[auth.mfa.totp] enroll/verify = true`). **Action requise une seule fois : activer TOTP sur le projet hébergé (Dashboard → Authentication → Multi-Factor Authentication).** Tests : `tests/mfa-errors.test.ts` (`npm test`).
- Durcissement recommandé (non fait, à cadrer) : exiger AAL2 côté base (RLS `is_admin()` + `auth.jwt()->>'aal'`) pour que la porte MFA ne soit pas seulement frontend — impact à évaluer sur l'app mobile et les usages admin hors console.

## Automatisation client/admin + quotas (2026-09-17) — MISE EN SERVICE, dans cet ordre
Le site déployé fonctionne à l'identique tant que ces étapes ne sont pas faites (capacités détectées à l'exécution). Rien n'est supprimé.

> **VOIE RAPIDE (2026-09-18)** : tout ce qui est pilotable par l'API (TOTP, migrations manquantes,
> modèle OTP `{{ .Token }}`, redirect URLs, fonctions, secrets, preuves — dont l'override j.gomes)
> est automatisé par `scripts/mise-en-service-supabase.mjs` (Management API officielle, simulation
> par défaut). Une seule intervention : créer un jeton sur
> https://supabase.com/dashboard/account/tokens puis `export SUPABASE_ACCESS_TOKEN=sbp_…` et
> `node scripts/mise-en-service-supabase.mjs` (état), `--apply` (config+migrations),
> `--apply --deploy-functions` (fonctions), `--apply --secrets` (saisie masquée).
> Les étapes manuelles restantes (webhook au dashboard Stripe, enrôlement TOTP personnel,
> sync abonnés, variable GitHub) sont rappelées en fin d'exécution. Les étapes 1–8 ci-dessous
> restent la référence détaillée si l'on préfère tout faire à la main.

1. **Fonctions serveur** (Supabase CLI, depuis la racine du dépôt) :
   - `supabase functions deploy notify-lead` (notification admin e-mail + SMS, idempotente, relançable ; e-mail historique conservé)
   - `supabase functions deploy admin-users` (suspension / réactivation : super admin + MFA)
   - `supabase functions deploy stripe-webhook --no-verify-jwt` (signature Stripe vérifiée dans la fonction)
2. **Secrets serveur** (`supabase secrets set …` — jamais dans le code ni le frontend) :
   - `STRIPE_SECRET_KEY` (clé restreinte : lecture Subscriptions/Customers/Prices/Products), `STRIPE_WEBHOOK_SECRET` (whsec_… de l'étape 4)
   - `ADMIN_NOTIFICATION_EMAIL` (facultatif ; défaut : adresse historique), `ADMIN_NOTIFICATION_PHONE` (+33…)
   - SMS : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — sans eux, le SMS est marqué « non configuré » et l'e-mail part quand même.
3. **Migrations** (SQL Editor, projet buzgokfmxpmyceppvjpp), dans l'ordre : `20260915120000_gestion_documentaire.sql` → `20260915150000_super_admin.sql` → `20260916120000_mobile_push_tokens.sql` → `20260917120000_automatisation_quotas.sql` → `20260918100000_admin_aal2_suppression_exclusive.sql` (durcissement : données de tiers réservées à l'admin en AAL2, corbeille/suppression réservées au super admin, fenêtre mensuelle des quotas sur offres annuelles). `20260829120000_prospects.sql` reste facultative (capture des demandes) et peut être appliquée avant ou jamais — la 20260918 s'y adapte. Toutes additives et rejouables. Testées sur PostgreSQL réel : `node tests/sql/migrations.pglite.mjs` (46 vérifications).
   - Vérifier l'exception j.gomes (le message « exception illimitée active » s'affiche à l'exécution) :
     `select o.mode, o.expires_at, o.active from entitlement_overrides o join auth.users u on u.id = o.user_id where lower(u.email) = 'j.gomes@avocats-gojuris.fr';` → `unlimited | null | true`
4. **Stripe (dashboard)** :
   - Développeurs → Webhooks → endpoint `https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/stripe-webhook`, événements : `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` → copier le secret de signature (étape 2).
   - Paramètres → E-mails clients : activer l'envoi des reçus et factures.
   - Payment Links (7 mensuels + annuels) : activer la collecte de l'adresse de facturation et du numéro de TVA (informations fiscales), sans toucher aux prix.
   - Portail client (Billing → Customer portal) : l'activer, copier le lien de connexion public, puis GitHub → Settings → Variables → `VITE_STRIPE_PORTAL_URL` (affiche « Factures et abonnement » dans Mon compte).
5. **Abonnés existants** (payés avant le webhook) : `node --import tsx scripts/sync-stripe-subscriptions.ts` (simulation) puis `--apply`. Rapprochement par e-mail ; les cas sans compte correspondant sont listés, rien n'est inventé. Tant qu'un client n'a pas d'abonnement synchronisé, AUCUNE limite ne lui est appliquée (pas de blocage injustifié).
6. **Supabase Auth → Email templates → Confirm signup** : ajouter le code `{{ .Token }}` au modèle (le site propose la saisie d'un code à 6 chiffres ; le lien reste valable). Vérifier aussi que « Confirm email » reste activé.
7. **Contrôles réels** après mise en service : compte A / compte B (A ne voit rien de B), validation d'un dossier → notification reçue (e-mail/SMS) et visible dans /admin → Notifications ; quota d'un compte test abonné à 5 dossiers → 6ᵉ refusé avec la date de renouvellement.
8. **Supabase Auth → URL Configuration → Redirect URLs** : ajouter `https://www.clair-dossier.com/**` (le lien de confirmation ramène sur /compte ; à défaut Supabase renvoie vers l'URL du site, sans erreur).

## Mise en production 2026-09-17 (session automatisée) — état réel vérifié, preuves
Chaque ligne : élément → état constaté → action → preuve.

- **Cause du site inchangé** → PR #28 (`feature/mobile-app` → `main`) et #29 (`feature/automatisation-quotas` → `feature/mobile-app`) ouvertes, jamais fusionnées ; production = build du 2026-09-15 → fusion des deux PR (cette session) → `last-modified` GitHub Pages 2026-09-15 avant fusion, puis `/version.json` après.
- **Backend production (sonde anon REST du 2026-09-17, clé extraite du bundle prod)** → tables historiques présentes et étanches (`dossiers`/`profiles`/`dossier_documents` → 401 anonyme) ; **5 migrations NON appliquées** : `20260829(prospects)`, `20260915120000`, `20260915150000`, `20260916120000`, `20260917120000` (tables `prospects`, `dossier_deadlines`, `audit_logs`, `push_tokens`, `plan_entitlements`… → 404). Fonctions déployées : `notify-lead` seulement ; `delete-account` (exigée par l'app mobile pour la suppression de compte), `submit-prospect`, `stripe-webhook`, `admin-users` → 404. → Étapes 1–3 ci-dessus À FAIRE par le propriétaire ; ajouter `supabase functions deploy delete-account` (mobile) et, si capture des demandes souhaitée, `20260829120000_prospects.sql` + `submit-prospect` (+ `PROSPECT_HASH_SALT`).
- **Le nouveau frontend n'exige pas le nouveau backend** → toutes les capacités sont détectées à l'exécution (probes `hasQuotaEngine`, profil `extended`/`legacy`, RPC absente → pas de quota affiché, insert sans `client_request_id`) → déploiement frontend sûr AVANT les migrations → code vérifié (`src/lib/dossier-workspace.ts`, `src/lib/profile.ts`, `src/pages/DossierFlow.tsx`).
- **Validation locale branche #29 (2026-09-17)** → typecheck OK ; 102/102 tests unitaires ; 39/39 tests SQL (PGlite, RLS réelles : A/B, quota 20→21, idempotence, override, AAL2) ; build + 32 routes prérendues → journal de session.
- **Textes alignés sur le produit réel (cette session)** → l'étape 5 n'envoie plus rien par e-mail/WhatsApp : `features.ts` (transmission-validee, espace-securise, calendrier-relances, recapitulatif-transmission), `faq.ts` (3 réponses), `product-status.ts` (transmission ; quotas et webhook décrits « livré, activation en cours ») + `public/*.md` régénérés. **Après l'activation backend (étapes 1–6)** : repasser les deux entrées « Quotas de dossiers des formules » et « Rattachement automatique de l'abonnement » de « partiel » à « disponible » dans `src/data/product-status.ts`.
- **CGV / confidentialité (à VALIDER par le propriétaire, non modifiées par la session)** → `src/data/legal.ts` décrit encore « transmission par e-mail ou WhatsApp à l'initiative du Client » (objet des CGV, art. responsabilité, finalités confidentialité). Proposition minimale : remplacer par « le téléchargement des pièces et la transmission du dossier par le Client, par le canal de son choix, à son initiative » — aucun engagement nouveau, description conforme au produit. Décision + éventuelle relecture juridique = propriétaire.
- **Repère de version** → absent → ajouté au workflow (cette session) : `https://www.clair-dossier.com/version.json` = `{commit, builtAt}` → preuve de la version servie par le domaine.
- **client_reference_id (webhook)** → vérifié : un lien de paiement falsifié ne peut qu'attribuer un abonnement PAYÉ à un autre compte (aucun droit sans paiement réel, offre issue de `metadata.planId` contrôlée contre `plan_entitlements`, événements ultérieurs rattachés au seul propriétaire déjà enregistré) ; garde e-mail/UUID côté fonction. Durcissement futur (Checkout Sessions côté serveur) : à cadrer, non bloquant.
- **Quota et période Stripe** → la limite s'applique à la période de facturation réelle (`current_period_start/end`). **Point de vigilance validé à surveiller** : pour un abonnement ANNUEL, la limite du plan vaut pour l'année (ex. Business PME 20 = 20 dossiers/période annuelle). Si l'intention commerciale est mensuelle, définir les limites en conséquence dans `plan_entitlements` avant rattachement des abonnés annuels.
- **SMS admin** → BLOQUÉ tant que `TWILIO_*` non configurés (la fonction marque `not_configured`, l'e-mail part quand même) ; e-mail admin dépend du secret `RESEND_API_KEY` déjà utilisé par `notify-lead` en production.
## Console admin, TOTP et suppression exclusive (2026-09-18) — état réel, corrections, preuves
Chaque ligne : fonction → état réel → correction → environnement → preuve.

- **Blocage console « TOTP désactivé »** → CAUSE PROUVÉE : l'écran n'affiche ce message que pour les codes GoTrue `mfa_totp_enroll_not_enabled` / `mfa_totp_verify_not_enabled` (HTTP 422 sur `POST /auth/v1/factors`, mapping 1:1 dans `src/lib/mfa-errors.ts`) — le projet hébergé n'a jamais eu TOTP activé (`supabase/config.toml` ne règle que le local) → **ACTION PROPRIÉTAIRE (1 min)** : Dashboard Supabase → projet `buzgokfmxpmyceppvjpp` → Authentication → Multi-Factor Authentication → activer « TOTP (App Authenticator) » (enrôlement ET vérification), puis relire l'état affiché → ensuite enrôlement PERSONNEL sur /admin (QR ou clé dans votre application d'authentification, code à 6 chiffres). Aucun autre chemin depuis cette machine : pas de CLI/jeton/MCP/secret CI, pas de session navigateur (Chrome non connecté), saisie d'identifiants interdite → BLOQUÉ côté session, prêt côté code (machine à états vérifiée : non connecté→connexion ; non admin→espace client ; AAL1 sans facteur→enrôlement ; AAL1 avec facteur→code ; AAL2→console ; nettoyage des seuls facteurs non vérifiés ; re-contrôle AAL2 après verify ; erreurs typées sans secret).
- **Exposition multiclients de /compte en AAL1 (capture)** → réelle aujourd'hui : policies de juin (`is_admin()` sans condition AAL) → migration `20260918100000` : TOUTES les lectures/écritures admin sur données de tiers exigent AAL2 (`admin_aal2()`), y compris `admin_user_emails()` et `admin_list_entitlements()` ; en AAL1 l'admin ne voit que ses propres données et /compte l'explique (bannière) → effective EN PRODUCTION après application des migrations (étape 3) → prouvé hors production : tests SQL « admin en AAL1 : aucune donnée de tiers », « modification d'un dossier de tiers sans effet ».
- **Suppression administrative exclusive (prestige.seller)** → `app_admins` verrouillée (aucune policy), seed durable par e-mail → user_id (migration 20260621, appliquée en prod — prouvé par l'accès admin de la capture) ; rôle `super_admin` posé par 20260915150000 ; la 20260918 réserve corbeille + restauration + suppression définitive (dossier ET documents, table + storage) au super admin en AAL2, trigger compris (un UPDATE direct de `deleted_at` par un autre acteur est ignoré) ; **index unique : une seule ligne super_admin possible** ; `dossiers_delete_own` resserrée aux brouillons jamais validés (aucun frontend n'utilisait la suppression client) → tests SQL dédiés (corbeille exclusive, restauration neutre : ni notification ni consommation, brouillons supprimables, verrou super unique).
- **Console : succès fantômes corrigés** → un refus RLS (session AAL1/expirée) renvoyait 0 ligne SANS erreur → l'UI annonçait « supprimé/restauré » à tort → toutes les actions sensibles re-lisent le résultat (`.select('id[,deleted_at]')`) et l'ordre des suppressions définitives détruit la LIGNE avant les fichiers (un refus ne coûte plus aucune donnée ; fichiers restants tracés dans l'audit pour purge rejouable) → `src/pages/AdminConsole.tsx` ; corbeille aussi disponible depuis le détail d'un dossier (`DossierDetail`, admin + capacité détectées).
- **Rattachement Stripe** → `client_reference_id` (URL modifiable) n'est plus suffisant : le webhook n'attache que si l'e-mail saisi au paiement correspond à l'e-mail du compte OU à l'e-mail de facturation déclaré ; sinon « rapprochement manuel » (rien de perdu, script existant) → `supabase/functions/stripe-webhook/index.ts` + `paymentEmailMatchesAccount` (testée).
- **Quota annuel** → la limite d'un plan s'applique désormais par FENÊTRE MENSUELLE anniversaire à l'intérieur d'une période de facturation longue (un abonné annuel « 20 dossiers » a 20/mois comme le mensuel, jamais 20/an) → `dossier_entitlement` v2 (20260918100000) → test SQL « offre annuelle : fenêtre mensuelle ».
- **Notifications admin** → destinataire e-mail par défaut DANS LE CODE = `prestige.seller@icloud.com` (`ADMIN_NOTIFICATION_EMAIL` facultatif), SMS uniquement si `TWILIO_*` + `ADMIN_NOTIFICATION_PHONE` configurés (sinon `not_configured`, e-mail part quand même) ; file durable `admin_notifications` (unique par dossier), relance bornée (5), relance = admin authentifié ; appel auto = claim atomique d'une notification existante → fonction `notify-lead` v2 À DÉPLOYER (étape 1) ; canaux réels NON TESTÉS d'ici là.
- **Erreur React #418 — diagnostiquée et CLOSE (2026-09-17)** → cause prouvée par instrumentation `onRecoverableError` (React dev non minifié) : ce n'est PAS un défaut du site. `vite preview` (localhost:4173) ne redirige pas `/etat-du-produit` vers `/etat-du-produit/` et son fallback SPA sert alors le HTML prérendu de la HOME pour la route demandée → mismatch d'hydratation garanti, récupéré ensuite (page correcte). En production : GitHub Pages répond **301** vers l'URL à barre oblique (HTML correct, vérifié par curl) et le fallback `404.html` a un `#root` VIDE (rendu client pur, aucune hydratation). « Flaky » = dépendait du slash final de l'URL testée. Aucun correctif produit nécessaire ; en local, toujours tester les routes prérendues AVEC la barre oblique finale.
