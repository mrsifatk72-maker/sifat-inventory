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
await p.evaluate(() => { const t = document.querySelector('#details_en'); t.focus(); t.setSelectionRange(0, 5); });
await p.locator('#details_en').locator('xpath=..').locator('button[title^="Bold"]').click();
check('format bar: B makes the selected words bold (**…**)', (await p.inputValue('#details_en')).startsWith('**First** paragraph.'));
const p2Max = Number(stack.sql("select max(c.sort_order) from courses c join phases p on p.id=c.phase_id where p.code=2"));
check('courses new: display order = end of its phase', Number(await p.inputValue('#sort_order')) === p2Max + 10, await p.inputValue('#sort_order'));
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
{
  const order = [...(await site('/')).html.matchAll(/class="course rv" data-f="(\d)"[^>]*href="\/courses\/([^"]+)"/g)].map((m) => [m[1], m[2]]);
  const idx = order.findIndex((o) => o[1] === 'admin-test-course');
  const phasesInOrder = order.map((o) => o[0]).join('');
  check('courses order: phase by phase on the website (new course is not first)', idx > 0 && /^1+2+3+4+$/.test(phasesInOrder) && order[idx][0] === '2' && order[idx + 1]?.[0] !== '2', `${idx} ${phasesInOrder}`);
  check('course page: bold in details rendered', (await site('/courses/admin-test-course')).html.includes('<b>First</b> paragraph.'));
  check('course page: bullet list rendered', /<ul><li>Point one<\/li><li>Point two<\/li><\/ul>/.test((await site('/courses/admin-test-course')).html));
}
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

// ------------------------------------------------------------------ image resizer
await p.goto(base + '/admin/media');
await p.waitForSelector('#mediaGrid .tile');
check('resizer: switch is ON by default', await p.isChecked('.resize-toggle'));
await p.selectOption('#uploadFolder', 'images');
await p.setInputFiles('#uploadFile', { name: 'Big Photo.png', mimeType: 'image/png', buffer: png(3000, 2000, [30, 140, 220]) });
await clearToasts(p);
await p.click('#uploadBtn');
const bigToast = await toastText(p);
check('resizer: big image made smaller (toast shows before → after)', /Uploaded images\/big-photo\.webp \(.+ → .+\)/.test(bigToast), bigToast);
const big = JSON.parse(stack.sql("select row_to_json(m)::text from media m where path='images/big-photo.webp'") || '{}');
check('resizer: stored as WebP, 1600px wide', big.mime === 'image/webp' && big.width === 1600 && big.height === 1067, JSON.stringify(big));
await p.uncheck('.resize-toggle');
await p.reload();
await p.waitForSelector('#mediaGrid .tile');
check('resizer: OFF setting is remembered', !(await p.isChecked('.resize-toggle')));
await p.selectOption('#uploadFolder', 'images');
await p.setInputFiles('#uploadFile', { name: 'Original.png', mimeType: 'image/png', buffer: png(1800, 900, [220, 40, 90]) });
await clearToasts(p);
await p.click('#uploadBtn');
await toastText(p);
const orig = JSON.parse(stack.sql("select row_to_json(m)::text from media m where path='images/original.png'") || '{}');
check('resizer: OFF keeps the original file', orig.mime === 'image/png' && orig.width === 1800);
await p.check('.resize-toggle');
stack.sql("delete from media where path in ('images/big-photo.webp','images/original.png')");

