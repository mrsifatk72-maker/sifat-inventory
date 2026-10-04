# Go live on dental.mediversebd.com

The website and admin panel move from the `*.vercel.app` test address to
`https://dental.mediversebd.com` (admin: `https://dental.mediversebd.com/admin`).
The current Netlify site is **not deleted** — it stays as an instant rollback.

## 1. Create the live Vercel project (≈5 min)

Open this link while logged in to Vercel:

https://vercel.com/new/clone?repository-url=https://github.com/mrsifatk72-maker/sifat-inventory/tree/ccr-0b6d8b68-4bii23/mediverse-dental&project-name=mediverse-dental-live&repository-name=mediverse-dental-live&env=SUPABASE_URL,SUPABASE_ANON_KEY,SITE_URL,ALLOW_INDEXING&envDescription=Supabase%20URL%20and%20public%20anon%20key%2C%20then%20SITE_URL%3Dhttps%3A%2F%2Fdental.mediversebd.com%20and%20ALLOW_INDEXING%3Dtrue&envLink=https://supabase.com/dashboard/project/hhcxwianpbkhqqhccwbk/settings/api-keys

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://hhcxwianpbkhqqhccwbk.supabase.co` |
| `SUPABASE_ANON_KEY` | the **publishable / anon** key (never the secret / service_role key) |
| `SITE_URL` | `https://dental.mediversebd.com` |
| `ALLOW_INDEXING` | `true` |

Open `https://mediverse-dental-live.vercel.app` and check it works. (That address
stays `noindex` on purpose — only the real domain is shown to Google.)

## 2. Connect the domain

1. Vercel → **mediverse-dental-live** → **Settings → Domains** → Add
   `dental.mediversebd.com`.
2. Vercel shows a DNS record (normally **CNAME** `dental` → a `…vercel-dns…` value).
   Copy it **exactly as Vercel shows it**.
3. Where the DNS of `mediversebd.com` is managed (Netlify DNS, Cloudflare or the
   domain registrar): change the existing `dental` record to that value.
   Only the `dental` record — do not touch `mediversebd.com`, `www` or MX (email) records.
   On Cloudflare, set the record to **DNS only** (grey cloud).
4. Wait until Vercel shows **Valid Configuration** and the SSL certificate (usually
   5–30 min). If Vercel asks for a TXT verification record, add it the same way.

## 3. Supabase Auth (for admin login + password reset)

Supabase → Authentication → **URL Configuration**:
- **Site URL**: `https://dental.mediversebd.com`
- **Redirect URLs**: add `https://dental.mediversebd.com/admin/reset`
  (keep the staging one for testing).

Authentication → **Sign In / Providers**: make sure **"Allow new users to sign up"
is OFF**. Admins are only added by you.

## 4. After go-live — Google

1. https://search.google.com/search-console → Add property → **Domain**
   `mediversebd.com` (or URL prefix `https://dental.mediversebd.com`) → verify
   with the TXT record it gives.
2. **Sitemaps** → submit `https://dental.mediversebd.com/sitemap.xml`.
3. Optional: Admin → Settings → Analytics → add the GA4 ID.

## Updating the live site later

New versions still come as a clone link. Deploy it, test on its `vercel.app`
address, then in the **new** project → Settings → Domains → add
`dental.mediversebd.com` → Vercel offers to **move** it (no DNS change, ~1 minute).
Remember to set `SITE_URL` and `ALLOW_INDEXING` on the new project too.

## Rollback

- To the previous Vercel version: move the domain back to the old project (same as above).
- To the old Netlify site: point the `dental` DNS record back to the Netlify value
  (write it down before step 2).

## What protects the site

- Database: Row Level Security on every table; visitors can only read published
  content; all edits need an admin login; every change is written to the audit log.
- Only the public key is used in the browser; the code refuses to run with a secret key.
- Admin: strict Content-Security-Policy, cannot be framed, never cached, never indexed;
  passwords handled only by Supabase Auth (≥10 chars, letters + numbers).
- Whole site: HTTPS only (HSTS), nosniff, referrer policy, permissions policy,
  cross-origin opener policy.
- SEO: canonical URLs, Open Graph / Twitter cards, structured data (Organization,
  WebSite, Course, Article), `sitemap.xml`, `robots.txt` (blocks /admin and /api).
