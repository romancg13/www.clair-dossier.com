# État des fonctionnalités — source unique de vérité

Mis à jour : 2026-11-25 · commit de recette déployé : voir `version.json` de la recette (V12, analyse progressive) ; PWA `1f278f2` ; recette finale V8 jouée sur `5035ff5` (463 unitaires et 118 SQL verts sur ce code ; recette finale hébergée jouée en session neuve le 25/11 : premier résultat 12,9 s, six rendus 20 s, archive de 14 fichiers contrôlée, isolation A/B 404, 0 erreur JS) (branche `claude/clairdossier-optimization-85z7y5`, PR brouillon #71) · production : `85bbb4e`.

Mise à jour 2026-11-25 (soir) : clé API Claude et `RECETTE_AI=direct` actifs sur `clairdossier-recette-20b5a2` (Production Vercel) ; lignes E-01, E-03, E-04, F-03 réévaluées d'après un essai réel sur la recette (comptes fictifs, pièces fictives). Coût réel NON mesuré (page `/admin` : `RECETTE_ADMIN_PASSWORD` absent).

Statuts : **OK** = OPÉRATIONNEL ET VÉRIFIÉ · **PART** = PARTIELLEMENT OPÉRATIONNEL · **DNT** = DÉVELOPPÉ MAIS NON TESTÉ · **ÉMU** = VÉRIFIÉ PAR ÉMULATION (navigateur automatisé, aucun appareil physique) · **SIM** = SIMULÉ · **BLQ** = BLOQUÉ · **ND** = NON DÉVELOPPÉ · **DV** = VOLONTAIREMENT DIFFÉRÉ OU DÉSACTIVÉ · **—** = sans objet dans cet environnement.

Règles de lecture : « Local » = tests automatisés du dépôt (467 unitaires, 118 SQL, verts le 25/11) ou parcours navigateur local. « Recette » = https://clairdossier-recette-20b5a2.vercel.app (comptes fictifs, stockage privé) et https://clairdossier-preview.vercel.app/demo. « Production » = https://www.clair-dossier.com + Supabase `buzgokfmxpmyceppvjpp` ; **aucun outil de cette session n'accède à la base de production** : tout ce qui dépend d'un compte client y est noté DNT (« en service, non retesté le 25/11 ») et non OK. Un test unitaire ne prouve pas un service externe ; un modèle simulé ne compte jamais comme opérationnel.

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
| B-02 | Paiement par liens Stripe LIVE (gelés) | toutes | OK | DV | DNT | gel vérifié par test ; 12 liens présents dans le build de production du 25/11 ; aucun achat réel tenté | — |
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
| C-09 | 250 fichiers par dossier | toutes | OK | ND | ND | `CAPACITE.md` : 10 → 250 fichiers mesurés en local le 25/11 ; à 250 : six rendus en 21,7 s après correctif du rendu « Résumé » (288 s avant) | mesure sur stockage hébergé : non faite (quota gratuit d'opérations) |
| C-10 | Capacité logique 20 × 250 fichiers | Business → Premium | OK | ND | ND | `CAPACITE.md` : 5 000 pièces déposées et listées sur 20 dossiers, 0 analyse lancée | idem C-09 |
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
| E-01 | Clé API dans le coffre serveur | — | — | OK | DV | `ANTHROPIC_API_KEY` (sensible, Production) ajoutée le 25/11 à ~18 h 30 ; redéploiement ; l'assistant passe en mode `modele` | solde et limite de dépense du workspace à lire dans la Console (propriétaire) |
| E-02 | Liste des modèles réellement accessibles (`GET /v1/models`) | — | SIM | BLQ | DV | code `runtime.ts`, page /admin | dépend de E-01 |
| E-03 | Sélection automatique du modèle (simple / courant / avancé) | toutes | SIM | OK | DV | recette 25/11 (session V11, API réelle) : question simple → claude-haiku-5-5, courante → claude-sonnet-5-5, analyse avancée → claude-opus-5-5, tous observés | — |
| E-04 | Lecture des pièces par modèle (extraction, consolidation) | toutes | SIM | OK | DV | recette 25/11 (session V11, API réelle) : 3 pièces lues par le modèle ET synthèse par le modèle (fournisseur « anthropic », plus de mention simulation) après 2 correctifs : grammaire refusée par l'API (400 « compiled grammar is too large ») → sortie par outil non strict validée strictement ; tableaux rendus en texte → relus. Analyse juste (3 480 € réclamés / 3 210 € au relevé, réponse avant le 15/01/2027, loyer T4 « paiement à vérifier ») | délai complet encore long (86 s pour 2 pièces) : dominé par les appels au modèle |
| E-05 | Lecture par règles déterministes (sans modèle) | toutes | OK | OK | DV | `evaluation-moteur.test.ts` : exactitude 100 %, 0 partie inventée | — |
| E-06 | OCR / lecture de scans et photos | toutes | SIM | BLQ | DV | pièce marquée « lecture reportée » | dépend de E-01 |
| E-07 | Fournisseur de secours | — | ND | ND | ND | — | à décider (licences, confidentialité) |
| E-08 | Traitement différé (Batch), cache des consignes | — | PART | BLQ | DV | cache des consignes codé ; Batch ND | après E-01 |
| E-09 | Évaluation continue (corpus de référence, anti-régression) | interne | OK | — | — | `npm run ia:evaluation`, `evaluation-moteur.test.ts` | lancer avec un modèle après E-01 |
| E-10 | Sources juridiques officielles (Légifrance/PISTE, Judilibre, EUR-Lex) | — | ND | ND | ND | — | comptes PISTE à créer |
| E-11 | Analyse progressive : « Premiers résultats — analyse en cours » puis analyse IA | toutes | OK | OK | DV | `tests/moteur-progressif.test.ts` (4) ; recette 25/11, IA réelle, 2 pièces : premiers résultats 10 s, analyse IA 86 s, une seule notification ; captures `v12-premiers-resultats.png`, `v12-analyse-complete.png` | mesurer sur un lot plus grand (budget) ; pièces numérisées : pas de premiers résultats |

## F — Assistant ClairDossier IA et outils

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| F-01 | Panneau latéral à droite de « Vos résultats », mobile adapté | toutes | OK | OK | DV | captures V3/V5 | — |
| F-02 | Réponses par règles sur le dossier (résumé, démarches, échéances, recherche, comparaison) | toutes | OK | OK | DV | `intelligence.test.ts` ; 2,3 s en recette | — |
| F-03 | Conversation par modèle avec outils côté serveur | toutes | SIM | OK | DV | recette 25/11 (session V11, API réelle) : 3 réponses en mode modèle, outils serveur (echeances, resumer, prochaines_demarches, comparer, preparer_relance), 2-3 sources citées, 9 à 20 s | latence à réduire |
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
| G-02 | Bilan régulier des dossiers | toutes | OK | DNT | DV | horloge injectée | bilan quotidien créé, premier passage le 26/11 à 07:05 UTC |
| G-03 | Alerte avant échéance ou renouvellement (30, 7, 1 j) | toutes | OK | OK | DV | recette hébergée le 25/11 : passage du planificateur à 16:10:36 UTC (source « planificateur », navigateur fermé depuis 14:52), 1 exécution, preuve datée dans `/api/automatisations/…/executions` ; résultat : « aucune échéance dans les 30 jours » (aucune alerte à émettre) | alerte réellement émise : à observer avec une échéance proche |
| G-04 | Pause, reprise, annulation, plafonds, arrêt après 3 échecs | toutes | OK | OK | DV | pause et isolement vérifiés en recette | — |
| G-05 | Exécution réelle par le planificateur hébergé, navigateur fermé | toutes | OK | OK | DV | recette hébergée le 25/11 : passage du planificateur à 16:10:36 UTC (source « planificateur », navigateur fermé depuis 14:52), 1 exécution, preuve datée dans `/api/automatisations/…/executions` | — |
| G-06 | Idempotence, équité entre comptes, rattrapage unique | toutes | OK | PART | DV | tests ; une exécution réelle unique constatée (rattrapage marqué) ; équité entre comptes non observée en hébergé | — |
| G-07 | Déclencheur « à chaque pièce reçue » | toutes | OK | OK | DV | dépôt à 14:52 → exécution au passage de 16:10 (25/11) | exécution à la seconde : passage plus fréquent (offre payante) |
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
| J-01 | Réservation du coût maximal avant chaque appel, règlement après | — | OK | OK | DV | recette 25/11 (session V11, API réelle) : réservation puis règlement, réservations à 0 après chaque appel (`/api/moi/consommation`) | — |
| J-02 | Plafonds global et par compte, concurrence | — | OK | OK | DV | recette 25/11 (session V11, API réelle) : plafond global de lecture (1 €/mois) atteint et respecté | — |
| J-03 | Registre par appel (compte, fonction, modèle, jetons, cache, durée, coût) | — | OK | OK | DV | recette 25/11 (session V11, API réelle) : registre par appel lisible par le titulaire (modèle, jetons, cache, durée, coût) | — |
| J-04 | Alertes 70 / 90 / 100 %, une par palier et par mois | interne | OK | DNT | — | `recette-pilotage.test.ts` | E-01 |
| J-05 | Repli sur les règles au plafond, résultat annoncé partiel | toutes | OK | PART | DV | recette 25/11 (session V11, API réelle) : plafond global atteint → alerte BUDGET, synthèse par règles, six rendus publiés | affichage du motif « résultat partiel » au client : non relu |
| J-06 | Coupe-circuit des appels de modèle | interne | OK | DNT | — | `recette-assistant.test.ts` | — |
| J-07 | Calculateur de rentabilité (offres, options, gros consommateur, seuil, croissance, avec/sans crédits) | interne | OK | — | — | `RENTABILITE.md`, `rentabilite.test.ts` ; toutes les consommations sont ESTIMÉES | remplacer par des mesures réelles |
| J-08 | Coût réel mesuré par document, dossier, conversation | interne | BLQ | PART | — | MESURÉ 25/11 (petit échantillon) : ≈ 2,5 c€/pièce, ≈ 8 c€/synthèse, ≈ 1,5 c€/question ; `RENTABILITE.md` recalculé | mesurer sur un corpus plus large (accord de budget) |
| J-09 | Économie de l'IA (console fondateur) : marge directe par client, projection du mois, anomalies, recommandations | interne | OK | — | BLQ | `tests/economie-ia.test.ts` (4) ; onglet Supervision → « Économie de l'IA » (`src/components/admin/AdminEconomieIa.tsx`) ; coûts mesurés + montants Stripe, frais Stripe ESTIMÉS | production : migration 20261125140000 (Gérard) puis moteur IA ; aucune action automatique (décision du fondateur) |

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
| M-09 | Refonte du hero et de la conversion (8 leviers, 3 offres puis 7) | — | PART | PART | PART | hero en service : une promesse (« Des documents dispersés. Un dossier clair. »), une phrase, un bouton principal et un lien secondaire (vu en production le 25/11) ; avis clients, vidéo et « 3 offres puis 7 » non faits | décision propriétaire : aucun avis authentique disponible à ce jour |
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
| N-05 | Secrets côté serveur uniquement ; build de production sans élément de recette | — | OK | OK | OK | `revue-securite.test.ts` ; `dist/` du 25/11 : aucun secret, aucun compte fictif, aucune route de simulation, pas de /demo | — |
| N-06 | Stockage privé de la recette, liens non publics | — | OK | OK | — | Vercel Blob privé | architecture de recette, pas de production |
| N-07 | Dépendances sans vulnérabilité connue | — | OK | OK | OK | `npm audit` : 0 (25/11) | — |
| N-08 | Sauvegardes et restauration testées | — | ND | ND | BLQ | non vérifiable sans accès Supabase | vérifier dans Supabase → Backups |
| N-09 | CGV art. 6, confidentialité, DPA, AIPD à jour pour l'analyse automatique | — | PART | — | BLQ | projets dans `MOTEUR_ET_CONFORMITE.md` | validation juridique du propriétaire |
| N-10 | Analyse de sécurité dynamique (HawkScan ou équivalent) | — | ND | ND | ND | non exécutée | — |
| N-11 | Supabase de recette hébergé et isolé | — | OK | BLQ | — | recette locale 63 cas ; organisation à la limite gratuite | décision propriétaire |

## O — Application installable (PWA)

Même site, mêmes comptes, même serveur : l'application installée est le site ouvert sans barre de navigateur. Toutes les fonctions des catégories A à N y sont donc identiques (même code, même API) ; seules les lignes ci-dessous lui sont propres. **Aucun appareil physique n'a été utilisé** : les vérifications sont faites dans Chromium automatisé (ordinateur et écran de téléphone émulé). iPhone, iPad, Android, Safari Mac et Windows restent à confirmer par le fondateur. Détail et matrice : `PWA.md`.

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| O-01 | Manifeste (nom, identifiant stable, plein écran, couleurs, raccourcis) | toutes, gratuit | OK | ÉMU | ND | `tests/pwa.test.ts` ; manifeste servi en recette | arrive en production à la fusion de la PR #71 |
| O-02 | Icônes 192, 512, adaptative, Apple — dérivées du logo officiel | toutes | OK | ÉMU | PART | test des tailles ; 192/512/Apple déjà en production | icône adaptative : à la fusion |
| O-03 | Recette et démonstration distinctes de la production (nom, identifiant, icône « RECETTE ») | — | OK | ÉMU | — | `tests/pwa.test.ts` | — |
| O-04 | « Installer l'application » dans Mon compte et dès la connexion, sans abonnement | toutes | OK | ÉMU | ND | parcours Chromium, `captures/v9-installer-*.png` | — |
| O-05 | Invitation native (Chrome, Edge, Android) | toutes | DNT | DNT | ND | code `src/lib/pwa.ts` ; l'invitation du navigateur ne se déclenche pas en navigateur automatisé | essai sur un vrai Chrome/Android |
| O-06 | Consignes iPhone/iPad, Android, Safari Mac, ordinateur selon le navigateur détecté | toutes | OK | ÉMU | ND | `tests/pwa.test.ts` (détection) ; aucun iPhone réel | essai sur iPhone |
| O-07 | Aucune invitation répétée une fois l'application ouverte | toutes | OK | ÉMU | ND | mode application émulé | — |
| O-08 | Service worker minimal : seule la page hors connexion est en cache | toutes | OK | ÉMU | ND | test statique + cache inspecté après dépôt, rendus et archive : 2 fichiers publics, rien d'autre | — |
| O-09 | Aucune donnée privée sur l'appareil (cache, IndexedDB, stockage local vides) | toutes | OK | ÉMU | ND | inspection après parcours complet | — |
| O-10 | Hors connexion : écran simple, aucun ancien résultat affiché, API sans réponse en cache | toutes | OK | ÉMU | ND | parcours hors ligne | — |
| O-11 | Mise à jour proposée, jamais imposée (pas de rechargement pendant un dépôt) | toutes | PART | DNT | ND | logique testée statiquement ; passage réel d'une version à l'autre non observé | observer au prochain déploiement |
| O-12 | Désactivation à distance du service worker (`/pwa.json`) et retour arrière | interne | OK | ÉMU | ND | désinscription et caches vidés constatés | — |
| O-13 | Zones sécurisées (encoche, barre d'accueil), cibles tactiles de 44 px | toutes | DNT | DNT | ND | règles CSS en place ; aucun iPhone réel | essai sur iPhone |
| O-14 | Synchronisation site ↔ application (mêmes données serveur) | toutes | OK | OK | ND | par construction : aucune donnée locale ; deux sessions du même compte lisent le même serveur | — |
| O-15 | Photo et fichiers du téléphone au dépôt | toutes | DNT | DNT | ND | champ de dépôt acceptant les images (sélecteur natif) ; aucun téléphone réel | essai sur téléphone |
| O-16 | Notifications poussées (analyse terminée, échéance, automatisation) | toutes | ND | ND | ND | — | clés d'envoi à créer dans le coffre serveur, abonnement par appareil, envoi sans contenu confidentiel |
| O-17 | Partage d'un document vers ClairDossier depuis une autre application | toutes | ND | ND | ND | — | Android/Chrome uniquement ; à développer |
| O-18 | Retour OAuth et paiement dans l'application installée | Entrepreneur → | BLQ | BLQ | ND | dépend de H-01/H-02 et I-03 | — |

## P — Un seul ClairDossier (unification V11, décision « tout sur Supabase »)

Référence : les pages client ORIGINALES, branchées sur Supabase. « Local » = Supabase local (docker) + navigateur automatisé, le 25/11. Détail : `UNIFICATION.md`.

| ID | Fonction | Offres | Local | Recette | Production | Preuve | Reste à faire |
|---|---|---|---|---|---|---|---|
| P-01 | Accueil, tarifs, navigation et pied de page ORIGINAUX sur la recette (variantes retirées) | — | OK | OK | OK | recette hébergée le 25/11 : titre et hauteur identiques à la production | — |
| P-02 | Tarifs originaux → connexion → paiement de recette de la même formule | toutes | OK | OK | — | parcours hébergé (Entrepreneur) le 25/11 | Stripe bac à sable (I-03) |
| P-03 | ClairDossier IA à droite de « Vos résultats » dans la page dossier ORIGINALE | toutes | OK | ND | ND | `captures/v11-dossier-ia-ordi.png`, mobile 390 px | migration 20261126120000 + drapeau en production (accord) |
| P-04 | Rappel confirmé → vraie échéance (RLS) depuis la page originale | toutes | OK | ND | ND | ligne créée le 25/11 | idem |
| P-05 | Automatisation confirmée → exécutée par `pg_cron` navigateur fermé, preuve unique | toutes | OK | ND | ND | exécution autonome 17:07:00 le 25/11 ; 124 tests SQL | idem ; avec modèle : E-01 |
| P-06 | Mon compte ORIGINAL : à décider, depuis la dernière visite, automatisations, préférences | toutes | OK | ND | ND | `captures/v11-compte-*.png` | idem |
| P-07 | Isolation A/B sur les nouvelles données (historique, préférences, automatisations, notifications) | toutes | OK | ND | BLQ | tests SQL + B « introuvable » dans le navigateur | production : N-01 |
| P-08 | Build de production inchangé sans le drapeau (aucun code d'intelligence ni de recette) | — | OK | — | — | `dist/` contrôlé le 25/11 | — |
| P-09 | Espace client de la recette hébergée = pages originales | — | — | BLQ | — | aucun Supabase de recette hébergé (choix « local seulement ») | projet Supabase hébergé (décision) |

<!-- SYNTHESE -->
## Synthèse (calculée par `node scripts/synthese-fonctionnalites.mjs`)

Fonctionnalités recensées : **151**.

### Local

| OK | ÉMU | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|---|
| 110 | 0 | 7 | 6 | 6 | 2 | 15 | 2 | 3 |

- Couverture de vérification : 145/151 = **96 %** (état établi par une preuve ; exclus : les 6 « développé mais non testé »).
- Taux d'opérationnalité : 110/146 = **75 %** vérifié réellement, plus 0 vérifié par émulation (périmètre actif = recensées − sans objet − désactivées volontairement ; simulé, bloqué et non développé restent au dénominateur).

### Recette

| OK | ÉMU | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|---|
| 56 | 10 | 10 | 11 | 4 | 11 | 24 | 5 | 20 |

- Couverture de vérification : 140/151 = **93 %** (état établi par une preuve ; exclus : les 11 « développé mais non testé »).
- Taux d'opérationnalité : 56/126 = **44 %** vérifié réellement, plus 10 vérifié par émulation (périmètre actif = recensées − sans objet − désactivées volontairement ; simulé, bloqué et non développé restent au dénominateur).

### Production

| OK | ÉMU | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|---|
| 11 | 0 | 5 | 14 | 0 | 8 | 41 | 56 | 16 |

- Couverture de vérification : 137/151 = **91 %** (état établi par une preuve ; exclus : les 14 « développé mais non testé »).
- Taux d'opérationnalité : 11/79 = **14 %** vérifié réellement, plus 0 vérifié par émulation (périmètre actif = recensées − sans objet − désactivées volontairement ; simulé, bloqué et non développé restent au dénominateur).

### Par catégorie (colonne Recette)

| Catégorie | Total | OK | ÉMU | PART | DNT | SIM | BLQ | ND | DV | — |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 7 | 4 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 2 |
| B | 8 | 3 | 0 | 1 | 0 | 2 | 0 | 0 | 1 | 1 |
| C | 12 | 6 | 0 | 1 | 1 | 0 | 0 | 3 | 0 | 1 |
| D | 9 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| E | 11 | 5 | 0 | 0 | 0 | 0 | 3 | 2 | 0 | 1 |
| F | 14 | 7 | 0 | 3 | 0 | 0 | 0 | 3 | 0 | 1 |
| G | 10 | 5 | 0 | 1 | 2 | 0 | 0 | 1 | 1 | 0 |
| H | 6 | 0 | 0 | 0 | 0 | 1 | 3 | 0 | 1 | 1 |
| I | 4 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | 0 |
| J | 9 | 3 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 2 |
| K | 6 | 0 | 0 | 0 | 1 | 0 | 1 | 1 | 0 | 3 |
| L | 5 | 1 | 0 | 0 | 0 | 0 | 0 | 3 | 1 | 0 |
| M | 12 | 6 | 0 | 2 | 1 | 0 | 0 | 0 | 1 | 2 |
| N | 11 | 4 | 0 | 0 | 0 | 0 | 1 | 2 | 0 | 4 |
| O | 18 | 1 | 10 | 0 | 4 | 0 | 1 | 2 | 0 | 0 |
| P | 9 | 2 | 0 | 0 | 0 | 0 | 1 | 5 | 0 | 1 |
