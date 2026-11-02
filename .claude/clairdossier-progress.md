# Journal de progression — mission « Private AI, fin de projet et déploiement » (2026-11-02)

Reprise après interruption : lire ce fichier puis `.claude/clairdossier-tasks.json`, puis continuer à la première tâche non `done`.
Branche de travail : `claude/clairdossier-autonomous-deploy-959cad` (worktree). Production = `main` (GitHub Pages).

## Constat initial (vérifié, 2026-11-02 09:00 UTC)

- Production servie : commit `f3d6c0f` (version.json, construit le 2026-10-27). Serveur GitHub Pages.
- PR #41 (moteur IA : migration 20261023, `ai-worker`, livrables, `AiPanel`) : OUVERTE, jamais fusionnée, CI verte, 7 commits, base 71521db.
- PR #42 (grille tarifs + llms.txt alignés) : OUVERTE, CI verte. PR #27 (optimisation, oct.) et #37 (llms) : ouvertes, anciennes.
- Branche `claude/clairdossier-master-prompt-bjvhlz` : architecture IA concurrente (VERITAS/ATLAS/SENTINEL/ECHO, 9 migrations 202609, 17 k lignes), 78 commits derrière `main`, jamais fusionnée → classée UNUSED (divergente ; idées réutilisables : fixture « dossier étalon » avec pièce d'injection).
- Supabase prod `buzgokfmxpmyceppvjpp` : INVISIBLE de tous les identifiants de cette machine (MCP = autre organisation ; pas de jeton). Sondes anonymes : migrations ≤ 20260920 appliquées (`device_push_tokens` présent), `20261012` (revenus) et `20261023` (IA) ABSENTES ; fonctions : seule `notify-lead` déployée.
- Stripe : CLI connectée au compte LIVE `acct_1TW3iOEpkxd8UInh` mais rafraîchissement OAuth bloqué par le bac à sable ; MCP Stripe à tester.
- Vercel CLI : connectée (`prestigeseller-2094`) → cible de staging `clairdossier-demo` possible.
- GitHub : MCP fonctionnel (lecture ; écriture à vérifier) ; `gh` jeton invalide ; `git fetch` OK.
- Aucune clé Anthropic serveur, aucun secret Resend accessible.

## Actions réalisées

1. 09:05 — Fusion sans conflit de `origin/claude/clairdossier-finalization-03da04` (PR #41) et `origin/fix/tarifs-llms-coherence-produit` (PR #42) dans la branche de travail (commits ba40f0d, 090d9fc).
2. 09:12 — `npm ci` avec cache `$TMPDIR/npm-cache` (le cache ~/.npm est en lecture seule dans le bac à sable) ; PGlite installé hors package.json.

## Décisions

- Reprise du moteur IA de la PR #41 (orchestration Supabase : `ai_jobs` + pg_cron → Edge Function) plutôt que PGMQ ou un worker Vercel : déjà construit, testé (PGlite 79/79), persistant côté Supabase, aucun hébergeur supplémentaire.
- Déploiement en production (fusion sur `main`) : préparé et vérifié, mais déclenché seulement sur accord explicite (CLAUDE.md du dépôt + garde `settings.json`).
