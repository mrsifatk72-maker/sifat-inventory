// Vercel Function: renders the public website from the Supabase database.
//   /                → homepage
//   /courses/<slug>  → course detail page
//   /articles, /articles/<slug>, /team, /books
// Pages are cached at Vercel's edge for 60 s and served stale for up to 10 min
// while refreshing, so the database is queried at most about once a minute.
import { config, loadContent } from '../lib/data.js';
import { renderHome, renderCourse, renderNotFound, renderArticles, renderArticle, renderArticleNotFound, renderTeam, renderBooks } from '../lib/render.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function origin(req, env) {
  if (env.SITE_URL && /^https:\/\/[^\s/]+$/.test(env.SITE_URL.replace(/\/+$/, ''))) return env.SITE_URL.replace(/\/+$/, '');
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://${req.headers.host || 'localhost'}`;
}

function route(req) {
  const u = new URL(req.url, 'http://local');
  const q = u.searchParams.get('route');
  if (q === 'course' || q === 'article') return { name: q, slug: u.searchParams.get('slug') || '' };
  if (['home', 'articles', 'team', 'books'].includes(q)) return { name: q };
  let m = /^\/courses\/([^/]+)\/?$/.exec(u.pathname);
  if (m) return { name: 'course', slug: decodeURIComponent(m[1]) };
  m = /^\/articles\/([^/]+)\/?$/.exec(u.pathname);
  if (m) return { name: 'article', slug: decodeURIComponent(m[1]) };
  m = /^\/(articles|team|books)\/?$/.exec(u.pathname);
  if (m) return { name: m[1] };
  return { name: 'home' };
}

function send(res, status, html, { cache, noindex }) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  if (noindex) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(html);
}

export function makeHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    // Staging/preview must never be indexed by search engines.
    const noindex = env.ALLOW_INDEXING !== 'true';
    const opts = { origin: origin(req, env), noindex };
    const r = route(req);
    const extra = {
      home: { articles: 'latest' }, articles: { articles: 'all' }, team: { team: true }, books: { books: true },
      article: { articleSlug: SLUG.test(r.slug || '') ? r.slug : '' },
    }[r.name] || {};
    let content;
    try {
      content = await loadContent(config(env), fetchImpl, extra);
    } catch (err) {
      console.error('Content load failed:', err.message);
      return send(res, 503, '<!doctype html><meta charset="utf-8"><title>Temporarily unavailable</title><p style="font-family:sans-serif;padding:40px">The site is temporarily unavailable. Please try again in a minute.</p>',
        { cache: 'no-store', noindex: true });
    }

    const cache = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
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
