# État de reprise — recette ClairDossier (V6)

Mis à jour : 2026-11-25 · PR #70 **fusionnée** (production `85bbb4e`) · travaux V6 : branche `claude/clairdossier-optimization-85z7y5`, PR brouillon #71, NON fusionnée · commit déployé : voir `ETAT_FONCTIONNALITES.md`.
Source unique de l'état de chaque fonctionnalité : `ETAT_FONCTIONNALITES.md` (122 lignes, synthèse calculée). Sécurité de la production : `SECURITE_ISOLATION.md`.
Production : inchangée depuis la fusion. Aucune migration appliquée, aucun paiement. Appels d'API payants : recette uniquement (clé installée le 25/11), environ 1 € de lecture (plafond mensuel atteint) et environ 0,2 USD d'assistant.

Légende : VÉRIFIÉ EN LOCAL · VÉRIFIÉ SUR RECETTE HÉBERGÉE · IMPLÉMENTÉ NON TESTÉ · SIMULÉ · BLOQUÉ · DIFFÉRÉ.

## Travaux V6 (2026-11-25)

| Lot | Statut | Preuve |
|---|---|---|
| Diagnostic d'isolation en lecture seule pour la production | VÉRIFIÉ EN LOCAL · production BLOQUÉ (aucun accès) | `supabase/verification/`, 118 tests SQL |
| Centre d'actions multidossiers, préférences de l'assistant | VÉRIFIÉ SUR RECETTE | `tests/recette-pilotage.test.ts`, `captures/v6-recette-compte.png` |
| « Depuis votre dernière visite », coupe-circuit, alertes de budget 70/90/100 % | VÉRIFIÉ EN LOCAL | idem, `tests/recette-assistant.test.ts` (16) |
| Premier résultat plus tôt (exécuteur, accès au stockage, sondage adaptatif) | VÉRIFIÉ SUR RECETTE : 15 s (premier résultat), 23 s (six rendus) contre 37–39 s | `tests/recette-performance.test.ts`, `scripts/recette/latence.ts` |
| Preuve de passage du planificateur | VÉRIFIÉ EN LOCAL ; recette : automatisation quotidienne créée, passage du 26/11 07:05 UTC à lire | `/api/planificateur` |
| Évaluation continue du moteur ; correctif « partie inventée » | VÉRIFIÉ EN LOCAL (exactitude 100 %, citations 100 %) | `npm run ia:evaluation`, `tests/evaluation-moteur.test.ts` |
| Rentabilité : gros consommateur, seuil, croissance, avec/sans crédits | VÉRIFIÉ EN LOCAL (consommations ESTIMÉES) | `RENTABILITE.md` |
| Capacité 10 → 250 fichiers et 20 × 250 | VÉRIFIÉ EN LOCAL ; recette hébergée : NON TESTÉ | `CAPACITE.md`, `mesures/` ; correctif du rendu « Résumé » (288 s → 14 s à 250 fichiers) |
| Build de production contrôlé, procédure de mise en production | VÉRIFIÉ EN LOCAL, non exécutée | `DEPLOIEMENT_PRODUCTION.md` |
| Exécution par le planificateur hébergé, navigateur fermé | VÉRIFIÉ SUR RECETTE : passage du 25/11 à 16:10:36 UTC, 1 automatisation exécutée | `/api/planificateur`, preuve d'exécution datée |
| Application installable (PWA) | VÉRIFIÉ EN LOCAL et par émulation sur la recette ; aucun appareil physique | `PWA.md`, `tests/pwa.test.ts` |
| Clé API Claude, Supabase de production, Stripe bac à sable, OAuth Gmail/Outlook | BLOQUÉ | actions propriétaire ci-dessous |

Tests : 467 unitaires, 118 SQL, typecheck site + recette, build recette OK.

## Environnements (une seule branche, un seul build : `scripts/vercel-build.mjs`)

| URL | Rôle | Contenu |
|---|---|---|
| https://clairdossier-preview.vercel.app/demo | **URL de validation** | Démonstration fictive publique : dossier simplifié, six résultats, ClairDossier IA |
| https://clairdossier-recette-20b5a2.vercel.app/connexion | Parcours réel (lié depuis /demo) | Comptes fictifs isolés, dépôt → traitement serveur → résultats, stockage Vercel Blob privé (Paris) |

