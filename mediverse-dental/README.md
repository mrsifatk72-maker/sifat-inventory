# MediVerse Dental — Landing Page

`index.html` is the finished, self-contained page (all images inlined) — upload it as-is.

To edit:
- Courses & mentors: edit the `COURSES` / `MENTORS` lists in `src/build.py`
- Layout, text & styles: edit `src/template.html`
- Bangla translations: edit `src/i18n_bn.py` (update it whenever you change English text)
- Images: put files in `assets/` and reference them by filename in `build.py`

Then rebuild: `python3 mediverse-dental/src/build.py`

## Staging: website rendered from Supabase (Phase 2)

The same design, rendered by a Vercel Function from the staging database:

- `api/page.js` — serves `/` and `/courses/<slug>` (cached 60 s at Vercel's edge)
- `lib/` — read-only database access (anon key + RLS), safe text rendering, page builder.
  Styles and page script come straight from `src/template.html`, so the design stays identical.
- `vercel.json` — routes, region (Mumbai) and security headers; only `public/` is served as static files.
- Environment variables (Vercel → Settings → Environment Variables, **Preview** only):
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Never the service-role key.

Tests (no network needed — a fake Supabase serves `tests/fixtures/content.json` and `assets/`):

```bash
npm test                              # 9 server/security tests
node tests/browser-check.mjs          # 29 real-browser checks (Playwright)
node tests/visual-compare.mjs         # text + pixel comparison with the current index.html
node tests/dev-server.mjs             # local preview at http://localhost:3000
bash scripts/local-db/export-fixture.sh   # rebuild the fixture from migrations + seed (as anon)
```
