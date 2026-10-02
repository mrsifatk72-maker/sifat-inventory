// Automated tests for the database-rendered website (no network, fake Supabase).
//   npm test   (node --test tests/*.test.mjs)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startServer } from './dev-server.mjs';
import { makeHandler } from '../api/page.js';
import { loadContent } from '../lib/data.js';
import { renderHome, renderCourse } from '../lib/render.js';
import { inline, isSafeUrl } from '../lib/markup.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/content.json', import.meta.url), 'utf8'));
let server, base;
const get = async (path) => { const r = await fetch(base + path); return { status: r.status, headers: r.headers, html: await r.text() }; };

before(async () => ({ server, base } = await startServer(0)));
after(() => server.close());

test('homepage renders all content from the database', async () => {
  const { status, html, headers } = await get('/');
  assert.equal(status, 200);
  assert.match(headers.get('cache-control'), /s-maxage=60/);
  assert.equal((html.match(/<a class="course rv"/g) || []).length, 22, '22 course cards');
  assert.equal((html.match(/<article class="mentor rv"/g) || []).length, 10, '10 mentor cards');
  assert.equal((html.match(/class="mono" role="img"/g) || []).length, 4, '4 hijab-icon mentors');
  for (const c of FIXTURE.courses) assert.ok(html.includes(`href="/courses/${c.slug}"`), `card links to /courses/${c.slug}`);
  assert.ok(!html.includes('data:image/'), 'no embedded base64 images (images come from storage)');
  assert.ok(html.length < 200_000, `page is light (${html.length} bytes)`);
  assert.ok(!/\{\{|undefined<|>null</.test(html), 'no unfilled placeholders');
});

test('every Bangla key used in the page exists in the Bangla dictionary', async () => {
  const { html } = await get('/');
  const dict = JSON.parse(/var BN=(\{.*?\}),lang=/s.exec(html)[1]);
  const keys = [...html.matchAll(/data-i18n="(t\d+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 80, `${keys.length} translatable elements`);
  for (const k of keys) assert.ok(dict[k], `Bangla text for ${k}`);
  assert.ok(dict._title && dict._search, 'Bangla title + search placeholder');
});

test('all 22 course pages render with flyer, Enroll link to Mediverse and SEO', async () => {
  for (const c of FIXTURE.courses) {
    const { status, html } = await get(`/courses/${c.slug}`);
    assert.equal(status, 200, c.slug);
    assert.ok(html.includes(`<title>${c.title_en.replace(/&/g, '&amp;')} — MediVerse Dental</title>`), `title for ${c.slug}`);
    assert.ok(html.includes(`href="${c.external_url}" target="_blank" rel="noopener"><span`), `Enroll button → ${c.external_url}`);
    assert.match(c.external_url, /^https:\/\/mediversebd\.com/);
    assert.ok(html.includes(`<link rel="canonical" href="`) && html.includes(`/courses/${c.slug}"`), 'canonical URL');
    assert.ok(html.includes('"@type":"Course"'), 'structured data');
    assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'), 'staging is not indexed');
    if (c.flyer_media_id) assert.match(html, /<img src="[^"]+\/storage\/v1\/object\/public\/public-media\/flyers\//, `flyer for ${c.slug}`);
    else assert.ok(html.includes('class="ph"'), `placeholder for ${c.slug}`);
  }
});

test('course pages show their mentors', async () => {
  const { html } = await get('/courses/essential-medicine-for-bds');
  assert.ok(html.includes('<h3>Dr. M R Sifat</h3>'));
  const sdm = (await get('/courses/sdm-full-course')).html;
  assert.ok(sdm.includes('<h3>Firoj Ahamed Fahim</h3>'));
  const none = (await get('/courses/microbiology')).html;
  assert.ok(!none.includes('<article class="mentor'), 'no mentor section when none assigned');
});

test('unknown or malformed course slugs return 404', async () => {
  for (const p of ['/courses/does-not-exist', '/courses/%3Cscript%3E', '/courses/SDM-FULL-COURSE', "/courses/x'or'1"]) {
    assert.equal((await get(p)).status, 404, p);
  }
});

test('the anon key and any secrets never appear in the HTML', async () => {
  for (const p of ['/', '/courses/sdm-full-course', '/courses/nope']) {
    const { html } = await get(p);
    assert.ok(!html.includes('local-test-anon-key'), `no key in ${p}`);
    assert.ok(!/service_role|SUPABASE_/i.test(html), `no secret names in ${p}`);
  }
});

test('database text is escaped; unsafe links are neutralised', async () => {
  assert.equal(inline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(inline('[click](javascript:alert(1))'), '[click](javascript:alert(1))');
  assert.equal(inline('[ok](https://mediversebd.com)'), '<a href="https://mediversebd.com" target="_blank" rel="noopener" style="color:var(--cyan)">ok</a>');
  assert.equal(inline('**bold** and [[grad]]\nline'), '<b>bold</b> and <span class="grad-text">grad</span><br>line');
  assert.ok(!isSafeUrl('//evil.example') && !isSafeUrl('data:text/html,x') && isSafeUrl('#courses'));

  const evil = structuredClone(FIXTURE);
  evil.courses[0].title_en = '<img src=x onerror=alert(1)>';
  evil.courses[0].external_url = 'javascript:alert(1)';
  evil.nav_items[0].url = 'javascript:alert(2)';
  const fake = (rows) => async (url) => ({ ok: true, json: async () => rows[/rest\/v1\/([a-z_]+)/.exec(url)[1]] });
  const c = await loadContent({ url: 'https://example.supabase.co', key: 'k' }, fake(evil));
  const home = renderHome(c, { origin: 'https://x', noindex: true });
  const page = renderCourse(c, c.courses[0], { origin: 'https://x', noindex: true });
  for (const html of [home, page]) {
    assert.ok(!html.includes('<img src=x onerror'), 'HTML in content is escaped');
    assert.ok(!html.includes('href="javascript:'), 'javascript: links removed');
  }
  assert.ok(page.includes('href="https://mediversebd.com" target="_blank"'), 'unsafe CTA falls back to Mediverse');
});

test('if Supabase is unreachable the site answers 503 (not a broken page)', async () => {
  const handler = makeHandler({ env: { SUPABASE_URL: 'https://down.example', SUPABASE_ANON_KEY: 'k' }, fetchImpl: async () => { throw new Error('offline'); } });
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
  await handler({ url: '/', headers: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('missing environment variables fail safely', async () => {
  const handler = makeHandler({ env: {} });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  await handler({ url: '/', headers: {} }, res);
  assert.equal(res.statusCode, 503);
});
