// Builds the homepage and course pages from database content.
// Markup mirrors src/template.html + src/build.py exactly (same classes, same
// structure) so the page looks identical to the current live site.
import { esc, inline, blocks, safeUrl, articleHtml } from './markup.js';
import { SOCIAL_SVG, ARROW, HIJAB_SVG } from './icons.js';
import { documentHtml } from './shell.js';

const ARROW_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ARROW_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>';
const TOOTH_PATH = 'M100 30c-14-12-40-18-58-8-22 12-26 42-18 70 6 22 10 34 14 60 4 30 10 52 24 52 12 0 14-22 18-44 3-16 8-24 20-24s17 8 20 24c4 22 6 44 18 44 14 0 20-22 24-52 4-26 8-38 14-60 8-28 4-58-18-70-18-10-44-4-58 8z';
const FEATURE_ICONS = {
  video: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M10 9l5 2.5-5 2.5z"/><path d="M8 21h8"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
};
const WA_FLOAT_SVG = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.05 1.02-1.05 2.5 1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>';

// Fixed interface words on the new course pages (not admin-editable content).
const UI = {
  allCourses: ['All courses', 'সব কোর্স'],
  askWhatsApp: ['Ask on WhatsApp', 'হোয়াটসঅ্যাপে জিজ্ঞেস করো'],
  enroll: ['Enroll on Mediverse', 'মেডিভার্সে এনরোল করো'],
  details: ['Course details', 'কোর্সের বিস্তারিত'],
  whatYouGet: ['What you get', 'কোর্সে যা যা পাবে'],
  mentorKicker: ['Mentors', 'মেন্টর'],
  mentorHeading: ['Learn with [[your mentors]].', '[[তোমার মেন্টরদের]] সাথে শেখো।'],
  comingSoon: ['Coming soon', 'শীঘ্রই আসছে'],
  classes: ['Classes', 'ক্লাস'],
  access: ['Access', 'অ্যাক্সেস'],
  levelUg: ['Undergraduate (BDS)', 'আন্ডারগ্র্যাজুয়েট (BDS)'],
  levelPg: ['Postgraduate', 'পোস্টগ্র্যাজুয়েট'],
  pgSoon: ['Postgraduate courses are coming soon.', 'পোস্টগ্র্যাজুয়েট কোর্স শীঘ্রই আসছে।'],
  reviewsKicker: ['Student reviews', 'স্টুডেন্টদের রিভিউ'],
  reviewsOne: ['review', 'টি রিভিউ'],
  reviewsMany: ['reviews', 'টি রিভিউ'],
  student: ['Student', 'স্টুডেন্ট'],
  notFound: ['Course not found', 'কোর্সটি পাওয়া যায়নি'],
  notFoundBody: ['This course is not available. Browse all courses instead.', 'এই কোর্সটি এখন নেই। সব কোর্স দেখে নাও।'],
};

// ---------------------------------------------------------------- i18n ----
class I18n {
  constructor() { this.dict = {}; this.n = 0; }
  // Returns ' data-i18n="tN"' when a Bangla version exists, else ''.
  attr(bnHtml) {
    if (!bnHtml) return '';
    const k = `t${this.n++}`;
    this.dict[k] = bnHtml;
    return ` data-i18n="${k}"`;
  }
}

const f = (section, key) => ({
  en: section?.content?.en?.[key] ?? '',
  bn: section?.content?.bn?.[key] ?? '',
});

// Element with translatable inline content.
function el(i18n, tag, cls, en, bn, extra = '') {
  return `<${tag}${cls ? ` class="${cls}"` : ''}${extra}${i18n.attr(bn ? inline(bn) : '')}>${inline(en)}</${tag}>`;
}
function kicker(i18n, field, cls = 'kicker') {
  return `<span class="${cls}"${i18n.attr(field.bn ? '<i></i>' + inline(field.bn) : '')}><i></i>${inline(field.en)}</span>`;
}
const pair = (en, bn) => ({ en, bn });
const ui = (k) => pair(...UI[k]);

function linkHref(url, onHome) {
  const u = safeUrl(url);
  if (!onHome && u.startsWith('#')) return u === '#top' ? '/' : '/' + u;
  return u;
}
const ext = (item) => (item.open_new_tab || item.is_external || /^https?:/i.test(item.url) ? ' target="_blank" rel="noopener"' : '');

