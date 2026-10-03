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

async function getTable({ url, key }, table, fetchImpl) {
  const res = await fetchImpl(`${url}/rest/v1/${table}?select=*`, {
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

export async function loadContent(cfg = config(), fetchImpl = fetch) {
  const lists = await Promise.all(TABLES.map((t) => getTable(cfg, t, fetchImpl)));
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
  }));

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
  };
}