// ------------------------------------------------------------------ settings
await p.goto(base + '/admin/settings');
await p.waitForSelector('#settingsForm');
check('settings: page loads with WhatsApp number', (await p.inputValue('#whatsapp_number')) === '+8801726415926');
await p.fill('#whatsapp_number', 'abc');
await p.click('#saveBtn');
await p.waitForSelector('.form-error:not(.hidden)');
check('settings: invalid WhatsApp number rejected', /country code/.test(await p.textContent('.form-error')));
await p.fill('#whatsapp_number', '+8801700000000');
await p.click('.tab[data-tab="seo"]');
await p.fill('#seo_title_en', 'MediVerse Dental — Admin SEO Test');
await p.click('.tab[data-tab="contact"]');
await p.click('button:has-text("+ Add social / contact link")');
const last = p.locator('#settingsForm .rep-item').last();
await last.locator('select[aria-label="Platform"]').selectOption('instagram');
await last.locator('input[aria-label="Link"]').fill('https://instagram.com/mediversedental');
await last.locator('input[aria-label="Name (English)"]').fill('Instagram');
await clearToasts(p);
await p.click('#saveBtn');
check('settings: saved', /Settings saved/.test(await toastText(p)));
await p.waitForTimeout(1200); // page reloads after new links
await p.waitForSelector('#settingsForm');
let homeHtml = (await site('/')).html;
check('settings: WhatsApp links use the new number', homeHtml.includes('wa.me/8801700000000') && !homeHtml.includes('wa.me/8801726415926'));
check('settings: course page WhatsApp uses the new number', (await site('/courses/decode-the-opg')).html.includes('wa.me/8801700000000'));
check('settings: new Instagram link + icon on website', homeHtml.includes('href="https://instagram.com/mediversedental"') && homeHtml.includes('#E1306C'));
check('settings: SEO title on website', homeHtml.includes('<title>MediVerse Dental — Admin SEO Test</title>'));
check('settings: social links stored without duplicates', stack.sql("select count(*) from social_links") === '5');
// logo change
await p.click('.tab[data-tab="look"]');
await p.locator('#settingsForm fieldset:has(legend:text("Logos")) button:has-text("Change image")').first().click();
await p.waitForSelector('.modal .tile');
await p.click('.modal .tile[title="logos/logo-blue.png"]');
await p.click('.tab[data-tab="contact"]');
await p.fill('#whatsapp_number', '+8801726415926');
await p.click('.tab[data-tab="seo"]');
await p.fill('#seo_title_en', 'MediVerse Dental — Future Dentistry Begins Here');
await p.click('.tab[data-tab="contact"]');
await p.locator('#settingsForm .rep-item').last().locator('button:has-text("Remove")').click();
await clearToasts(p);
await p.click('#saveBtn');
await toastText(p);
await p.waitForTimeout(1200);
homeHtml = (await site('/')).html;
check('settings: dark-theme logo changed', /class="l-dark" src="[^"]*logos\/logo-blue\.png"/.test(homeHtml));
check('settings: removed link gone, number + title restored', !homeHtml.includes('instagram.com') && homeHtml.includes('wa.me/8801726415926') && homeHtml.includes('<title>MediVerse Dental — Future Dentistry Begins Here</title>'));
stack.sql("update site_settings set logo_dark_media_id = (select id from media where path='logos/logo-white.png')");

// ------------------------------------------------------------------ theme, fonts, analytics
await p.goto(base + '/admin/settings');
await p.waitForSelector('#settingsForm');
await p.click('.tab[data-tab="look"]');
check('settings: tabs (only the chosen tab is shown)', await p.isVisible('#preset') && !(await p.isVisible('#whatsapp_number')));
await p.selectOption('#preset', 'sunset');
await p.selectOption('#font_en', 'Poppins');
await p.selectOption('#font_bn', 'Noto Sans Bengali');
await p.selectOption('#theme_default', 'light');
await p.click('.tab[data-tab="analytics"]');
await p.fill('#ga4_measurement_id', '<script>alert(1)</script>');
await p.click('#saveBtn');
await p.waitForSelector('.form-error:not(.hidden)');
check('analytics: pasting code instead of an ID is rejected', /G-XXXXXXXXXX/.test(await p.textContent('.form-error')));
await p.fill('#ga4_measurement_id', 'g-test12345');
await p.fill('#gtm_container_id', 'GTM-N4JDQJNM');
await clearToasts(p);
await p.click('#saveBtn');
check('theme: saved', /Settings saved/.test(await toastText(p)));
homeHtml = (await site('/')).html;
check('theme: website opens in light theme for new visitors', homeHtml.includes('<html lang="en" data-theme="light">'));
check('theme: new colours on website', homeHtml.includes('--cyan:#FBBF24') && homeHtml.includes('--violet:#EC4899'));
check('theme: fonts on website', homeHtml.includes('family=Poppins') && homeHtml.includes('family=Noto+Sans+Bengali') && homeHtml.includes("body{font-family:'Poppins'"));
check('analytics: GA4 + GTM official tags added with the IDs', homeHtml.includes('gtag/js?id=G-TEST12345') && homeHtml.includes("'dataLayer','GTM-N4JDQJNM'") && homeHtml.includes('ns.html?id=GTM-N4JDQJNM'));
check('theme: course pages use it too', (await site('/courses/decode-the-opg')).html.includes('--cyan:#FBBF24'));
{
  const pp = await ctx.newPage();
  await pp.goto(base + '/');
  check('theme: light theme + colour actually applied in the browser', await pp.evaluate(() => document.documentElement.dataset.theme === 'light' && getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim().toUpperCase() === '#FBBF24'));
  if (shots) await pp.screenshot({ path: `${shots}/theme-sunset-light.png` });
  await pp.close();
}
await p.reload();
await p.waitForSelector('#settingsForm');
await p.click('.tab[data-tab="look"]');
await p.selectOption('#preset', 'default');
await p.selectOption('#font_en', 'Plus Jakarta Sans');
await p.selectOption('#font_bn', 'Hind Siliguri');
await p.selectOption('#theme_default', 'dark');
await p.click('.tab[data-tab="analytics"]');
await p.fill('#ga4_measurement_id', '');
await p.fill('#gtm_container_id', '');
await clearToasts(p);
await p.click('#saveBtn');
await toastText(p);
homeHtml = (await site('/')).html;
check('theme: back to original = no extra styles or tags', !homeHtml.includes('site-theme') && !homeHtml.includes('googletagmanager') && homeHtml.includes('data-theme="dark"'));
check('theme: stored as empty (original design)', stack.sql("select coalesce(color_cyan,'')||coalesce(font_en,'')||coalesce(ga4_measurement_id,'')||theme_default from site_settings") === 'dark');
if (shots) { await p.click('.tab[data-tab="look"]'); await p.screenshot({ path: `${shots}/settings-theme.png`, fullPage: true }); }