function waUrl(settings, message = settings.whatsapp_message_en) {
  const n = String(settings.whatsapp_number || '').replace(/[^0-9]/g, '');
  if (!n) return 'https://mediversebd.com';
  const msg = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${n}${msg}`;
}

// Course pages: WhatsApp messages that name the course (English + Bangla).
// Same number as everywhere else; only the pre-filled text changes.
// Adds "Course" / "কোর্স" unless the name already contains it ("SDM Full Course", "Crash Course on …").
const withCourseWord = (name, word) => (/\bcourse\b|কোর্স/i.test(name) ? name.trim() : `${name.trim()} ${word}`);
function courseWhatsApp(settings, course) {
  const en = withCourseWord(course.title_en, 'Course');
  const bn = withCourseWord(course.title_bn || course.title_en, 'কোর্স');
  return {
    en: waUrl(settings, `Hello MediVerse Dental, I would like to know more about your ${en}.`),
    bn: waUrl(settings, `হ্যালো মেডিভার্স ডেন্টাল, আমি আপনাদের ${bn} সম্পর্কে আরও জানতে চাই।`),
  };
}
// href for a WhatsApp link: the course-specific one when given (with the Bangla
// version in data-wa-bn for the language switch), otherwise the usual link.
const waHref = (wa, fallback) => (wa ? `href="${esc(wa.en)}" data-wa-bn="${esc(wa.bn)}"` : `href="${esc(fallback)}"`);
const isWa = (url) => /^https:\/\/wa\.me\//i.test(url || '');

function initials(name) {
  const parts = String(name).replace('Dr.', '').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}

// -------------------------------------------------------------- shared ----
// `current` = path of the page being shown (e.g. "/articles"): that menu item is highlighted.
const navCur = (n, current) => (current && n.url === current ? ' class="active" aria-current="page"' : '');
function header(c, i18n, onHome, wa = null, current = '') {
  const s = c.settings;
  const logos = `<img class="l-dark" src="${esc(s.logoDarkUrl)}" alt="${esc(s.site_name)}">
      <img class="l-light" src="${esc(s.logoLightUrl)}" alt="${esc(s.site_name)}">`;
  const links = c.nav.header.filter((n) => n.style === 'link')
    .map((n) => `      <a href="${esc(linkHref(n.url, onHome))}"${navCur(n, current)}${n.open_new_tab ? ' target="_blank" rel="noopener"' : ''}${i18n.attr(n.label_bn && inline(n.label_bn))}>${inline(n.label_en)}</a>`).join('\n');
  const cta = c.nav.header.filter((n) => n.style === 'button')
    .map((n) => `      <a class="btn btn-primary nav-cta" href="${esc(safeUrl(n.url))}"${ext(n)}${i18n.attr(n.label_bn && inline(n.label_bn))}>${inline(n.label_en)}</a>`).join('\n');
  return `<!-- ============ HEADER ============ -->
<header id="hdr">
  <div class="wrap nav">
    <a href="${onHome ? '#top' : '/'}" class="logo" aria-label="${esc(s.site_name)} home">
      ${logos}
    </a>
    <nav class="navlinks" aria-label="Primary">
${links}
    </nav>
    <div class="nav-right">
      <button class="icon-btn lang-btn" id="langBtn" aria-label="Switch language to Bangla" lang="bn">বাংলা</button>
      <button class="icon-btn theme-btn" id="themeBtn" aria-label="Toggle light and dark theme">
        <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
${cta}
      <button class="icon-btn burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mnav"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>

<!-- ============ MOBILE MENU ============ -->
<nav class="mnav" id="mnav" aria-label="Mobile" aria-hidden="true">
  <ol>
${c.nav.mobile.filter((n) => n.style === 'link').map((n) => `    <li><a href="${esc(linkHref(n.url, onHome))}"${navCur(n, current)}${n.open_new_tab ? ' target="_blank" rel="noopener"' : ''}${i18n.attr(n.label_bn && inline(n.label_bn))}>${inline(n.label_en)}</a></li>`).join('\n')}
  </ol>
  <div class="m-foot">
    <p${i18n.attr(inline('আমাদের সাথে যুক্ত থাকো'))}>Follow ${esc(s.site_name)}</p>
    <div class="m-social">
${c.socials.filter((x) => x.show_in_header).map((x) => `      <a ${waHref(x.platform === 'whatsapp' ? wa : null, safeUrl(x.url))} target="_blank" rel="noopener" aria-label="${esc(x.label_en || x.platform)}">${SOCIAL_SVG[x.platform] || ''}</a>`).join('\n')}
    </div>
${c.nav.mobile.filter((n) => n.style === 'button').map((n) => `    <a class="btn btn-primary" href="${esc(safeUrl(n.url))}"${ext(n)}${i18n.attr(n.label_bn && inline(n.label_bn))}>${inline(n.label_en)}</a>`).join('\n')}
  </div>
</nav>`;
}

function footer(c, i18n, onHome, wa = null) {
  const s = c.settings;
  const text = c.footerSections.find((x) => x.type === 'text');
  const columns = c.footerSections.filter((x) => x.type === 'links').map((sec) => {
    const items = sec.links.map((l) => {
      const m = /^#phase-(\d+)$/.exec(l.url);
      const href = m ? (onHome ? '#courses' : '/#courses') : linkHref(l.url, onHome);
      const jump = m && onHome ? ` data-jump="${m[1]}"` : '';
      return `<li><a href="${esc(href)}"${jump}${l.is_external ? ' target="_blank" rel="noopener"' : ''}${i18n.attr(l.label_bn && l.label_bn !== l.label_en ? inline(l.label_bn) : '')}>${inline(l.label_en)}</a></li>`;
    }).join('');
    return `      <div><h4${i18n.attr(sec.title_bn && inline(sec.title_bn))}>${inline(sec.title_en)}</h4><ul>${items}</ul></div>`;
  }).join('\n');
  return `<!-- ============ FOOTER ============ -->
<footer>
  <div class="wrap">
    <div class="f-grid">
      <div class="f-brand">
        <img class="l-dark" src="${esc(s.logoDarkUrl)}" alt="${esc(s.site_name)}" loading="lazy">
        <img class="l-light" src="${esc(s.logoLightUrl)}" alt="${esc(s.site_name)}" loading="lazy">
        ${text ? el(i18n, 'p', '', text.body_en, text.body_bn) : ''}
        <div class="f-icons">
${c.socials.filter((x) => x.show_in_footer).map((x) => `          <a ${waHref(x.platform === 'whatsapp' ? wa : null, safeUrl(x.url))} target="_blank" rel="noopener" aria-label="${esc(x.label_en || x.platform)}">${SOCIAL_SVG[x.platform] || ''}</a>`).join('\n')}
        </div>
      </div>
${columns}
    </div>
    <div class="f-bottom"><span>© <span id="yr">${new Date().getFullYear()}</span> ${el(i18n, 'span', '', s.copyright_en, s.copyright_bn)}</span>${el(i18n, 'span', '', s.footer_tagline_en, s.footer_tagline_bn)}</div>
  </div>
</footer>

<button class="to-top" id="toTop" aria-label="Back to top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
<a class="wa-float" ${waHref(wa, waUrl(s))} target="_blank" rel="noopener" aria-label="Chat with ${esc(s.site_name)} on WhatsApp">${WA_FLOAT_SVG}</a>`;
}

function mentorMedia(m, idSuffix = '') {
  if (m.avatar_style === 'photo' && m.photoUrl) return `<img src="${esc(m.photoUrl)}" alt="${esc(m.name)}" loading="lazy" decoding="async">`;
  if (m.avatar_style === 'hijab_icon') return `<div class="mono" role="img" aria-label="${esc(m.name)}">${HIJAB_SVG.replaceAll('{id}', 'hj' + initials(m.name).toLowerCase() + idSuffix)}</div>`;
  return `<div class="mono" aria-hidden="true"><span>${esc(initials(m.name))}</span></div>`;
}

// Course page: photo on the left, details on the right (stacked on phones).
function mentorRow(m, i18n) {
  const meta = [m.institution, m.session && `Session ${m.session}`].filter(Boolean).join(' · ');
  return `      <article class="card cm rv">
        <div class="cm-photo">${mentorMedia(m, 'cm').replace(' loading="lazy"', '')}</div>
        <div class="cm-info">
          ${m.designation_en ? el(i18n, 'span', 'tag', m.designation_en, m.designation_bn) : ''}
          <h3>${esc(m.name)}</h3>
          ${m.credentials ? `<p class="cm-cred">${esc(m.credentials)}</p>` : ''}
          ${m.bio_en || m.bio_bn ? el(i18n, 'p', 'cm-bio', m.bio_en || m.bio_bn, m.bio_en && m.bio_bn ? m.bio_bn : '') : ''}
          ${meta ? `<p class="cm-meta">${esc(meta)}</p>` : ''}
        </div>
      </article>`;
}

function mentorCard(m, i18n) {
  const media = mentorMedia(m);
  return `      <article class="mentor rv" tabindex="0">${media}`
    + `<button class="more" aria-label="Show credentials of ${esc(m.name)}" aria-expanded="false">i</button>`
    + `<div class="info">${el(i18n, 'span', 'tag', m.designation_en, m.designation_bn)}<h3>${esc(m.name)}</h3><p>${esc(m.credentials)}</p></div></article>`;
}

function sectionHead(i18n, sec, cls = 'sec-head rv', style = '') {
  const p = f(sec, 'intro');
  return `    <div class="${cls}"${style}>
      ${kicker(i18n, f(sec, 'kicker'))}
      ${el(i18n, 'h2', '', f(sec, 'heading').en, f(sec, 'heading').bn)}${p.en ? `\n      ${el(i18n, 'p', '', p.en, p.bn)}` : ''}
    </div>`;
}

function button(i18n, b, extraCls = '', arrow = '', wa = null) {
  const href = waHref(isWa(b.url) ? wa : null, safeUrl(b.url));
  const cls = b.style === 'ghost' ? 'btn btn-ghost' : 'btn btn-primary';
  const target = b.new_tab || /^https?:/i.test(b.url) ? ' target="_blank" rel="noopener"' : '';
  if (arrow) {
    return `<a class="${cls}${extraCls}" ${href}${target}><span${i18n.attr(b.label_bn && inline(b.label_bn))}>${inline(b.label_en)}</span>\n          ${arrow}</a>`;
  }
  return `<a class="${cls}${extraCls}" ${href}${target}${i18n.attr(b.label_bn && inline(b.label_bn))}>${inline(b.label_en)}</a>`;
}

function contactSection(c, i18n, wa = null) {
  const sec = c.sections.contact;
  if (!sec) return '';
  const btns = (sec.content.buttons || []);
  return `<!-- ============ CONTACT / CTA ============ -->
<section class="sec" id="contact" style="padding-top:20px;padding-bottom:0">
  <div class="wrap">
    <div class="cta rv">
      <svg class="tooth-bg" viewBox="0 0 200 220" fill="#fff" aria-hidden="true"><path d="${TOOTH_PATH}"/></svg>
      ${el(i18n, 'h2', '', f(sec, 'heading').en, f(sec, 'heading').bn)}
      ${el(i18n, 'p', '', f(sec, 'body').en, f(sec, 'body').bn)}
      <div class="hero-cta" style="margin-bottom:0;justify-content:flex-start">
${btns.map((b) => '        ' + button(i18n, b, '', '', wa)).join('\n')}
      </div>
      <div class="socials">
${c.socials.filter((x) => x.show_in_contact).map((x) => `        <a class="soc" ${waHref(x.platform === 'whatsapp' ? wa : null, safeUrl(x.url))} target="_blank" rel="noopener">${SOCIAL_SVG[x.platform] || ''}<span><b>${esc(x.label_en)}</b>${el(i18n, 'small', '', x.subtitle_en, x.subtitle_bn && x.subtitle_bn !== x.subtitle_en ? x.subtitle_bn : '')}</span></a>`).join('\n')}
      </div>
    </div>
  </div>
</section>`;
}

function meta({ title, description, url, image, noindex, extra = '' }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    '<meta name="theme-color" content="#060E1F">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    '<meta property="og:type" content="website">',
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
    extra,
  ].filter(Boolean).join('\n');
}

// ------------------------------------------------------------- homepage ----
export function renderHome(c, { origin, noindex }) {
  const i18n = new I18n();
  const S = c.sections;
  const s = c.settings;
  const out = [];

  out.push(`<div class="progress" id="progress"></div>
<div class="bg-fx" aria-hidden="true"><div class="grid"></div><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>
`);
  out.push(header(c, i18n, true));
  out.push('\n<main id="top">');

  // Each homepage section renders itself; they appear in the order set in the admin (sort_order).
  const blocks = {};

  blocks.hero = () => {
    const h = S.hero;
    const [b1, ...rest] = h.content.buttons || [];
    out.push(`<!-- ============ HERO ============ -->
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      ${kicker(i18n, f(h, 'kicker'), 'kicker rv')}
      ${el(i18n, 'h1', 'rv', f(h, 'heading').en, f(h, 'heading').bn)}
      <div class="bn bn-tag rv">${inline(f(h, 'tagline').en)}</div>
      ${el(i18n, 'p', 'lead rv', f(h, 'lead').en, f(h, 'lead').bn)}
      <div class="hero-cta rv">
        ${b1 ? button(i18n, b1, '', ARROW_RIGHT) : ''}
${rest.map((b) => '        ' + button(i18n, b)).join('\n')}
      </div>
      <div class="stats rv">
${c.stats.map((st) => `        <div class="stat"><b data-count="${Number(st.value) || 0}" data-suffix="${esc(st.suffix)}">0</b>${el(i18n, 'span', '', st.label_en, st.label_bn)}</div>`).join('\n')}
      </div>
    </div>

  </div>
</section>
`);
  };

  blocks.about = () => {
    const a = S.about;
    const hv = f(a, 'highlight_value');
    const hm = /^(\d+)(.*)$/.exec(hv.en || '') || [null, '0', ''];
    const total = c.phases.length || 1;
    out.push(`
<!-- ============ ABOUT ============ -->
<section class="sec" id="about">
  <div class="wrap">
${sectionHead(i18n, a)}

    <div class="bento">
      <div class="card b-mission rv">
        <div>
          ${el(i18n, 'h3', '', f(a, 'mission_heading').en, f(a, 'mission_heading').bn)}
          ${el(i18n, 'p', '', f(a, 'mission_body').en, f(a, 'mission_body').bn)}
        </div>
        <div class="sig"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>${el(i18n, 'span', '', f(a, 'trust_line').en, f(a, 'trust_line').bn)}</div>
      </div>
      <div class="card b-num rv">
        <svg viewBox="0 0 200 220"><path d="${TOOTH_PATH}"/></svg>
        <div class="big"><span data-count="${Number(hm[1]) || 0}">0</span>${esc(hm[2])}</div>
        ${el(i18n, 'p', '', f(a, 'highlight_label').en, f(a, 'highlight_label').bn)}
      </div>
${c.features.map((ft) => `      <div class="card feat rv">
        <div class="ic">${FEATURE_ICONS[ft.icon] || FEATURE_ICONS.video}</div>
        ${el(i18n, 'h4', '', ft.title_en, ft.title_bn)}${el(i18n, 'p', '', ft.body_en, ft.body_bn)}
      </div>`).join('\n')}
    </div>

    <div class="journey">
${c.phases.map((p, i) => `      <div class="card phase rv" style="--w:${Math.round(((i + 1) / total) * 100)}%"><div class="pn">${String(p.code).padStart(2, '0')}</div>${el(i18n, 'h4', '', p.name_en, p.name_bn)}${el(i18n, 'p', '', p.summary_en, p.summary_bn)}<div class="bar"><i></i></div></div>`).join('\n')}
    </div>
  </div>
</section>
`);
  };

  blocks.courses = () => {
    const cs = S.courses;
    const more = (cs.content.buttons || [])[0];
    // Undergraduate / Postgraduate switch: on unless turned off in Admin → Homepage → Courses.
    const levels = cs.content.show_level_switch !== false;
    const levelTabs = levels ? `      <div class="chips lvl-tabs" role="tablist" aria-label="Course level">
        <button class="lvl active" data-lvl="ug" role="tab" aria-selected="true"${i18n.attr(UI.levelUg[1])}>${UI.levelUg[0]}</button>
        <button class="lvl" data-lvl="pg" role="tab" aria-selected="false"${i18n.attr(UI.levelPg[1])}>${UI.levelPg[0]}</button>
      </div>
` : '';
    out.push(`<!-- ============ COURSES ============ -->
<section class="sec" id="courses" style="padding-top:20px">
  <div class="wrap">
${sectionHead(i18n, cs)}

    <div class="c-tools rv${levels ? ' has-lvl' : ''}">
${levelTabs}      <div class="chips" role="tablist" aria-label="Filter courses by phase">
        <button class="chip active" data-f="all" role="tab" aria-selected="true"${i18n.attr('সব')}>All</button>
${c.phases.map((p) => `        <button class="chip" data-f="${p.code}" role="tab" aria-selected="false"${i18n.attr(p.name_bn && inline(p.name_bn))}>${inline(p.name_en)}</button>`).join('\n')}
      </div>
      <label class="search"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="cSearch" type="search" placeholder="${esc(f(cs, 'search_placeholder').en)}" aria-label="Search courses"></label>
    </div>

    <div class="c-grid" id="cGrid">
${c.courses.map((co) => courseCard(co, i18n, levels)).join('\n')}
    </div>${levels ? `
    <div class="empty" id="pgSoon"><span${i18n.attr(UI.pgSoon[1])}>${UI.pgSoon[0]}</span></div>` : ''}
    <div class="empty" id="cEmpty"><span${i18n.attr('এই নামে এখনো কোনো কোর্স নেই — ')}>No course matches that search yet — </span><a href="${esc(waUrl(s))}" target="_blank" rel="noopener" style="color:var(--cyan);font-weight:700"${i18n.attr('হোয়াটসঅ্যাপে আমাদের জিজ্ঞেস করো')}>ask us on WhatsApp</a>.</div>
${more ? `    <div class="c-more rv">${button(i18n, more, '', ARROW_OUT)}</div>` : ''}
  </div>
</section>
`);
    if (levels) out.push(LEVEL_ASSETS);
  };

  blocks.mentors = () => {
    out.push(`<!-- ============ MENTORS ============ -->
<section class="sec" id="mentors" style="padding-top:40px">
  <div class="wrap">
${sectionHead(i18n, S.mentors)}
    <div class="m-grid">
${c.mentors.map((m) => mentorCard(m, i18n)).join('\n')}
    </div>
  </div>
</section>
`);
  };

  blocks.stories = () => {
    out.push(`<!-- ============ STORIES ============ -->
<section class="sec" id="stories" style="padding-top:40px">
  <div class="wrap">
${sectionHead(i18n, S.stories, 'sec-head center rv')}
    <div class="t-grid">
${c.testimonials.map((t) => {
      const av = String(t.attribution_en || '').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
      const whoBn = t.attribution_bn ? `<b style="color:var(--ink)">${inline(t.attribution_bn)}</b><br>${inline(t.source_bn || t.source_en)}` : '';
      return `      <div class="card tcard rv"><div class="q grad-text">“</div>${el(i18n, 'blockquote', '', t.quote_en, t.quote_bn)}<div class="stars">★★★★★</div><div class="who"><span class="av">${esc(av)}</span><span${i18n.attr(whoBn)}><b style="color:var(--ink)">${inline(t.attribution_en)}</b><br>${inline(t.source_en)}</span></div></div>`;
    }).join('\n')}
    </div>
  </div>
</section>
`);
  };

  blocks.faq = () => {
    out.push(`<!-- ============ FAQ ============ -->
<section class="sec" id="faq" style="padding-top:40px">
  <div class="wrap faq-wrap">
${sectionHead(i18n, S.faq, 'sec-head rv', ' style="margin-bottom:0"')}
    <div class="faq-list rv">
${c.faqs.map((q, i) => `      <details${i === 0 ? ' open' : ''}><summary>${el(i18n, 'span', '', q.question_en, q.question_bn)}<span class="pm">+</span></summary>${el(i18n, 'div', 'ans', q.answer_en, q.answer_bn)}</details>`).join('\n')}
    </div>
  </div>
</section>
`);
  };

  blocks.articles = () => { if (c.articles?.length) out.push(articlesTeaser(c, i18n, S.articles)); };
  blocks.team = () => out.push(teamTeaser(i18n, S.team));
  blocks.contact = () => out.push(contactSection(c, i18n));
  const order = Object.values(S).filter((x) => blocks[x.key]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const sec of order) blocks[sec.key]();
  if (!S.contact) out.push(contactSection(c, i18n)); // as before: the contact block is always shown
  out.push('</main>\n');
  out.push(footer(c, i18n, true));

  const title = s.seo_title_en || s.site_name;
  return documentHtml({
    settings: s,
    // Styles for the Articles / Team blocks, only when they are shown (otherwise the page is unchanged).
    extraStyle: (c.articles?.length && S.articles) || S.team ? PAGE_STYLE : '',
    meta: meta({ title, description: s.seo_description_en || '', url: origin + '/', image: s.ogImageUrl, noindex }),
    body: out.join('\n'),
    bn: { _title: s.seo_title_bn || title, _search: f(S.courses, 'search_placeholder').bn || f(S.courses, 'search_placeholder').en, ...i18n.dict },
  });
}

const isPg = (co) => co.level === 'postgraduate';
// Undergraduate / Postgraduate switch (only added when turned on in the admin).
// Runs after the page's own course filter script, and keeps its search + phase chips working.
const LEVEL_ASSETS = `<style>.course.lvl-hide{display:none}#pgSoon{display:none}.c-tools.has-lvl{flex-wrap:wrap}.c-tools .lvl-tabs{flex:1 1 100%;max-width:max-content}
.lvl{padding:10px 16px;border-radius:11px;font-weight:700;font-size:.88rem;color:var(--muted);white-space:nowrap;transition:all .25s}
.lvl.active{background:var(--grad);color:#fff;box-shadow:0 8px 20px -8px rgba(61,139,255,.8)}.lvl:not(.active):hover{color:var(--ink)}
@media (max-width:640px){.lvl{flex:1 1 auto;padding:10px 12px}}</style>
<script>
document.addEventListener('DOMContentLoaded',function(){
  var tabs=[].slice.call(document.querySelectorAll('[data-lvl]'));if(!tabs.length)return;
  var cards=[].slice.call(document.querySelectorAll('.course[data-l]')),phases=document.querySelector('.c-tools .chips:not(.lvl-tabs)'),
      empty=document.getElementById('cEmpty'),soon=document.getElementById('pgSoon'),lvl='ug';
  function fix(){
    var shown=0,any=false;
    cards.forEach(function(c){var off=c.dataset.l!==lvl;c.classList.toggle('lvl-hide',off);if(!off){any=true;if(!c.classList.contains('hide'))shown++;}});
    var none=lvl==='pg'&&!any;
    if(soon)soon.style.display=none?'block':'none';
    if(empty)empty.style.display=shown||none?'none':'block';
    if(phases)phases.style.display=lvl==='pg'?'none':'';
  }
  tabs.forEach(function(t){t.addEventListener('click',function(){
    lvl=t.dataset.lvl;
    tabs.forEach(function(b){var on=b===t;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);});
    if(lvl==='pg'){var all=document.querySelector('.chip[data-f="all"]');if(all)all.click();}
    fix();
  });});
  var q=document.getElementById('cSearch');if(q)q.addEventListener('input',fix);
  document.querySelectorAll('.chip[data-f]').forEach(function(c){c.addEventListener('click',fix);});
  fix();
});
</script>`;
function courseCard(co, i18n, withLevel = false) {
  const media = co.flyerUrl
    ? `<img src="${esc(co.flyerUrl)}" alt="${esc(co.title_en)} course flyer" loading="lazy" decoding="async">`
    : `<div class="ph"><div><b>${esc(co.title_en)}</b><small${i18n.attr(UI.comingSoon[1])}>${UI.comingSoon[0]}</small></div></div>`;
  const phase = co.phase || {};
  const badge = co.phase ? [phase.name_en, phase.name_bn] : isPg(co) ? UI.levelPg : ['', ''];
  return `      <a class="course rv" data-f="${esc(co.phase ? phase.code : 'pg')}"${withLevel ? ` data-l="${isPg(co) ? 'pg' : 'ug'}"` : ''} data-k="${esc((co.search_keywords || []).join(' ').toLowerCase())}" href="/courses/${esc(co.slug)}">`
    + `<div class="c-img">${media}<span class="badge"${i18n.attr(badge[1] && inline(badge[1]))}>${inline(badge[0] || '')}</span></div>`
    + `<div class="c-body">${el(i18n, 'h3', '', co.title_en, co.title_bn)}${el(i18n, 'p', '', co.short_desc_en, co.short_desc_bn)}`
    + `<span class="c-link"><span${i18n.attr('কোর্সটা দেখো')}>View course</span> ${ARROW}</span></div></a>`;
}

// ------------------------------------------------------------- reviews ----
export const RATING_LABELS = { 5: ['Very good', 'খুব ভালো'], 4: ['Good', 'ভালো'], 3: ['Average', 'মোটামুটি'], 2: ['Bad', 'খারাপ'], 1: ['Very bad', 'খুব খারাপ'] };
const bnDigits = (x) => String(x).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const starsHtml = (n) => `<span class="rv-stars" role="img" aria-label="${n} out of 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;

function reviewsSection(reviews, i18n) {
  const valid = reviews.filter((r) => r.rating >= 1 && r.rating <= 5 && (r.review_en || r.review_bn));
  if (!valid.length) return '';
  const avg = Math.round((valid.reduce((a, r) => a + r.rating, 0) / valid.length) * 10) / 10;
  const word = valid.length === 1 ? UI.reviewsOne : UI.reviewsMany;
  const summaryEn = `${avg.toFixed(1)} / 5 · ${valid.length} ${word[0]}`;
  const summaryBn = `${bnDigits(avg.toFixed(1))} / ৫ · ${bnDigits(valid.length)}${word[1]}`;
  const cards = valid.map((r) => {
    const name = r.reviewer_name || '';
    const av = (name || UI.student[0]).split(/\s+/).filter((w) => !/^dr\.?$/i.test(w)).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
    const label = RATING_LABELS[r.rating];
    const textEn = r.review_en || r.review_bn, textBn = r.review_bn || r.review_en;
    const who = name ? esc(name) : `<span${i18n.attr(UI.student[1])}>${UI.student[0]}</span>`;
    // "College · Session 2019-20" (both optional; Bangla uses Bangla digits for the session).
    const college = [r.reviewer_info_en || r.reviewer_info_bn, r.reviewer_info_bn || r.reviewer_info_en];
    const sess = r.reviewer_session ? [`Session ${r.reviewer_session}`, `সেশন ${bnDigits(r.reviewer_session)}`] : null;
    const infoEn = [college[0], sess?.[0]].filter(Boolean).join(' · ');
    const infoBn = [college[1], sess?.[1]].filter(Boolean).join(' · ');
    const info = infoEn ? el(i18n, 'span', 'rv-info', infoEn, infoBn !== infoEn ? infoBn : '') : '';
    return `      <div class="card tcard rv"><div class="rv-top">${starsHtml(r.rating)}${el(i18n, 'span', 'rv-word', label[0], label[1])}</div>${el(i18n, 'blockquote', '', textEn, textBn !== textEn ? textBn : '')}<div class="who"><span class="av">${esc(av)}</span><span><b style="color:var(--ink)">${who}</b>${info ? `<br>${info}` : ''}</span></div></div>`;
  }).join('\n');
  return `<section class="sec" id="reviews" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head rv">
      ${kicker(i18n, ui('reviewsKicker'))}
      <h2 class="rv-summary">${starsHtml(Math.round(avg))} <span${i18n.attr(summaryBn)}>${summaryEn}</span></h2>
    </div>
    <div class="t-grid rv-grid">
${cards}
    </div>
  </div>
</section>
`;
}

// ---------------------------------------------------------- course page ----
// When the visitor switches to Bangla (the site's own script sets <html lang>),
// WhatsApp links switch to the Bangla message, and back again for English.
const WA_LANG_SCRIPT = `<script>
(function(){
  var root=document.documentElement;
  function sync(){
    var bn=root.lang==='bn';
    document.querySelectorAll('a[data-wa-bn]').forEach(function(a){
      if(a.dataset.waEn===undefined)a.dataset.waEn=a.getAttribute('href');
      a.setAttribute('href',bn?a.dataset.waBn:a.dataset.waEn);
    });
  }
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['lang']});
  sync();
})();
</script>`;
const COURSE_STYLE = `<style>
/* Course detail page — reuses the site's design tokens and components. */
.cp-hero{padding-bottom:20px}
.cp-back{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-weight:700;font-size:.92rem;margin-bottom:26px}
.cp-back:hover{color:var(--ink)}
.cp-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:44px;align-items:start}
.cp-flyer{padding:0;overflow:hidden;position:sticky;top:96px}
.cp-flyer .c-img{aspect-ratio:auto}
.cp-flyer img{width:100%;height:auto;display:block}
.cp-info h1{font-size:clamp(2rem,4.6vw,3.3rem);font-weight:800;margin:18px 0 14px}
.hero .cp-info p.lead{font-size:1.1rem;color:var(--muted);max-width:none;margin:0 0 28px}
.cp-info .hero-cta{justify-content:flex-start;margin-bottom:28px}
.cp-facts{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px}
.cp-facts .stat b{font-size:1.25rem}
.cp-details{padding:30px}
.cp-details p{color:var(--muted);margin-bottom:14px}
.cp-details p:last-child{margin-bottom:0}
.cp-details ul,.cp-list{list-style:none;display:grid;gap:10px;margin:0 0 14px}
.cp-details li,.cp-list li{padding-left:28px;position:relative;color:var(--muted)}
.cp-details li::before,.cp-list li::before{content:"✓";position:absolute;left:0;color:var(--cyan);font-weight:800}
.cm-list{display:grid;gap:18px}
.cm{display:grid;grid-template-columns:200px 1fr;gap:26px;align-items:center;padding:22px}
.cm-photo{aspect-ratio:1;border-radius:18px;overflow:hidden;background:var(--surface-2)}
.cm-photo img{width:100%;height:100%;object-fit:cover}
.cm-photo .mono{width:100%;height:100%;display:grid;place-items:center;font-size:3rem;font-weight:800;color:var(--muted)}
.cm-photo .mono svg{width:70%;height:70%}
.cm-info h3{font-size:1.45rem;margin:10px 0 6px}
.cm-info .tag{display:inline-block;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan);padding:5px 12px;border:1px solid var(--line-2);border-radius:999px}
.cm-cred{color:var(--ink);font-weight:600;margin-bottom:8px}
.cm-bio{color:var(--muted);margin-bottom:8px}
.cm-meta{color:var(--soft);font-size:.9rem}
@media (max-width:640px){.cm{grid-template-columns:1fr;text-align:center;gap:16px}.cm-photo{max-width:220px;margin:0 auto;width:100%}}
.rv-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))!important}
.rv-stars{color:var(--amber);letter-spacing:2px}.rv-stars .off{opacity:.22}
.rv-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.rv-word{font-size:.82rem;font-weight:700;color:var(--muted)}
.rv-summary{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:clamp(1.3rem,3vw,1.8rem)!important}.rv-info{font-size:.82rem}
.cp-soon{display:inline-block;margin-left:10px;padding:5px 11px;border-radius:999px;font-size:.75rem;font-weight:800;background:var(--grad-warm);color:#1a0d00;vertical-align:middle}
@media (max-width:1024px){.cp-grid{gap:28px}}
@media (max-width:760px){.cp-grid{grid-template-columns:1fr}.cp-flyer{position:static;max-width:520px;width:100%;margin:0 auto}}
@media (max-width:640px){.cp-info .hero-cta .btn{flex:1 1 100%}}
</style>`;

export function renderCourse(c, course, { origin, noindex }) {
  const i18n = new I18n();
  const s = c.settings;
  const phase = course.phase || {};
  const url = `${origin}/courses/${course.slug}`;
  const info = course.info || {};
  const facts = [];
  if (info.total_classes) facts.push([ui('classes'), pair(String(info.total_classes), '')]);
  if (info.access_period_en) facts.push([ui('access'), pair(info.access_period_en, info.access_period_bn)]);
  const features = Array.isArray(info.features) ? info.features.filter((x) => x && x.en) : [];
  const ctaUrl = safeUrl(course.external_url, 'https://mediversebd.com');
  const ctaEn = course.cta_label_en || UI.enroll[0];
  const ctaBn = course.cta_label_bn || UI.enroll[1];
  const details = course.details_en ? pair(course.details_en, course.details_bn) : null;
  const wa = courseWhatsApp(s, course);

  const media = course.flyerUrl
    ? `<img src="${esc(course.flyerUrl)}" alt="${esc(course.title_en)} course flyer"${course.flyerMedia?.width ? ` width="${course.flyerMedia.width}" height="${course.flyerMedia.height}"` : ''}>`
    : `<div class="c-img"><div class="ph"><div><b>${esc(course.title_en)}</b><small${i18n.attr(UI.comingSoon[1])}>${UI.comingSoon[0]}</small></div></div></div>`;

  const body = [];
  body.push(`<div class="progress" id="progress"></div>
<div class="bg-fx" aria-hidden="true"><div class="grid"></div><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>
`);
  body.push(header(c, i18n, false, wa));
  body.push(`
<main id="top">
<section class="hero cp-hero">
  <div class="wrap">
    <a class="cp-back" href="/#courses">← <span${i18n.attr(UI.allCourses[1])}>${UI.allCourses[0]}</span></a>
    <div class="cp-grid">
      <div class="card cp-flyer rv">${media}</div>
      <div class="cp-info">
        <span class="kicker rv"${i18n.attr(course.phase ? (phase.name_bn ? '<i></i>' + inline(phase.name_bn) : '') : isPg(course) ? '<i></i>' + UI.levelPg[1] : '')}><i></i>${inline(course.phase ? phase.name_en || '' : isPg(course) ? UI.levelPg[0] : '')}</span>
        <h1 class="rv"><span${i18n.attr(course.title_bn && inline(course.title_bn))}>${inline(course.title_en)}</span>${course.status === 'upcoming' ? `<span class="cp-soon"${i18n.attr(UI.comingSoon[1])}>${UI.comingSoon[0]}</span>` : ''}</h1>
        ${course.short_desc_en ? el(i18n, 'p', 'lead rv', course.short_desc_en, course.short_desc_bn) : ''}
        <div class="hero-cta rv">
          <a class="btn btn-primary" href="${esc(ctaUrl)}" target="_blank" rel="noopener"><span${i18n.attr(inline(ctaBn))}>${inline(ctaEn)}</span>
          ${ARROW_OUT}</a>
          <a class="btn btn-ghost" ${waHref(wa)} target="_blank" rel="noopener"${i18n.attr(UI.askWhatsApp[1])}>${UI.askWhatsApp[0]}</a>
        </div>${facts.length ? `
        <div class="cp-facts rv">
${facts.map(([label, value]) => `          <div class="stat"><b${i18n.attr(value.bn && inline(value.bn))}>${inline(value.en)}</b>${el(i18n, 'span', '', label.en, label.bn)}</div>`).join('\n')}
        </div>` : ''}
      </div>
    </div>
  </div>
</section>
`);

  if (details || features.length) {
    body.push(`<section class="sec" id="details" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head rv">
      ${kicker(i18n, ui('details'))}
    </div>
    <div class="card cp-details rv">${details ? `
      <div${i18n.attr(details.bn ? blocks(details.bn) : '')}>${blocks(details.en)}</div>` : ''}${features.length ? `
      <h3 style="margin:${details ? '22px' : '0'} 0 14px"${i18n.attr(UI.whatYouGet[1])}>${UI.whatYouGet[0]}</h3>
      <ul class="cp-list">${features.map((x) => el(i18n, 'li', '', x.en, x.bn)).join('')}</ul>` : ''}
    </div>
  </div>
</section>
`);
  }

  if (course.reviews?.length) body.push(reviewsSection(course.reviews, i18n));

  if (course.mentors.length) {
    body.push(`<section class="sec" id="mentors" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head rv">
      ${kicker(i18n, ui('mentorKicker'))}
      ${el(i18n, 'h2', '', UI.mentorHeading[0], UI.mentorHeading[1])}
    </div>
    <div class="cm-list">
${course.mentors.map((m) => mentorRow(m, i18n)).join('\n')}
    </div>
  </div>
</section>
`);
  }


  body.push(contactSection(c, i18n, wa));
  body.push('</main>\n');
  body.push(footer(c, i18n, false, wa));
  body.push(WA_LANG_SCRIPT);

  const title = course.seo_title_en || `${course.title_en} — ${s.site_name}`;
  const titleBn = course.seo_title_bn || `${course.title_bn || course.title_en} — ${s.site_name}`;
  const description = course.seo_description_en || course.short_desc_en || s.seo_description_en || '';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title_en,
    description,
    url,
    ...(course.flyerUrl ? { image: course.flyerUrl } : {}),
    provider: { '@type': 'Organization', name: s.site_name, sameAs: 'https://mediversebd.com' },
  };
  return documentHtml({
    settings: s,
    meta: meta({
      title, description, url, image: course.flyerUrl || s.ogImageUrl, noindex,
      extra: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    }),
    extraStyle: COURSE_STYLE,
    body: body.join('\n'),
    bn: { _title: titleBn, _search: '', ...i18n.dict },
  });
}

