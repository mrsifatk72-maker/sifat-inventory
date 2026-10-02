# Phase 1 — Supabase foundation: setup & verification

Phase 1 delivers the database, security model, auth structure, storage bucket and seed for the
MediVerse Dental CMS. **Nothing here touches the live website** (`index.html`, `src/`, `assets/` are
unchanged, and the production domain is not involved).

## 1. What's in this phase

| Path | Purpose |
|---|---|
| `supabase/config.toml` | Supabase CLI/project config: invite-only auth, MFA (TOTP), CAPTCHA, password policy, API exposes only `public` |
| `supabase/migrations/20261002090000_foundation.sql` | `private` helper schema, enum types, URL/slug validators, `updated_at` trigger |
| `supabase/migrations/20261002090100_admin_auth.sql` | `admin_users` allowlist (owner/editor), `is_admin()` / `is_owner()` / `has_mfa()`, last-owner guard, `bootstrap_owner()`, immutable `audit_log` + audit trigger |
| `supabase/migrations/20261002090200_content.sql` | Media, site settings, homepage sections, stats, features, FAQs, testimonials, banners, phases, courses, mentors, course↔mentor, header/footer/social; RLS for all |
| `supabase/migrations/20261002090300_analytics.sql` | Anonymous visitor analytics tables (sessions, events, daily rollups); closed to anonymous users |
| `supabase/migrations/20261002090400_storage.sql` | `public-media` bucket (5 MB, JPEG/PNG/WebP/AVIF) + admin-only write/list policies |
| `supabase/seed/generate_seed.py` | Builds `seed.sql` from the current site source (`src/build.py`, `src/i18n_bn.py`, `assets/`) |
| `supabase/seed.sql` | Generated seed: 22 courses, 10 mentors, 29 media records, all homepage copy in EN + BN |
| `supabase/tests/database/*.test.sql` | 204 pgTAP checks (RLS, auth, storage, constraints, seed) |
| `scripts/local-db/test.sh` | Runs migrations + seed + tests on a throwaway local PostgreSQL |
| `scripts/local-db/supabase_shim.sql` | **Local testing only**: recreates Supabase roles, `auth.*`, `storage.*` on plain PostgreSQL |
| `.env.example` | Environment variable names (no values) |
| `vercel.json` | Baseline security headers + Mumbai region for the future Vercel preview |

## 2. Run the tests locally

```bash
# Plain PostgreSQL 16 + pgTAP (what was used for Phase 1 verification)
bash mediverse-dental/scripts/local-db/test.sh

# Or, with Docker + Supabase CLI (runs on the real Supabase images)
cd mediverse-dental && supabase start && supabase db reset && supabase test db
```

## 3. Apply to the hosted Supabase project (staging) — after approval

1. **Create the project** in the Supabase dashboard: region **South Asia (Mumbai) `ap-south-1`**,
   a strong database password (store it in your password manager).
2. **Link and push** from your machine:
   ```bash
   cd mediverse-dental
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push --include-seed        # applies migrations + seed.sql
   supabase config push                   # applies auth settings from config.toml
   ```
3. **Dashboard checks** (Authentication → Settings):
   - Sign-ups **disabled**; anonymous sign-ins **off**.
   - MFA → TOTP **enabled**.
   - Attack protection → CAPTCHA: **Cloudflare Turnstile**, paste the secret key.
   - URL configuration: Site URL = staging preview URL; redirect URL = `<preview>/admin`.
4. **Create the first owner**: Authentication → Users → **Invite user** (your email). After accepting
   the invite, run once in the SQL editor:
   ```sql
   select private.bootstrap_owner('your-email@example.com');
   ```
   Then enroll an authenticator app (TOTP) — owner actions on admin users require MFA.
5. **Security advisor**: Database → Advisors → Security should report no RLS/policy issues.
6. **Media files** are uploaded to the `public-media` bucket by the Phase 2 upload script, at the exact
   paths recorded in `media.path` (e.g. `flyers/sdm-full.jpg`).

