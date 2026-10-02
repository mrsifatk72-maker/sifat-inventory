#!/usr/bin/env bash
# Build a throwaway local database (shim + migrations + seed), then export every
# public table AS THE ANONYMOUS ROLE — i.e. exactly what the website can read
# through Supabase with the anon key — to tests/fixtures/content.json.
#
#   bash mediverse-dental/scripts/local-db/export-fixture.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SUPA="$ROOT/supabase"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PGPORT_FIXTURE:-54339}"
OUT="$ROOT/tests/fixtures/content.json"

WORK="$(mktemp -d)"; chmod 755 "$WORK"
RUN=(); if [ "$(id -u)" = "0" ]; then chown postgres "$WORK"; RUN=(sudo -u postgres); fi
cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/pg.log" -w start >/dev/null
PSQL=("${RUN[@]}" psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" < "$HERE/supabase_shim.sql" >/dev/null
for f in "$SUPA"/migrations/*.sql; do "${PSQL[@]}" < "$f" >/dev/null; done
"${PSQL[@]}" < "$SUPA/seed.sql" >/dev/null

mkdir -p "$(dirname "$OUT")"
"${PSQL[@]}" -t -A > "$OUT" <<'SQL'
\o /dev/null
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
\o
select jsonb_pretty(jsonb_build_object(
  'site_settings',   (select coalesce(jsonb_agg(t), '[]') from public.site_settings t),
  'page_sections',   (select coalesce(jsonb_agg(t), '[]') from public.page_sections t),
  'stats',           (select coalesce(jsonb_agg(t), '[]') from public.stats t),
  'features',        (select coalesce(jsonb_agg(t), '[]') from public.features t),
  'faqs',            (select coalesce(jsonb_agg(t), '[]') from public.faqs t),
  'testimonials',    (select coalesce(jsonb_agg(t), '[]') from public.testimonials t),
  'phases',          (select coalesce(jsonb_agg(t), '[]') from public.phases t),
  'courses',         (select coalesce(jsonb_agg(t), '[]') from public.courses t),
  'mentors',         (select coalesce(jsonb_agg(t), '[]') from public.mentors t),
  'course_mentors',  (select coalesce(jsonb_agg(t), '[]') from public.course_mentors t),
  'media',           (select coalesce(jsonb_agg(t), '[]') from public.media t),
  'nav_items',       (select coalesce(jsonb_agg(t), '[]') from public.nav_items t),
  'footer_sections', (select coalesce(jsonb_agg(t), '[]') from public.footer_sections t),
  'footer_links',    (select coalesce(jsonb_agg(t), '[]') from public.footer_links t),
  'social_links',    (select coalesce(jsonb_agg(t), '[]') from public.social_links t)
));
SQL
echo "wrote $OUT"
