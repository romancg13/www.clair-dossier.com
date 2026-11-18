# Quotas IA par offre — proposition de recette (2026-11-18)

> Statut : **PROPOSITION À VALIDER par le propriétaire.** Rien n'est publié sur le site
> (src/data/pricing.ts inchangé, paiements gelés intacts) ; les plafonds n'ont d'effet
> qu'une fois la migration appliquée ET le moteur IA activé — donc uniquement en recette.
> Implémentation : `supabase/migrations/20261118120000_quotas_ia_offres.sql`
> (retour arrière : `supabase/rollback/20261118120000_quotas_ia_offres.down.sql`),
> contrôle dans `supabase/functions/ai-worker/index.ts`, tests réels
> `tests/sql/migrations.pglite.mjs` (« quotas par offre »).

## Grille proposée (configuration serveur unique : `plan_entitlements`)

| Offre | Prix €/mois | Dossiers | Utilisateurs | Pages IA/mois | Actions IA/mois |
|---|---|---|---|---|---|
| Essentiel | 19 | 5 | 1 | **50** | **0** |
| Entrepreneur | 39 | 10 | 2 | **150** | **20** |
| Business PME 20 | 49 | 20 | 5 | **300** | **50** |
| Business PME 50 | 89 | 50 | 5 | **800** | **150** |
| Business / PME Pro | 169 | illimités | 15 | **2 000** | **400** |
| Business / PME Premium | 299 | illimités | illimités | **5 000** | **1 000** |
| Business / PME personnalisée | devis | illimités | illimités | contractuel* | contractuel* |

\* Par `entitlement_overrides` (colonnes `ai_pages_month` / `ai_actions_month`), compte par compte,
avec motif obligatoire — jamais dans la grille commune. Prix, dossiers et utilisateurs : inchangés
(vérifiés identiques à `src/data/pricing.ts` et à `plan_entitlements`).

## Définitions (reprises en commentaire de la migration)

- **Page IA** : page lue d'une pièce lors d'une **extraction réussie** — PDF = pages réelles
  (comptées avant l'appel au modèle), image = 1, texte/DOCX/XLSX/CSV = 1 par pièce.
  Le **résumé initial** (consolidation du dossier) **est compris** : il ne consomme aucune page.
  Un échec ou un format non pris en charge ne consomme rien.
- **Action IA** : question posée sur un dossier **ou** brouillon complémentaire demandé hors
  analyse initiale (générations complémentaires de recette comprises). Décomptée par
  `ai_consume_action` (journal `ai_action_events`, jamais de décompte sans journal ni l'inverse).
- **Réanalyses** : la réextraction d'une pièce **remplace** son extraction (unicité par pièce :
  jamais de double décompte le même mois) ; relue un autre mois, elle compte dans ce mois-là.
- **Renouvellement** : mensuel **calendaire**, y compris en facturation annuelle (−10 % inchangé).
- **Tailles / stockage** : limites existantes conservées (25 Mo par fichier côté client,
  30 Mo côté moteur) ; aucun quota de stockage ajouté — à décider séparément si besoin.
- **« Dossiers illimités » ≠ consommation illimitée** : Pro et Premium restent plafonnées.
- **Plafond atteint** : suspension des **nouveaux** traitements seulement (état « pause »
  existant, même mécanique que le plafond de dépense) ; données, résultats, exports et dépôt
  **conservés** ; **aucune facturation supplémentaire** ; reprise automatique le mois suivant
  ou sur relèvement du plafond (dérogation).

## Ordre de contrôle (inchangé, conforme V.5)

`AUTH → abonnement actif (ou dérogation administrative) → activation du dossier (CGV) →
budget de dépense (compte + global) → quota de pages de l'offre → traitement`.
Le quota est vérifié **côté serveur** par le worker, jamais par l'interface ; l'interface
lit seulement `get_my_ai_quota()` (titulaire, lecture seule).

## Mesure sur échantillon — BLOQUÉE, estimation par le modèle de coût

Aucune clé `ANTHROPIC_API_KEY` sur cette machine : aucun passage réel mesurable
(`scripts/ia-corpus-test.ts` prêt à l'emploi dès qu'une clé de recette existe).
Estimation à partir du barème codé (`_shared/ai-pipeline.ts`, Opus 4/20 $ par MTok,
≈ 1 500–3 000 tokens d'entrée par page PDF) :

| Offre | Pages/mois | Coût IA estimé/mois (Opus) | % du prix |
|---|---|---|---|
| Essentiel | 50 | ≈ 0,5–1,2 € | 3–6 % |
| Entrepreneur | 150 | ≈ 1,5–3,5 € | 4–9 % |
| PME 20 | 300 | ≈ 3–7 € | 6–14 % |
| PME 50 | 800 | ≈ 8–18 € | 9–20 % |
| Pro | 2 000 | ≈ 20–45 € | 12–27 % |
| Premium | 5 000 | ≈ 50–110 € | 17–37 % |

Conséquences à arbitrer avant toute publication commerciale :
1. Le **budget de dépense** par compte (défaut 20 €/mois) doit être relevé pour Pro/Premium,
   sinon il s'applique avant le quota (c'est le comportement voulu tant que rien n'est validé).
2. Passer `AI_MODEL_EXTRACT` à Sonnet (2/10 $) ou Haiku (0,1/0,5 $) après évaluation sur corpus
   divise le coût par ~2 à ~40 : la mesure réelle sur échantillon reste indispensable
   avant de figer la grille.

## Reste à faire (décisions propriétaire)

- [ ] Valider ou ajuster la grille ci-dessus (UPDATE simple de `plan_entitlements`).
- [ ] Clé API de recette → mesurer `scripts/ia-corpus-test.ts` et confirmer les coûts.
- [ ] Fixer `AI_BUDGET_CENTS_PER_USER_MONTH` par rapport au quota de la plus grande offre.
- [ ] Publication commerciale (pages tarifs/CGV) : séparée, jamais automatique.
