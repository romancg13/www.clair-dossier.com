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

1. **Fonctions serveur** (Supabase CLI, depuis la racine du dépôt) :
   - `supabase functions deploy notify-lead` (notification admin e-mail + SMS, idempotente, relançable ; e-mail historique conservé)
   - `supabase functions deploy admin-users` (suspension / réactivation : super admin + MFA)
   - `supabase functions deploy stripe-webhook --no-verify-jwt` (signature Stripe vérifiée dans la fonction)
2. **Secrets serveur** (`supabase secrets set …` — jamais dans le code ni le frontend) :
   - `STRIPE_SECRET_KEY` (clé restreinte : lecture Subscriptions/Customers/Prices/Products), `STRIPE_WEBHOOK_SECRET` (whsec_… de l'étape 4)
   - `ADMIN_NOTIFICATION_EMAIL` (facultatif ; défaut : adresse historique), `ADMIN_NOTIFICATION_PHONE` (+33…)
   - SMS : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — sans eux, le SMS est marqué « non configuré » et l'e-mail part quand même.
3. **Migrations** (SQL Editor, projet buzgokfmxpmyceppvjpp), dans l'ordre : `20260915120000_gestion_documentaire.sql` → `20260915150000_super_admin.sql` → `20260916120000_mobile_push_tokens.sql` → `20260917120000_automatisation_quotas.sql`. Toutes additives et rejouables. Testées sur PostgreSQL réel : `node tests/sql/migrations.pglite.mjs` (39 vérifications).
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
