// End-to-end checks of the admin panel against a local copy of the database
// (real PostgreSQL + real migrations/RLS + PostgREST), in a real browser.
//   POSTGREST_BIN=/path/to/postgrest node tests/admin-e2e.mjs [screenshotDir]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import zlib from 'node:zlib';
import { startStack } from './local-supabase/stack.mjs';

let pw;
try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const OWNER = { email: 'owner@example.test', password: 'owner-pass-123456', role: 'owner' };
const EDITOR = { email: 'editor@example.test', password: 'editor-pass-123456', role: 'editor' };
const VISITOR = { email: 'visitor@example.test', password: 'visitor-pass-123456' };
const stack = await startStack({ users: [OWNER, EDITOR, VISITOR] });
const { base } = stack;
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); if (!ok) console.log('FAIL', name, info); };

// ------------------------------------------------------------- helpers
function png(w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const api = async (path, { token, method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { apikey: stack.anonKey, ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', prefer: 'return=representation', ...headers }, body: body == null ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};
const site = async (path) => { const r = await fetch(base + path); return { status: r.status, html: await r.text() }; };
const visibleCourses = (html) => (html.match(/class="course[ "][^>]*href="\/courses\//g) || []).length;

// ================================================ 1. Authorization (REST, real RLS)
{
  const owner = stack.login(OWNER.email).access_token;
  const editor = stack.login(EDITOR.email).access_token;
  const visitor = stack.login(VISITOR.email).access_token;
  const someCourse = (await api('/rest/v1/courses?select=id,slug&limit=1')).body[0];

  // anonymous
  check('authz anon: can read 22 public courses', (await api('/rest/v1/courses?select=id')).body.length === 22);
  check('authz anon: cannot read admin_users', (await api('/rest/v1/admin_users')).status === 401);
  check('authz anon: cannot read media_usage', (await api('/rest/v1/media_usage')).status === 401);
  check('authz anon: cannot insert a course', (await api('/rest/v1/courses', { method: 'POST', body: { slug: 'x-anon', title_en: 'x', phase_id: '00000000-0000-0000-0000-000000000000' } })).status === 401);
  const anonUpd = await api(`/rest/v1/courses?id=eq.${someCourse.id}`, { method: 'PATCH', body: { title_en: 'hacked' } });
  check('authz anon: cannot update a course', anonUpd.status === 401 || (Array.isArray(anonUpd.body) && anonUpd.body.length === 0), JSON.stringify(anonUpd));
  const anonUp = await fetch(`${base}/storage/v1/object/public-media/images/anon.png`, { method: 'POST', headers: { apikey: stack.anonKey, 'content-type': 'image/png' }, body: png(4, 4, [1, 2, 3]) });
  check('authz anon: cannot upload to public-media', anonUp.status === 403);

  // logged-in but NOT an admin
  check('authz non-admin: sees no admin_users rows', JSON.stringify((await api('/rest/v1/admin_users', { token: visitor })).body) === '[]');
  check('authz non-admin: cannot insert a course', (await api('/rest/v1/courses', { token: visitor, method: 'POST', body: { slug: 'x-visitor', title_en: 'x', phase_id: '00000000-0000-0000-0000-000000000000' } })).status === 403);
  const visUpd = await api(`/rest/v1/courses?id=eq.${someCourse.id}`, { token: visitor, method: 'PATCH', body: { title_en: 'hacked' } });
  check('authz non-admin: cannot update a course', Array.isArray(visUpd.body) && visUpd.body.length === 0, JSON.stringify(visUpd));
  const visSec = await api('/rest/v1/page_sections?key=eq.hero', { token: visitor, method: 'PATCH', body: { is_visible: false } });
  check('authz non-admin: cannot change homepage', Array.isArray(visSec.body) && visSec.body.length === 0);
  const visDel = await api('/rest/v1/media?path=eq.logos/logo-blue.png', { token: visitor, method: 'DELETE' });
  check('authz non-admin: cannot delete media', Array.isArray(visDel.body) && visDel.body.length === 0);
  const visUp = await fetch(`${base}/storage/v1/object/public-media/images/visitor.png`, { method: 'POST', headers: { apikey: stack.anonKey, authorization: `Bearer ${visitor}`, 'content-type': 'image/png' }, body: png(4, 4, [1, 2, 4]) });
  check('authz non-admin: cannot upload to public-media', visUp.status === 403);
  const selfPromote = await api('/rest/v1/admin_users', { token: visitor, method: 'POST', body: { user_id: stack.users.get(VISITOR.email).id, role: 'owner' } });
  check('authz non-admin: cannot make themselves admin', selfPromote.status === 403, JSON.stringify(selfPromote));
  check('authz non-admin: cannot see hidden data (analytics)', (await api('/rest/v1/analytics_events?select=id', { token: visitor })).body.length === 0);

  // editor (admin, not owner)
  check('authz editor: is an admin (reads own role)', JSON.stringify((await api('/rest/v1/admin_users?select=role', { token: editor })).body) === '[{"role":"editor"}]');
  const edUpd = await api(`/rest/v1/courses?id=eq.${someCourse.id}`, { token: editor, method: 'PATCH', body: { sort_order: 11 } });
  check('authz editor: can update a course', Array.isArray(edUpd.body) && edUpd.body.length === 1);
  const edDel = await api(`/rest/v1/courses?id=eq.${someCourse.id}`, { token: editor, method: 'DELETE' });
  check('authz editor: cannot permanently delete a course (owner only)', Array.isArray(edDel.body) && edDel.body.length === 0);
  const edPromote = await api(`/rest/v1/admin_users?user_id=eq.${stack.users.get(EDITOR.email).id}`, { token: editor, method: 'PATCH', body: { role: 'owner' } });
  check('authz editor: cannot promote themselves to owner', Array.isArray(edPromote.body) ? edPromote.body.length === 0 : edPromote.status >= 400);
  const badPath = await fetch(`${base}/storage/v1/object/public-media/secret/evil.png`, { method: 'POST', headers: { apikey: stack.anonKey, authorization: `Bearer ${editor}`, 'content-type': 'image/png' }, body: png(4, 4, [9, 9, 9]) });
  check('authz editor: uploads limited to the allowed folders', badPath.status === 403);
  // owner
  check('authz owner: reads own role', JSON.stringify((await api('/rest/v1/admin_users?select=role&user_id=eq.' + stack.users.get(OWNER.email).id, { token: owner })).body) === '[{"role":"owner"}]');
  const mediaInUse = await api('/rest/v1/media?path=eq.flyers/sdm-full.jpg', { token: owner, method: 'DELETE' });
  check('authz owner: database refuses deleting an image that is in use', mediaInUse.status === 409, JSON.stringify(mediaInUse.status));
  await api(`/rest/v1/courses?id=eq.${someCourse.id}`, { token: editor, method: 'PATCH', body: { sort_order: 10 } });
  check('auth: sign-up is disabled', (await api('/auth/v1/signup', { method: 'POST', body: { email: 'a@b.c', password: 'x' } })).status === 422);
}

// ================================================ 2. Browser
const browser = await pw.chromium.launch();
async function open(path = '/admin', { mobile = false } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] }
    : { viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${m.text()} @ ${p.url()}`); });
  if (path) await p.goto(base + path);
  return { ctx, p, errors };
}
async function login(p, user) {
  await p.waitForSelector('#email');
  await p.fill('#email', user.email);
  await p.fill('#password', user.password);
  await p.click('button[type=submit]');
}
const toastText = async (p) => { await p.waitForSelector('.toast', { timeout: 8000 }); const t = await p.$$eval('.toast', (els) => els.map((e) => e.textContent).join(' | ')); return t; };
const clearToasts = (p) => p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
const save = async (p) => { await clearToasts(p); await p.click('#saveBtn'); return toastText(p); };

// ---------------------------------------------------------------- auth flow
{
  const { ctx, p, errors } = await open('/admin');
  await p.waitForSelector('#email');
  check('auth: /admin without login → /admin/login', new URL(p.url()).pathname === '/admin/login');
  await p.goto(base + '/admin/courses');
  await p.waitForSelector('#email');
  check('auth: deep link remembers where to go (?next=)', p.url().endsWith('/admin/login?next=%2Fadmin%2Fcourses'), p.url());
  await login(p, { email: OWNER.email, password: 'wrong-password' });
  await p.waitForSelector('.form-error:not(.hidden)');
  check('auth: wrong password → clear error', (await p.textContent('.form-error')) === 'Wrong email or password.');
  check('auth: wrong password → still on login page', new URL(p.url()).pathname === '/admin/login');
  if (shots) await p.screenshot({ path: `${shots}/login-error.png` });
  await login(p, OWNER);
  await p.waitForSelector('#courseList');
  check('auth: login → goes to the page asked for', new URL(p.url()).pathname === '/admin/courses');
  await p.goto(base + '/admin');
  await p.waitForSelector('#stats');
  const stats = await p.$$eval('#stats .stat-card b', (b) => b.map((x) => x.textContent));
  check('dashboard: cards show 22 courses, 10 mentors, 7 sections, 29 media', stats.join(',') === '22,10,7,29', stats.join(','));
  if (shots) await p.screenshot({ path: `${shots}/dashboard-desktop.png`, fullPage: true });
  await p.reload();
  await p.waitForSelector('#stats');
  check('auth: session persists after reload', true);
  const p2 = await ctx.newPage();
  await p2.goto(base + '/admin/mentors');
  await p2.waitForSelector('#mentorList');
  check('auth: session persists in a new tab', true);
  await p2.close();
  check('admin: no JavaScript or CSP errors', errors.length === 0, errors.join(' | '));
  await p.click('.who .btn');
  await p.waitForSelector('#email');
  check('auth: logout → login page', new URL(p.url()).pathname === '/admin/login');
  await p.goto(base + '/admin/media');
  await p.waitForSelector('#email');
  check('auth: after logout, admin pages need login again', new URL(p.url()).pathname === '/admin/login');
  check('auth: no session left in browser storage', await p.evaluate(() => !Object.keys(localStorage).some((k) => /auth-token/.test(k) && localStorage.getItem(k) && localStorage.getItem(k) !== 'null')));
  await ctx.close();
}

// ------------------------------------------------------------- non-admin user
{
  const { ctx, p } = await open('/admin');
  await login(p, VISITOR);
  await p.waitForSelector('.denied');
  check('authz non-admin: sees “No admin access”, no admin menu', (await p.textContent('.denied h1')) === 'No admin access' && !(await p.$('.side')));
  if (shots) await p.screenshot({ path: `${shots}/non-admin.png` });
  await p.goto(base + '/admin/courses');
  await p.waitForSelector('.denied');
  check('authz non-admin: deep link also blocked', !(await p.$('#courseList')));
  await p.click('.denied .btn');
  await p.waitForSelector('#email');
  check('authz non-admin: can log out', true);
  await ctx.close();
}

// ------------------------------------------------------------------ courses
const { ctx, p, errors } = await open('/admin/courses');
await login(p, OWNER);
await p.waitForSelector('#courseList .row');
check('courses: list shows all 22', (await p.$$('#courseList .row')).length === 22);
await p.fill('#courseSearch', 'opg');
check('courses: search “opg” finds Decode the OPG', (await p.$$eval('#courseList .row b', (b) => b.map((x) => x.textContent))).join() === 'Decode the OPG');
await p.fill('#courseSearch', '');

// edit an existing course
await p.click('#courseList .row:has-text("Decode the OPG")');
await p.waitForSelector('#courseForm');
const oldDesc = await p.inputValue('#short_desc_en');
await p.fill('#short_desc_en', 'Read any OPG with confidence — edited from admin.');
check('unsaved: save bar shows “Unsaved changes”', (await p.textContent('.savebar .state')) === 'Unsaved changes');
await p.click('.side a[data-view="mentors"]');
await p.waitForSelector('.modal');
check('unsaved: leaving asks for confirmation', (await p.textContent('.modal h2')) === 'Leave without saving?');
await p.click('.modal .btn:has-text("Cancel")');
check('unsaved: cancel keeps you on the form', new URL(p.url()).pathname.startsWith('/admin/courses/'));
check('courses edit: save', /Course saved/.test(await save(p)));
let pub = await site('/courses/decode-the-opg');
check('courses edit: public course page shows the change', pub.html.includes('edited from admin'));
check('courses edit: homepage card shows the change', (await site('/')).html.includes('edited from admin'));
await p.fill('#short_desc_en', oldDesc);
await save(p);

// validation
await p.fill('#external_url', 'http://not-secure.example');
await p.click('#saveBtn');
await p.waitForSelector('.form-error:not(.hidden)');
check('courses: rejects non-https enrollment URL', /https/.test(await p.textContent('.form-error:not(.hidden)')));
await p.goto(base + '/admin/courses/new'); // discard (dialog)
await p.waitForTimeout(300);

// add a new course
await p.goto(base + '/admin/courses/new');
await p.waitForSelector('#courseForm');
await p.fill('#title_en', 'Admin Test Course');
await p.fill('#title_bn', 'অ্যাডমিন টেস্ট কোর্স');
check('courses new: slug is filled from the name', (await p.inputValue('#slug')) === 'admin-test-course');
await p.selectOption('#phase_id', { label: '2nd Phase' });
await p.selectOption('#status', 'active');
await p.fill('#external_url', 'https://mediversebd.com/courses/admin-test-course');
await p.fill('#short_desc_en', 'A course created in the admin test.');
await p.fill('#short_desc_bn', 'অ্যাডমিন টেস্টে বানানো কোর্স।');
await p.fill('#details_en', 'First paragraph.\n- Point one\n- Point two');
await p.fill('#total_classes', '24');
await p.click('button:has-text("+ Add feature")');
await p.fill('.rep-item input >> nth=0', 'Live classes');
await p.click('button:has-text("+ Add mentor")');
await p.selectOption('select[aria-label="Mentor"]', { label: 'Dr. M R Sifat' });
await p.click('button:has-text("Choose image")');
await p.waitForSelector('.modal .tile');
await p.click('.modal .tile[title="flyers/decode-opg.jpg"]');
check('courses new: flyer picked from media', (await p.textContent('.preview .pinfo')).includes('flyers/decode-opg.jpg'));
if (shots) await p.screenshot({ path: `${shots}/course-new.png`, fullPage: true });
check('courses new: created', /Course created/.test(await save(p)));
await p.waitForURL(/\/admin\/courses\/[0-9a-f-]{36}$/);
const newId = p.url().split('/').pop();
pub = await site('/courses/admin-test-course');
check('courses new: public page exists', pub.status === 200 && pub.html.includes('Admin Test Course') && pub.html.includes('24'), String(pub.status));
check('courses new: Enroll button → Mediverse URL', pub.html.includes('href="https://mediversebd.com/courses/admin-test-course"'));
check('courses new: mentor shown on course page', pub.html.includes('Dr. M R Sifat'));
check('courses new: Bangla name present', pub.html.includes('অ্যাডমিন টেস্ট কোর্স'));
check('courses new: feature + details rendered', pub.html.includes('Live classes') && pub.html.includes('Point two'));
check('courses new: homepage now lists 23 courses', visibleCourses((await site('/')).html) === 23, String(visibleCourses((await site('/')).html)));
const dbInfo = stack.sql(`select info::text from courses where id='${newId}'`);
check('courses new: info JSON stored in the existing format', JSON.parse(dbInfo).total_classes === 24 && JSON.parse(dbInfo).features[0].en === 'Live classes', dbInfo);

// hide / unpublish
await p.selectOption('#status', 'hidden');
await save(p);
check('courses hide: public page gone (404)', (await site('/courses/admin-test-course')).status === 404);
check('courses hide: homepage back to 22', visibleCourses((await site('/')).html) === 22);
// archive → restore → delete
await clearToasts(p);
await p.click('#archiveBtn');
await p.click('.modal .btn-danger');
await p.waitForURL((u) => u.pathname === '/admin/courses');
await p.waitForSelector('#courseList .row');
check('courses archive: removed from current list', (await p.$$('#courseList .row')).length === 22);
await p.selectOption('#courseFilter', 'archived');
check('courses archive: listed under Archived', (await p.$$eval('#courseList .row b', (b) => b.map((x) => x.textContent))).includes('Admin Test Course'));
await p.click('#courseList .row:has-text("Admin Test Course")');
await p.waitForSelector('#restoreBtn');
await p.click('#restoreBtn');
await p.waitForSelector('#archiveBtn');
check('courses restore: works', stack.sql(`select archived_at is null from courses where id='${newId}'`) === 't');
await p.click('#archiveBtn'); await p.click('.modal .btn-danger');
await p.waitForURL((u) => u.pathname === '/admin/courses');
await p.waitForSelector('#courseList .row');
await p.goto(base + `/admin/courses/${newId}`);
await p.waitForSelector('#deleteBtn');
await p.click('#deleteBtn');
check('courses delete: must type the slug first', await p.isDisabled('.modal .btn-danger'));
await p.fill('.modal input', 'admin-test-course');
await p.click('.modal .btn-danger');
await p.waitForURL((u) => u.pathname === '/admin/courses');
check('courses delete: permanently deleted (owner)', stack.sql(`select count(*) from courses where id='${newId}'`) === '0');
check('courses: 22 original courses still there', stack.sql('select count(*) from courses') === '22');

// ------------------------------------------------------------------ mentors
await p.goto(base + '/admin/mentors');
await p.waitForSelector('#mentorList .row');
check('mentors: list shows all 10', (await p.$$('#mentorList .row')).length === 10);
await p.click('#mentorList .row:has-text("Dr. M R Sifat")');
await p.waitForSelector('#mentorForm');
const oldDes = await p.inputValue('#designation_en');
await p.fill('#designation_en', 'Medicine · Admin Edit');
check('mentors edit: saved', /Mentor saved/.test(await save(p)));
check('mentors edit: homepage shows it', (await site('/')).html.includes('Medicine · Admin Edit'));
await p.fill('#designation_en', oldDes); await save(p);

await p.goto(base + '/admin/mentors/new');
await p.waitForSelector('#mentorForm');
await p.fill('#name', 'Dr. Test Mentor');
check('mentors new: slug from name', (await p.inputValue('#slug')) === 'test-mentor');
await p.fill('#designation_en', 'Testing');
await p.click('button:has-text("Choose image")');
await p.waitForSelector('#pickFile');
await p.setInputFiles('#pickFile', { name: 'Test Mentor Photo.PNG', mimeType: 'image/png', buffer: png(40, 40, [200, 120, 60]) });
await p.click('.modal .btn-primary:has-text("Upload")');
await p.waitForSelector('.modal', { state: 'detached', timeout: 8000 }).catch(async () => console.log('TOASTS:', await p.$$eval('.toast', (e) => e.map((x) => x.textContent))));
check('mentors new: photo uploaded to mentors/ with a safe name', (await p.textContent('.preview .pinfo')).includes('mentors/test-mentor-photo.png'));
check('mentors new: picture style switched to Photo', (await p.inputValue('#avatar_style')) === 'photo');
check('mentors new: added', /Mentor added/.test(await save(p)));
await p.waitForURL(/\/admin\/mentors\/[0-9a-f-]{36}$/);
const home = (await site('/')).html;
check('mentors new: on the homepage with photo', home.includes('Dr. Test Mentor') && home.includes('/storage/v1/object/public/public-media/mentors/test-mentor-photo.png'));
const img = await fetch(`${base}/storage/v1/object/public/public-media/mentors/test-mentor-photo.png`);
check('mentors new: photo URL works', img.status === 200 && img.headers.get('content-type') === 'image/png');
await p.click('#archiveBtn'); await p.click('.modal .btn-danger');
await p.waitForURL((u) => u.pathname === '/admin/mentors');
check('mentors archive: gone from homepage', !(await site('/')).html.includes('Dr. Test Mentor'));
const tmId = stack.sql("select id from mentors where slug='test-mentor'");
await p.goto(base + `/admin/mentors/${tmId}`);
await p.waitForSelector('#deleteBtn');
await p.click('#deleteBtn'); await p.fill('.modal input', 'test-mentor'); await p.click('.modal .btn-danger');
await p.waitForURL((u) => u.pathname === '/admin/mentors');
check('mentors delete: removed (unused mentor, owner)', stack.sql("select count(*) from mentors where slug='test-mentor'") === '0');
const sifatId = stack.sql("select id from mentors where slug='m-r-sifat'") || stack.sql("select id from mentors where name='Dr. M R Sifat'");
stack.sql(`update mentors set archived_at = now() where id='${sifatId}'`);
await p.goto(base + `/admin/mentors/${sifatId}`);
await p.waitForSelector('#restoreBtn');
check('mentors delete: blocked while the mentor teaches courses', !(await p.$('#deleteBtn')) && /Permanent delete is not possible/.test(await p.textContent('#danger')));
await p.click('#restoreBtn');
await p.waitForSelector('#archiveBtn');
check('mentors: 10 mentors after tests', stack.sql('select count(*) from mentors where archived_at is null') === '10');

// ------------------------------------------------------------------ homepage
await p.goto(base + '/admin/homepage');
await p.waitForSelector('#sectionList .row');
check('homepage: 7 sections listed', (await p.$$('#sectionList .row')).length === 7);
const heroBefore = JSON.parse(stack.sql("select content::text from page_sections where key='hero'"));
await p.click('#sectionList .row:has-text("Hero")');
await p.waitForSelector('#sectionForm');
check('homepage hero: EN + BN heading loaded', (await p.inputValue('#en_heading')) === heroBefore.en.heading && (await p.inputValue('#bn_heading')) === heroBefore.bn.heading);
await p.fill('#en_heading', 'Future Dentistry\n[[Starts Today.]]');
await p.fill('#bn_heading', 'ডেন্টিস্ট্রির ভবিষ্যৎ\n[[আজ থেকেই।]]');
check('homepage hero: saved', /Section saved/.test(await save(p)));
const heroAfter = JSON.parse(stack.sql("select content::text from page_sections where key='hero'"));
check('homepage hero: JSON structure preserved (same keys, buttons untouched)',
  JSON.stringify(Object.keys(heroAfter).sort()) === JSON.stringify(Object.keys(heroBefore).sort())
  && JSON.stringify(Object.keys(heroAfter.en).sort()) === JSON.stringify(Object.keys(heroBefore.en).sort())
  && JSON.stringify(heroAfter.buttons) === JSON.stringify(heroBefore.buttons) && heroAfter.en.lead === heroBefore.en.lead);
const h1 = await site('/');
check('homepage hero: English shows on website', h1.html.includes('Starts Today.'));
check('homepage hero: Bangla shows on website', h1.html.includes('আজ থেকেই।'));
// browser EN/BN switch on the public site
{
  const pp = await ctx.newPage();
  await pp.goto(base + '/');
  const en = await pp.textContent('h1');
  await pp.click('#langBtn');
  const bn = await pp.textContent('h1');
  check('homepage hero: language switch shows edited EN/BN', en.includes('Starts Today.') && bn.includes('আজ থেকেই।'), `${en} / ${bn}`);
  await pp.close();
}
await p.fill('#en_heading', heroBefore.en.heading); await p.fill('#bn_heading', heroBefore.bn.heading); await save(p);
check('homepage hero: restored exactly', stack.sql("select content::text from page_sections where key='hero'") === JSON.stringify(heroBefore) || JSON.stringify(JSON.parse(stack.sql("select content::text from page_sections where key='hero'"))) === JSON.stringify(heroBefore));
// buttons + visibility
await p.goto(base + '/admin/homepage/contact');
await p.waitForSelector('#sectionForm');
await p.fill('input[aria-label="Button link"] >> nth=0', 'javascript:alert(1)');
await p.click('#saveBtn');
await p.waitForSelector('.form-error:not(.hidden)');
check('homepage: unsafe button link rejected', /link must start/.test(await p.textContent('.form-error')));
await p.fill('input[aria-label="Button link"] >> nth=0', 'https://mediversebd.com');
await p.goto(base + '/admin/homepage/faq');
if (await p.$('.modal')) await p.click('.modal .btn-danger');
await p.waitForSelector('#sectionForm');
await p.uncheck('#is_visible');
await save(p);
check('homepage: hiding FAQ removes it from the website', !(await site('/')).html.includes('id="faq"'));
await p.check('#is_visible');
await save(p);
check('homepage: showing FAQ again', (await site('/')).html.includes('id="faq"'));

// ------------------------------------------------------------------ media
await p.goto(base + '/admin/media');
await p.waitForSelector('#mediaGrid .tile');
check('media: library shows 29 files + the test mentor photo', (await p.$$('#mediaGrid .tile')).length === 30);
await p.selectOption('#mediaFolder', 'mentors');
check('media: folder filter (mentors/ = 6 + 1)', (await p.$$('#mediaGrid .tile')).length === 7);
await p.selectOption('#mediaFolder', '');
await p.selectOption('#uploadFolder', 'banners');
await p.setInputFiles('#uploadFile', { name: 'Eid Offer!.png', mimeType: 'image/png', buffer: png(60, 30, [10, 200, 90]) });
await p.fill('#uploadAlt', 'Eid offer banner');
await clearToasts(p);
await p.click('#uploadBtn');
check('media upload: done', /Uploaded banners\/eid-offer.png/.test(await toastText(p)));
await p.waitForFunction(() => document.querySelectorAll('#mediaGrid .tile').length === 1 || document.querySelectorAll('#mediaGrid .tile').length === 30);
const row = JSON.parse(stack.sql("select row_to_json(m)::text from media m where path='banners/eid-offer.png'"));
check('media upload: stored with kind, size, dimensions, sha256', row.kind === 'banner' && row.width === 60 && row.height === 30 && /^[0-9a-f]{64}$/.test(row.sha256) && row.alt_en === 'Eid offer banner');
check('media upload: public URL works', (await fetch(`${base}/storage/v1/object/public/public-media/banners/eid-offer.png`)).status === 200);
await clearToasts(p);
await p.setInputFiles('#uploadFile', { name: 'again.png', mimeType: 'image/png', buffer: png(60, 30, [10, 200, 90]) });
await p.click('#uploadBtn');
check('media upload: same image twice is detected', /already in the library/.test(await toastText(p)));
await clearToasts(p);
await p.setInputFiles('#uploadFile', { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
await p.click('#uploadBtn');
check('media upload: non-image rejected', /Only JPG, PNG, WebP or AVIF/.test(await toastText(p)));
await p.selectOption('#mediaFolder', 'banners');
await p.click('#mediaGrid .tile[title="banners/eid-offer.png"]');
await p.waitForSelector('#publicUrl');
await p.click('#copyUrl');
check('media: copy public URL', (await p.evaluate(() => navigator.clipboard.readText())) === `${base}/storage/v1/object/public/public-media/banners/eid-offer.png`);
check('media: unused file can be deleted', !(await p.isDisabled('#deleteMediaBtn')));
await p.setInputFiles('#replaceFile', { name: 'new.png', mimeType: 'image/png', buffer: png(80, 40, [250, 50, 50]) });
await clearToasts(p);
await p.click('#replaceBtn'); await p.click('body > .modal-wrap:last-of-type .btn-primary');
check('media replace: done', /Image replaced/.test(await toastText(p)));
const row2 = JSON.parse(stack.sql("select row_to_json(m)::text from media m where path='banners/eid-offer.png'"));
check('media replace: same path, new size/hash', row2.id === row.id && row2.width === 80 && row2.sha256 !== row.sha256);
await p.click('#mediaGrid .tile[title="banners/eid-offer.png"]');
await p.waitForSelector('#deleteMediaBtn');
if (shots) await p.screenshot({ path: `${shots}/media-details.png`, fullPage: true });
await clearToasts(p);
await p.click('#deleteMediaBtn'); await p.click('body > .modal-wrap:last-of-type .btn-danger');
check('media delete: done', /Image deleted/.test(await toastText(p)));
check('media delete: row and file gone', stack.sql("select count(*) from media where path='banners/eid-offer.png'") === '0' && (await fetch(`${base}/storage/v1/object/public/public-media/banners/eid-offer.png`)).status === 404);
await p.selectOption('#mediaFolder', 'flyers');
await p.click('#mediaGrid .tile[title="flyers/sdm-full.jpg"]');
await p.waitForSelector('#deleteMediaBtn');
check('media: image in use cannot be deleted', await p.isDisabled('#deleteMediaBtn') && /Course flyer/.test(await p.textContent('#usedBy')));
await p.click('.modal .btn:has-text("Close")');
// the deleted test mentor's photo is now unused → can be deleted
await p.selectOption('#mediaFolder', 'mentors');
await p.click('#mediaGrid .tile[title="mentors/test-mentor-photo.png"]');
await p.waitForSelector('#deleteMediaBtn');
await clearToasts(p);
await p.click('#deleteMediaBtn'); await p.click('body > .modal-wrap:last-of-type .btn-danger');
check('media delete: photo of deleted mentor removed', /Image deleted/.test(await toastText(p)));
const paths = stack.sql('select path from media order by path').split('\n');
let okUrls = 0;
for (const pth of paths) if ((await fetch(`${base}/storage/v1/object/public/public-media/${pth}`)).status === 200) okUrls++;
check('media: all 29 original image URLs still work', paths.length === 29 && okUrls === 29, `${okUrls}/${paths.length}`);
check('admin (owner session): no JavaScript or CSP errors', errors.length === 0, errors.join(' | '));
await ctx.close();

// ------------------------------------------------------------------ editor + mobile
{
  const { ctx: c2, p: m, errors: e2 } = await open('/admin', { mobile: true });
  await login(m, EDITOR);
  await m.waitForSelector('#stats');
  check('mobile: dashboard, no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (shots) await m.screenshot({ path: `${shots}/dashboard-mobile.png`, fullPage: true });
  check('mobile: sidebar hidden until menu tapped', await m.evaluate(() => getComputedStyle(document.querySelector('.side')).transform !== 'none'));
  await m.click('.menu-btn');
  await m.waitForTimeout(400);
  check('mobile: menu opens', await m.evaluate(() => document.querySelector('.side').classList.contains('open')));
  if (shots) await m.screenshot({ path: `${shots}/menu-mobile.png` });
  await m.click('.side a[data-view="courses"]');
  await m.waitForSelector('#courseList .row');
  check('mobile: menu closes after navigation', !(await m.evaluate(() => document.querySelector('.side').classList.contains('open'))));
  await m.click('#courseList .row >> nth=0');
  await m.waitForSelector('#courseForm');
  check('mobile: course form, no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check('mobile: Save button visible at the bottom', await m.isVisible('#saveBtn'));
  if (shots) await m.screenshot({ path: `${shots}/course-edit-mobile.png` });
  check('editor: no permanent-delete button', !(await m.$('#deleteBtn')));
  check('editor: can save a course', /Course saved/.test(await save(m)));
  await m.goto(base + '/admin/media');
  await m.waitForSelector('#mediaGrid .tile');
  check('mobile: media grid, no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (shots) await m.screenshot({ path: `${shots}/media-mobile.png` });
  await m.goto(base + '/admin/homepage/about');
  await m.waitForSelector('#sectionForm');
  check('mobile: homepage form, no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (shots) await m.screenshot({ path: `${shots}/homepage-mobile.png`, fullPage: true });
  check('mobile/editor: no JavaScript or CSP errors', e2.length === 0, e2.join(' | '));
  await c2.close();
}

// ------------------------------------------------------------------ public site still fine
{
  const res = await fetch(base + '/admin');
  check('headers: admin is no-store, noindex, frame-deny, CSP', res.headers.get('cache-control') === 'no-store' && /noindex/.test(res.headers.get('x-robots-tag')) && res.headers.get('x-frame-options') === 'DENY' && /script-src 'self'/.test(res.headers.get('content-security-policy')));
  const cfg = await (await fetch(base + '/api/admin-config')).json();
  check('admin-config: gives only URL + public key', Object.keys(cfg).join() === 'supabaseUrl,supabaseKey' && cfg.supabaseKey === stack.anonKey);
  const h = (await site('/')).html;
  check('public: homepage lists 22 courses after all tests', visibleCourses(h) === 22);
  let ok = 0;
  for (const slug of stack.sql('select slug from courses').split('\n')) if ((await site(`/courses/${slug}`)).status === 200) ok++;
  check('public: all 22 course pages work', ok === 22, String(ok));
}

await browser.close();
await stack.stop();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.info ? '' : '  — ' + r.info}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
