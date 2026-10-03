# Vercel settings for the staging site

## Simplest: deploy branch `ccr-0b6d8b68-4bii23` with Root Directory EMPTY
The repository root of this branch has its own `vercel.json` + `api/*.mjs`
entry points that serve the app from `mediverse-dental/` (nothing was moved).
- Branch: `ccr-0b6d8b68-4bii23`
- Root Directory: empty
- Framework Preset: Other (vercel.json sets it anyway)

The options below still work too.

The app lives in the `mediverse-dental/` folder of branch `ccr-0b6d8b68-4bii23`.
`main` does NOT contain it (main's root is an unrelated React app), so a Vercel
project that builds `main`, or builds the repo root, shows 404 / the wrong app.

## A. Project made from the "Clone / Deploy" link (repo `mediverse-dental-staging-v3` in your GitHub)
The files are already at the top of that repo.
- Root Directory: **empty** (`./`)
- Framework Preset: **Other**
- Build / Output / Install Command: **override OFF** (vercel.json sets them)

## B. Project imported from `mrsifatk72-maker/sifat-inventory`
- Root Directory: **`mediverse-dental`**
- Production Branch: **`ccr-0b6d8b68-4bii23`** (Settings → Environments → Production → Branch Tracking)
- Framework Preset: **Other**; Build / Output / Install Command: **override OFF**

Then: Deployments → latest → ⋯ → **Redeploy**.

Environment variables (unchanged): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public key only).

## Expected result
- `/` → MediVerse Dental homepage (served by `api/page.js`)
- `/courses/<slug>` → course page
- `/admin` → admin login page
- A Vercel "404: NOT_FOUND" page means Vercel is not building this folder: check the two settings above.
