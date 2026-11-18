# État de reprise — session « prompt unique fusionné / quota limité »

> Fichier d'état demandé par la mission (économie §7). Mis à jour au fil de la session.
> Branche : `claude/clairdossier-optimization-85z7y5` (PR #27, brouillon — jamais fusionnée sans accord écrit).

## Décisions prises

- 2026-11-18 : fusion de `origin/main` (0d10442, = SHA repère de la mission) dans la branche ;
  conflits résolus en faveur de main (focus menu mobile), import dynamique Supabase conservé (perf PR #27).
- Correction cible livrée : classement généré/manuel des livrables par TYPE ENREGISTRÉ
  (`generated_by`), alias historiques (`deliverableKeyFromName`), section « Autres documents »,
  aucun déplacement de fichier (commit `eaa3aa8`).
- `deno.lock` racine restauré à la version de main (pollué par un `deno check` local).

## Audit (constats vérifiés dans le code, 2026-11-18)

| Point | État |
|---|---|
| Jobs persistants | `ai_jobs` + pg_cron → `ai-worker` (code complet, NON installé en prod) |
| review_mode | `dossier_ai_settings.review_mode` manual/auto + RPC admin — existe |
| VITE_AI_ENGINE | absent de deploy.yml → panneau client invisible en prod ✔ |
| Budgets/pause | par compte (2000 ¢/mois défaut) + global (20261104) + état « pause » ✔ |
| Charte LEPARC | palette marine/champagne en place (src/styles, cinematics) ✔ |
| Offres | pricing.ts = grille de référence exacte (7 offres, −10 % annuel) ✔ |
| Quotas | `plan_entitlements.dossier_limit` seul ; pages IA / actions IA ABSENTS → chantier A |
| E-mail entrant | AUCUN code (Resend sortant seulement : notify-lead, ai-worker) → chantier B |
| Droits serveur | `dossiers_guard` + entitlements + RLS (prod ≤ 20260920 ; 20261012+ non appliquées) |
| Paiements gelés | tests/paiements-geles.* intacts, 180/180 tests ✔ |
| LinkedIn / MCP admin | aucun module existant — non traité (accès et cadrage absents) |

## Blocages (accès propriétaire, aucune simulation comptée comme validée)

- Supabase prod `buzgokfmxpmyceppvjpp` : aucun identifiant ici → pas de recette serveur réelle,
  pas de review_mode=auto testable en vrai. (MCP Supabase connecté = AUTRE organisation : interdit d'y migrer.)
- Stripe : lecture seule déjà auditée ; webhook endpoint et descriptions produit = dashboard propriétaire.
- Resend : pas de compte/domaine → réception entrante non testable de bout en bout.
- Clé Anthropic : absente → aucun passage IA réel.

## Chantiers livrés (2026-11-18, tout validé : tsc · 184/184 unités · 98/98 SQL PGlite · deno check · build 36 routes)

1. Correction cible livrables — commit `eaa3aa8` (type enregistré, alias, « Autres documents »).
2. Quotas IA par offre — commit `12cc6b6` (migration 20261118120000, worker, AiPanel usage
   restant, docs/recette/QUOTAS_IA.md, rollback niveau 1).
3. Réception e-mail entrante — commit `33d0c89` (migration 20261118130000, fonction
   email-inbound signée Svix, EmailInbox 3 étapes, docs/recette/EMAIL_ENTRANT.md,
   rollback niveau 1). E2E NON vérifié : domaine Resend absent.

## Différé (décision assumée, pas un oubli)

- Sélecteur des 7 offres en recette : l'affectation d'offre passe par `subscriptions`
  (source de vérité Stripe) ou `entitlement_overrides` (RPC admin existante) — un
  sélecteur UI dédié n'a de sens qu'une fois un environnement de recette serveur réel
  disponible ; y renoncer évite un contournement de la source de vérité Stripe.
- LinkedIn / connexions MCP admin : aucun module existant, accès et cadrage absents.
- Révision vitrine/marketing et textes CGV : publication commerciale jamais automatique
  (mission) — propositions dans docs/recette/*, décision propriétaire requise.

## Prochaine action

Suivi de PR #27 (brouillon) jusqu'à décision du propriétaire ; AUCUNE fusion sur main
sans accord écrit explicite (« fusionne »).
