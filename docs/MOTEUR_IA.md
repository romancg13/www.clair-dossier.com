# Moteur documentaire IA — exploitation (2026-10-23)

Traitement automatique des pièces d'un dossier : dépôt → lecture → extraction sourcée →
consolidation → livrables publiés dans l'espace client → e-mail de disponibilité.
Fonctionne sans navigateur ni poste de travail : tout l'état vit dans Supabase.

## Architecture (une seule orchestration : Supabase)

| Brique | Rôle | Fichier |
|---|---|---|
| `dossier_ai_settings` | activation **par dossier**, traçable (qui, quand, version des conditions) | `supabase/migrations/20261023120000_moteur_documentaire_ia.sql` |
| `ai_jobs` | file de travaux (`extract` par pièce, `consolidate` par dossier) : un travail ouvert par clé, `for update skip locked`, bail 5 min, 3 tentatives, backoff 2^n min | idem |
| `ai_extractions` / `ai_analyses` | résultats par pièce (remplacés) / par révision de dossier (historisés), coût et jetons | idem |
| déclencheur `documents_ai_enqueue` | dépôt / corbeille / restauration d'une pièce ⇒ extraction + consolidation temporisée 90 s (réarmée) | idem |
| `pg_cron` → `pg_net` | toutes les minutes, appelle la fonction `ai-worker` (si l'extension `pg_cron` est activée sur le projet) | idem §9 |
| `ai-worker` (Edge Function) | une étape par travail, 3 travaux par invocation, budget 100 s ; Claude via `@anthropic-ai/sdk` (PDF/images natifs, DOCX/XLSX/CSV/texte convertis) ; livrables PDF/CSV/ICS ; e-mail Resend sans contenu | `supabase/functions/ai-worker/index.ts` |
| helpers purs | détection de type, vérification des preuves, CSV/ICS, coût, couverture | `supabase/functions/_shared/ai-pipeline.ts` |
| interface | panneau « Traitement automatique » dans l'onglet DashBoard du dossier | `src/components/dossier/AiPanel.tsx` |

Pourquoi pas Vercel Workflows : le site est servi par GitHub Pages, le backend est Supabase ; ajouter un second
hébergeur de calcul créerait une dépendance et un contrat de sous-traitance de plus pour un gain nul.

## Garanties

- **Jamais rétroactif** : un dossier non activé n'est jamais lu ; à la désactivation, les travaux ouverts sont annulés et
  les pièces ajoutées ensuite ne sont plus lues. L'activation exige un abonnement actif (ou une dérogation administrative)
  et consigne `terms_version` (constante `AI_TERMS_VERSION` côté site).
- **Contenu non fiable** : aucun outil n'est exposé au modèle, sortie à schéma strict (zod), chaque preuve
  `{document_id, page, quote}` est vérifiée côté serveur (pièce du dossier, extrait non vide, page plausible) ; les
  références invalides sont retirées et comptées (`coverage.stripped_references`), l'élément reste marqué `unverified`.
- **Couverture explicite** : « analyse complète » uniquement si toutes les pièces sont lues ou déclarées non prises en
  charge ; sinon la mention « analyse partielle x/y » figure dans l'interface, les PDF et l'e-mail.
- **Corrections humaines** : toute échéance modifiée par l'utilisateur (`user_edited`) n'est plus touchée par les
  réanalyses ; les échéances manuelles (sans `ai_key`) ne sont jamais en conflit.
- **Versions** : chaque consolidation crée une révision `ai_analyses` ; les livrables précédents passent à la corbeille
  (conservés), seuls ceux de la dernière révision restent visibles ; les livrables déposés à la main par l'équipe
  (`generated_by` null) ne sont jamais touchés.
- **E-mails** : au client uniquement, lien vers l'espace authentifié, sans pièce ni résumé. Les relances vers des tiers
  sont des **brouillons** (PDF), jamais envoyées.
- **Budget** : `AI_BUDGET_CENTS_PER_USER_MONTH` (défaut 2000 = 20 €/compte/mois) ; dépassé ⇒ travaux en `failed`
  avec `BUDGET:` et état « pause » dans l'interface. Aucune réduction silencieuse de la couverture.

## Configuration serveur (secrets Supabase — jamais côté client)

| Secret | Obligatoire | Rôle |
|---|---|---|
| `ANTHROPIC_API_KEY` | oui | sans elle, `ai-worker` répond 503 et ne réclame aucun travail |
| `AI_MODEL_EXTRACT`, `AI_MODEL_CONSOLIDATE` | non | défaut `claude-opus-5-5` ; à ajuster après évaluation sur corpus |
| `AI_BUDGET_CENTS_PER_USER_MONTH` | non | défaut 2000 |
| `RESEND_API_KEY` | non | e-mail client de disponibilité (déjà utilisé par notify-lead) |

## Mise en service (une fois l'accès au projet `buzgokfmxpmyceppvjpp` disponible)

```bash
npx -y supabase login                          # compte propriétaire du projet de production
node scripts/mise-en-service-supabase.mjs      # simulation : migrations manquantes, fonctions, secrets
node scripts/mise-en-service-supabase.mjs --apply --deploy-functions --secrets
```

Puis, au tableau de bord Supabase : activer l'extension **pg_cron** (Database → Extensions) et rejouer la migration
20261023120000 (idempotente) pour enregistrer la tâche `clairdossier-ai-worker` ; vérifier dans `cron.job_run_details`
qu'elle tourne toutes les minutes et que `ai-worker` répond 200 (ou 503 tant que la clé n'est pas posée).

