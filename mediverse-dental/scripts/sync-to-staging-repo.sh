#!/usr/bin/env bash
# Copy this app into the Vercel staging repo (mediversedental1-a11y/mediverse-dental-staging):
#   - at the repo top level (Vercel Root Directory empty)
#   - and again in mediverse-dental/ (Vercel Root Directory "mediverse-dental")
# Usage: scripts/sync-to-staging-repo.sh /path/to/mediverse-dental-staging
# Does not delete anything in the target; no database changes.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?path to the mediverse-dental-staging clone}"
cd "$SRC"
git ls-files -z | grep -zv '^tests/site.test.mjs$' | xargs -0 tar cf - | tar xf - -C "$DEST"
# The root-layout test belongs to sifat-inventory only; copy site tests without it.
sed "/^test('repository-root vercel.json/,\$d" tests/site.test.mjs > "$DEST/tests/site.test.mjs"
mkdir -p "$DEST/mediverse-dental"
git ls-files -z api lib public src vercel.json package.json | xargs -0 tar cf - | tar xf - -C "$DEST/mediverse-dental"
printf '# Copy of the app for Vercel "Root Directory = mediverse-dental"\n\nThe top-level files are the source of truth; re-run scripts/sync-to-staging-repo.sh after changes.\n' > "$DEST/mediverse-dental/README.md"
echo "Synced into $DEST"
