// Real-browser checks of the interactive features on the database-rendered site.
//   node tests/browser-check.mjs [screenshotDir]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { startServer } from './dev-server.mjs';

let pw;
try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const { server, base } = await startServer(0);
const browser = await pw.chromium.launch();
const results = [];
const check = (name, ok, info = '') => results.push({ name, ok: !!ok, info });

async function page(path, { mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + path, { waitUntil: 'load' });
  await p.addStyleTag({ content: '.rv{opacity:1!important;transform:none!important}' });
  return { ctx, p, errors };
}

// ---------------------------------------------------------------- homepage
{
  const { ctx, p, errors } = await page('/');
  check('homepage: no JavaScript errors', errors.length === 0, errors.join(' | '));

  await p.click('#themeBtn');
  check('theme toggle → light', await p.evaluate(() => document.documentElement.dataset.theme) === 'light');
  await p.click('#themeBtn');
  check('theme toggle → dark', await p.evaluate(() => document.documentElement.dataset.theme) === 'dark');

  const h1en = await p.textContent('h1');
  await p.click('#langBtn');
  const h1bn = await p.textContent('h1');
  check('language switch → Bangla', /[ঀ-৿]/.test(h1bn) && await p.evaluate(() => document.documentElement.lang) === 'bn', h1bn);
  check('Bangla course descriptions', /[ঀ-৿]/.test(await p.textContent('.course .c-body p')));
  check('Bangla search placeholder', /[ঀ-৿]/.test(await p.getAttribute('#cSearch', 'placeholder')));
  await p.click('#langBtn');
  check('language switch → English', (await p.textContent('h1')) === h1en);

  const visible = () => p.evaluate(() => [...document.querySelectorAll('.course')].filter((c) => getComputedStyle(c).display !== 'none').length);
  check('course listing shows 22', await visible() === 22);
  check('Undergraduate / Postgraduate tabs shown (Undergraduate selected)', await p.isVisible('[data-lvl="ug"].active') && await p.isVisible('[data-lvl="pg"]'));
  await p.click('[data-lvl="pg"]');
  check('Postgraduate tab: no PG courses yet → "coming soon"', await visible() === 0 && await p.isVisible('#pgSoon'));
  await p.click('[data-lvl="ug"]');
  check('back to Undergraduate: 22 courses', await visible() === 22);
  await p.click('.chip[data-f="3"]');
  check('phase filter (3rd Phase) shows 4', await visible() === 4, String(await visible()));
  await p.click('.chip[data-f="all"]');
  await p.fill('#cSearch', 'opg');
  check('search "opg" finds Decode the OPG', await visible() === 1 && (await p.textContent('.course:not(.hide) h3')) === 'Decode the OPG');
  await p.fill('#cSearch', '');

  await p.click('.course[href="/courses/decode-the-opg"]');
  await p.waitForURL('**/courses/decode-the-opg');
  check('course card opens /courses/:slug', p.url().endsWith('/courses/decode-the-opg'));
  await ctx.close();
}

// ------------------------------------------------------------- course page
{
  const { ctx, p, errors } = await page('/courses/essential-medicine-for-bds');
  check('course page: no JavaScript errors', errors.length === 0, errors.join(' | '));
  check('course page: title', (await p.textContent('h1')).includes('Essential Medicine for BDS'));
  check('course page: flyer image loaded', await p.evaluate(() => { const i = document.querySelector('.cp-flyer img'); return i && i.complete && i.naturalWidth > 0; }));
  const cta = await p.$('.cp-info .btn-primary');
  check('course page: Enroll → Mediverse platform', (await cta.getAttribute('href')) === 'https://mediversebd.com/courses/essential-medicine-for-bds' && (await cta.getAttribute('target')) === '_blank');
  check('course page: mentor shown', (await p.textContent('#mentors .mentor h3')) === 'Dr. M R Sifat');
  const waEn = await p.getAttribute('.cp-info .btn-ghost', 'href');
  check('course page: WhatsApp message names the course (EN)', decodeURIComponent(waEn).includes('your Essential Medicine for BDS Course.'), waEn);
  await p.click('#langBtn');
  const waBn = await p.getAttribute('.cp-info .btn-ghost', 'href');
  check('course page: WhatsApp message switches to Bangla', decodeURIComponent(waBn).includes('আমি আপনাদের Essential Medicine for BDS কোর্স সম্পর্কে'), waBn);
  check('course page: floating WhatsApp button switches too', decodeURIComponent(await p.getAttribute('.wa-float', 'href')).includes('আপনাদের Essential Medicine'));
  check('course page: Bangla', /[ঀ-৿]/.test(await p.textContent('.cp-info .lead')) && /[ঀ-৿]/.test(await p.textContent('.cp-info .btn-primary')));
  if (shots) await p.screenshot({ path: `${shots}/course-desktop-bn.png`, fullPage: true });
  await p.click('#langBtn');
  check('course page: WhatsApp back to English', (await p.getAttribute('.cp-info .btn-ghost', 'href')) === waEn);
  if (shots) await p.screenshot({ path: `${shots}/course-desktop-en.png`, fullPage: true });
  await p.click('#themeBtn');
  check('course page: theme toggle', await p.evaluate(() => document.documentElement.dataset.theme) === 'light');
  if (shots) await p.screenshot({ path: `${shots}/course-desktop-light.png`, fullPage: true });
  await p.click('.cp-back');
  await p.waitForURL((u) => u.pathname === '/');
  check('course page: "All courses" goes back to homepage', new URL(p.url()).pathname === '/');
  await ctx.close();
}

// ------------------------------------------------------------------ mobile
for (const path of ['/', '/courses/sdm-full-course', '/courses/pedodontics-made-easy']) {
  const { ctx, p, errors } = await page(path, { mobile: true });
  check(`mobile ${path}: no JavaScript errors`, errors.length === 0, errors.join(' | '));
  check(`mobile ${path}: no sideways scrolling`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    String(await p.evaluate(() => document.documentElement.scrollWidth)));
  await p.click('#burger');
  await p.waitForTimeout(700);
  check(`mobile ${path}: menu opens`, await p.evaluate(() => document.getElementById('mnav').classList.contains('open')));
  await p.click('#burger');
  if (path === '/') {
    await p.evaluate(() => document.querySelector('#mentors').scrollIntoView());
    const more = await p.$('.mentor .more');
    await more.click();
    check('mobile: mentor info (i) button shows credentials', await p.evaluate(() => document.querySelector('.mentor').classList.contains('show')));
  }
  if (shots) await p.screenshot({ path: `${shots}/mobile${path.replace(/\//g, '_') || '_home'}.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
server.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.info ? '' : '  — ' + r.info}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