Les deux sont non indexées et sans lien Stripe LIVE (`scripts/preview-neutralise.mjs`, build en échec s'il en reste un).

## Travaux V5 (2026-11-25, déployés : `a5a152b`)

| Jalon | Statut | Preuve |
|---|---|---|
| J1 — clé API, modèle réel | **BLOQUÉ** (une manipulation propriétaire) | `ACTIVATION_API.md` ; aucun outil de session ne peut ouvrir la Claude Console ; aucun appel payant lancé, coût constaté : 0 |
| J2 — assistant exécutant des outils côté serveur | VÉRIFIÉ EN LOCAL (modèle SIMULÉ) · VÉRIFIÉ SUR RECETTE en mode règles | `tests/recette-assistant.test.ts` (15) ; `captures/v5-assistant-recette-*.png` ; réponse en 2,3 s |
| J3 — analyse d'un nouveau document, six rendus | VÉRIFIÉ SUR RECETTE (lecture par règles) | lot de 4 pièces → premier résultat 37–39 s ; lecture par IA : BLOQUÉ (J1) |
| J4 — automatisation réellement exécutée | VÉRIFIÉ EN LOCAL (horloge injectée, 14 tests) ; créée, mise en pause et isolée SUR RECETTE | `tests/recette-automatisations.test.ts` ; `captures/v5-automatisations.png` ; première exécution réelle par le planificateur hébergé : NON TESTÉ (cron quotidien 07:05 UTC, échéance vendredi) |
| J5 — coûts, quotas, rentabilité | VÉRIFIÉ EN LOCAL | réservation avant appel, plafonds global/compte, concurrence ; `RENTABILITE.md` (hypothèses d'usage, rien de mesuré en réel) |
| J6 — messagerie, Stripe bac à sable, options | BLOQUÉ / DIFFÉRÉ | inchangé : OAuth Google/Microsoft, Resend, compte Stripe de test |
| J7 — simplification, recette finale | VÉRIFIÉ SUR RECETTE | preview et recette : 0 lien Stripe LIVE, noindex, 0 erreur JS, ordinateur + mobile |

Nouveautés : `recette/server/assistant.ts` (modèle + outils, FinOps, historique), `recette/server/automations.ts`,
`scripts/rentabilite.mjs`, page `/admin` (coûts IA, santé du fournisseur), planificateur sans secret à saisir
(clé dérivée côté serveur, inscrite au build), rappel confirmé = vraie échéance du dossier.
Tests : 433 unitaires verts, typecheck site + recette, build recette OK.

Limites connues : heure d'exécution des automatisations = passage quotidien du planificateur (8 h 05 en hiver, 9 h 05 en été) ;
déclencheur « à chaque pièce reçue » exécuté au passage suivant ; assistant non monté dans l'espace client de production
(Supabase, moteur désactivé — CGV art. 6) ; recherche de l'assistant sur l'analyse, pas sur le texte intégral.

## Travaux V3

| Lot | Statut | Preuve |
|---|---|---|
| Consolidation #68 + #70 (2 conflits résolus, correctifs, migrations et tests des deux conservés) | VÉRIFIÉ EN LOCAL | typecheck site + recette, tests unitaires, 117 tests SQL, build 36 routes |
| Écran dossier simplifié : suivi en une ligne, 3 priorités, situation d'abord, résultats en liste, 5 jalons, date de référence unique, outils de démo repliés | VÉRIFIÉ SUR RECETTE HÉBERGÉE (preview) | `captures/v3-avant-*.png` / `v3-apres-*.png` ; 1440 px : 5 326 → 3 153 px, 1 253 → 567 mots, 46 → 30 boutons ; 390 px : 11 474 → 5 294 px |
| Écarts entre pièces : contestation / différence documentaire / contradiction réelle | VÉRIFIÉ EN LOCAL | `tests/attention.test.ts` |
| ClairDossier Intelligence (registre fermé, 3 niveaux d'autonomie, refus des actions sensibles, anti-injection) | VÉRIFIÉ EN LOCAL + parcours navigateur sur la preview | `tests/intelligence.test.ts` (11) ; `captures/v3-intelligence-*.png` ; limites dans `INTELLIGENCE.md` |
| Dépôt direct > 4 Mo vers le stockage privé (25 Mo par fichier, envoi par 4) | VÉRIFIÉ SUR RECETTE HÉBERGÉE | 9 Mo + 12 Mo envoyés en 11,6 s puis lus, six résultats produits ; `tests/recette-depot-direct.test.ts` (4) |
| LinkedIn retiré des options ; « Personnaliser mon espace » (aperçu, tarifs provisoires, aucune vente) | VÉRIFIÉ EN LOCAL | visible sur /demo ; inerte dans l'espace client sans `VITE_OPTIONS_PREVIEW=1` |
| Dépendances : zod sous `@vercel/cli-config` | VÉRIFIÉ EN LOCAL | `npm audit` : 0 vulnérabilité (4 hautes avant) |
| CLS de /demo | VÉRIFIÉ EN LOCAL | 0,59 → 0 (mobile simulé) ; LCP mesuré sur la preview : / 0,70 s · /tarifs 0,54 s · /demo 1,85 s |
| Défauts moteur de REMISE §11 (équité, citations, repli budget, relecture, latence) | voir section « Moteur » ci-dessous | |

Acquis de la session précédente, inchangés et non rejoués : recette Supabase locale (63 cas, 0 échec), correctif RLS `20261125150000`,
essai prospect inactif, messagerie directe (IMPLÉMENTÉ NON TESTÉ), supervision (SQL), six PDF à la charte.

## Moteur (REMISE §11)

Lot fusionné (`2b88a05`), chaque point avec un test qui échoue sans le correctif — VÉRIFIÉ EN LOCAL (magasin en mémoire) :

| Défaut ouvert | Correctif | Test |
|---|---|---|
| Équité entre clients | Prise des travaux à tour de rôle entre comptes, 2 travaux en cours au plus par compte | `tests/moteur-equite.test.ts` |
| Citation validée par un mot isolé | Passage d'au moins 2 mots significatifs, ou valeur typée concordante (date, montant, référence), ou partie vérifiée sur la même pièce | `tests/moteur-citations.test.ts` |
| Budget IA épuisé sans repli | Repli sur les règles, résultat annoncé PARTIEL avec motif, reprise au cycle suivant sans double décompte | `tests/moteur-budget.test.ts` |
| Pièce en échec = nouveau dépôt | Relecture automatique après 1 h, 6 h, 24 h (3 au plus) ; reste « illisible » d'ici là | `tests/moteur-relecture.test.ts` |
| Latence (lectures du stockage) | Dépôt de 4 pièces → premier résultat : 207 → 174 accès, 140 → 107 lectures | `tests/moteur-acces-stockage.test.ts` |
| Facture échue sans preuve d'impayé | « Paiement à vérifier » confirmé | `tests/moteur-citations.test.ts` |

Le gain de latence réel sur la recette hébergée est à lire dans la remise (mesure navigateur), pas dans ces compteurs.

## Travaux V11 (2026-11-25) — IA réelle sur la recette

| Lot | Statut | Preuve |
|---|---|---|
| Clé `ANTHROPIC_API_KEY` (sensible, recette seulement), redéploiement | VÉRIFIÉ SUR RECETTE | commit déployé `74767fa`, aucune valeur affichée |
| Assistant avec modèle : routage Haiku / Sonnet / Opus, outils, sources | VÉRIFIÉ SUR RECETTE | 9–25 s par réponse ; 0,085 puis 0,067 USD pour 3 questions |
| Lecture des pièces par le modèle | VÉRIFIÉ SUR RECETTE | 2,5 à 32 c€ par pièce |
| Synthèse par le modèle | VÉRIFIÉ SUR RECETTE après 2 correctifs | API : « compiled grammar is too large » → outil non strict + validation zod ; `tests/schema-filaire.test.ts` |
| Plafond global de lecture (1 €/mois) | ATTEINT le 25/11, repli par règles VÉRIFIÉ | alerte BUDGET ; plus de lecture IA avant décembre sans accord |
| Rentabilité avec coûts mesurés | VÉRIFIÉ (petit échantillon) | `RENTABILITE.md` : usage normal 84–89 %, intensif 14–62 %, seuil 6 clients |
| Unification sur Supabase (pages originales + IA + automatisations pg_cron) | VÉRIFIÉ SUR SUPABASE LOCAL | `UNIFICATION.md`, captures `v11-*` |

Point faible : premier résultat avec IA 142–207 s (30 s par règles). Piste : publier d'abord l'aperçu par règles puis remplacer par la synthèse du modèle, effort réduit pour la consolidation.

## Blocages — action minimale du propriétaire

1. **Supabase isolé hébergé** — BLOQUÉ : organisation à la limite gratuite (2 projets actifs, tous deux étrangers à ClairDossier ; les 2 projets ClairDossier sont en pause). Une action : autoriser la reprise de « ClairDossier's Projet » à la place d'un projet actif, ou un projet payant.
2. **Analyse IA réelle** — ACTIVE sur la recette (25/11). Plafond de lecture de 1 €/mois atteint : poursuivre les essais demande l'accord du propriétaire pour relever ce plafond (dans la limite totale de 2 USD).
3. **Messagerie** — BLOQUÉ : applications OAuth Google Cloud et Microsoft Entra, compte Resend.
4. **Stripe bac à sable** — DIFFÉRÉ : paiement simulé sur la recette ; aucune option n'est vendue.
5. **Juridique** — CGV art. 6, confidentialité, AIPD : projets dans `MOTEUR_ET_CONFORMITE.md` et `REMISE.md` §6, rien publié.

DIFFÉRÉ (backlog) : refonte vitrine/hero/navigation (§15), assistant côté serveur avec modèle et historique persistant,
exécution planifiée des automatisations, TUS pour Supabase Storage en production, mesures 20 × 250 fichiers,
MCP depuis l'interface ChatGPT/Claude, démonstration universelle (protections prêtes, lien NON généré).

## Reprise et retour arrière

- Tests : `npm run typecheck && npm run typecheck:recette && npm test` ; SQL : `npm install --no-save @electric-sql/pglite && node tests/sql/migrations.pglite.mjs`.
- Recette Supabase locale : voir `RECETTE_LOCALE.md`.
- Retour arrière : la PR #71 n'est pas fusionnée. Recette et preview : redéployer `a5a152b` (V5) sur les deux projets. Production : revert de `85bbb4e`. Chaque migration a son fichier dans `supabase/rollback/`.

## Prochaine action

1. Propriétaire : exécuter le diagnostic d'isolation (`SECURITE_ISOLATION.md`) — priorité.
2. Propriétaire : clé API (`ACTIVATION_API.md`), puis `npm run ia:evaluation` avec modèle.
3. Lire le passage du planificateur du 26/11 ; relancer la mesure de capacité.
Aucune fusion dans `main`, migration réelle ou activation du lien universel sans accord explicite.
