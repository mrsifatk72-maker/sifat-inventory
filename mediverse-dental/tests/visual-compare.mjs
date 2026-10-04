// Compares the CURRENT live page (index.html) with the NEW database-rendered page:
//   1. all visible text, English and Bangla
//   2. full-page screenshots, pixel by pixel (desktop + mobile, dark + light)
// Requires Playwright + Chromium (available in the dev environment).
//   node tests/visual-compare.mjs [outDir]
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './dev-server.mjs';

// Use a local Playwright if installed, otherwise the global one.
let pw;
try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium } = pw;

const OLD = new URL('../index.html', import.meta.url).href;
const outDir = process.argv[2] || fileURLToPath(new URL('../.visual', import.meta.url));
mkdirSync(outDir, { recursive: true });

// The original page has no Undergraduate/Postgraduate switch, so compare with it turned off.
const { server, base } = await startServer(0, {
  mutate: (d) => { const c = d.page_sections.find((x) => x.key === 'courses'); c.content = { ...c.content, show_level_switch: false }; },
});
const browser = await chromium.launch();
const results = [];

async function open(url, { width, height, mobile, theme, lang }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, locale: 'en-US' });
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem('mvd-theme', t); localStorage.setItem('mvd-lang', l); } catch (e) {} }, [theme, lang]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  process.stderr.write(`· ${url.slice(0, 30)} ${width}px ${theme} ${lang}\n`);
  await page.goto(url, { waitUntil: 'load' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.rv{opacity:1!important;transform:none!important}.bg-fx{display:none!important}' });
  // Trigger lazy images and count-up numbers, then wait for them to settle.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(2200);
  // Load every image now (lazy images off-screen would never finish) and wait until all are decoded.
  await page.evaluate(() => document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.waitForTimeout(300);
  return { ctx, page };
}

const visibleText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());

// ---- 1. text, EN + BN -----------------------------------------------------
for (const lang of ['en', 'bn']) {
  const a = await open(OLD, { width: 1366, height: 900, theme: 'dark', lang });
  const b = await open(base + '/', { width: 1366, height: 900, theme: 'dark', lang });
  const [ta, tb] = [await visibleText(a.page), await visibleText(b.page)];
  let diffAt = -1;
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) if (ta[i] !== tb[i]) { diffAt = i; break; }
  results.push({ check: `text ${lang.toUpperCase()}`, same: diffAt === -1, chars: ta.length,
    ...(diffAt >= 0 ? { old: ta.slice(diffAt - 40, diffAt + 60), new: tb.slice(diffAt - 40, diffAt + 60) } : {}) });
  await a.ctx.close(); await b.ctx.close();
}

// ---- 2. pixels ------------------------------------------------------------
const cmp = await browser.newPage();
async function pixelDiff(pngA, pngB) {
  return cmp.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], ratio: 1 };
    const c = (img) => { const k = document.createElement('canvas'); k.width = img.width; k.height = img.height; const x = k.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
    const da = c(ia), db = c(ib); let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 30) n++;
    return { size: [ia.width, ia.height], differentPixels: n, ratio: n / (da.length / 4) };
  }, [pngA.toString('base64'), pngB.toString('base64')]);
}

for (const [name, vp] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844, mobile: true }]]) {
  for (const theme of ['dark', 'light']) {
    const a = await open(OLD, { ...vp, theme, lang: 'en' });
    const b = await open(base + '/', { ...vp, theme, lang: 'en' });
    const [pa, pb] = [await a.page.screenshot({ fullPage: true }), await b.page.screenshot({ fullPage: true })];
    writeFileSync(`${outDir}/${name}-${theme}-old.png`, pa);
    writeFileSync(`${outDir}/${name}-${theme}-new.png`, pb);
    const d = await pixelDiff(pa, pb);
    results.push({ check: `pixels ${name} ${theme}`, same: d.ratio < 0.001, ...d });
    await a.ctx.close(); await b.ctx.close();
  }
}

await browser.close();
server.close();
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.every((r) => r.same) ? 0 : 1;
