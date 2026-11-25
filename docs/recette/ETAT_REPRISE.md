# État de reprise — recette ClairDossier

Mis à jour : 2026-11-25 · branche `claude/clairdossier-optimization-85z7y5` (NON fusionnée) · base `main@6f8f788`.
Production : inchangée (lecture seule). Aucune migration appliquée à un Supabase distant, aucun paiement, aucun DNS.

Légende : VÉRIFIÉ (prouvé par exécution) · IMPLÉMENTÉ NON TESTÉ (code + tests à réseau simulé) · SIMULÉ · BLOQUÉ · DIFFÉRÉ.

## Travaux de cette session

| Lot | Contenu | Statut | Preuve |
|---|---|---|---|
| Neutralisation preview | `scripts/preview-neutralise.mjs` + `vercel.json` : liens Stripe LIVE retirés du build preview, noindex, bandeau | VÉRIFIÉ | 15 liens neutralisés, 0 restant ; build en échec s'il en reste un |
| Recette réelle locale | `scripts/recette/recette-locale.mjs` sur pile Supabase docker (27 migrations, Postgres réel) | VÉRIFIÉ | 63 tests en 149 s : 53 VÉRIFIÉ · 9 SIMULÉ · 1 BLOQUÉ · 0 ÉCHEC (`docs/recette/RECETTE_LOCALE.md`) |
| Correctif d'isolation | Migration `20261125150000` : pièce ou échéance non rattachable au dossier d'autrui ; `ai-worker` refuse tout chemin hors de l'espace du titulaire | VÉRIFIÉ en local | Tests 16 et 61 de la recette (ÉCHEC avant, VÉRIFIÉ après) + test SQL |
| Chaîne IA complète | file → worker → extraction → consolidation par pg_cron → 13 fichiers / 6 rendus → publication → quota | SIMULÉ | Faux modèle local (aucune clé Anthropic) ; sans clé le worker répond 503 et ne réclame rien (VÉRIFIÉ) |
| Six rendus PDF | Charte commune (logo, marine/or/blanc), 5 compositions distinctes, formats et noms inchangés | VÉRIFIÉ (rendu) | `docs/recette/rendus/avant-*.png` / `apres-*.png` ; ZIP global existant conservé |
| Boîte d'attention | Module déterministe + « ce qui a changé » (fiche dossier et démo) | VÉRIFIÉ (tests unitaires) | `tests/attention*.test.ts` ; visible sur `/demo` |
| Essai prospect | Migration `20261125120000` : 2 emplacements atomiques, manifeste figé, 3ᵉ analyse refusée, pas de remise à zéro | VÉRIFIÉ en SQL, INACTIF | 11 blocs SQL ; `trial_settings.enabled = false` ; aucun lien généré (`ESSAI_PROSPECT.md`) |
| Messagerie directe | Gmail / Microsoft 365 lecture seule, jetons chiffrés, synchro par curseur ; UI derrière `VITE_MAIL_CONNECT=1` | IMPLÉMENTÉ NON TESTÉ | Aucun identifiant OAuth : aucun flux réel (`MESSAGERIE_DIRECTE.md`) |
| Supervision fondateur | Migration `20261125140000` + onglet admin « Supervision » (agrégats, pause, alerte budget) | VÉRIFIÉ en SQL, non essayé en navigateur | `SUPERVISION.md` |
| Moteur et conformité | Évaluation fournisseurs, règlement IA, loi 71-1130, RGPD, textes publics à adapter | Note d'analyse | `MOTEUR_ET_CONFORMITE.md` — à faire valider par un avocat |

Validation de la branche : `npm run typecheck` OK · `npm test` 249/249 · tests SQL PGlite 117/117 · build 36 routes · gel des paiements respecté.
Non exécuté : `deno check` (deno absent de la machine) ; `npm run ia:commission` (cible la PRODUCTION `buzgokfmxpmyceppvjpp` — inspecté, non lancé).

## Blocages et action minimale du propriétaire

1. **Supabase isolé hébergé** — BLOQUÉ : l'organisation est à la limite gratuite de 2 projets actifs. Action : mettre en pause un projet inactif ou autoriser un projet payant ; je crée alors `clairdossier-recette`.
2. **Analyse IA réelle** — BLOQUÉ : aucune clé Anthropic de recette. Action : la saisir comme secret `ANTHROPIC_API_KEY` de la fonction (jamais dans le chat).
3. **Messagerie directe** — BLOQUÉ : créer l'application OAuth Google Cloud (portée restreinte `gmail.readonly`, vérification Google requise) et Microsoft Entra.
4. **E-mail entrant** — BLOQUÉ : compte et domaine de réception Resend.
5. **Paiement de test** — DIFFÉRÉ : bac à sable Stripe non branché ; la preview n'a aucun lien de paiement.
6. **Juridique** — CGV art. 6, politique de confidentialité, AIPD, base légale des données de tiers : propositions dans `MOTEUR_ET_CONFORMITE.md`, rien publié.

DIFFÉRÉ : refonte conversion/SEO (§11), intégrations de fournisseurs tiers, MCP privé de suivi, mesures 20 × 250 fichiers, 14ᵉ fichier « dates modifiables ».

## Reprise

- Pile locale : démarrer `dockerd`, copier `supabase/` dans un dossier de travail, remplacer `[inbucket]` par `[local_smtp]` dans la copie de `config.toml`, `npx supabase start`, puis `RECETTE_WORKDIR=<dossier> node scripts/recette/recette-locale.mjs`.
- Tests SQL : `npm install --no-save @electric-sql/pglite && node tests/sql/migrations.pglite.mjs`.
- Retour arrière : la branche n'est pas fusionnée ; la preview revient à l'état précédent en redéployant `main@6f8f788`. Chaque migration a son fichier dans `supabase/rollback/`.

## Prochaine action

Attendre l'accord explicite du propriétaire avant toute fusion dans `main`, toute migration réelle et toute activation du lien commercial universel.
