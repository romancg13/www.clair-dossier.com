# Tests de base de données (migrations, cloisonnement, invariants)

Ces tests appliquent **réellement** les migrations de `supabase/migrations/` sur un
Postgres 16 local et vérifient, par exécution, le cloisonnement par tenant, la
non-régression des flux existants et les invariants du socle IA (ancrage des
sources, journal d'audit immuable, validation humaine, protection des corrections).

Aucune donnée réelle : les jeux d'essai sont générés dans des transactions
annulées (interdit n° 15).

`documents.test.ts` dépose les pièces du dossier étalon (`tests/fixtures/dossier-etalon/`)
avec leur empreinte réelle et compare la détection de doublons à `verite-terrain.json` ;
il vérifie aussi l'immutabilité du stockage (suppression logique, bucket).

`pipeline.test.ts` fait traverser le pipeline d'ingestion (étapes 1 à 5) aux pièces du
dossier étalon : le code serveur partagé (`supabase/functions/_shared/pipeline/`) tourne
en Node avec un `Store` branché sur la connexion du test (`pipeline-store.ts`) et un
`Stockage` qui sert les octets du jeu d'essai ; les statuts obtenus sont comparés à la
section `ingestion_attendue` de la vérité terrain. Reprise sur erreur, backoff, verrou
expiré et idempotence sont exercés réellement.

`veritas.test.ts` fait traverser ingestion, indexation puis VERITAS au dossier étalon :
aucune entité sans source (requête SQL), entités attendues de la vérité terrain toutes
présentes, extraits relus dans les chunks, réanalyse idempotente, modèle simulé (fabrication
rejetée, événement ancré, correction humaine intacte). Aucun modèle réel n'est appelé.

`recherche.test.ts` enchaîne l'indexation (découpage, vectorisation 1024 dimensions,
index HNSW) et interroge la recherche hybride : premiers résultats de la section
`recherche_attendue`, aucun résultat pour un autre tenant, hors du dossier ou sur une
pièce retirée, y compris pour le rôle de service (le filtre est dans la requête SQL).

`isolation.test.ts` rejoue aussi les scénarios d'attaque identifiés en revue
(forge du journal, contournement du verrou humain par suppression, réécriture des
métadonnées d'ingestion, déplacement de dossier entre tenants, `setval` sur la
séquence du journal, escalade de rôle entre membres, fabrication de preuves) : chacun
doit échouer avec l'erreur nommée dans la migration (D-005).

## Prérequis

- PostgreSQL 16 (`postgresql-16`) et l'extension pgvector (`postgresql-16-pgvector`).
- `psql` dans le PATH.
- Le cluster local ne doit jamais être exposé : socket Unix uniquement.

## Démarrer un cluster local

```bash
PGDIR=/tmp/clair-pg
mkdir -p "$PGDIR" && chown postgres:postgres "$PGDIR"
runuser -u postgres -- /usr/lib/postgresql/16/bin/initdb -D "$PGDIR/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D "$PGDIR/data" \
  -o "-p 54329 -k $PGDIR -c listen_addresses=''" -l "$PGDIR/postgres.log" start
```

## Appliquer les migrations

```bash
tests/db/apply-migrations.sh --reset     # recrée la base, applique le shim puis toutes les migrations
tests/db/apply-migrations.sh --replay    # ré-applique les migrations : preuve de rejouabilité
```

Variables reconnues : `PGHOST` (défaut `/tmp/clair-pg`), `PGPORT` (`54329`), `PGUSER`
(`postgres`), `PGDATABASE` (`clair_test`).

## Lancer les tests

```bash
npm run test:db      # reset + migrations + vitest tests/db
npm test             # vitest (tous les tests)
```

## Le shim Supabase (`shim-supabase.sql`)

Reproduit le strict nécessaire de l'environnement Supabase : rôles `anon`,
`authenticated`, `service_role`, schémas `auth` / `storage` / `extensions` / `net`,
`auth.uid()` piloté par `request.jwt.claim.sub`, `storage.foldername()`, un stub
`net.http_post()`. La ligne `create extension if not exists pg_net;` de la migration
`20260617110728` est neutralisée à l'application (pg_net n'est pas installable en
local) ; aucune autre transformation.

Pour simuler un utilisateur dans un test :

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<uuid>', true);
-- requêtes soumises à la RLS
rollback;
```
