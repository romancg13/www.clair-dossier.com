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
