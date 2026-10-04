// Gives the admin panel (browser) the Supabase project URL and the PUBLIC key.
// Both are public by design: every admin action is still checked by Row-Level
// Security in the database (only users listed in public.admin_users can write).
// config() refuses to run with a secret / service_role key.
import { config } from '../lib/data.js';

export function makeAdminConfigHandler(env = process.env) {
  return function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    try {
      const { url, key } = config(env);
      res.statusCode = 200;
      res.end(JSON.stringify({ supabaseUrl: url, supabaseKey: key }));
    } catch (err) {
      console.error('admin-config:', err.message);
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Admin is not configured on this deployment.' }));
    }
  };
}

export default makeAdminConfigHandler();
