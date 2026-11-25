# Migrations du 25/11/2026 — procédure pour la production

La fusion de la PR #70 ne touche pas la base : le site fonctionne contre le schéma actuel (vérifié par relecture).
Les migrations ci-dessous sont à appliquer **par le propriétaire**, à la main, une à la fois, **après un export de la base**
(Supabase → Database → Backups, ou `pg_dump`). Projet : `buzgokfmxpmyceppvjpp` → SQL Editor → coller le fichier → Run.

Ne pas utiliser `npm run ia:commission` ni `scripts/mise-en-service-supabase.mjs --apply` pour cela : ce script ne
connaît pas ces quatre migrations et pourrait installer le moteur IA (CGV art. 6).

| Ordre | Fichier (`supabase/migrations/`) | À appliquer maintenant ? | Effet | Retour arrière (`supabase/rollback/`) |
|---|---|---|---|---|
| 1 | `20261125150000_pieces_dossier_proprietaire.sql` | **Oui, recommandé** | Correctif d'isolation : une pièce ou une échéance ne peut plus être rattachée au dossier d'un autre compte. Aucun effet sur les parcours normaux (site, mobile, administration vérifiés). | `20261125150000_pieces_dossier_proprietaire.down.sql` (rétablit le défaut) |
| 2 | `20261125140000_supervision_fondateur.sql` | Facultatif | Onglet « Supervision » de la console d'administration (compteurs, aucune donnée client). Sans elle, l'onglet affiche « non installée ». | `20261125140000_supervision_fondateur.down.sql` |
| — | `20261125130000_messagerie_directe.sql` | **Non, attendre** | Inutile tant que les fonctions `mail-oauth` / `mail-sync` et les applications OAuth n'existent pas. Exige les tables d'abonnement de `20260917120000`. | `20261125130000_messagerie_directe.down.sql` |
| — | `20261125120000_essai_prospect.sql` | **Non : échouerait** | Dépend du moteur IA (tables `ai_jobs`, `ai_extractions`, `ai_analyses`), non installé en production. À appliquer seulement après 20261023 → 20261118. | `20261125120000_essai_prospect.down.sql` |

## Vérification après l'étape 1

Dans le SQL Editor :

```sql
select policyname from pg_policies
where tablename in ('dossier_documents','dossier_deadlines')
  and policyname in ('docs_insert_own','docs_update_own','deadlines_update_own');
-- 3 lignes attendues ; puis déposer une pièce depuis un compte client de test : le dépôt doit réussir.
```

## À retenir pour plus tard

Si le moteur IA est installé un jour, **rejouer `20261125140000`** juste après (elle est rejouable) : sinon la mise en
pause depuis la console n'arrêterait pas le worker.