export function renderNotFound(c, { origin, noindex }) {
  const i18n = new I18n();
  const s = c.settings;
  const body = `<div class="progress" id="progress"></div>
<div class="bg-fx" aria-hidden="true"><div class="grid"></div><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>
${header(c, i18n, false)}
<main id="top">
<section class="hero cp-hero">
  <div class="wrap">
    <div class="sec-head">
      <h1 style="font-size:clamp(2rem,4.6vw,3.3rem);font-weight:800;margin-bottom:14px"${i18n.attr(UI.notFound[1])}>${UI.notFound[0]}</h1>
      <p${i18n.attr(UI.notFoundBody[1])}>${UI.notFoundBody[0]}</p>
    </div>
    <a class="btn btn-primary" href="/#courses"${i18n.attr(UI.allCourses[1])}>${UI.allCourses[0]}</a>
  </div>
</section>
</main>
${footer(c, i18n, false)}`;
  return documentHtml({
    settings: s,
    meta: meta({ title: `${UI.notFound[0]} — ${s.site_name}`, description: '', url: `${origin}/`, noindex: true }),
    extraStyle: COURSE_STYLE,
    body,
    bn: { _title: `${UI.notFound[1]} — ${s.site_name}`, _search: '', ...i18n.dict },
  });
}

// ======================================================================
// Extra pages: Articles, Article, Team (Central Executives), Books
// ======================================================================
const P = {
  articles: ['Articles', 'আর্টিকেল'],
  articlesHeading: ['Read, learn, [[stay ahead]].', 'পড়ো, শেখো, [[এগিয়ে থাকো]]।'],
  articlesIntro: ['Study tips, exam guidelines and clinical notes from MediVerse mentors.', 'মেডিভার্স মেন্টরদের লেখা পড়ার টিপস, পরীক্ষার গাইডলাইন আর ক্লিনিক্যাল নোটস।'],
  noArticles: ['New articles are coming soon.', 'নতুন আর্টিকেল শীঘ্রই আসছে।'],
  readMore: ['Read article', 'পুরোটা পড়ো'],
  minRead: ['min read', 'মিনিটে পড়া'],
  views: ['views', 'বার পড়া হয়েছে'],
  writtenBy: ['Written by', 'লিখেছেন'],
  backArticles: ['All articles', 'সব আর্টিকেল'],
  share: ['Share', 'শেয়ার'],
  copied: ['Link copied', 'লিংক কপি হয়েছে'],
  team: ['Central Executives', 'সেন্ট্রাল এক্সিকিউটিভ'],
  teamHeading: ['Meet our [[Central Executives]].', 'আমাদের [[সেন্ট্রাল এক্সিকিউটিভদের]] সাথে পরিচিত হও।'],
  teamIntro: ['The people who plan, build and run MediVerse Dental.', 'যাঁরা মেডিভার্স ডেন্টালকে পরিকল্পনা করেন, গড়ে তোলেন আর চালান।'],
  noTeam: ['Team profiles are coming soon.', 'টিমের প্রোফাইল শীঘ্রই আসছে।'],
  joinHeading: ['Want to Be Part of [[MediVerse]]?', '[[মেডিভার্সের]] অংশ হতে চাও?'],
  joinBody: ['Join our growing team and contribute to the future of dental education in Bangladesh. We welcome passionate and dedicated individuals who want to make a difference.',
    'আমাদের বাড়তে থাকা টিমে যোগ দাও, আর বাংলাদেশের ডেন্টাল শিক্ষার ভবিষ্যৎ গড়তে অবদান রাখো। যারা আন্তরিক, নিবেদিত আর কিছু বদলাতে চায়, তাদের আমরা স্বাগত জানাই।'],
  joinWa: ['Contact via WhatsApp', 'হোয়াটসঅ্যাপে যোগাযোগ করো'],
  joinMail: ['Apply via Email', 'ইমেইলে আবেদন করো'],
  writeHeading: ['Want to Publish Your [[Article]]?', 'তোমার [[লেখা]] প্রকাশ করতে চাও?'],
  writeBody: ['Share your knowledge with dental students across Bangladesh. Send us your article, case discussion or study tips — we review every submission and publish the best ones on MediVerse Dental.',
    'সারা বাংলাদেশের ডেন্টাল স্টুডেন্টদের সাথে তোমার জ্ঞান শেয়ার করো। তোমার আর্টিকেল, কেস ডিসকাশন বা পড়ার টিপস আমাদের পাঠাও — আমরা প্রতিটি লেখা দেখে সেরাগুলো মেডিভার্স ডেন্টালে প্রকাশ করি।'],
  writeWa: ['Send via WhatsApp', 'হোয়াটসঅ্যাপে পাঠাও'],
  writeMail: ['Send via Email', 'ইমেইলে পাঠাও'],
  books: ['Books', 'বই'],
  booksHeading: ['Books for [[dental students]].', '[[ডেন্টাল স্টুডেন্টদের]] জন্য বই।'],
  booksIntro: ['Online and printed books by MediVerse mentors and trusted authors.', 'মেডিভার্স মেন্টর আর বিশ্বস্ত লেখকদের অনলাইন ও ছাপা বই।'],
  all: ['All', 'সব'],
  online: ['Online', 'অনলাইন'],
  offline: ['Offline (printed)', 'অফলাইন (ছাপা)'],
  noBooks: ['Books are coming soon.', 'বই শীঘ্রই আসছে।'],
  by: ['by', 'লেখক:'],
  mentor: ['Mentor', 'মেন্টর'],
  view: ['View', 'দেখো'],
  articleNotFound: ['Article not found', 'আর্টিকেলটি পাওয়া যায়নি'],
  articleNotFoundBody: ['This article is not available. Browse all articles instead.', 'এই আর্টিকেলটি এখন নেই। সব আর্টিকেল দেখে নাও।'],
};
const JOIN_WA = 'Hello MediVerse Dental! I\'m interested in joining your team. Could you please share more details about the available opportunities?';
const JOIN_SUBJECT = 'Application to Join MediVerse Dental Team';
const JOIN_BODY = 'Hello MediVerse Dental Team,\n\nI am interested in joining your team. I would appreciate it if you could share more information about the available opportunities and application process.\n\nThank you.';
const WRITE_WA = 'Hello MediVerse Dental! I would like to publish my article on your website. Could you please tell me how to submit it?';
const WRITE_SUBJECT = 'Article Submission for MediVerse Dental';
const WRITE_BODY = 'Hello MediVerse Dental Team,\n\nI would like to publish my article on MediVerse Dental.\n\nTitle:\nTopic:\nMy name, college & session:\n\n(Please attach the article or paste it below.)\n\nThank you.';
const EMAIL_OK = /^[^@\s<>"'`]+@[^@\s<>"'`]+\.[a-z]{2,}$/i;

const PAGE_STYLE = `<style>
.pg-hero{padding:130px 0 30px}
.pg-hero h1{font-size:clamp(2rem,4.6vw,3.3rem);font-weight:800;margin:18px 0 14px}
.pg-hero .wrap{text-align:center}
.pg-hero .lead{font-size:1.08rem;color:var(--muted);max-width:720px;margin:0 auto}
.pg-hero .art{text-align:left}
.hero .art p.lead{max-width:none;margin:0 0 20px}
.a-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px}
.a-grid:has(> :only-child){max-width:760px;margin:0 auto}
.a-card{display:flex;flex-direction:column;overflow:hidden;color:inherit}
.a-card .a-img{aspect-ratio:16/9;background:var(--surface-2);overflow:hidden}
.a-card .a-img img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.a-card:hover .a-img img{transform:scale(1.04)}
.a-ph{width:100%;height:100%;display:grid;place-items:center;padding:20px;text-align:center;font-weight:800;font-size:1.2rem;background:linear-gradient(135deg,rgba(53,224,255,.18),rgba(139,108,255,.25))}
.a-body{padding:20px 22px 22px;display:flex;flex-direction:column;gap:10px;flex:1}
.a-cat{font-size:.74rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan)}
.a-body h3{font-size:1.2rem;line-height:1.3}
.a-body p{color:var(--muted);font-size:.95rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.a-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.84rem;color:var(--soft);margin-top:auto}
.a-meta b{color:var(--cyan);font-weight:700}
.art{max-width:780px;margin:0 auto}
.art .back{display:inline-flex;gap:6px;color:var(--muted);font-weight:600;margin-bottom:18px}
.art h1{font-size:clamp(1.9rem,4.4vw,3rem);font-weight:800;margin:14px 0 14px;line-height:1.2}
.art .lead{font-size:1.12rem;color:var(--muted);margin-bottom:20px}
.art-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;color:var(--soft);font-size:.92rem;padding-bottom:20px;border-bottom:1px solid var(--line);margin-bottom:26px}
.art-meta .by b{color:var(--cyan)}
.art-meta .mi{vertical-align:-3px;margin-right:2px;color:var(--cyan)}
.art-share{margin-left:auto;padding:8px 16px;border-radius:999px;border:1px solid var(--line-2);font-weight:700;color:var(--ink)}
.art-cover{border-radius:22px;overflow:hidden;margin-bottom:30px;border:1px solid var(--line)}
.art-cover img{width:100%;height:auto}
.art-body{font-size:1.08rem;line-height:1.85;color:var(--ink)}
.art-body h2{font-size:1.6rem;margin:34px 0 12px}
.art-body h3{font-size:1.25rem;margin:26px 0 10px}
.art-body p{margin:0 0 18px;color:var(--ink);opacity:.92}
.art-body ul,.art-body ol{margin:0 0 18px 1.3em;display:grid;gap:8px}
.art-body blockquote{margin:0 0 18px;padding:14px 18px;border-left:4px solid var(--cyan);background:var(--surface);border-radius:0 14px 14px 0;color:var(--muted)}
.art-body figure{margin:26px 0}
.art-body figure img{border-radius:16px;width:100%;height:auto;border:1px solid var(--line)}
.art-body figcaption{text-align:center;color:var(--soft);font-size:.88rem;margin-top:8px}
.tm-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:20px}
.tm-grid .tm-card{flex:0 1 260px;min-width:min(100%,230px)}
.tm-card{text-align:center;padding:22px 18px 24px}
.tm-photo{width:150px;height:150px;border-radius:50%;margin:0 auto 16px;overflow:hidden;background:var(--grad);padding:3px}
.tm-photo img,.tm-photo .mono{width:100%;height:100%;border-radius:50%;object-fit:cover;background:var(--bg-2);display:grid;place-items:center;font-size:2.4rem;font-weight:800;color:var(--muted)}
.tm-card h3{font-size:1.15rem;margin-bottom:8px}
.tm-role{display:inline-block;font-size:.76rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:999px;background:var(--grad);color:#fff;margin-bottom:10px}
.tm-card p{color:var(--muted);font-size:.92rem}
.join{padding:44px 30px;text-align:center;position:relative;overflow:hidden}
.join h2{font-size:clamp(1.7rem,3.6vw,2.5rem);font-weight:800;margin-bottom:14px}
.join p{color:var(--muted);max-width:680px;margin:0 auto 26px;font-size:1.05rem}
.join .hero-cta{justify-content:center}
.bk-tabs{display:inline-flex;gap:6px;padding:6px;border:1px solid var(--line);border-radius:16px;background:var(--surface);margin-bottom:26px;flex-wrap:wrap}
.bk-tabs button{padding:10px 18px;border-radius:11px;font-weight:700;font-size:.9rem;color:var(--muted)}
.bk-tabs button.active{background:var(--grad);color:#fff}
.bk-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:20px}
.bk-grid .bk-card{flex:0 1 280px;min-width:min(100%,240px)}
.bk-card{display:flex;flex-direction:column;overflow:hidden;padding:0}
.a-card{padding:0}
.bk-card.hide{display:none}
.bk-cover{aspect-ratio:3/4;background:var(--surface-2);position:relative;overflow:hidden}
.bk-cover img{width:100%;height:100%;object-fit:cover}
.bk-cover .a-ph{height:100%}
.bk-type{position:absolute;top:12px;left:12px;font-size:.74rem;font-weight:800;padding:5px 11px;border-radius:999px;background:rgba(6,14,31,.82);color:#fff;backdrop-filter:blur(6px)}
.bk-body{padding:18px 20px 20px;display:flex;flex-direction:column;gap:8px;flex:1}
.bk-body h3{font-size:1.15rem;line-height:1.3}
.bk-sub{color:var(--muted);font-size:.9rem}
.bk-body p.desc{color:var(--muted);font-size:.93rem}
.bk-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:8px}
.bk-price{font-weight:800;font-size:1.1rem}
.bk-foot .btn{padding:10px 16px;font-size:.88rem}
.pg-empty{display:block;text-align:center;padding:50px 20px;color:var(--muted);border:1px dashed var(--line-2);border-radius:var(--radius)}
.team-cta{padding:36px 30px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px}
.team-cta h2{font-size:clamp(1.5rem,3vw,2.1rem);font-weight:800;margin:12px 0 8px}
.team-cta p{color:var(--muted);max-width:620px}
@media (max-width:640px){.bk-grid .bk-card{flex:1 1 100%}.tm-grid{gap:12px}.tm-grid .tm-card{flex:1 1 calc(50% - 6px);min-width:0;padding:16px 10px 18px}.tm-photo{width:100px;height:100px}.tm-card h3{font-size:1rem}.tm-role{font-size:.66rem}.pg-hero{padding:110px 0 20px}.join{padding:34px 20px}.team-cta{padding:28px 20px}.art-share{margin-left:0}}
</style>`;

const fmtDate = (iso, lang) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }); } catch { return ''; }
};
const pairEl = (i18n, tag, cls, p) => el(i18n, tag, cls, p[0], p[1]);
const placeholder = (title) => `<div class="a-ph"><span>${esc(title)}</span></div>`;

