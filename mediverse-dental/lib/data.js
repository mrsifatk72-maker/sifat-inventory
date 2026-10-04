// Reads public website content from Supabase (read-only).
//
// Uses ONLY the public key ("publishable" sb_publishable_… or legacy "anon"). Row-Level Security in the database decides
// what is visible (published courses, active mentors, visible sections…), so this
// code cannot see drafts, admin data or analytics even if it tried.
// The service-role key is never used here.

const TABLES = [
  'site_settings', 'page_sections', 'stats', 'features', 'faqs', 'testimonials',
  'phases', 'courses', 'mentors', 'course_mentors', 'media',
  'nav_items', 'footer_sections', 'footer_links', 'social_links',
];

function decodeJwtPayload(k) {
  try { return Buffer.from(k.split('.')[1] || '', 'base64url').toString('utf8'); } catch { return ''; }
}

export function config(env = process.env) {
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = (env.SUPABASE_ANON_KEY || '').trim();
  // Refuse secret keys: this code must only ever run with the public key.
  if (/^sb_secret_/.test(key) || /"role"\s*:\s*"service_role"/.test(decodeJwtPayload(key))) {
    throw new Error('SUPABASE_ANON_KEY must be the public (anon/publishable) key, not a secret key');
  }
  if (!/^https?:\/\/[^\s]+$/.test(url) || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable');
  }
  return { url, key };
}

const isJwt = (k) => /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k);

async function getTable({ url, key }, table, fetchImpl, query = 'select=*') {
  const res = await fetchImpl(`${url}/rest/v1/${table}?${query}`, {
    // New "publishable" keys (sb_publishable_…) go only in the apikey header;
    // legacy anon keys (JWTs) are also sent as a Bearer token. Both = anonymous role.
    headers: { apikey: key, ...(isJwt(key) ? { Authorization: `Bearer ${key}` } : {}), Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Supabase ${table}: HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error(`Supabase ${table}: unexpected response`);
  return rows;
}

const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

// Columns for article lists (the full body is only loaded on the article's own page).
const ARTICLE_LIST = 'id,slug,title,excerpt,lang,category,author_name,cover_media_id,published_at,view_count,read_minutes';

// extra: { articles: 'latest' | 'all', articleSlug, team: bool, books: bool }
// These tables are optional: before their SQL has run, the pages simply show nothing.
export async function loadContent(cfg = config(), fetchImpl = fetch, extra = {}) {
  const optional = (table, query) => getTable(cfg, table, fetchImpl, query).catch(() => []);
  const SLUGRE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const [articles, article, team, books] = await Promise.all([
    extra.articles ? optional('articles', `select=${ARTICLE_LIST}&order=published_at.desc${extra.articles === 'latest' ? '&limit=3' : '&limit=200'}`) : [],
    extra.articleSlug && SLUGRE.test(extra.articleSlug) ? optional('articles', `select=*&slug=eq.${encodeURIComponent(extra.articleSlug)}&limit=1`) : [],
    extra.team ? optional('team_members', 'select=*&order=sort_order.asc,name.asc') : [],
    extra.books ? optional('books', 'select=*&order=sort_order.asc,title.asc') : [],
  ]);
  // course_reviews is optional: until its SQL has been run the site simply shows no reviews.
  const [lists, reviews] = await Promise.all([
    Promise.all(TABLES.map((t) => getTable(cfg, t, fetchImpl))),
    getTable(cfg, 'course_reviews', fetchImpl).catch(() => []),
  ]);
  const c = Object.fromEntries(TABLES.map((t, i) => [t, lists[i]]));

  for (const t of TABLES) c[t].sort(bySort);
  c.phases.sort((a, b) => a.sort_order - b.sort_order || a.code - b.code);

  const media = new Map(c.media.map((m) => [m.id, m]));
  const mediaUrl = (id) => {
    const m = id && media.get(id);
    return m ? `${cfg.url}/storage/v1/object/public/${encodeURIComponent(m.bucket)}/${m.path.split('/').map(encodeURIComponent).join('/')}` : null;
  };
  const phaseById = new Map(c.phases.map((p) => [p.id, p]));
  const mentorById = new Map(c.mentors.map((m) => [m.id, m]));

  const courses = c.courses.map((course) => ({
    ...course,
    phase: phaseById.get(course.phase_id) || null,
    flyerUrl: mediaUrl(course.flyer_media_id),
    flyerMedia: media.get(course.flyer_media_id) || null,
    thumbnailUrl: mediaUrl(course.thumbnail_media_id),
    mentors: c.course_mentors
      .filter((cm) => cm.course_id === course.id)
      .sort(bySort)
      .map((cm) => mentorById.get(cm.mentor_id))
      .filter(Boolean),
    reviews: reviews.filter((r) => r.course_id === course.id && r.is_visible !== false).sort(bySort),
  }));

  // Courses are listed phase by phase (1st, 2nd, 3rd, Final), then by their own order,
  // so a newly added course appears inside its phase, not at the top.
  const phaseRank = (p) => (p ? [p.sort_order ?? 0, p.code ?? 0] : [1e9, 1e9]); // no phase (postgraduate) → after BDS phases
  courses.sort((a, b) => {
    const [pa, ca] = phaseRank(a.phase), [pb, cb] = phaseRank(b.phase);
    return pa - pb || ca - cb || (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const mentors = c.mentors.map((m) => ({ ...m, photoUrl: mediaUrl(m.photo_media_id) }));
  for (const course of courses) course.mentors = course.mentors.map((m) => mentors.find((x) => x.id === m.id));

  const sections = Object.fromEntries(c.page_sections.map((s) => [s.key, s]));
  const settings = c.site_settings[0] || {};
  const footerSections = c.footer_sections.map((s) => ({
    ...s,
    links: c.footer_links.filter((l) => l.section_id === s.id).sort(bySort),
  }));

  return {
    settings: {
      ...settings,
      logoDarkUrl: mediaUrl(settings.logo_dark_media_id),
      logoLightUrl: mediaUrl(settings.logo_light_media_id),
      ogImageUrl: mediaUrl(settings.og_image_media_id),
    },
    sections,
    stats: c.stats,
    features: c.features,
    faqs: c.faqs,
    testimonials: c.testimonials,
    phases: c.phases,
    courses,
    mentors,
    nav: { header: c.nav_items.filter((n) => n.location === 'header'), mobile: c.nav_items.filter((n) => n.location === 'mobile') },
    footerSections,
    socials: c.social_links,
    articles: articles.map((a) => ({ ...a, coverUrl: mediaUrl(a.cover_media_id) })),
    article: article[0] ? { ...article[0], coverUrl: mediaUrl(article[0].cover_media_id) } : null,
    team: team.map((t) => ({ ...t, photoUrl: mediaUrl(t.photo_media_id) })),
    books: books.map((b) => ({ ...b, coverUrl: mediaUrl(b.cover_media_id) })),
    // Inline article images are referenced by path (e.g. articles/brain.webp).
    pathUrl: (path) => `${cfg.url}/storage/v1/object/public/public-media/${path.split('/').map(encodeURIComponent).join('/')}`,
  };
}
