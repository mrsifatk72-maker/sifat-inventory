// Builds the homepage and course pages from database content.
// Markup mirrors src/template.html + src/build.py exactly (same classes, same
// structure) so the page looks identical to the current live site.
import { esc, inline, blocks, safeUrl } from './markup.js';
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
function header(c, i18n, onHome, wa = null) {
  const s = c.settings;
  const logos = `<img class="l-dark" src="${esc(s.logoDarkUrl)}" alt="${esc(s.site_name)}">
      <img class="l-light" src="${esc(s.logoLightUrl)}" alt="${esc(s.site_name)}">`;
  const links = c.nav.header.filter((n) => n.style === 'link')
    .map((n) => `      <a href="${esc(linkHref(n.url, onHome))}"${n.open_new_tab ? ' target="_blank" rel="noopener"' : ''}${i18n.attr(n.label_bn && inline(n.label_bn))}>${inline(n.label_en)}</a>`).join('\n');
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
${c.nav.mobile.filter((n) => n.style === 'link').map((n) => `    <li><a href="${esc(linkHref(n.url, onHome))}"${n.open_new_tab ? ' target="_blank" rel="noopener"' : ''}${i18n.attr(n.label_bn && inline(n.label_bn))}>${inline(n.label_en)}</a></li>`).join('\n')}
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

function mentorCard(m, i18n) {
  let media;
  if (m.avatar_style === 'photo' && m.photoUrl) {
    media = `<img src="${esc(m.photoUrl)}" alt="${esc(m.name)}" loading="lazy" decoding="async">`;
  } else if (m.avatar_style === 'hijab_icon') {
    media = `<div class="mono" role="img" aria-label="${esc(m.name)}">${HIJAB_SVG.replaceAll('{id}', 'hj' + initials(m.name).toLowerCase())}</div>`;
  } else {
    media = `<div class="mono" aria-hidden="true"><span>${esc(initials(m.name))}</span></div>`;
  }
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

  if (S.hero) {
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
  }

  if (S.about) {
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
  }

  if (S.courses) {
    const cs = S.courses;
    const more = (cs.content.buttons || [])[0];
    // Optional Undergraduate / Postgraduate switch (Admin → Homepage → Courses). Off = page unchanged.
    const levels = cs.content.show_level_switch === true;
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
  }

  if (S.mentors) {
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
  }

  if (S.stories) {
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
  }

  if (S.faq) {
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
  }

  out.push(contactSection(c, i18n));
  out.push('</main>\n');
  out.push(footer(c, i18n, true));

  const title = s.seo_title_en || s.site_name;
  return documentHtml({
    settings: s,
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
    const info = r.reviewer_info_en || r.reviewer_info_bn ? el(i18n, 'span', 'rv-info', r.reviewer_info_en || r.reviewer_info_bn, r.reviewer_info_bn && r.reviewer_info_en ? r.reviewer_info_bn : '') : '';
    return `      <div class="card tcard rv"><div class="rv-top">${starsHtml(r.rating)}${el(i18n, 'span', 'rv-word', label[0], label[1])}</div>${el(i18n, 'blockquote', '', textEn, textBn !== textEn ? textBn : '')}<div class="who"><span class="av">${esc(av)}</span><span><b style="color:var(--ink)">${who}</b>${info ? `<br>${info}` : ''}</span></div></div>`;
  }).join('\n');
  return `<section class="sec" id="reviews" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head rv">
      ${kicker(i18n, ui('reviewsKicker'))}
      <h2 class="rv-summary">${starsHtml(Math.round(avg))} <span${i18n.attr(summaryBn)}>${summaryEn}</span></h2>
    </div>
    <div class="t-grid">
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
.cp-info .lead{font-size:1.1rem;color:var(--muted);margin-bottom:28px}
.cp-info .hero-cta{justify-content:flex-start;margin-bottom:28px}
.cp-facts{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px}
.cp-facts .stat b{font-size:1.25rem}
.cp-details{padding:30px}
.cp-details p{color:var(--muted);margin-bottom:14px}
.cp-details p:last-child{margin-bottom:0}
.cp-details ul,.cp-list{list-style:none;display:grid;gap:10px;margin:0 0 14px}
.cp-details li,.cp-list li{padding-left:28px;position:relative;color:var(--muted)}
.cp-details li::before,.cp-list li::before{content:"✓";position:absolute;left:0;color:var(--cyan);font-weight:800}
.rv-stars{color:var(--amber);letter-spacing:2px}.rv-stars .off{opacity:.22}
.rv-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.rv-word{font-size:.82rem;font-weight:700;color:var(--muted)}
.rv-summary{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:clamp(1.3rem,3vw,1.8rem)!important}.rv-info{font-size:.82rem}
.cp-soon{display:inline-block;margin-left:10px;padding:5px 11px;border-radius:999px;font-size:.75rem;font-weight:800;background:var(--grad-warm);color:#1a0d00;vertical-align:middle}
@media (max-width:1024px){.cp-grid{grid-template-columns:1fr;gap:28px}.cp-flyer{position:static;max-width:520px}}
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

  if (course.mentors.length) {
    body.push(`<section class="sec" id="mentors" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head rv">
      ${kicker(i18n, ui('mentorKicker'))}
      ${el(i18n, 'h2', '', UI.mentorHeading[0], UI.mentorHeading[1])}
    </div>
    <div class="m-grid">
${course.mentors.map((m) => mentorCard(m, i18n)).join('\n')}
    </div>
  </div>
</section>
`);
  }

  if (course.reviews?.length) body.push(reviewsSection(course.reviews, i18n));

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
