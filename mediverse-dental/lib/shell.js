// The page "shell": <head> styles and the <script> are taken from src/template.html,
// the same file the current live site is built from, so the design and behaviour
// (theme toggle, EN/BN switch, menu, filters, animations) stay exactly the same.
import { readFileSync } from 'node:fs';
import { esc } from './markup.js';

const TEMPLATE = readFileSync(new URL('../src/template.html', import.meta.url), 'utf8');

function between(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`template.html: cannot find ${start} … ${end}`);
  return src.slice(a, b + end.length);
}

// <style>…</style> block, byte-for-byte from the template.
export const STYLE = between(TEMPLATE, '<style>', '</style>');

// Font links, byte-for-byte from the template.
export const FONT_LINKS = between(TEMPLATE, '<link rel="preconnect" href="https://fonts.googleapis.com">', 'display=swap" rel="stylesheet">');

// Page script from the template, with three small null-guards so the same script
// also runs on course pages (which have no course search box and use "/#section" links).
// On the homepage the behaviour is identical.
const RAW_SCRIPT = between(TEMPLATE, '<script>', '</script>');
const SCRIPT_PATCHES = [
  ["var secs=links.map(function(a){return document.querySelector(a.getAttribute('href'));});",
   "var secs=links.map(function(a){var h=a.getAttribute('href');return /^#[A-Za-z][\\w-]*$/.test(h)?document.querySelector(h):null;});"],
  ['var EN_TITLE=document.title,EN_PH=search.placeholder,',
   "var EN_TITLE=document.title,EN_PH=search?search.placeholder:'',"],
  ['document.title=l===\'bn\'?BN._title:EN_TITLE;search.placeholder=l===\'bn\'?BN._search:EN_PH;',
   "document.title=l==='bn'?BN._title:EN_TITLE;if(search)search.placeholder=l==='bn'?BN._search:EN_PH;"],
  ["q.addEventListener('input',apply);", "if(q)q.addEventListener('input',apply);"],
];
let script = RAW_SCRIPT;
for (const [from, to] of SCRIPT_PATCHES) {
  if (script.split(from).length !== 2) throw new Error(`template.html script changed; cannot patch: ${from}`);
  script = script.replace(from, to);
}
if (!script.includes('{{BN_JSON}}')) throw new Error('template.html script: {{BN_JSON}} placeholder missing');
export const SCRIPT = script;

export function documentHtml({ lang = 'en', meta, extraStyle = '', body, bn }) {
  const json = JSON.stringify(bn).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="${esc(lang)}" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${meta}
${FONT_LINKS}
${STYLE}
${extraStyle}
</head>
<body>
${body}
${SCRIPT.replace('{{BN_JSON}}', () => json)}
</body>
</html>
`;
}
