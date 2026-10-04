// Vercel Function: renders the public website from the Supabase database.
//   /                → homepage
//   /courses/<slug>  → course detail page
//   /articles, /articles/<slug>, /team, /books
//   /robots.txt, /sitemap.xml
// Pages are cached at Vercel's edge for 60 s and served stale for up to 10 min
// while refreshing, so the database is queried at most about once a minute.
import { config, loadContent } from '../lib/data.js';
import { renderHome, renderCourse, renderNotFound, renderArticles, renderArticle, renderArticleNotFound, renderTeam, renderBooks } from '../lib/render.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const siteUrl = (env) => {
  const u = (env.SITE_URL || '').replace(/\/+$/, '');
  return /^https:\/\/[^\s/]+$/.test(u) ? u : '';
};

function origin(req, env) {
  if (siteUrl(env)) return siteUrl(env);
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://${req.headers.host || 'localhost'}`;
}

// Search engines may index only when ALLOW_INDEXING=true AND the request came in on the
// official domain (SITE_URL). The *.vercel.app addresses always stay noindex, so Google
// never sees duplicate copies of the site.
export function indexable(req, env) {
  if (env.ALLOW_INDEXING !== 'true') return false;
  const site = siteUrl(env);
  if (!site) return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  return host === new URL(site).host;
}

const xmlEsc = (v) => String(v).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]));
const day = (v) => { const d = new Date(v || ''); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };

export function robotsTxt(base, allow) {
  if (!allow) return '# Not the official site address — do not index.\nUser-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
}

export function sitemapXml(base, c) {
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    ...c.courses.map((co) => ({ loc: `/courses/${co.slug}`, lastmod: day(co.updated_at), priority: '0.9', changefreq: 'weekly' })),
    { loc: '/articles', priority: '0.8', changefreq: 'daily' },
    ...(c.articles || []).map((a) => ({ loc: `/articles/${a.slug}`, lastmod: day(a.published_at), priority: '0.7', changefreq: 'monthly' })),
    { loc: '/team', priority: '0.5', changefreq: 'monthly' },
    { loc: '/books', priority: '0.6', changefreq: 'weekly' },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xmlEsc(base + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}

function route(req) {
  const u = new URL(req.url, 'http://local');
  const q = u.searchParams.get('route');
  if (q === 'course' || q === 'article') return { name: q, slug: u.searchParams.get('slug') || '' };
  if (['home', 'articles', 'team', 'books', 'robots', 'sitemap'].includes(q)) return { name: q };
  if (u.pathname === '/robots.txt') return { name: 'robots' };
  if (u.pathname === '/sitemap.xml') return { name: 'sitemap' };
  let m = /^\/courses\/([^/]+)\/?$/.exec(u.pathname);
  if (m) return { name: 'course', slug: decodeURIComponent(m[1]) };
  m = /^\/articles\/([^/]+)\/?$/.exec(u.pathname);
  if (m) return { name: 'article', slug: decodeURIComponent(m[1]) };
  m = /^\/(articles|team|books)\/?$/.exec(u.pathname);
  if (m) return { name: m[1] };
  return { name: 'home' };
}

// A short, non-secret reason shown on the error page so a misconfigured deploy is easy to spot.
export function failCode(err) {
  const m = String(err?.message || '');
  if (/SUPABASE_URL|SUPABASE_ANON_KEY/.test(m)) return 'SETUP';
  const http = /HTTP (\d{3})/.exec(m);
  if (http) return ['401', '403'].includes(http[1]) ? 'KEY' : `DB-${http[1]}`;
  return 'NETWORK';
}

function send(res, status, html, { cache, noindex, type = 'text/html; charset=utf-8' }) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  if (noindex) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(html);
}

export function makeHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    // Staging/preview must never be indexed by search engines.
    const noindex = !indexable(req, env);
    const opts = { origin: origin(req, env), noindex };
    const r = route(req);
    if (r.name === 'robots') return send(res, 200, robotsTxt(opts.origin, !noindex), { cache: 'public, max-age=0, s-maxage=3600', noindex, type: 'text/plain; charset=utf-8' });
    const extra = {
      home: { articles: 'latest' }, articles: { articles: 'all' }, sitemap: { articles: 'all' }, team: { team: true }, books: { books: true },
      article: { articleSlug: SLUG.test(r.slug || '') ? r.slug : '' },
    }[r.name] || {};
    let content;
    try {
      content = await loadContent(config(env), fetchImpl, extra);
    } catch (err) {
      console.error('Content load failed:', err.message);
      return send(res, 503, '<!doctype html><meta charset="utf-8"><title>Temporarily unavailable</title><p style="font-family:sans-serif;padding:40px">The site is temporarily unavailable. Please try again in a minute.</p><p style="font-family:sans-serif;padding:0 40px;color:#888;font-size:13px">Code: ' + failCode(err) + '</p>',
        { cache: 'no-store', noindex: true });
    }

    const cache = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
    if (r.name === 'sitemap') return send(res, 200, sitemapXml(opts.origin, content), { cache, noindex, type: 'application/xml; charset=utf-8' });
    if (r.name === 'articles') return send(res, 200, renderArticles(content, opts), { cache, noindex });
    if (r.name === 'team') return send(res, 200, renderTeam(content, opts), { cache, noindex });
    if (r.name === 'books') return send(res, 200, renderBooks(content, opts), { cache, noindex });
    if (r.name === 'article') {
      if (!content.article) return send(res, 404, renderArticleNotFound(content, opts), { cache, noindex: true });
      return send(res, 200, renderArticle(content, content.article, opts), { cache, noindex });
    }
    if (r.name === 'course') {
      const course = SLUG.test(r.slug) ? content.courses.find((x) => x.slug === r.slug) : null;
      if (!course) return send(res, 404, renderNotFound(content, opts), { cache, noindex: true });
      return send(res, 200, renderCourse(content, course, opts), { cache, noindex });
    }
    return send(res, 200, renderHome(content, opts), { cache, noindex });
  };
}

export default makeHandler();
