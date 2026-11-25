# État des fonctionnalités — source unique de vérité

Mis à jour : 2026-11-25 · commit déployé et vérifié en recette `77ccb92` (branche `claude/clairdossier-optimization-85z7y5`, PR brouillon #71) · production : `85bbb4e`.

Statuts : **OK** = OPÉRATIONNEL ET VÉRIFIÉ · **PART** = PARTIELLEMENT OPÉRATIONNEL · **DNT** = DÉVELOPPÉ MAIS NON TESTÉ · **SIM** = SIMULÉ · **BLQ** = BLOQUÉ · **ND** = NON DÉVELOPPÉ · **DV** = DÉSACTIVÉ VOLONTAIREMENT · **—** = sans objet dans cet environnement.

Règles de lecture : « Local » = tests automatisés du dépôt (462 unitaires, 118 SQL, verts le 25/11) ou parcours navigateur local. « Recette » = https://clairdossier-recette-20b5a2.vercel.app (comptes fictifs, stockage privé) et https://clairdossier-preview.vercel.app/demo. « Production » = https://www.clair-dossier.com + Supabase `buzgokfmxpmyceppvjpp` ; **aucun outil de cette session n'accède à la base de production** : tout ce qui dépend d'un compte client y est noté DNT (« en service, non retesté le 25/11 ») et non OK. Un test unitaire ne prouve pas un service externe ; un modèle simulé ne compte jamais comme opérationnel.

Le détail fin de la vitrine historique (219 lignes F-001…) reste dans `FEATURE_INVENTORY.md` ; il est regroupé ici en lignes M.

## A — Comptes, authentification, collaborateurs

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| A-01 | Inscription, connexion, déconnexion | toutes | OK | OK | DNT | `tests/recette-api.test.ts`, `securite-session.test.ts` ; parcours recette | retester en production avec un compte de test |
| A-02 | Réinitialisation du mot de passe | toutes | OK | OK | DNT | `recette-api.test.ts` | idem |
| A-03 | Isolation des comptes (lecture, écriture, IDOR) | toutes | OK | OK | BLQ | `tests/sql/migrations.pglite.mjs` (A/B), `recette-assistant.test.ts` | appliquer et vérifier le correctif 20261125150000 (N-01) |
| A-04 | Administrateur global, double facteur, suppression exclusive | interne | OK | — | DNT | tests SQL (admin, aal2) | — |
| A-05 | Suspension d'un compte | interne | OK | — | DNT | tests SQL | — |
| A-06 | Collaborateurs / plusieurs utilisateurs par compte | Entrepreneur → Premium | ND | ND | ND | aucune table d'équipe | concevoir (invitations, rôles) |
| A-07 | Comptes de démonstration isolés par visiteur | recette | OK | OK | — | `/api/demo/demarrer`, parcours du 25/11 | — |

## B — Sept abonnements, droits, quotas

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| B-01 | Sept offres et tarifs affichés | toutes | OK | OK | OK | `tests/paiements-geles.test.ts`, page /tarifs vue en production le 25/11 | — |
| B-02 | Paiement par liens Stripe LIVE (gelés) | toutes | OK | DV | DNT | gel vérifié par test ; aucun achat réel tenté | — |
| B-03 | Activation de l'abonnement par événement signé, idempotent et ordonné | toutes | OK | SIM | ND | `recette-api.test.ts` ; paiement simulé en recette | webhooks Stripe réels (I-03) |
| B-04 | Droits vérifiés côté serveur (dossiers, dépôt, assistant, automatisations) | toutes | OK | OK | PART | refus 402 testés ; en production : limites non imposées par le serveur | configuration centrale des droits en production |
| B-05 | Plafond de dossiers par offre | toutes | OK | OK | ND | `recette-api.test.ts` | idem B-04 |
| B-06 | Quotas IA par offre | toutes | OK | PART | DV | `QUOTAS_IA.md`, tests SQL ; migration non installée | décision propriétaire |
| B-07 | Suivi des revenus et abonnements (administration) | interne | OK | — | DNT | `tests/revenue.test.ts` | — |
| B-08 | Résiliation à terme, impayé, récupération des données | toutes | OK | SIM | ND | `applyEvent` testé | Stripe bac à sable |

## C — Dépôt, stockage, téléchargements

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| C-01 | Dépôt multi-fichiers dans un dossier | toutes | OK | OK | DNT | parcours recette | — |
| C-02 | Dépôt direct vers stockage privé, 25 Mo par fichier | toutes | OK | OK | ND | 9 + 12 Mo en 11,6 s (25/11) ; `recette-depot-direct.test.ts` | équivalent Supabase Storage en production |
| C-03 | Transfert reprenable (TUS / multipart) après coupure réseau | toutes | ND | ND | ND | — | à développer |
| C-04 | Détection de doublons | toutes | OK | OK | DV | `engine-runner.test.ts`, événement « piece_doublon » | — |
| C-05 | Contrôle des formats, pièce illisible signalée | toutes | OK | OK | DV | `ai-pipeline.test.ts` | antivirus : ND |
| C-06 | Relecture automatique d'une pièce échouée (1 h, 6 h, 24 h) | toutes | OK | DNT | DV | `moteur-relecture.test.ts` | observer en recette |
| C-07 | Téléchargement des pièces et des rendus, liens privés | toutes | OK | OK | DNT | parcours recette | — |
| C-08 | ZIP complet des rendus | toutes | OK | OK | DV | `deliverables-zip.test.ts` | — |
| C-09 | 250 fichiers par dossier | toutes | DNT | ND | ND | script `scripts/recette/capacite.ts` écrit, exécution non aboutie le 25/11 | lancer et consigner dans `CAPACITE.md` |
| C-10 | Capacité logique 20 × 250 fichiers | Business → Premium | ND | ND | ND | — | idem C-09 |
| C-11 | Premier résultat rapide après dépôt | toutes | OK | PART | DV | `recette-performance.test.ts` ; recette hébergée le 25/11 : premier résultat 15 s, six rendus 23 s (37–39 s avant) | viser quelques secondes : passage horaire et moins d'accès au stockage |
| C-12 | Corbeille client, suppression, audit | toutes | OK | — | DNT | tests SQL corbeille | — |

## D — Six rendus, corrections, exports

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| D-01 | Résumé (PDF, DOCX) | toutes | OK | OK | DV | `deliverables.test.ts`, `revue-rendus.test.ts`, `docs/recette/rendus/` | — |
| D-02 | Tableau de bord (PDF) | toutes | OK | OK | DV | idem | — |
| D-03 | Chronologie (PDF, CSV, XLSX) | toutes | OK | OK | DV | idem | — |
| D-04 | Dates modifiables : correction persistante, motif, historique | toutes | OK | OK | DV | `recette-api.test.ts` | PDF à champs éditables : PART |
| D-05 | Échéances et calendrier (PDF, XLSX, ICS) | toutes | OK | OK | DV | idem | — |
| D-06 | Projets de relance (PDF, DOCX), jamais envoyés | toutes | OK | OK | DV | idem | — |
| D-07 | Citations vérifiées (passage, valeur typée, pièce) | toutes | OK | OK | DV | `moteur-citations.test.ts`, `evaluation-moteur.test.ts` (100 %) | — |
| D-08 | Écrans dossier simplifiés (suivi en une ligne, 3 priorités) | toutes | OK | OK | OK | `suivi-libelles.test.ts`, captures V3, production vue le 25/11 | — |
| D-09 | Livrables déposés à la main par l'équipe (mode actuel de production) | toutes | OK | — | DNT | tests SQL livrables | — |

## E — API Claude et modèles

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| E-01 | Clé API dans le coffre serveur | — | — | BLQ | DV | aucune `ANTHROPIC_API_KEY` dans Vercel (vérifié le 25/11) | manipulation propriétaire : `ACTIVATION_API.md` |
| E-02 | Liste des modèles réellement accessibles (`GET /v1/models`) | — | SIM | BLQ | DV | code `runtime.ts`, page /admin | dépend de E-01 |
| E-03 | Sélection automatique du modèle (simple / courant / avancé) | toutes | SIM | BLQ | DV | `recette-assistant.test.ts` (faux client) | dépend de E-01 |
| E-04 | Lecture des pièces par modèle (extraction, consolidation) | toutes | SIM | BLQ | DV | `ai-pipeline.test.ts` ; passerelle Vercel gratuite : 403 | dépend de E-01 |
| E-05 | Lecture par règles déterministes (sans modèle) | toutes | OK | OK | DV | `evaluation-moteur.test.ts` : exactitude 100 %, 0 partie inventée | — |
| E-06 | OCR / lecture de scans et photos | toutes | SIM | BLQ | DV | pièce marquée « lecture reportée » | dépend de E-01 |
| E-07 | Fournisseur de secours | — | ND | ND | ND | — | à décider (licences, confidentialité) |
| E-08 | Traitement différé (Batch), cache des consignes | — | PART | BLQ | DV | cache des consignes codé ; Batch ND | après E-01 |
| E-09 | Évaluation continue (corpus de référence, anti-régression) | interne | OK | — | — | `npm run ia:evaluation`, `evaluation-moteur.test.ts` | lancer avec un modèle après E-01 |
| E-10 | Sources juridiques officielles (Légifrance/PISTE, Judilibre, EUR-Lex) | — | ND | ND | ND | — | comptes PISTE à créer |

## F — Assistant ClairDossier IA et outils

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| F-01 | Panneau latéral à droite de « Vos résultats », mobile adapté | toutes | OK | OK | DV | captures V3/V5 | — |
| F-02 | Réponses par règles sur le dossier (résumé, démarches, échéances, recherche, comparaison) | toutes | OK | OK | DV | `intelligence.test.ts` ; 2,3 s en recette | — |
| F-03 | Conversation par modèle avec outils côté serveur | toutes | SIM | BLQ | DV | `recette-assistant.test.ts` (16) | dépend de E-01 |
| F-04 | Registre fermé d'outils, droits vérifiés par le serveur | toutes | OK | OK | DV | `intelligence.test.ts` | — |
| F-05 | Refus des actions sensibles, résistance aux consignes cachées | toutes | OK | OK | DV | idem + pièce piégée du corpus | — |
| F-06 | Création réelle d'un rappel (échéance) après confirmation | toutes | OK | OK | DV | `recette-assistant.test.ts` ; fait en recette le 25/11 | — |
| F-07 | Historique privé par dossier, effaçable | toutes | OK | OK | DV | idem | — |
| F-08 | Préférences de travail (mémoire privée, 12 au plus, supprimables) | toutes | OK | PART | DV | `recette-pilotage.test.ts` ; enregistrée et relue en recette le 25/11 ; effet sur les réponses seulement avec modèle | E-01 |
| F-09 | Génération de fichiers par l'assistant | toutes | PART | PART | DV | renvoie les six rendus existants ; pas de fichier libre | à étendre |
| F-10 | Recherche sur plusieurs dossiers | Pro, Premium | ND | ND | ND | — | à développer |
| F-11 | Pièces jointes dans la conversation, lecture Word/Excel/image par l'assistant | toutes | PART | PART | DV | dépôt depuis le panneau ; lecture par le moteur, pas par l'assistant | — |
| F-12 | Commandes rapides depuis une pièce, un rendu, une échéance | toutes | ND | ND | ND | — | à développer |
| F-13 | Réponses progressives (affichage au fil de l'eau) | toutes | ND | ND | ND | — | à développer |
| F-14 | Assistant dans l'espace client de production | toutes | — | — | DV | CGV art. 6 | accord écrit + mise à jour des CGV |

## G — Automatisations et planificateur

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| G-01 | Demande en langage naturel → automatisation confirmée | toutes | OK | OK | DV | `intelligence.test.ts`, `recette-automatisations.test.ts` (14) | — |
| G-02 | Bilan régulier des dossiers | toutes | OK | DNT | DV | horloge injectée | G-05 |
| G-03 | Alerte avant échéance ou renouvellement (30, 7, 1 j) | toutes | OK | DNT | DV | idem | G-05 |
| G-04 | Pause, reprise, annulation, plafonds, arrêt après 3 échecs | toutes | OK | OK | DV | pause et isolement vérifiés en recette | — |
| G-05 | Exécution réelle par le planificateur hébergé, navigateur fermé | toutes | OK | DNT | DV | passage quotidien 07:05 UTC ; preuve datée désormais enregistrée | automatisation quotidienne créée en recette le 25/11 (prochaine : 26/11 07:00 UTC) ; lire « Dernier passage automatique » le 26/11 |
| G-06 | Idempotence, équité entre comptes, rattrapage unique | toutes | OK | DNT | DV | tests | — |
| G-07 | Déclencheur « à chaque pièce reçue » | toutes | OK | PART | DV | exécuté au passage suivant, pas à la seconde | passage horaire (offre payante) |
| G-08 | Heure choisie par le client | toutes | ND | ND | ND | toujours 8 h | à développer |
| G-09 | Relance préparée automatiquement | Entrepreneur → | DV | DV | DV | refusée clairement, jamais simulée | décision produit |
| G-10 | Coupe-circuit des automatisations | interne | OK | DNT | — | `recette-assistant.test.ts` | /admin exige `RECETTE_ADMIN_PASSWORD` |

## H — Gmail, Outlook, e-mail entrant

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| H-01 | Connexion Gmail / Google Workspace (OAuth, watch, historique) | Entrepreneur → | DNT | BLQ | DV | `mail-connect.test.ts` (logique) ; aucune application OAuth | créer l'application Google Cloud + validation |
| H-02 | Connexion Outlook / Microsoft 365 (Graph, delta) | Entrepreneur → | DNT | BLQ | DV | idem | créer l'application Microsoft Entra |
| H-03 | E-mail entrant de secours (Resend Inbound) | toutes | OK | BLQ | DV | `email-inbound.test.ts` ; pas de compte Resend | compte + domaine |
| H-04 | Proposition « Connecter / Plus tard / Non » | Entrepreneur → | OK | DV | DV | composant inerte sans configuration | dépend de H-01/H-02 |
| H-05 | Notification de fin de traitement | toutes | OK | SIM | DV | boîte de recette interne, aucun envoi | Resend |
| H-06 | Notification de contact (`notify-lead`) | — | OK | — | DNT | fonction historique | — |

## I — Options et Stripe bac à sable

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| I-01 | « Personnaliser mon espace » (Automation, Vigilance, Pilotage Pro) | toutes | OK | SIM | DV | aperçu sur /demo, aucune vente | — |
| I-02 | LinkedIn retiré des options | — | OK | OK | OK | code | — |
| I-03 | Stripe bac à sable : paiement, webhooks signés, changement, résiliation | toutes | SIM | BLQ | — | seul un compte LIVE est relié (vérifié le 25/11) | créer un bac à sable Stripe |
| I-04 | Activation / désactivation d'une option et droits associés | toutes | ND | ND | ND | — | après I-03 |

## J — Coûts, budgets, rentabilité

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| J-01 | Réservation du coût maximal avant chaque appel, règlement après | — | OK | DNT | DV | `recette-assistant.test.ts` ; 0 appel réel | E-01 |
| J-02 | Plafonds global et par compte, concurrence | — | OK | DNT | DV | idem | E-01 |
| J-03 | Registre par appel (compte, fonction, modèle, jetons, cache, durée, coût) | — | OK | DNT | DV | idem | E-01 |
| J-04 | Alertes 70 / 90 / 100 %, une par palier et par mois | interne | OK | DNT | — | `recette-pilotage.test.ts` | E-01 |
| J-05 | Repli sur les règles au plafond, résultat annoncé partiel | toutes | OK | DNT | DV | `moteur-budget.test.ts` | E-01 |
| J-06 | Coupe-circuit des appels de modèle | interne | OK | DNT | — | `recette-assistant.test.ts` | — |
| J-07 | Calculateur de rentabilité (offres, options, gros consommateur, seuil, croissance, avec/sans crédits) | interne | OK | — | — | `RENTABILITE.md`, `rentabilite.test.ts` ; toutes les consommations sont ESTIMÉES | remplacer par des mesures réelles |
| J-08 | Coût réel mesuré par document, dossier, conversation | interne | BLQ | BLQ | — | 0 appel réel, 0 USD dépensé | E-01 |

## K — Supervision et MCP

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| K-01 | Console d'administration (clients, dossiers, livrables) | interne | OK | — | DNT | tests SQL admin | — |
| K-02 | Onglet Supervision (compteurs sans donnée cliente) | interne | OK | — | BLQ | `supervision.test.ts` ; migration 20261125140000 non appliquée | appliquer (facultatif) |
| K-03 | /admin de recette : coûts IA, santé du fournisseur, exceptions, coupe-circuit, dernier passage | interne | OK | BLQ | — | code + tests ; pas de `RECETTE_ADMIN_PASSWORD` dans Vercel | ajouter la variable |
| K-04 | Suivi depuis ChatGPT / Claude par MCP (lecture seule, OAuth, révocable) | toutes | OK | DNT | DV | `recette/server/mcp.ts`, tests ; non rejoué depuis un client réel le 25/11 | essai réel |
| K-05 | Surveillance du site public | interne | OK | — | DNT | `scripts/surveillance-site.mjs` | — |
| K-06 | Revenus, marges et prévisions dans la supervision | interne | ND | ND | ND | calculateur hors ligne seulement | à développer |

## L — Essai prospect et anti-abus

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| L-01 | Deux essais par compte, compteur atomique, troisième refusé | prospects | OK | ND | DV | tests SQL essai (idempotence, reprise) | dépend du moteur IA |
| L-02 | Manifeste figé, budgets, expiration, suppression programmée | prospects | OK | ND | DV | idem, `ESSAI_PROSPECT.md` | — |
| L-03 | Limitation de débit | toutes | OK | OK | PART | limites recette testées | — |
| L-04 | CAPTCHA adaptatif, contrôle des comptes multiples | prospects | ND | ND | ND | — | à développer avant ouverture |
| L-05 | Lien commercial universel | prospects | DV | DV | DV | non généré, sur instruction | attendre l'instruction |

## M — Vitrine, UX, mobile, SEO, accessibilité

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| M-01 | 36 pages publiques prérendues (accueil, fonctionnalités, métiers, tarifs, sécurité, journal, légal) | — | OK | OK | OK | `routes.test.ts`, 8 pages vues en production le 25/11, 0 erreur JS | — |
| M-02 | Performances : LCP 0,2–0,5 s, CLS 0 (production) ; /demo 0,6–0,9 s | — | OK | OK | OK | mesure synthétique du 25/11 (centre de données, pas des données d'usage réelles) | INP non mesuré |
| M-03 | SEO : titres, descriptions, canonical, sitemap, robots, données structurées | — | OK | DV | OK | prérendu + contrôle ; recette volontairement non indexée | une description à 172 caractères (/fonctionnalites/recapitulatif-transmission) |
| M-04 | Démonstration publique /demo (dossier fictif, six résultats, assistant par règles) | — | OK | OK | DV | preview vue le 25/11 | — |
| M-05 | Centre d'actions multidossiers : 3 priorités, une conséquence, une action | toutes | OK | OK | ND | `recette-pilotage.test.ts` ; priorité affichée en recette le 25/11 (`captures/v6-recette-compte.png`) | — |
| M-06 | « Depuis votre dernière visite » : ce qui a changé, ce qui a été fait | toutes | OK | DNT | ND | idem | visible à la deuxième visite (30 min) : à relire le 26/11 |
| M-07 | Mobile et ordinateur sans défilement horizontal | — | OK | OK | OK | parcours 390 et 1440 px | tablette non rejouée |
| M-08 | Accessibilité (clavier, contrastes, mouvement réduit) | — | PART | PART | PART | `cinematics-quality.test.ts`, `recette-couleurs.mjs` ; pas d'audit complet | audit dédié |
| M-09 | Refonte du hero et de la conversion (8 leviers, 3 offres puis 7) | — | ND | ND | ND | hero actuel conservé : « Des documents dispersés. Un dossier clair. » | décision propriétaire (production en lecture seule) |
| M-10 | Application mobile (Expo) | toutes | DNT | — | ND | `mobile/`, non publiée | — |
| M-11 | Prospection B2B (scoring, validation, campagne) | interne | OK | — | DNT | `prospects-*.test.ts`, `campagne-droit10.test.ts` | — |
| M-12 | Bandeau ClairNova, téléphone, WhatsApp, formulaires de contact | — | OK | OK | OK | `cta.test.ts`, pied de page vu le 25/11 | — |

## N — Sécurité, sauvegardes, conformité

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| N-01 | Correctif d'isolation pièces / échéances (20261125150000) | toutes | OK | — | BLQ | 118 tests SQL ; base de production inaccessible | **manipulation propriétaire : `SECURITE_ISOLATION.md`** |
| N-02 | Diagnostic d'isolation en lecture seule | interne | OK | — | BLQ | joué avant/après correctif | à exécuter par le propriétaire |
| N-03 | Chemin de fichier contrôlé par le worker | toutes | OK | — | DV | `ai-worker` (non installé) | — |
| N-04 | Recette neutralisée : aucun lien Stripe LIVE, non indexée | — | OK | OK | — | build en échec sinon | — |
| N-05 | Secrets côté serveur uniquement | — | OK | OK | OK | `revue-securite.test.ts`, aucune variable `VITE_` secrète | — |
| N-06 | Stockage privé de la recette, liens non publics | — | OK | OK | — | Vercel Blob privé | architecture de recette, pas de production |
| N-07 | Dépendances sans vulnérabilité connue | — | OK | OK | OK | `npm audit` : 0 (25/11) | — |
| N-08 | Sauvegardes et restauration testées | — | ND | ND | BLQ | non vérifiable sans accès Supabase | vérifier dans Supabase → Backups |
| N-09 | CGV art. 6, confidentialité, DPA, AIPD à jour pour l'analyse automatique | — | PART | — | BLQ | projets dans `MOTEUR_ET_CONFORMITE.md` | validation juridique du propriétaire |
| N-10 | Analyse de sécurité dynamique (HawkScan ou équivalent) | — | ND | ND | ND | non exécutée | — |
| N-11 | Supabase de recette hébergé et isolé | — | OK | BLQ | — | recette locale 63 cas ; organisation à la limite gratuite | décision propriétaire |

<!-- SYNTHESE -->
## Synthèse (calculée par `node scripts/synthese-fonctionnalites.mjs`)

Fonctionnalités recensées : **122**.

### Local

| OK | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|
| 87 | 5 | 4 | 6 | 1 | 15 | 2 | 2 |

- Couverture de vérification : 118/122 = **97 %** (état établi par une preuve ; exclus : les 4 « développé mais non testé »).
- Taux d'opérationnalité : 87/118 = **74 %** (périmètre actif = recensées − sans objet − désactivées volontairement ; simulé, bloqué et non développé restent au dénominateur).

### Recette

| OK | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|
| 42 | 7 | 14 | 4 | 14 | 18 | 5 | 18 |

- Couverture de vérification : 108/122 = **89 %** (état établi par une preuve ; exclus : les 14 « développé mais non testé »).
- Taux d'opérationnalité : 42/99 = **42 %** (périmètre actif = recensées − sans objet − désactivées volontairement ; simulé, bloqué et non développé restent au dénominateur).

### Production

| OK | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|
| 10 | 3 | 14 | 0 | 6 | 22 | 55 | 12 |

- Couverture de vérification : 108/122 = **89 %** (état établi par une preuve ; exclus : les 14 « développé mais non testé »).
- Taux d'opérationnalité : 10/55 = **18 %** (périmètre actif = recensées − sans objet − désactivées volontairement ; simulé, bloqué et non développé restent au dénominateur).

### Par catégorie (colonne Recette)

| Catégorie | Total | OK | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|---|---|
| A | 7 | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 2 |
| B | 8 | 3 | 1 | 0 | 2 | 0 | 0 | 1 | 1 |
| C | 12 | 6 | 1 | 1 | 0 | 0 | 3 | 0 | 1 |
| D | 9 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| E | 10 | 1 | 0 | 0 | 0 | 6 | 2 | 0 | 1 |
| F | 14 | 6 | 3 | 0 | 0 | 1 | 3 | 0 | 1 |
| G | 10 | 2 | 1 | 5 | 0 | 0 | 1 | 1 | 0 |
| H | 6 | 0 | 0 | 0 | 1 | 3 | 0 | 1 | 1 |
| I | 4 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 |
| J | 8 | 0 | 0 | 6 | 0 | 1 | 0 | 0 | 1 |
| K | 6 | 0 | 0 | 1 | 0 | 1 | 1 | 0 | 3 |
| L | 5 | 1 | 0 | 0 | 0 | 0 | 3 | 1 | 0 |
| M | 12 | 6 | 1 | 1 | 0 | 0 | 1 | 1 | 2 |
| N | 11 | 4 | 0 | 0 | 0 | 1 | 2 | 0 | 4 |