## Supervision et reprise

- État des travaux : `select kind, status, count(*) from ai_jobs group by 1,2;` — `failed` avec `last_error` lisible dans
  le panneau (section « Diagnostic », administration).
- Relancer un travail échoué : `update ai_jobs set status='queued', attempts=0, run_after=now() where id = …;`
- Arrêt d'urgence du moteur : retirer `ANTHROPIC_API_KEY` (le worker refuse de réclamer) ou `select cron.unschedule('clairdossier-ai-worker');`
- Arrêt des e-mails : retirer `RESEND_API_KEY` (le traitement continue, sans notification).
- Restauration d'une révision : les PDF/CSV/ICS d'une révision antérieure sont à la corbeille du dossier (restauration
  depuis l'interface) ; l'analyse structurée reste dans `ai_analyses`.
- Coût réel : RPC `ai_month_cost_cents(user)` (somme `ai_extractions` + `ai_analyses` du mois).

## Limites connues (état livré)

- Livrables : PDF (résumé, chronologie, relances-brouillons), CSV (chronologie, échéances, dates modifiables), ICS.
  DOCX et XLSX natifs non produits (ponytail : à ajouter via `npm:docx` / SheetJS quand l'édition bureautique est demandée).
- « Dates modifiables » : édition via l'onglet Échéances existant (lignes `ai_key`, protégées une fois modifiées) ;
  pas encore d'édition en ligne des événements de chronologie.
- Dépendances `npm:` épinglées (`@anthropic-ai/sdk@1.1.0`, `zod@4.6.7`, `pdf-lib@1.17.1`, `mammoth@1.13.0`, `xlsx@0.18.5`), lock dans `supabase/functions/ai-worker/deno.lock` ; vérification locale : `npx -y deno@2 check --node-modules-dir=none supabase/functions/ai-worker/index.ts`.
- Aucun test de bout en bout avec le vrai fournisseur n'a pu être exécuté (pas de clé, pas d'accès au projet).

## Cadre contractuel — proposition à valider par le propriétaire (NON publiée)

Les CGV (art. 6, `src/data/legal.ts`), la page Sécurité, l'état du produit et `docs/mobile-architecture.md` affirment
aujourd'hui qu'aucune lecture, extraction ni analyse automatique n'est faite. Avant toute activation en production :

1. **CGV art. 6** — remplacer l'exclusion par : « Sur activation expresse et révocable du client, dossier par dossier,
   ClairDossier procède à une lecture et une analyse automatiques des pièces afin de produire des documents de travail
   (résumé, chronologie, échéances, projets de courriers). Ces documents sont générés par un système d'intelligence
   artificielle, signalés comme tels, doivent être vérifiés par le client et ne constituent ni un conseil ni un acte
   juridique. Le traitement est réalisé par le sous-traitant mentionné dans la politique de confidentialité. »
2. **Politique de confidentialité / registre des sous-traitants** — ajouter Anthropic (traitement IA, États-Unis,
   garanties de transfert à documenter, conservation selon le contrat applicable) ; vérifier l'offre de conservation
   applicable au compte API utilisé.
3. **Page Sécurité et état du produit** — retirer la promesse « aucune lecture automatique », décrire l'activation par
   dossier et la nature des livrables ; mettre à jour `docs/mobile-architecture.md` (L19, L116) et `CLAUDE.md`.
4. **Tests** — `tests/features.test.ts` et `tests/home-landing.test.ts` interdisent aujourd'hui le vocabulaire IA dans le
   marketing : à faire évoluer en même temps que le contenu public, pas avant.
5. **RGPD** — AIPD à évaluer (données potentiellement sensibles ou pénales dans les pièces), base légale : exécution du
   contrat sur demande expresse du client ; information des clients existants avant toute activation.