// ------------------------------------------------------------------ homepage lists
await p.goto(base + '/admin/homepage/hero');
await p.waitForSelector('#sectionForm');
check('hero: 4 numbers editable', (await p.$$('fieldset[data-table="stats"] .rep-item')).length === 4);
await p.locator('fieldset[data-table="stats"] input[aria-label="Number"]').first().fill('5000');
await p.click('fieldset[data-table="stats"] button:has-text("+ Add number")');
const ns = p.locator('fieldset[data-table="stats"] .rep-item').last();
await ns.locator('input[aria-label="Number"]').fill('30');
await ns.locator('input[aria-label="After the number (e.g. +)"]').fill('+');
await ns.locator('input[aria-label="Label (English)"]').fill('Live batches');
await clearToasts(p);
await p.click('#saveBtn');
check('hero: numbers saved', /Section saved/.test(await toastText(p)));
homeHtml = (await site('/')).html;
check('hero: changed number + new number on website', homeHtml.includes('data-count="5000"') && homeHtml.includes('Live batches'));
await p.waitForSelector('fieldset[data-table="stats"] .rep-item');
await p.locator('fieldset[data-table="stats"] .rep-item').last().locator('button:has-text("Remove")').click();
await p.locator('fieldset[data-table="stats"] input[aria-label="Number"]').first().fill('4700');
await clearToasts(p);
await p.click('#saveBtn');
await toastText(p);
homeHtml = (await site('/')).html;
check('hero: number removed and restored', !homeHtml.includes('Live batches') && homeHtml.includes('data-count="4700"') && stack.sql('select count(*) from stats') === '4');

await p.goto(base + '/admin/homepage/faq');
await p.waitForSelector('fieldset[data-table="faqs"] .rep-item');
check('faq: 5 questions editable', (await p.$$('fieldset[data-table="faqs"] .rep-item')).length === 5);
await p.click('button:has-text("+ Add question")');
const nq = p.locator('fieldset[data-table="faqs"] .rep-item').last();
await nq.locator('input[aria-label="Question (English)"]').fill('Is there a refund policy?');
await clearToasts(p);
await p.click('#saveBtn');
await p.waitForSelector('.toast');
check('faq: answer is required', /cannot be empty/.test(await toastText(p)));
await nq.locator('textarea[aria-label="Answer (English)"]').fill('Yes, within **7 days**.');
await clearToasts(p);
await p.click('#saveBtn');
await toastText(p);
homeHtml = (await site('/')).html;
check('faq: new question with bold answer on website', homeHtml.includes('Is there a refund policy?') && homeHtml.includes('<b>7 days</b>'));
await p.waitForSelector('fieldset[data-table="faqs"] .rep-item');
await p.locator('fieldset[data-table="faqs"] .rep-item').last().locator('button:has-text("Remove")').click();
await clearToasts(p);
await p.click('#saveBtn');
await toastText(p);
check('faq: question removed', !(await site('/')).html.includes('refund policy') && stack.sql('select count(*) from faqs') === '5');

