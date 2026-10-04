# Admin password reset — Supabase settings (staging)

The admin panel uses Supabase Auth. "Forgot password?" asks Supabase to email a one-time
link that opens `/admin/reset`. Two settings in the Supabase dashboard make this work.

## 1. Allow the reset page as a redirect URL (required)
Supabase → staging project → **Authentication → URL Configuration**
- **Site URL**: your current staging address, e.g. `https://mediverse-dental-staging-v9.vercel.app`
- **Redirect URLs** → Add: `https://mediverse-dental-staging-*.vercel.app/admin/reset`
  (the `*` covers v9, v10 … so it does not need changing for every new deploy)

Without this, the email link opens the Site URL instead of the reset page.

## 2. Email sending (strongly recommended)
Supabase's built-in email service only delivers to the project's team members and allows
very few emails per hour. For real use set up custom SMTP:
**Authentication → Emails → SMTP Settings** (e.g. Resend, Brevo, Gmail SMTP with an app password).

## Security notes
- Passwords are never stored by the website or in the database tables — only Supabase Auth keeps them (hashed).
- Changing the password signs out every other device; a reset signs out all devices.
- The "Forgot password?" answer is the same for every email address (nobody can find out which emails are admins).
