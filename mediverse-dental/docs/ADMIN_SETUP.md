# Admin panel — setup & use (staging)

Admin address: `https://<your-staging-project>.vercel.app/admin`

## How access works
- Login uses **Supabase Auth** (email + password). There is no sign-up page.
- Being logged in is **not** enough: the account must also be listed in the
  `public.admin_users` table (role `owner` or `editor`). The database checks this
  on every save/upload (Row-Level Security). Other users see “No admin access”.
- The browser only gets the **public** key (from `/api/admin-config`). The
  service-role key is never used anywhere in this project.

| Action                                   | editor | owner |
|------------------------------------------|:------:|:-----:|
| Edit courses, mentors, homepage, media   |   ✓    |   ✓   |
| Hide / archive / restore courses+mentors |   ✓    |   ✓   |
| Delete a course or mentor permanently    |        |   ✓   |
| Delete an unused image                   |   ✓    |   ✓   |

## Create the first admin (once, in the STAGING Supabase project only)
1. Supabase Dashboard → staging project → **Authentication → Users → Add user →
   Create new user**. Enter your email and a strong password, tick
   **Auto Confirm User**, then Create. (You type the password there — never in chat.)
2. Supabase Dashboard → **SQL Editor** → New query → run:
   ```sql
   select private.bootstrap_owner('your-email@example.com');
   ```
   Expected result: one row (your user id). This makes you the **owner**.
3. Recommended: **Authentication → Sign In / Providers → Email** → turn OFF
   “Allow new users to sign up”.
4. Open `/admin`, log in.

No SQL migration is needed for the admin panel — the tables, roles and RLS
were created in Phase 1.

## Notes
- Website updates appear within about 1 minute (edge cache).
- A replaced image keeps the same address; it can take up to ~10 minutes to show everywhere.
- Archived items are hidden from the website and can be restored; only the owner
  can delete permanently, and images in use can never be deleted.

## Tests
`POSTGREST_BIN=/path/to/postgrest npm run test:admin` — runs the admin panel in a
real browser against a local PostgreSQL with the real migrations, RLS and seed
(anonymous / non-admin / editor / owner).
