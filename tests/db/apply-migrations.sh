#!/usr/bin/env bash
# Applique le shim Supabase puis toutes les migrations de supabase/migrations/
# (ordre lexicographique = ordre chronologique) sur une base Postgres locale.
#
# Variables : PGHOST PGPORT PGUSER PGDATABASE (défauts : /tmp/clair-pg, 54329, postgres, clair_test)
# Usage     : tests/db/apply-migrations.sh                 # shim + toutes les migrations
#             tests/db/apply-migrations.sh --reset         # drop + create de la base, puis idem
#             tests/db/apply-migrations.sh --replay [FROM] # ré-applique les migrations dont le nom
#                                                          # est >= FROM (défaut 20260903000000 :
#                                                          # le socle CLAIR-IA), preuve de rejouabilité.
#
# Note : les migrations historiques (2026-06/07) ne sont pas idempotentes (create policy
# sans drop) ; Supabase ne les rejoue jamais (table schema_migrations). Seules les
# migrations CLAIR-IA sont tenues d'être rejouables (DECISIONS.md D-004).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGHOST="${PGHOST:-/tmp/clair-pg}"
export PGPORT="${PGPORT:-54329}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-clair_test}"

PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
MODE="${1:-}"
REPLAY_FROM="${2:-20260903000000}"

if [[ "$MODE" == "--reset" ]]; then
  "${PSQL[@]}" -d postgres -c "drop database if exists \"$PGDATABASE\";" -c "create database \"$PGDATABASE\";"
  echo "reset    $PGDATABASE"
fi

if [[ "$MODE" != "--replay" ]]; then
  "${PSQL[@]}" -f "$ROOT/tests/db/shim-supabase.sql"
  echo "applied  shim-supabase.sql"
fi

for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  if [[ "$MODE" == "--replay" && "${name%%_*}" < "$REPLAY_FROM" ]]; then
    echo "skipped  $name (historique, non rejoué)"
    continue
  fi
  # pg_net n'existe pas en local : la ligne d'extension est neutralisée, le stub
  # net.http_post du shim prend le relais. Aucune autre transformation.
  sed -E 's/^create extension if not exists pg_net;/-- (shim local) create extension pg_net;/' "$f" \
    | "${PSQL[@]}" -f - >/dev/null
  echo "applied  $name"
done
