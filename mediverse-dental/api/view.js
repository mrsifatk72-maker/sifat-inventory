// Vercel Function: POST /api/view  (body = article slug) → +1 view for a published article.
// Uses only the public key; the database function counts published articles only and
// cannot change anything else. Best-effort limit: one count per IP+article per 10 minutes
// per server instance. Always answers 204 so it reveals nothing.
import { config } from '../lib/data.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isJwt = (k) => /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k);
const seen = new Map();

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0; const chunks = [];
    req.on('data', (d) => { size += d.length; if (size <= 200) chunks.push(d); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()));
    req.on('error', () => resolve(''));
  });
}

export function makeViewHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const done = () => { res.statusCode = 204; res.end(); };
    if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(); }
    const slug = typeof req.body === 'string' ? req.body.trim() : await readBody(req);
    if (!SLUG.test(slug) || slug.length > 80) return done();
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const key = `${ip}|${slug}`, now = Date.now();
    if (seen.get(key) > now - 10 * 60 * 1000) return done();
    seen.set(key, now);
    if (seen.size > 5000) for (const [k, t] of seen) if (t < now - 10 * 60 * 1000) seen.delete(k);
    try {
      const { url, key: apiKey } = config(env);
      await fetchImpl(`${url}/rest/v1/rpc/record_article_view`, {
        method: 'POST',
        headers: { apikey: apiKey, ...(isJwt(apiKey) ? { Authorization: `Bearer ${apiKey}` } : {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_slug: slug }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) { console.error('view count failed:', err.message); }
    return done();
  };
}

export default makeViewHandler();