await p.goto(base + '/admin/homepage/about');
await p.waitForSelector('fieldset[data-table="phases"] .rep-item');
check('about: 3 feature cards + 4 phases editable (phases cannot be removed)', (await p.$$('fieldset[data-table="features"] .rep-item')).length === 3 && (await p.$$('fieldset[data-table="phases"] .rep-item')).length === 4 && !(await p.$('fieldset[data-table="phases"] button:has-text("Remove")')));
await p.goto(base + '/admin/homepage/stories');
await p.waitForSelector('fieldset[data-table="testimonials"] .rep-item');
check('stories: 3 testimonials editable', (await p.$$('fieldset[data-table="testimonials"] .rep-item')).length === 3);
if (shots) await p.screenshot({ path: `${shots}/stories.png`, fullPage: true });

if (shots) await p.screenshot({ path: `${shots}/settings.png`, fullPage: true });

// ------------------------------------------------------------------ reviews
{
  const opg = stack.sql("select id from courses where slug='decode-the-opg'");
  await p.goto(base + '/admin/reviews');
  await p.waitForSelector('#reviewList');
  check('reviews: page opens (empty at first)', /No reviews yet/.test(await p.textContent('#reviewList')));
  await p.click('a:has-text("+ Add review")');
  await p.waitForSelector('#reviewForm');
  check('reviews: every course is in the course list', (await p.$$eval('#course_id option', (o) => o.length)) === 23);
  await p.fill('#review_en', 'Something');
  await p.click('#saveBtn');
  await p.waitForSelector('.form-error:not(.hidden)');
  check('reviews: course is required', /Choose the course/.test(await p.textContent('.form-error')));
  await p.selectOption('#course_id', opg);
  await p.selectOption('#rating', '4');
  await p.fill('#review_en', 'Very clear OPG classes. Highly recommended.');
  await p.evaluate(() => { const t = document.querySelector('#review_en'); t.focus(); t.setSelectionRange(24, 30); });
  await p.locator('#review_en').locator('xpath=..').locator('button[title^="Bold"]').click();
  check('reviews: name and college can be left empty', (await p.inputValue('#reviewer_name')) === '');
  await clearToasts(p);
  await p.click('#saveBtn');
  check('reviews: added', /Review added/.test(await toastText(p)));
  await p.waitForURL(/\/admin\/reviews\/[0-9a-f-]{36}$/);
  const firstId = p.url().split('/').pop();

  await p.goto(base + `/admin/reviews/new?course=${opg}`);
  await p.waitForSelector('#reviewForm');
  check('reviews: course pre-selected from course page link', (await p.inputValue('#course_id')) === opg);
  await p.fill('#reviewer_name', 'Rafi Ahmed');
  await p.fill('#reviewer_info_en', 'Dhaka Dental College');
  await p.fill('#reviewer_session', '2019-20');
  await p.fill('#review_bn', 'খুব সুন্দর করে বোঝানো হয়েছে।');
  await clearToasts(p);
  await p.click('#saveBtn');
  await toastText(p);
  let opgPage = (await site('/courses/decode-the-opg')).html;
  check('reviews: shown on the course page with average', opgPage.includes('id="reviews"') && opgPage.includes('4.5 / 5 · 2 reviews'));
  check('reviews: bold, name, college, "Student" fallback, Bangla text', opgPage.includes('<b>Highly</b>') && opgPage.includes('Rafi Ahmed') && opgPage.includes('Dhaka Dental College · Session 2019-20') && opgPage.includes('সেশন ২০১৯-২০') && opgPage.includes('>Student<') && opgPage.includes('খুব সুন্দর করে বোঝানো হয়েছে।'));
  check('reviews: star labels (Good / Very good)', opgPage.includes('>Good<') && opgPage.includes('>Very good<'));
  check('reviews: other courses unaffected', !(await site('/courses/sdm-full-course')).html.includes('id="reviews"'));
  {
    const pp = await ctx.newPage();
    await pp.goto(base + '/courses/decode-the-opg');
    if (await pp.evaluate(() => document.documentElement.lang) !== 'bn') await pp.click('#langBtn');
    check('reviews: Bangla switch shows Bangla summary', (await pp.textContent('#reviews h2')).includes('৪.৫ / ৫ · ২টি রিভিউ'));
    if (shots) { await pp.evaluate(() => document.querySelector('#reviews').scrollIntoView()); await pp.addStyleTag({ content: '.rv{opacity:1!important;transform:none!important}' }); await pp.screenshot({ path: `${shots}/course-reviews.png` }); }
    await pp.close();
  }
  // hide, list, filter
  await p.goto(base + `/admin/reviews/${firstId}`);
  await p.waitForSelector('#reviewForm');
  await p.uncheck('#is_visible');
  await clearToasts(p);
  await p.click('#saveBtn');
  await toastText(p);
  opgPage = (await site('/courses/decode-the-opg')).html;
  check('reviews: hidden review not on website', !opgPage.includes('<b>Highly</b>') && opgPage.includes('5.0 / 5 · 1 review'));
  await p.goto(base + `/admin/reviews?course=${opg}`);
  await p.waitForSelector('#reviewList .row');
  check('reviews: list filtered by course shows both', (await p.$$('#reviewList .row')).length === 2 && /average 4.5/.test(await p.textContent('.muted.small')));
  // future courses appear automatically
  stack.sql(`insert into courses (slug, title_en, phase_id, status) select 'future-course-x', 'Future Course X', id, 'active' from phases where code=4`);
  await p.goto(base + '/admin/reviews/new');
  await p.waitForSelector('#reviewForm');
  check('reviews: newly added courses appear in the list', (await p.$$eval('#course_id option', (o) => o.map((x) => x.textContent))).some((t) => t.startsWith('Future Course X')));
  stack.sql("delete from courses where slug='future-course-x'");
  // course page shortcut
  await p.goto(base + `/admin/courses/${opg}`);
  await p.waitForSelector('#courseReviews');
  check('reviews: course edit page shows count + Manage reviews', /2 reviews for this course/.test(await p.textContent('#courseReviews')));
  // delete
  await p.goto(base + `/admin/reviews/${firstId}`);
  await p.waitForSelector('#deleteBtn');
  await p.click('#deleteBtn'); await p.click('.modal .btn-danger');
  await p.waitForURL((u) => u.pathname === '/admin/reviews');
  check('reviews: deleted', stack.sql(`select count(*) from course_reviews where id='${firstId}'`) === '0');
  if (shots) { await p.waitForSelector('#reviewList'); await p.screenshot({ path: `${shots}/reviews-list.png` }); }
  // a logged-in non-admin cannot add a review through the API
  const visitorTok = stack.login(VISITOR.email).access_token;
  const spam = await api('/rest/v1/course_reviews', { token: visitorTok, method: 'POST', body: { course_id: opg, rating: 1, review_en: 'spam' } });
  check('authz non-admin: cannot add reviews', spam.status === 403, String(spam.status));
  stack.sql('delete from course_reviews');
}

