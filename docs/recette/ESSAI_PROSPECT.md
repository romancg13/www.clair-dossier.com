# Essai prospect — protections serveur (préparation interne, 2026-11-25)

> Statut : **PRÉPARATION INTERNE, RIEN N'EST ACTIVÉ.** Aucune route publique, aucun lien,
> aucune interface. La migration n'est appliquée nulle part (ni production, ni Supabase distant).
> Une fois appliquée, elle reste inerte : essais fermés, plafond global 0, budget 0.
> Implémentation : `supabase/migrations/20261125120000_essai_prospect.sql`
> (retour arrière : `supabase/rollback/20261125120000_essai_prospect.down.sql`),
> garde dans `supabase/functions/ai-worker/index.ts` (`stoppedByTrial`),
> tests réels `tests/sql/migrations.pglite.mjs` (11 blocs « Essai : … »).

## Règle

Un prospect dont l'e-mail est vérifié dispose de **deux analyses réelles gratuites, sur deux
dossiers**. La troisième est refusée, y compris par appel direct à l'API.

## Modèle

| Table | Rôle | Lecture |
|---|---|---|
| `trial_settings` (1 ligne) | interrupteur `enabled`, plafond global `max_trials`, durée, budget par essai (centimes), pièces et pages max par analyse | administration |
| `trial_accounts` | un essai par compte : empreinte e-mail, expiration, budget, dépense cumulée, suspension | titulaire + administration |
| `trial_slots` | emplacements 1 et 2 : dossier, clé d'idempotence, **manifeste figé** (id + empreinte des pièces), pages lues, analyse livrée | titulaire + administration |
| `trial_events` | journal append-only (ouvertures, réservations, refus et motifs, suspensions, réglages) | administration seule |

Aucune écriture possible par le client (aucune policy d'écriture) ; tout passe par des fonctions
`security definer` à `search_path` fixé.

| Fonction | Appelant | Effet |
|---|---|---|
| `trial_open(user)` | rôle serveur ou admin | ouvre l'essai (e-mail vérifié, plafond global, budget fixé, empreinte unique) |
| `trial_claim_slot(user, dossier, clé, conditions)` | **rôle serveur seul** | réserve un emplacement, fige le manifeste, active le dossier, met en file — une transaction |
| `trial_check(dossier, type, pièce, pages)` | interne (déclencheur `ai_jobs_trial_gate`) | point de contrôle unique : `null` = permis ou non concerné |
| `trial_allows(travail, pages)` | worker | même contrôle + décompte des travaux de consolidation |
| `trial_admin_suspend / resume / set_budget / configure` | admin (`is_admin`) | suspension motivée, reprise, budget individuel, réglages globaux |

## Garanties (toutes VÉRIFIÉES par les tests PGlite)

- **Deux, jamais trois** : contrainte `slot_no in (1, 2)` + unicité `(essai, n°)` + verrou de ligne
  sur l'essai pendant la réservation. La 3e réservation renvoie `EMPLACEMENTS_EPUISES` ; hors essai,
  `enable_ai_processing` exige toujours un abonnement (`SUBSCRIPTION_REQUIRED`, inchangé).
- **Idempotence** : même clé (ou même dossier) = même emplacement, aucun décompte ; même clé sur un
  autre dossier = refus. Côté worker, la reprise d'un même travail ne compte qu'une fois ; au plus
  trois travaux de consolidation distincts par emplacement, une seule analyse livrée.
- **Manifeste figé** : seules les pièces présentes au lancement sont lues. Une pièce ajoutée
  ensuite n'est jamais mise en file ; une pièce dont le chemin ou la taille change est refusée.
- **Pas de remise à zéro** : aucune clé étrangère en cascade vers l'essai ; suppression de pièces,
  de dossier ou du compte, nouvelle session, réémission d'accès → compteur et dépense intacts.
  Un compte recréé avec la même adresse (ou un alias) retrouve l'essai existant, déjà consommé.
- **Empreinte e-mail** : casse, alias `+tag`, points et domaine `googlemail` pour Gmail ; stockée
  hachée (SHA-256), jamais en clair. Aucune IP, aucun appareil, aucun cookie.
- **Bornes** : expiration (14 jours par défaut), suspension par un administrateur (travaux en
  attente annulés, motif privé), budget IA individuel, plafond global d'essais, pages et pièces par
  analyse, interrupteur global (`enabled = false` arrête aussi les lectures en cours).
- **Immutabilité** : essais, emplacements et journal ne peuvent être ni supprimés ni réécrits, quel
  que soit le rôle (déclencheurs `trial_guard`).
- **Abonnés inchangés** : la garde ne concerne que les dossiers porteurs d'un emplacement d'essai
  dont le titulaire n'est pas abonné. Un prospect qui s'abonne passe aux règles de son offre,
  y compris pendant un paiement en retard ou une résiliation dont la période payée court encore
  (même définition de l'abonnement courant que `dossier_entitlement` et les quotas de l'offre) ;
  la garde d'essai ne s'applique de nouveau qu'une fois l'abonnement terminé.
- **Relecture** : le dossier d'essai garde le mode `manual` par défaut — rien n'est publié au
  prospect sans approbation de l'équipe.

## Mise en service (propriétaire uniquement, après décision écrite)

1. Appliquer la migration (après 20261118130000) et déployer `ai-worker`.
2. `select trial_admin_configure(true, <plafond global>, <jours>, <budget en centimes>);`
3. Brancher le point d'entrée serveur (ci-dessous) qui appelle `trial_open` puis `trial_claim_slot`.

## Ce qui reste

| Sujet | État |
|---|---|
| CAPTCHA / anti-robot / limitation de débit à l'entrée | **DIFFÉRÉ** — à brancher sur le fournisseur choisi, dans le point d'entrée serveur, avant `trial_open` |
| Point d'entrée serveur (fonction Edge qui vérifie la session puis appelle les deux RPC) | **DIFFÉRÉ** — volontairement absent : aucune route publique |
| Interface prospect (lancement, compteur « 2 analyses ») | **DIFFÉRÉ** |
| Garde du worker (`stoppedByTrial`, 2 appels) | **IMPLÉMENTÉ NON TESTÉ** — la fonction SQL appelée est testée ; le code Deno n'a pas été exécuté |
| Concurrence réelle (deux connexions simultanées) | **SIMULÉ** — PGlite n'a qu'une connexion ; contraintes testées, verrou de ligne non exercé en parallèle |
| Empreinte du contenu binaire des pièces | **DIFFÉRÉ** — l'empreinte actuelle couvre identité, chemin, taille et date de dépôt (aucune somme de contrôle en base à ce jour) |
| Coût des appels au modèle qui échouent | non reporté sur l'essai (comme pour les abonnés) ; borné par les tentatives et le budget global |
| Durée de conservation des empreintes après suppression du compte (RGPD) | **À DÉCIDER** par le propriétaire ; aujourd'hui conservées sans limite |
| Texte des conditions d'essai (`p_terms_version`) et CGV art. 6 | **À VALIDER** par le propriétaire avant toute ouverture |
