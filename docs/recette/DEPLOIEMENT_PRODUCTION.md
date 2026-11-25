# Mise en production — procédure préparée, NON exécutée

Rien de ce document n'est lancé sans accord écrit du propriétaire. Un push sur `main` = mise en production (GitHub Pages).

## Ce que la fusion de la PR #71 changerait en production

Presque rien de visible : les nouveautés V6/V8 vivent dans la recette (`recette/server`, `src/recette`), absente du build de production.
Passent dans le code partagé : le correctif du moteur par règles (parties accolées), l'optimisation de comparaison des montants et la
compréhension élargie des automatisations — tous inactifs en production tant que le moteur IA n'est pas installé.
Vérifié sur le build de production du 25/11 (`npm run build`, 36 routes) : aucun secret, aucun compte fictif, aucune route de simulation,
pas de `/demo`, 12 liens Stripe inchangés (`tests/paiements-geles.test.ts`).

## Ordre

| # | Étape | Qui | Vérification | Retour arrière |
|---|---|---|---|---|
| 1 | Sauvegarde : Supabase → Database → Backups (sauvegarde du jour présente) | propriétaire | date de la sauvegarde | — |
| 2 | Diagnostic d'isolation puis correctif `20261125150000` (`SECURITE_ISOLATION.md`) | propriétaire | bloc [1] : 3 × `true` ; blocs [2]–[4] : 0 | ne PAS rejouer le `.down.sql` (il rétablit la faille) sauf parcours client bloqué |
| 3 | Validation du commit gelé : `npm run typecheck && npm run typecheck:recette && npm test && node tests/sql/migrations.pglite.mjs && npm run build` ; `grep -rE "demo/demarrer|paiement-recette|sk_live_|sk-ant-" dist/` doit être vide | Claude | tout vert, grep vide | — |
| 4 | Passer la PR #71 en « prête », fusionner dans `main` | propriétaire (accord écrit) | déploiement GitHub Pages vert | `git revert -m 1 <commit de fusion>` puis push |
| 5 | Contrôle après déploiement : 8 pages publiques ordinateur + mobile, 0 erreur JS, `/demo` = 404, liens Stripe inchangés, connexion d'un compte de test | Claude + propriétaire | captures | étape 4 |
| 6 | Facultatif : migration `20261125140000` (supervision) | propriétaire | onglet Supervision | `.down.sql` correspondant |

## À ne PAS faire lors de cette mise en production

- `20261125120000` (essai prospect) : dépend des tables du moteur IA, non installées.
- `20261125130000` (messagerie) : attend les applications OAuth Google et Microsoft.
- `npm run ia:commission` : installerait le moteur IA (CGV art. 6 — accord écrit et CGV à jour d'abord).
- Générer ou diffuser le lien commercial universel.

## Activation progressive, après la mise en production (chaque palier = un accord distinct)

| Palier | Prérequis | Contrôle |
|---|---|---|
| A. Analyse par modèle en recette | clé API dans Vercel (`ACTIVATION_API.md`) ; `npm run ia:evaluation -- --modele … --budget-centimes 20` au moins égal aux règles | coût réel lu dans /admin ; plafonds 0,80 USD + 1 € |
| B. Stripe bac à sable | bac à sable créé, clés de test dans Vercel | paiement, webhook dupliqué, résiliation |
| C. Messagerie | applications OAuth validées, compte Resend | un e-mail fictif par fournisseur |
| D. Moteur IA en production | A réussi, CGV art. 6 / confidentialité / DPA / AIPD validés, base de recette Supabase isolée | 1 compte interne, puis 3 clients volontaires |
| E. Essai prospect et lien universel | D réussi, CAPTCHA développé | instruction explicite |

## Surveillance

- Erreurs : `scripts/surveillance-site.mjs`, journaux Vercel de la recette (alertes `EXECUTEUR_INTERROMPU`, `AUTOMATISATIONS_INTERROMPUES`, `BUDGET_IA_70/90/100`, `COUPE_CIRCUIT`).
- Coûts : page /admin de la recette (exige `RECETTE_ADMIN_PASSWORD` dans Vercel) ; coupe-circuit immédiat des appels de modèle et des automatisations.