// ------------------------------------------------------------------ mentor order (↑ ↓)
{
  const mentorOrder = async () => [...(await site('/')).html.matchAll(/<article class="mentor[^"]*"[\s\S]*?<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
  const before = await mentorOrder();
  await p.goto(base + '/admin/mentors');
  await p.waitForSelector('#mentorList .order-btns');
  check('mentors: ↑ ↓ buttons shown (first ↑ and last ↓ disabled)', await p.isDisabled('#mentorList .row-wrap >> nth=0 >> button[aria-label^="Move"][aria-label$="up"]') && await p.isDisabled('#mentorList .row-wrap >> nth=-1 >> button[aria-label$="down"]'));
  await clearToasts(p);
  await p.click(`button[aria-label="Move ${before[0]} down"]`);
  check('mentors: moved', /moved down/.test(await toastText(p)));
  const after = await mentorOrder();
  check('mentors: new order on the website', after[0] === before[1] && after[1] === before[0], `${before.slice(0, 2)} → ${after.slice(0, 2)}`);
  check('mentors: new order in the admin list', (await p.textContent('#mentorList .row-wrap >> nth=0 >> b')) === before[1]);
  await clearToasts(p);
  await p.click(`button[aria-label="Move ${before[0]} up"]`);
  await toastText(p);
  check('mentors: moved back', JSON.stringify(await mentorOrder()) === JSON.stringify(before));
  await p.fill('#mentorSearch', 'sifat');
  check('mentors: ↑ ↓ hidden while searching', !(await p.$('#mentorList .order-btns')));
}

// ------------------------------------------------------------------ undergraduate / postgraduate
{
  await p.goto(base + '/admin/courses/new');
  await p.waitForSelector('#courseForm');
  check('level: Level field on the course form', await p.isVisible('#level'));
  await p.fill('#title_en', 'FCPS Part-1 Prep');
  await p.selectOption('#phase_id', '');
  await p.click('#saveBtn');
  await p.waitForSelector('.form-error:not(.hidden)');
  check('level: undergraduate course must have a phase', /Choose a phase/.test(await p.textContent('.form-error')));
  await p.selectOption('#level', 'postgraduate');
  await p.selectOption('#phase_id', '');
  await p.selectOption('#status', 'active');
  await p.fill('#external_url', 'https://mediversebd.com/courses/fcps-part-1');
  await clearToasts(p);
  await p.click('#saveBtn');
  check('level: postgraduate course without phase saved', /Course created/.test(await toastText(p)));
  await p.waitForURL(/\/admin\/courses\/[0-9a-f-]{36}$/);
  let home = (await site('/')).html;
  check('level: tabs shown by default, PG course has "Postgraduate" badge', home.includes('data-lvl="pg"') && /data-f="pg" data-l="pg"[^>]*href="\/courses\/fcps-part-1-prep"[\s\S]*?<span class="badge"[^>]*>Postgraduate<\/span>/.test(home));
  check('level: PG course page works', (await site('/courses/fcps-part-1-prep')).status === 200 && (await site('/courses/fcps-part-1-prep')).html.includes('<i></i>Postgraduate</span>'));
  await p.goto(base + '/admin/homepage/courses');
  await p.waitForSelector('#show_level_switch');
  check('level: switch is ON by default', await p.isChecked('#show_level_switch'));
  await p.uncheck('#show_level_switch');
  await clearToasts(p);
  await p.click('#saveBtn');
  await toastText(p);
  check('level: switch OFF → no tabs, all courses together', !(await site('/')).html.includes('data-lvl=') && visibleCourses((await site('/')).html) === 23);
  await p.check('#show_level_switch');
  await clearToasts(p);
  await p.click('#saveBtn');
  await toastText(p);
  home = (await site('/')).html;
  check('level: switch ON again → Undergraduate / Postgraduate tabs on website', home.includes('data-lvl="ug"') && home.includes('data-lvl="pg"') && home.includes('data-l="pg"'));
  {
    const pp = await ctx.newPage();
    await pp.goto(base + '/');
    if (await pp.evaluate(() => document.documentElement.lang) === 'bn') await pp.click('#langBtn');
    const vis = () => pp.evaluate(() => [...document.querySelectorAll('.course')].filter((c) => getComputedStyle(c).display !== 'none').length);
    check('level: Undergraduate tab shows the 22 BDS courses', await vis() === 22, String(await vis()));
    await pp.click('[data-lvl="pg"]');
    check('level: Postgraduate tab shows only PG course, phase chips hidden', await vis() === 1 && await pp.evaluate(() => getComputedStyle(document.querySelector('.c-tools .chips:not(.lvl-tabs)')).display === 'none'));
    await pp.addStyleTag({ content: '.rv{opacity:1!important;transform:none!important}' });
    if (shots) { await pp.evaluate(() => document.querySelector('#courses').scrollIntoView()); await pp.screenshot({ path: `${shots}/level-pg.png` }); }
    await pp.click('[data-lvl="ug"]');
    await pp.click('.chip[data-f="3"]');
    check('level: phase filter still works inside Undergraduate', await vis() === 4);
    await pp.click('.chip[data-f="all"]');
    await pp.fill('#cSearch', 'opg');
    check('level: search still works', await vis() === 1);
    await pp.close();
  }
  stack.sql("delete from courses where slug='fcps-part-1-prep'");
  {
    const pp = await ctx.newPage();
    await pp.goto(base + '/');
    await pp.click('[data-lvl="pg"]');
    check('level: no PG courses → "coming soon" message', await pp.isVisible('#pgSoon'));
    await pp.close();
  }
}
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
