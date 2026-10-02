#!/usr/bin/env bash
# Run all database migrations, the seed and the pgTAP test suite against a
# throwaway local PostgreSQL 16 server (no Docker needed).
#
#   bash mediverse-dental/scripts/local-db/test.sh
#
# Requires: postgresql-16, postgresql-16-pgtap, pg_prove.
# With Docker + the Supabase CLI available, the equivalent is:
#   supabase start && supabase db reset && supabase test db
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SUPA="$ROOT/supabase"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PGPORT_TEST:-54329}"

WORK="$(mktemp -d)"
chmod 755 "$WORK"
RUN=()
if [ "$(id -u)" = "0" ]; then
  # initdb refuses to run as root; use the postgres OS user.
  chown postgres "$WORK"
  RUN=(sudo -u postgres)
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "▸ Starting temporary PostgreSQL on port $PORT"
"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/pg.log" -w start >/dev/null

# SQL is piped via stdin so the postgres OS user never needs read access to this checkout.
PSQL=("${RUN[@]}" psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "▸ Loading Supabase compatibility shim (local only)"
"${PSQL[@]}" < "$HERE/supabase_shim.sql" >/dev/null

echo "▸ Applying migrations"
for f in "$SUPA"/migrations/*.sql; do
  echo "   - $(basename "$f")"
  "${PSQL[@]}" < "$f" >/dev/null
done

echo "▸ Loading seed"
"${PSQL[@]}" < "$SUPA/seed.sql" >/dev/null

echo "▸ Running pgTAP tests"
"${PSQL[@]}" -c 'create extension if not exists pgtap' >/dev/null
# pg_prove reads test files itself, so copy them somewhere the postgres user can read.
mkdir -p "$WORK/tests" && cp "$SUPA"/tests/database/*.test.sql "$WORK/tests/" && chmod -R a+rX "$WORK/tests"
"${RUN[@]}" pg_prove -h "$WORK" -p "$PORT" -U postgres -d postgres --failures "$WORK"/tests/*.test.sql
