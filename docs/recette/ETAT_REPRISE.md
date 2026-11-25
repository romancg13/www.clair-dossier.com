# État de reprise — recette ClairDossier (V3)

Mis à jour : 2026-11-25 · branche unique `claude/clairdossier-optimization-85z7y5` (PR brouillon #70, NON fusionnée) · base `main@6f8f788`.
La PR #68 (`claude/clair-dossier-workflow-63mjz1@c9753d6`) y est fusionnée : #70 est la seule référence.
Production : inchangée. Aucune migration appliquée à un Supabase distant, aucun paiement, aucun DNS.

Légende : VÉRIFIÉ EN LOCAL · VÉRIFIÉ SUR RECETTE HÉBERGÉE · IMPLÉMENTÉ NON TESTÉ · SIMULÉ · BLOQUÉ · DIFFÉRÉ.

## Environnements (une seule branche, un seul build : `scripts/vercel-build.mjs`)

| URL | Rôle | Contenu |
|---|---|---|
| https://clairdossier-preview.vercel.app/demo | **URL de validation** | Démonstration fictive publique : dossier simplifié, six résultats, ClairDossier IA |
| https://clairdossier-recette-20b5a2.vercel.app/connexion | Parcours réel (lié depuis /demo) | Comptes fictifs isolés, dépôt → traitement serveur → résultats, stockage Vercel Blob privé (Paris) |

Les deux sont non indexées et sans lien Stripe LIVE (`scripts/preview-neutralise.mjs`, build en échec s'il en reste un).

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

À compléter au retour du lot (branche de travail isolée, voir journal Git).

## Blocages — action minimale du propriétaire

1. **Supabase isolé hébergé** — BLOQUÉ : organisation à la limite gratuite (2 projets actifs, tous deux étrangers à ClairDossier ; les 2 projets ClairDossier sont en pause). Une action : autoriser la reprise de « ClairDossier's Projet » à la place d'un projet actif, ou un projet payant.
2. **Analyse IA réelle** — BLOQUÉ : aucune clé d'API de recette (passerelle Vercel : offre gratuite refusée ; aucune clé Anthropic). Une action : saisir `ANTHROPIC_API_KEY` comme secret du projet de recette (jamais dans le chat). Tant que ce n'est pas fait : lecture par règles déterministes (réel), chaîne IA SIMULÉE, assistant sans modèle.
3. **Messagerie** — BLOQUÉ : applications OAuth Google Cloud et Microsoft Entra, compte Resend.
4. **Stripe bac à sable** — DIFFÉRÉ : paiement simulé sur la recette ; aucune option n'est vendue.
5. **Juridique** — CGV art. 6, confidentialité, AIPD : projets dans `MOTEUR_ET_CONFORMITE.md` et `REMISE.md` §6, rien publié.

DIFFÉRÉ (backlog) : refonte vitrine/hero/navigation (§15), assistant côté serveur avec modèle et historique persistant,
exécution planifiée des automatisations, TUS pour Supabase Storage en production, mesures 20 × 250 fichiers,
MCP depuis l'interface ChatGPT/Claude, démonstration universelle (protections prêtes, lien NON généré).

## Reprise et retour arrière

- Tests : `npm run typecheck && npm run typecheck:recette && npm test` ; SQL : `npm install --no-save @electric-sql/pglite && node tests/sql/migrations.pglite.mjs`.
- Recette Supabase locale : voir `RECETTE_LOCALE.md`.
- Retour arrière : rien n'est fusionné. Preview : redéployer `6656df4` ; recette hébergée : redéployer `1d72ccb`. Chaque migration a son fichier dans `supabase/rollback/`.

## Prochaine action

Attendre l'accord explicite du propriétaire avant toute fusion dans `main`, toute migration réelle et toute activation du lien commercial universel.
