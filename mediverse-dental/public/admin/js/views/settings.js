// Site settings: contact (WhatsApp), social links, footer text, site SEO, share image, logos.
// Uses the existing site_settings (single row) and social_links tables.
import { h, put, field, text, area, select, checkbox, toast } from '../ui.js';
import { sb, q } from '../db.js';
import { tracker, saveBar, formError, imageSlot, repeater } from '../forms.js';

const PLATFORMS = [['facebook', 'Facebook'], ['youtube', 'YouTube'], ['telegram', 'Telegram'], ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['tiktok', 'TikTok'], ['x', 'X (Twitter)'], ['website', 'Website'], ['email', 'Email'], ['phone', 'Phone']];
const URL_HINT = { email: 'mailto:name@example.com', phone: 'tel:+8801XXXXXXXXX', whatsapp: 'https://wa.me/8801XXXXXXXXX' };
const SAFE_URL = /^(https?:\/\/[^\s<>"'`]+|mailto:[^\s<>"'`]+|tel:\+?[0-9 ()-]{3,20})$/i;
const WA_NUMBER = /^\+[0-9]{8,15}$/;

export const waLink = (number, message) => `https://wa.me/${String(number).replace(/[^0-9]/g, '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

export async function render({ root, setTitle, setDirtyCheck }) {
  setTitle('Settings');
  const [rows, socials] = await Promise.all([
    q(sb.from('site_settings').select('*').limit(1)),
    q(sb.from('social_links').select('*').order('sort_order')),
  ]);
  const s = rows[0];
  if (!s) { put(root, h('div', { class: 'empty' }, 'Site settings are missing in the database.')); return; }
  const mediaIds = [s.logo_dark_media_id, s.logo_light_media_id, s.og_image_media_id].filter(Boolean);
  const media = mediaIds.length ? await q(sb.from('media').select('*').in('id', mediaIds)) : [];
  const byId = (id) => media.find((m) => m.id === id) || null;

  const f = {
    site_name: text(s.site_name, { maxlength: 100 }),
    primary_cta_url: h('input', { type: 'url', value: s.primary_cta_url || '', inputmode: 'url', placeholder: 'https://mediversebd.com' }),
    whatsapp_number: text(s.whatsapp_number, { inputmode: 'tel', placeholder: '+8801XXXXXXXXX', maxlength: 16 }),
    whatsapp_message_en: area(s.whatsapp_message_en, { maxlength: 300, rows: 2 }),
    footer_tagline_en: text(s.footer_tagline_en, { maxlength: 200 }),
    footer_tagline_bn: text(s.footer_tagline_bn, { maxlength: 200, lang: 'bn' }),
    copyright_en: text(s.copyright_en, { maxlength: 200 }),
    copyright_bn: text(s.copyright_bn, { maxlength: 200, lang: 'bn' }),
    seo_title_en: text(s.seo_title_en, { maxlength: 120 }),
    seo_title_bn: text(s.seo_title_bn, { maxlength: 120, lang: 'bn' }),
    seo_description_en: area(s.seo_description_en, { maxlength: 300, rows: 3 }),
    seo_description_bn: area(s.seo_description_bn, { maxlength: 300, rows: 3, lang: 'bn' }),
  };
  for (const [k, el] of Object.entries(f)) el.id ||= k;

  const logoDark = imageSlot({ media: byId(s.logo_dark_media_id), folder: 'logos', title: 'Logo for dark theme (white logo)', allowRemove: false });
  const logoLight = imageSlot({ media: byId(s.logo_light_media_id), folder: 'logos', title: 'Logo for light theme (dark/blue logo)', allowRemove: false });
  const ogImage = imageSlot({ media: byId(s.og_image_media_id), folder: 'images', title: 'Share image (Facebook / WhatsApp preview)' });

  const social = repeater({
    items: socials,
    addLabel: '+ Add social / contact link',
    max: 20,
    make: (it = { platform: 'facebook', is_visible: true, show_in_header: true, show_in_footer: true, show_in_contact: true }) => {
      const platform = select(it.platform, PLATFORMS, { 'aria-label': 'Platform' });
      const url = text(it.url, { maxlength: 2048, inputmode: 'url', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Link', placeholder: URL_HINT[it.platform] || 'https://…' });
      platform.addEventListener('change', () => { url.placeholder = URL_HINT[platform.value] || 'https://…'; });
      const le = text(it.label_en, { maxlength: 60, 'aria-label': 'Name (English)' });
      const lb = text(it.label_bn, { maxlength: 60, lang: 'bn', 'aria-label': 'Name (Bangla)' });
      const se = text(it.subtitle_en, { maxlength: 80, 'aria-label': 'Small text (English)' });
      const sbn = text(it.subtitle_bn, { maxlength: 80, lang: 'bn', 'aria-label': 'Small text (Bangla)' });
      const vis = checkbox('Show on website', it.is_visible);
      const hd = checkbox('Mobile menu', it.show_in_header);
      const ft = checkbox('Footer', it.show_in_footer);
      const ct = checkbox('Contact section', it.show_in_contact);
      return {
        el: h('div', {},
          h('div', { class: 'grid2' }, field('Platform', platform), field('Link', url, 'Email: mailto:…  ·  Phone: tel:+880…')),
          h('div', { class: 'grid2' }, field('Name (English)', le), field('Name (বাংলা)', lb)),
          h('div', { class: 'grid2' }, field('Small text (English)', se, 'e.g. 100+ free classes'), field('Small text (বাংলা)', sbn)),
          h('div', { class: 'checks' }, vis.el, hd.el, ft.el, ct.el)),
        read: () => ({ id: it.id, platform: platform.value, url: url.value.trim(), label_en: le.value.trim(), label_bn: lb.value.trim(),
          subtitle_en: se.value.trim(), subtitle_bn: sbn.value.trim(), is_visible: vis.input.checked,
          show_in_header: hd.input.checked, show_in_footer: ft.input.checked, show_in_contact: ct.input.checked }),
      };
    },
  });

  const read = () => ({
    ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])),
    logo_dark: logoDark.get()?.id || null, logo_light: logoLight.get()?.id || null, og: ogImage.get()?.id || null,
    social: social.read(),
    ...readTheme(),
  });

  // ---- theme, colours, fonts, analytics (needs the 20261004 SQL; hidden until it has run)
  const hasTheme = 'theme_default' in s;
  const DEF = { cyan: '#35E0FF', blue: '#3D8BFF', violet: '#8B6CFF' };
  const PRESETS = {
    default: ['MediVerse (original)', DEF.cyan, DEF.blue, DEF.violet],
    ocean: ['Ocean blue', '#22D3EE', '#0EA5E9', '#2563EB'],
    emerald: ['Emerald green', '#34D399', '#10B981', '#0EA5E9'],
    sunset: ['Sunset', '#FBBF24', '#F97316', '#EC4899'],
    royal: ['Royal purple', '#C084FC', '#8B5CF6', '#6366F1'],
    rose: ['Rose', '#FDA4AF', '#F43F5E', '#A855F7'],
  };
  const th = {
    theme_default: select(s.theme_default || 'dark', [['dark', 'Dark (original)'], ['light', 'Light']], { id: 'theme_default' }),
    color_cyan: h('input', { type: 'color', value: s.color_cyan || DEF.cyan, id: 'color_cyan' }),
    color_blue: h('input', { type: 'color', value: s.color_blue || DEF.blue, id: 'color_blue' }),
    color_violet: h('input', { type: 'color', value: s.color_violet || DEF.violet, id: 'color_violet' }),
    font_en: select(s.font_en || 'Plus Jakarta Sans', ['Plus Jakarta Sans', 'Poppins', 'Inter', 'Montserrat', 'Nunito', 'Lato'].map((x) => [x, x === 'Plus Jakarta Sans' ? `${x} (original)` : x]), { id: 'font_en' }),
    font_bn: select(s.font_bn || 'Hind Siliguri', ['Hind Siliguri', 'Noto Sans Bengali', 'Baloo Da 2', 'Anek Bangla', 'Tiro Bangla'].map((x) => [x, x === 'Hind Siliguri' ? `${x} (original)` : x]), { id: 'font_bn' }),
    ga4_measurement_id: text(s.ga4_measurement_id, { id: 'ga4_measurement_id', placeholder: 'G-XXXXXXXXXX', autocapitalize: 'characters', spellcheck: 'false', maxlength: 22 }),
    gtm_container_id: text(s.gtm_container_id, { id: 'gtm_container_id', placeholder: 'GTM-XXXXXXX', autocapitalize: 'characters', spellcheck: 'false', maxlength: 16 }),
  };
  const preset = select('', [['', 'Choose a ready-made colour set…'], ...Object.entries(PRESETS).map(([k, p]) => [k, p[0]])], { id: 'preset', 'aria-label': 'Colour preset' });
  const swatch = h('div', { class: 'swatch' });
  const drawSwatch = () => { swatch.style.background = `linear-gradient(120deg,${th.color_cyan.value} 0%,${th.color_blue.value} 45%,${th.color_violet.value} 100%)`; };
  preset.addEventListener('change', () => {
    const p = PRESETS[preset.value];
    if (!p) return;
    [th.color_cyan.value, th.color_blue.value, th.color_violet.value] = p.slice(1);
    drawSwatch();
    form.dispatchEvent(new Event('input'));
  });
  for (const c of [th.color_cyan, th.color_blue, th.color_violet]) c.addEventListener('input', drawSwatch);
  drawSwatch();
  // Font preview (Google Fonts stylesheet is allowed by the admin CSP).
  const preview = h('p', { class: 'font-preview' }, 'MediVerse Dental — Future Dentistry ', h('span', { lang: 'bn' }, 'ডেন্টিস্ট্রির ভবিষ্যৎ'));
  const loadFont = (fam) => {
    const href = `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, '+')}:wght@400;700&display=swap`;
    if (!document.querySelector(`link[href="${href}"]`)) document.head.append(h('link', { rel: 'stylesheet', href }));
  };
  const drawFont = () => {
    loadFont(th.font_en.value); loadFont(th.font_bn.value);
    preview.style.fontFamily = `'${th.font_en.value}', sans-serif`;
    preview.lastChild.style.fontFamily = `'${th.font_bn.value}', sans-serif`;
  };
  th.font_en.addEventListener('change', drawFont); th.font_bn.addEventListener('change', drawFont);
  drawFont();
  const readTheme = () => (hasTheme ? Object.fromEntries(Object.entries(th).map(([k, el]) => [k, el.value])) : {});

  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const needSql = h('div', { class: 'form-error' }, 'Theme, colours, fonts and Google Analytics need one small database update first. Ask your developer to run the “theme & analytics” SQL in Supabase, then reload this page.');
  const panels = {
    contact: ['Contact & social', [
      h('fieldset', {}, h('legend', {}, 'WhatsApp & contact'),
        field('WhatsApp number', f.whatsapp_number, 'With country code, e.g. +8801726415926. Used by every WhatsApp button.'),
        field('Default WhatsApp message (English)', f.whatsapp_message_en, 'Course pages add the course name automatically.'),
        field('Main Mediverse platform link', f.primary_cta_url)),
      h('fieldset', {}, h('legend', {}, 'Social media & contact links'),
        h('p', { class: 'muted small rep-label' }, 'Facebook, YouTube, Telegram, WhatsApp, email, phone… Untick “Show on website” to hide one without deleting it.'),
        social.el)]],
    look: ['Theme & logo', [
      hasTheme ? h('fieldset', {}, h('legend', {}, 'Colours'),
        field('Ready-made colour sets', preset), swatch,
        h('div', { class: 'grid3' }, field('Colour 1 (light accent)', th.color_cyan), field('Colour 2 (main)', th.color_blue), field('Colour 3 (deep accent)', th.color_violet)),
        h('p', { class: 'muted small' }, 'These colours make the gradient on buttons, headings and highlights. Choose “MediVerse (original)” to go back.')) : needSql,
      hasTheme ? h('fieldset', {}, h('legend', {}, 'Fonts & theme'),
        h('div', { class: 'grid2' }, field('English font', th.font_en), field('Bangla font', th.font_bn)), preview,
        field('Theme for first-time visitors', th.theme_default, 'Visitors can still switch with the moon/sun button.')) : null,
      h('fieldset', {}, h('legend', {}, 'Logos'),
        h('p', { class: 'muted small rep-label' }, 'Dark theme logo (white):'), logoDark.el,
        h('p', { class: 'muted small rep-label' }, 'Light theme logo (blue):'), logoLight.el)]],
    seo: ['SEO', [
      h('fieldset', {}, h('legend', {}, 'SEO (Google & sharing)'),
        field('Site name', f.site_name),
        h('div', { class: 'grid2' }, field('Homepage title (English)', f.seo_title_en, 'Shown in Google results and the browser tab. ~60 characters.'), field('Homepage title (বাংলা)', f.seo_title_bn)),
        h('div', { class: 'grid2' }, field('Homepage description (English)', f.seo_description_en, 'Shown under the title in Google. ~155 characters.'), field('Homepage description (বাংলা)', f.seo_description_bn)),
        h('p', { class: 'muted small rep-label' }, 'Share image (shown when the link is shared on Facebook/WhatsApp; 1200×630 is ideal):'), ogImage.el,
        h('p', { class: 'muted small' }, 'Each course has its own SEO fields on its edit page. Note: the staging site is always hidden from Google on purpose.'))]],
    analytics: ['Analytics', [
      hasTheme ? h('fieldset', {}, h('legend', {}, 'Google Analytics & Tag Manager'),
        field('Google Analytics 4 — Measurement ID', th.ga4_measurement_id, 'Looks like G-XXXXXXXXXX (GA4 → Admin → Data streams).'),
        field('Google Tag Manager — Container ID', th.gtm_container_id, 'Looks like GTM-XXXXXXX. Use GA4 or GTM, usually not both.'),
        h('p', { class: 'muted small' }, 'Only the ID is saved. The website adds Google’s official code itself — pasting code is not allowed, so a hacked account cannot inject harmful scripts.')) : needSql]],
    footer: ['Footer', [
      h('fieldset', {}, h('legend', {}, 'Footer'),
        h('div', { class: 'grid2' }, field('Footer tagline (English)', f.footer_tagline_en), field('Footer tagline (বাংলা)', f.footer_tagline_bn)),
        h('div', { class: 'grid2' }, field('Copyright (English)', f.copyright_en), field('Copyright (বাংলা)', f.copyright_bn)))]],
  };
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const panelEls = {};
  for (const [key, [label, kids]] of Object.entries(panels)) {
    panelEls[key] = h('div', { class: 'tab-panel', dataset: { panel: key } }, kids);
    tabBar.append(h('button', { type: 'button', class: 'tab', role: 'tab', dataset: { tab: key }, onclick: () => showTab(key) }, label));
  }
  const showTab = (key) => {
    for (const [k, el] of Object.entries(panelEls)) el.classList.toggle('hidden', k !== key);
    for (const b of tabBar.children) b.setAttribute('aria-selected', String(b.dataset.tab === key));
    try { sessionStorage.setItem('mvd.settingsTab', key); } catch { /* ignore */ }
  };
  const form = h('form', { novalidate: true, id: 'settingsForm' }, err, tabBar, Object.values(panelEls));
  let first = 'contact';
  try { first = panels[sessionStorage.getItem('mvd.settingsTab')] ? sessionStorage.getItem('mvd.settingsTab') : 'contact'; } catch { /* ignore */ }
  showTab(first);
  const t = tracker(form, read, setDirtyCheck);
  let savedSocial = socials.map((x) => x.id);

  async function save() {
    formError(err, '');
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    const v = read();
    const wa = v.whatsapp_number.replace(/[\s-]/g, '');
    if (wa && !WA_NUMBER.test(wa)) return (showTab('contact'), bad(f.whatsapp_number, 'WhatsApp number must start with + and the country code, e.g. +8801726415926.'));
    if (v.primary_cta_url.trim() && !/^https:\/\/[^\s<>"'`]+$/i.test(v.primary_cta_url.trim())) return bad(f.primary_cta_url, 'The platform link must start with https://');
    if (!v.site_name.trim()) return bad(f.site_name, 'Site name is required.');
    for (const x of v.social) {
      if (!SAFE_URL.test(x.url)) return formError(err, `Social link “${x.label_en || x.platform}”: the link must start with https://, mailto: or tel:`);
    }
    const n = (x) => (x.trim() ? x.trim() : null);
    const waChanged = wa !== (s.whatsapp_number || '') || v.whatsapp_message_en.trim() !== (s.whatsapp_message_en || '');
    const row = {
      site_name: v.site_name.trim(), primary_cta_url: n(v.primary_cta_url), whatsapp_number: wa || null, whatsapp_message_en: n(v.whatsapp_message_en),
      footer_tagline_en: n(v.footer_tagline_en), footer_tagline_bn: n(v.footer_tagline_bn), copyright_en: n(v.copyright_en), copyright_bn: n(v.copyright_bn),
      seo_title_en: n(v.seo_title_en), seo_title_bn: n(v.seo_title_bn), seo_description_en: n(v.seo_description_en), seo_description_bn: n(v.seo_description_bn),
      logo_dark_media_id: v.logo_dark, logo_light_media_id: v.logo_light, og_image_media_id: v.og,
    };
    if (hasTheme) {
      const ga = v.ga4_measurement_id.trim().toUpperCase(), gtm = v.gtm_container_id.trim().toUpperCase();
      if (ga && !/^G-[A-Z0-9]{4,20}$/.test(ga)) { showTab('analytics'); return bad(th.ga4_measurement_id, 'Google Analytics ID must look like G-XXXXXXXXXX (only the ID, not the code).'); }
      if (gtm && !/^GTM-[A-Z0-9]{4,12}$/.test(gtm)) { showTab('analytics'); return bad(th.gtm_container_id, 'Tag Manager ID must look like GTM-XXXXXXX (only the ID, not the code).'); }
      const col = (k, d) => (v[k].toUpperCase() === d.toUpperCase() ? null : v[k].toUpperCase());
      const colors = { color_cyan: col('color_cyan', DEF.cyan), color_blue: col('color_blue', DEF.blue), color_violet: col('color_violet', DEF.violet) };
      if (!colors.color_cyan && !colors.color_blue && !colors.color_violet) Object.keys(colors).forEach((k) => { colors[k] = null; });
      Object.assign(row, colors, {
        theme_default: v.theme_default,
        font_en: v.font_en === 'Plus Jakarta Sans' ? null : v.font_en,
        font_bn: v.font_bn === 'Hind Siliguri' ? null : v.font_bn,
        ga4_measurement_id: ga || null, gtm_container_id: gtm || null,
      });
    }
    const saved = await q(sb.from('site_settings').update(row).eq('id', true).select().single());

    // WhatsApp links in the social list follow the WhatsApp number/message.
    // So do WhatsApp buttons inside homepage sections (only their url changes).
    if (waChanged && saved.whatsapp_number) {
      const link = waLink(saved.whatsapp_number, saved.whatsapp_message_en);
      for (const x of v.social) if (x.platform === 'whatsapp' && /^https:\/\/wa\.me\//i.test(x.url)) x.url = link;
      for (const sec of await q(sb.from('page_sections').select('id,content'))) {
        const btns = Array.isArray(sec.content?.buttons) ? sec.content.buttons : [];
        if (!btns.some((b) => /^https:\/\/wa\.me\//i.test(b?.url || ''))) continue;
        const content = { ...sec.content, buttons: btns.map((b) => (/^https:\/\/wa\.me\//i.test(b?.url || '') ? { ...b, url: link } : b)) };
        await q(sb.from('page_sections').update({ content }).eq('id', sec.id).select('id').single());
      }
    }
    const keep = v.social.filter((x) => x.id).map((x) => x.id);
    const removed = savedSocial.filter((id) => !keep.includes(id));
    if (removed.length) await q(sb.from('social_links').delete().in('id', removed));
    const out = v.social.map((x, i) => {
      const r = { ...x, label_en: n(x.label_en), label_bn: n(x.label_bn), subtitle_en: n(x.subtitle_en), subtitle_bn: n(x.subtitle_bn), sort_order: (i + 1) * 10 };
      if (!r.id) delete r.id;
      return r;
    });
    for (const r of out) {
      if (r.id) await q(sb.from('social_links').update(r).eq('id', r.id).select('id').single());
      else await q(sb.from('social_links').insert(r).select('id').single());
    }
    Object.assign(s, saved);
    toast('Settings saved.');
    // Reload so new link rows get their ids and the form reflects what was stored.
    savedSocial = (await q(sb.from('social_links').select('id'))).map((x) => x.id);
    t.reset();
    if (out.some((r) => !r.id) || waChanged) setTimeout(() => location.reload(), 600);
  }

  put(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Settings')),
    h('p', { class: 'muted lead' }, 'Contact info, social media, logos, SEO and footer. Changes show on the website within about 1 minute.'),
    form, saveBar(t, save));
}
