# Décisions et actions réservées au propriétaire — 2026-11-02

Généré par la session autonome « Private AI, finalisation, déploiement ». Rien de ce qui suit n'a été
fait à votre place : chaque point exige soit un accès que cette machine n'a pas, soit une décision
contractuelle, financière ou juridique. Statuts : **VÉRIFIÉ** (lu/sondé), **HYPOTHÈSE** (non vérifiable d'ici),
**PROPOSITION** (texte à valider, jamais publié).

## 1. Ce qui est prêt et attend un seul accord : la mise en production

La branche `claude/clairdossier-autonomous-deploy-959cad` contient `main` + PR #41 (moteur IA) + PR #42
(tarifs/llms) + la console IA privée (migration 20261102) + les correctifs d'audit. Vérifications réelles :
typecheck, tests unitaires, tests SQL PGlite (RLS réelles), `deno check` des fonctions, build 36 routes.
**La fusion sur `main` déclenche GitHub Pages** : elle n'est faite que sur votre accord explicite.

Sans effet client à la fusion : le panneau IA n'est rendu que si `VITE_AI_ENGINE=1` (absent du workflow),
et la console « IA privée » affiche « migration non appliquée » tant que Supabase n'est pas mis à jour.

## 2. Supabase — accès propriétaire indispensable (VÉRIFIÉ : aucun identifiant sur cette machine)

Le projet `buzgokfmxpmyceppvjpp` n'est visible ni du MCP Supabase connecté (autre organisation : ne JAMAIS
migrer « ClairDossier's Projet » `fqgorejfxfjavyejbaqh`), ni d'un jeton local. État sondé par REST anonyme le
2026-11-02 : migrations ≤ 20260920 appliquées ; `20261012` (revenus), `20261023` (moteur IA), `20261102`
(console privée) **absentes** ; fonctions : seule `notify-lead` déployée.

Procédure (une intervention) :

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…        # https://supabase.com/dashboard/account/tokens
node scripts/mise-en-service-supabase.mjs                 # simulation : rien n'est écrit
node scripts/mise-en-service-supabase.mjs --apply         # config + migrations manquantes (sauvegarde avant)
node scripts/mise-en-service-supabase.mjs --apply --deploy-functions --secrets
```

Secrets de fonctions à saisir (jamais dans le code) : `STRIPE_SECRET_KEY` (clé restreinte lecture
abonnements/clients/prix), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` (déjà en prod pour notify-lead),
`ANTHROPIC_API_KEY` (**nouvelle dépense : contrat API Anthropic à ouvrir — accord requis**), `AI_WORKER_TOKEN`
(chaîne aléatoire ; la même valeur dans Vault sous le nom `clairdossier_ai_worker_token`).
Puis Dashboard → Database → Extensions : activer `pg_cron` et rejouer la migration 20261102 (idempotente)
pour enregistrer la tâche `clairdossier-ai-worker`.

Retour arrière : `supabase/rollback/20261023120000_moteur_documentaire_ia.down.sql` et
`supabase/rollback/20261102120000_ia_console_privee.down.sql` (niveau 1 sans perte).

## 3. Stripe — VÉRIFIÉ en lecture seule sur le compte LIVE (MCP Stripe)

- 6 produits actifs, prix mensuels + annuels, 13 Payment Links actifs ; **aucun endpoint webhook** ;
  1 abonnement actif (Business PME 20, depuis le 2026-09-17) et 3 tentatives expirées.
- À faire (dashboard) : Développeurs → Webhooks → `https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/stripe-webhook`,
  événements `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`,
  `invoice.payment_failed` ; copier le secret dans `STRIPE_WEBHOOK_SECRET`.
- Puis rattacher l'abonné existant : `node --import tsx scripts/sync-stripe-subscriptions.ts` (simulation) puis `--apply`.
  Tant que ce n'est pas fait, cet abonné n'a **aucune limite** appliquée et aucune offre affichée (comportement
  volontairement non bloquant).
- **Descriptions produit Stripe à corriger (écriture Stripe : non faite sans accord)** — elles promettent encore
  « IA avancée (GPT-5.5) », « réponse automatisée aux e-mails, IA complète », « rédaction IA », « résumé IA »
  (produits `prod_Ui7G…`). Elles apparaissent au Checkout et contredisent les CGV. Proposition : reprendre
  mot pour mot les lignes `specs`/`description` de `src/data/pricing.ts`.
- Portail client : activer et renseigner la variable GitHub `VITE_STRIPE_PORTAL_URL`.

## 4. Cadre contractuel de l'IA — PROPOSITION, rien n'est publié

Le site affirme à plus de vingt endroits « aucune lecture, extraction ou analyse automatique des documents »
(`src/data/legal.ts:202` CGV art. 6 ; `src/pages/Security.tsx` ; `src/data/product-status.ts` ;
`src/data/segments.ts` ; `src/data/features.ts` ; composants de la home ; articles du journal ; application
mobile). Ils sont **exacts tant que `VITE_AI_ENGINE` n'est pas posé et qu'aucun dossier n'est activé**.
Avant toute activation client (par ordre) :

1. **Décision écrite** d'offrir le traitement automatique (option par dossier, révocable).
2. **CGV art. 6** — texte proposé : « Sur activation expresse et révocable du Client, dossier par dossier,
   ClairDossier procède à une lecture et une analyse automatiques des pièces afin de produire des documents de
   travail (résumé, chronologie, échéances, projets de courriers). Ces documents sont générés par un système
   d'intelligence artificielle, signalés comme tels, relus par ClairDossier avant mise à disposition sauf
   choix contraire du Client, et doivent être vérifiés par lui ; ils ne constituent ni un conseil ni un acte
   juridique. Le traitement est confié au sous-traitant mentionné dans la politique de confidentialité. »
3. **Politique de confidentialité et registre des sous-traitants** (`src/data/legal.ts`, `src/data/trust.ts`) :
   ajouter Anthropic (traitement IA ; localisation, mécanisme de transfert hors UE, durée de conservation :
   **À CONFIRMER sur le contrat API**) ; finalité « traitement automatisé des pièces sur demande du Client » ;
   base légale : exécution du contrat (option souscrite) ; conservation : résultats et livrables supprimés
   avec le dossier.
4. **Page Sécurité, état du produit, segments, FAQ, home, mobile** : remplacer l'absolu par « Aucune lecture
   automatique de vos pièces sans votre activation expresse, dossier par dossier (CGV, art. 6) ».
5. **Tests** à faire évoluer dans le même commit : `tests/llms-coherence.test.ts` (exige la phrase actuelle),
   `tests/features.test.ts`, `tests/home-landing.test.ts`.
6. **RGPD** : AIPD à évaluer (pièces pouvant contenir des données sensibles ou pénales) ; information des
   clients existants.
7. Seulement ensuite : `VITE_AI_ENGINE: '1'` dans `.github/workflows/deploy.yml`.

Points juridiques déjà ouverts, indépendants de l'IA (VÉRIFIÉ en production) : région d'hébergement Supabase,
encadrement des transferts Resend/GitHub, références DPA, raison sociale et adresse de l'hébergeur des données
dans les mentions légales (LCEN art. 6-III), durées de conservation des demandes de contact et journaux d'envoi,
mention « hébergeur conforme RGPD » (footer, FAQ) à reformuler, formulation « HT » vs « TVA non applicable,
art. 293 B » à unifier. Aucune valeur n'a été inventée : tout reste « À CONFIRMER » tant que vous ne l'avez pas lue
sur vos contrats.

## 5. Recherche juridique vérifiée (Légifrance / PISTE) — nouvelle dépendance, accord requis

Le moteur ne cite **aucune règle de droit** de lui-même : les échéances « calculées » sans règle certaine sont
classées « hypothèse à confirmer ». Brancher Légifrance (API PISTE), la Cour de cassation ou EUR-Lex exige
des identifiants d'API à créer par vous ; sans eux, rien n'est simulé.

## 6. Autres accès non disponibles

Google Search Console / Bing (SEO), compte Resend (vérifier le domaine d'envoi), Twilio (SMS admin, facultatif),
antivirus de fichiers (aucun service branché : les pièces sont contrôlées par type/taille seulement).