## 4. Environment variables

| Variable | Where | Browser-visible? | Notes |
|---|---|---|---|
| `SUPABASE_URL` | Vercel (server) | No | Project URL |
| `SUPABASE_ANON_KEY` | Vercel (server) | No (server copy) | Public by design; RLS enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server) | **Never** | Bypasses RLS — analytics ingest & admin invites only |
| `SITE_URL` / `ADMIN_URL` | Vercel (server) + CLI | No | Preview URL during staging |
| `ANALYTICS_ENABLED` | Vercel (server) | No | Kill switch |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Admin build | Yes (safe) | Never put the service role key in a `VITE_` variable |
| `VITE_TURNSTILE_SITE_KEY` | Admin build | Yes (safe) | Login CAPTCHA widget |
| `SUPABASE_AUTH_CAPTCHA_SECRET` | Supabase Auth settings / CLI | No | Not needed in Vercel |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Your machine only | No | CLI only |

`.env`, `.env.*` are git-ignored (only `.env.example` is committed).

## 5. Security model summary

- **RLS on every table.** Visitors (`anon`) can only `SELECT` content the website shows: active/upcoming,
  non-archived courses; active mentors; visible sections/items; media actually used on the site.
- **No anonymous access** to `admin_users`, `audit_log`, `media_usage` or any `analytics_*` table —
  not even `SELECT` privilege.
- **Admins** = rows in `admin_users`. Signed-in users who are not admins get the same view as visitors.
  Editors manage content; only owners can permanently delete courses/mentors; only owners **with MFA
  (aal2)** can add/change/remove admins; the last owner can't be removed or demoted.
- **Audit log**: every insert/update/delete on content and admin tables is recorded by trigger with
  the acting user; nobody can edit or delete audit rows through the API.
- **Analytics** is written only by the server (service role). No IPs, names, emails, phone numbers or
  raw user agents; schema enforces 2-letter country codes and bare referrer domains.
- **Storage**: public read by URL, but listing and all writes are admin-only, limited to
  `flyers/ thumbnails/ mentors/ banners/ logos/ images/` and `.jpg/.jpeg/.png/.webp/.avif`. SVG blocked.
- **Input guards**: URL allowlist (no `javascript:`/`data:`/protocol-relative), slug format, size limits,
  in-use media can't be deleted (FK `RESTRICT`), no raw HTML stored for page copy.
- Privileged helpers live in the non-exposed `private` schema; all `SECURITY DEFINER` functions pin
  `search_path`.

## 6. Changes vs. BACKEND_PLAN.md (refinements made while implementing)

- `site_settings` is a **typed single-row table** (not key/value) so logos/OG image can use real foreign keys.
- `media` stores `path` only; the public URL is derived from `SUPABASE_URL` + path (no stale URLs).
- `updated_by` columns were dropped from public tables — the **audit log** records who changed what,
  so no admin identifiers are exposed to visitors.
- Page copy uses a tiny safe markup (`[[highlight]]`, line breaks, `[label](url)` links) instead of HTML.
- Course↔mentor links are seeded **only where the existing flyers name the mentor** (7 links); assign the
  rest in the admin panel.
- `/courses/:slug` support: courses have `slug`, `details_en/bn`, `info` (course information),
  `cta_label_en/bn` + `external_url` (Mediverse platform), and per-course SEO fields.

## 7. Verification status

| Check | Local (PostgreSQL 16 + shim) | Hosted staging project |
|---|---|---|
| Migrations apply cleanly | ✅ | Pending project creation |
| RLS / privileges (204 pgTAP checks) | ✅ | Re-run with `supabase test db` |
| Authorization via JWT claims (owner/editor/outsider/anon, MFA) | ✅ | Re-run |
| Real login flow (invite → password → TOTP) | n/a locally | Pending — manual test on staging |
| Storage policies | ✅ (policy logic) | Pending — real upload/list via API |
| Supabase Security Advisor | n/a | Pending |