function articleCard(a, i18n) {
  const bnCls = a.lang === 'bn' ? ' bn' : '';
  const meta = [
    `<span>${esc(fmtDate(a.published_at, 'en'))}</span>`,
    a.read_minutes ? `<span><span${i18n.attr(`${bnDigits(a.read_minutes)} ${P.minRead[1]}`)}>${a.read_minutes} ${P.minRead[0]}</span></span>` : '',
    `<b>${esc(a.author_name)}</b>`,
  ].filter(Boolean).join('');
  return `      <a class="card a-card rv" href="/articles/${esc(a.slug)}">
        <div class="a-img">${a.coverUrl ? `<img src="${esc(a.coverUrl)}" alt="${esc(a.title)}" loading="lazy" decoding="async">` : placeholder(a.title)}</div>
        <div class="a-body">
          ${a.category ? `<span class="a-cat">${esc(a.category)}</span>` : ''}
          <h3 class="${bnCls.trim()}" lang="${esc(a.lang)}">${esc(a.title)}</h3>
          ${a.excerpt ? `<p class="${bnCls.trim()}" lang="${esc(a.lang)}">${esc(a.excerpt)}</p>` : ''}
          <div class="a-meta">${meta}</div>
        </div>
      </a>`;
}

// Homepage: latest 3 articles.
function articlesTeaser(c, i18n, sec) {
  const btns = (sec.content.buttons || []).map((b) => button(i18n, b)).join('\n');
  return `<!-- ============ ARTICLES ============ -->
<section class="sec" id="articles" style="padding-top:40px">
  <div class="wrap">
${sectionHead(i18n, sec)}
    <div class="a-grid">
${c.articles.slice(0, 3).map((a) => articleCard(a, i18n)).join('\n')}
    </div>
${btns ? `    <div class="c-more rv">${btns}</div>` : ''}
  </div>
</section>
`;
}

// Homepage: "Meet Our Central Executives" call-to-action.
function teamTeaser(i18n, sec) {
  const btns = (sec.content.buttons || []).map((b) => button(i18n, b, '', ARROW_RIGHT)).join('\n');
  return `<!-- ============ TEAM ============ -->
<section class="sec" id="team" style="padding-top:20px">
  <div class="wrap">
    <div class="card team-cta rv">
      <div>
        ${kicker(i18n, f(sec, 'kicker'))}
        ${el(i18n, 'h2', '', f(sec, 'heading').en, f(sec, 'heading').bn)}
        ${f(sec, 'intro').en ? el(i18n, 'p', '', f(sec, 'intro').en, f(sec, 'intro').bn) : ''}
      </div>
      <div class="hero-cta">${btns}</div>
    </div>
  </div>
</section>
`;
}

function pageDoc(c, i18n, { origin, noindex, path, title, titleBn, description = '', image, ld, body }) {
  const s = c.settings;
  const parts = [`<div class="progress" id="progress"></div>
<div class="bg-fx" aria-hidden="true"><div class="grid"></div><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>
`, header(c, i18n, false, null, path), '\n<main id="top">', body, '</main>\n', footer(c, i18n, false)];
  return documentHtml({
    settings: s,
    meta: meta({ title: `${title} — ${s.site_name}`, description, url: origin + path, image: image || s.ogImageUrl, noindex,
      extra: ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : '' }),
    extraStyle: COURSE_STYLE + PAGE_STYLE,
    body: parts.join('\n'),
    bn: { _title: `${titleBn || title} — ${s.site_name}`, _search: '', ...i18n.dict },
  });
}

function pageHead(i18n, kick, heading, intro) {
  return `<section class="hero pg-hero">
  <div class="wrap">
    ${kicker(i18n, pair(...kick), 'kicker rv')}
    ${el(i18n, 'h1', 'rv', heading[0], heading[1])}
    ${el(i18n, 'p', 'lead rv', intro[0], intro[1])}
  </div>
</section>`;
}

// WhatsApp + email call-to-action box (Team "join us", Articles "publish yours").
function ctaBox(c, i18n, { id, heading, text, wa, mail }) {
  const s = c.settings;
  const email = EMAIL_OK.test(s.contact_email || '') ? s.contact_email : null;
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent(mail[1])}&body=${encodeURIComponent(mail[2])}` : null;
  return `<section class="sec" id="${id}" style="padding-top:20px">
  <div class="wrap">
    <div class="card join rv">
      ${el(i18n, 'h2', '', heading[0], heading[1])}
      ${el(i18n, 'p', '', text[0], text[1])}
      <div class="hero-cta">
        ${s.whatsapp_number ? `<a class="btn btn-primary" href="${esc(waUrl(s, wa[1]))}" target="_blank" rel="noopener"${i18n.attr(wa[0][1])}>${wa[0][0]}</a>` : ''}
        ${mailto ? `<a class="btn btn-ghost" href="${esc(mailto)}"${i18n.attr(mail[0][1])}>${mail[0][0]}</a>` : ''}
      </div>
    </div>
  </div>
</section>`;
}
const writeBox = (c, i18n) => ctaBox(c, i18n, { id: 'write', heading: P.writeHeading, text: P.writeBody, wa: [P.writeWa, WRITE_WA], mail: [P.writeMail, WRITE_SUBJECT, WRITE_BODY] });

export function renderArticles(c, { origin, noindex }) {
  const i18n = new I18n();
  const body = `${pageHead(i18n, P.articles, P.articlesHeading, P.articlesIntro)}
<section class="sec" style="padding-top:10px">
  <div class="wrap">
${c.articles.length ? `    <div class="a-grid">\n${c.articles.map((a) => articleCard(a, i18n)).join('\n')}\n    </div>` : `    ${pairEl(i18n, 'p', 'pg-empty', P.noArticles)}`}
  </div>
</section>
${writeBox(c, i18n)}`;
  return pageDoc(c, i18n, { origin, noindex, path: '/articles', title: P.articles[0], titleBn: P.articles[1], description: P.articlesIntro[0], body });
}

// Counts one view per browser session (POST /api/view), and the Share button.
const ARTICLE_SCRIPT = (slug) => `<script>
(function(){
  var slug=${JSON.stringify(slug)};
  try{if(!sessionStorage.getItem('mvd-v-'+slug)){sessionStorage.setItem('mvd-v-'+slug,'1');
    fetch('/api/view',{method:'POST',headers:{'Content-Type':'text/plain'},body:slug,keepalive:true}).catch(function(){});}}catch(e){}
  var b=document.getElementById('shareBtn');if(!b)return;
  b.addEventListener('click',function(){
    var d={title:document.title,url:location.href};
    if(navigator.share){navigator.share(d).catch(function(){});return;}
    if(navigator.clipboard){navigator.clipboard.writeText(location.href).then(function(){var t=b.textContent;b.textContent=b.dataset.copied;setTimeout(function(){b.textContent=t;},1800);});}
  });
})();
</script>`;

// Small line icons for article meta (emoji like 📅 render as a fixed "July 17" on phones).
const MI = (d) => `<svg class="mi" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_DATE = MI('<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>');
const ICON_TIME = MI('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const ICON_VIEWS = MI('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');

export function renderArticle(c, a, { origin, noindex }) {
  const i18n = new I18n();
  const s = c.settings;
  const bn = a.lang === 'bn';
  const views = Number(a.view_count) || 0;
  const meta = [
    `<span>${ICON_DATE} ${esc(fmtDate(a.published_at, 'en'))}</span>`,
    a.read_minutes ? `<span>${ICON_TIME} <span${i18n.attr(`${bnDigits(a.read_minutes)} ${P.minRead[1]}`)}>${a.read_minutes} ${P.minRead[0]}</span></span>` : '',
    views ? `<span>${ICON_VIEWS} <span${i18n.attr(`${bnDigits(views)} ${P.views[1]}`)}>${views.toLocaleString('en-US')} ${P.views[0]}</span></span>` : '',
    `<span class="by"><span${i18n.attr(P.writtenBy[1])}>${P.writtenBy[0]}</span> <b>${esc(a.author_name)}</b></span>`,
    `<button class="art-share" id="shareBtn" type="button" data-copied="${esc(P.copied[0])}"${i18n.attr(P.share[1])}>${P.share[0]}</button>`,
  ].filter(Boolean).join('\n      ');
  const body = `<section class="hero pg-hero" style="padding-bottom:10px">
  <div class="wrap">
    <article class="art">
      <a class="back" href="/articles">← <span${i18n.attr(P.backArticles[1])}>${P.backArticles[0]}</span></a><br>
      ${a.category ? `<span class="kicker"><i></i>${esc(a.category)}</span>` : ''}
      <h1 class="${bn ? 'bn' : ''}" lang="${esc(a.lang)}">${esc(a.title)}</h1>
      ${a.excerpt ? `<p class="lead${bn ? ' bn' : ''}" lang="${esc(a.lang)}">${esc(a.excerpt)}</p>` : ''}
      <div class="art-meta">
      ${meta}
      </div>
      ${a.coverUrl ? `<div class="art-cover"><img src="${esc(a.coverUrl)}" alt="${esc(a.title)}"></div>` : ''}
      <div class="art-body${bn ? ' bn' : ''}" lang="${esc(a.lang)}">
${articleHtml(a.body, (p) => c.pathUrl(p))}
      </div>
    </article>
  </div>
</section>
${writeBox(c, i18n)}
${ARTICLE_SCRIPT(a.slug)}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.excerpt || undefined,
    datePublished: a.published_at, author: { '@type': 'Person', name: a.author_name },
    publisher: { '@type': 'Organization', name: s.site_name }, ...(a.coverUrl ? { image: a.coverUrl } : {}),
  };
  return pageDoc(c, i18n, { origin, noindex, path: `/articles/${a.slug}`, title: a.title, description: a.excerpt || '', image: a.coverUrl, ld, body });
}

export function renderArticleNotFound(c, { origin }) {
  const i18n = new I18n();
  const body = `<section class="hero pg-hero"><div class="wrap">
    ${el(i18n, 'h1', '', P.articleNotFound[0], P.articleNotFound[1])}
    ${el(i18n, 'p', 'lead', P.articleNotFoundBody[0], P.articleNotFoundBody[1])}
    <a class="btn btn-primary" href="/articles"${i18n.attr(P.backArticles[1])}>${P.backArticles[0]}</a>
  </div></section>`;
  return pageDoc(c, i18n, { origin, noindex: true, path: '/articles', title: P.articleNotFound[0], titleBn: P.articleNotFound[1], body });
}

function teamCard(t, i18n) {
  const photo = t.photoUrl ? `<img src="${esc(t.photoUrl)}" alt="${esc(t.name)}" loading="lazy" decoding="async">` : `<div class="mono" aria-hidden="true">${esc(initials(t.name))}</div>`;
  return `      <article class="card tm-card rv">
        <div class="tm-photo">${photo}</div>
        <h3>${esc(t.name)}</h3>
        ${el(i18n, 'span', 'tm-role', t.designation, t.designation_bn || '')}
        ${t.college || t.college_bn ? el(i18n, 'p', '', t.college || t.college_bn, t.college && t.college_bn ? t.college_bn : '') : ''}
      </article>`;
}

export function renderTeam(c, { origin, noindex }) {
  const i18n = new I18n();
  const body = `${pageHead(i18n, P.team, P.teamHeading, P.teamIntro)}
<section class="sec" style="padding-top:10px">
  <div class="wrap">
${c.team.length ? `    <div class="tm-grid">\n${c.team.map((t) => teamCard(t, i18n)).join('\n')}\n    </div>` : `    ${pairEl(i18n, 'p', 'pg-empty', P.noTeam)}`}
  </div>
</section>
${ctaBox(c, i18n, { id: 'join', heading: P.joinHeading, text: P.joinBody, wa: [P.joinWa, JOIN_WA], mail: [P.joinMail, JOIN_SUBJECT, JOIN_BODY] })}`;
  return pageDoc(c, i18n, { origin, noindex, path: '/team', title: P.team[0], titleBn: P.team[1], description: P.teamIntro[0], body });
}

function bookCard(b, i18n) {
  const type = b.book_type === 'online' ? P.online : P.offline;
  const link = safeUrl(b.link_url, '');
  return `      <article class="card bk-card rv" data-type="${b.book_type === 'online' ? 'online' : 'offline'}">
        <div class="bk-cover">${b.coverUrl ? `<img src="${esc(b.coverUrl)}" alt="${esc(b.title)}" loading="lazy" decoding="async">` : placeholder(b.title)}${el(i18n, 'span', 'bk-type', type[0], type[1])}</div>
        <div class="bk-body">
          <h3>${esc(b.title)}</h3>
          ${b.author ? `<span class="bk-sub"><span${i18n.attr(P.by[1])}>${P.by[0]}</span> ${esc(b.author)}</span>` : ''}
          ${b.mentor_name ? `<span class="bk-sub"><span${i18n.attr(P.mentor[1])}>${P.mentor[0]}</span>: ${esc(b.mentor_name)}</span>` : ''}
          ${b.description ? `<p class="desc">${inline(b.description)}</p>` : ''}
          <div class="bk-foot">
            ${b.price ? `<span class="bk-price">${esc(b.price)}</span>` : '<span></span>'}
            ${link ? `<a class="btn btn-primary" href="${esc(link)}" target="_blank" rel="noopener">${esc(b.link_label || P.view[0])}</a>` : ''}
          </div>
        </div>
      </article>`;
}

const BOOKS_SCRIPT = `<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.bk-tabs button')),cards=[].slice.call(document.querySelectorAll('.bk-card'));
  tabs.forEach(function(t){t.addEventListener('click',function(){
    tabs.forEach(function(b){var on=b===t;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);});
    cards.forEach(function(c){c.classList.toggle('hide',t.dataset.t!=='all'&&c.dataset.type!==t.dataset.t);});
  });});
})();
</script>`;

export function renderBooks(c, { origin, noindex }) {
  const i18n = new I18n();
  const tab = (t, p, on) => `<button type="button" data-t="${t}" role="tab" aria-selected="${on}"${on ? ' class="active"' : ''}${i18n.attr(p[1])}>${p[0]}</button>`;
  const body = `${pageHead(i18n, P.books, P.booksHeading, P.booksIntro)}
<section class="sec" style="padding-top:10px">
  <div class="wrap">
${c.books.length ? `    <div class="bk-tabs" role="tablist" aria-label="Book type">${tab('all', P.all, true)}${tab('online', P.online, false)}${tab('offline', P.offline, false)}</div>
    <div class="bk-grid">\n${c.books.map((b) => bookCard(b, i18n)).join('\n')}\n    </div>` : `    ${pairEl(i18n, 'p', 'pg-empty', P.noBooks)}`}
  </div>
</section>
${c.books.length ? BOOKS_SCRIPT : ''}`;
  return pageDoc(c, i18n, { origin, noindex, path: '/books', title: P.books[0], titleBn: P.books[1], description: P.booksIntro[0], body });
}
