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
  });

  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'settingsForm' }, err,
    h('fieldset', {}, h('legend', {}, 'WhatsApp & contact'),
      field('WhatsApp number', f.whatsapp_number, 'With country code, e.g. +8801726415926. Used by every WhatsApp button.'),
      field('Default WhatsApp message (English)', f.whatsapp_message_en, 'Course pages add the course name automatically.'),
      field('Main Mediverse platform link', f.primary_cta_url)),
    h('fieldset', {}, h('legend', {}, 'Social media & contact links'),
      h('p', { class: 'muted small rep-label' }, 'Facebook, YouTube, Telegram, WhatsApp, email, phone… Untick “Show on website” to hide one without deleting it.'),
      social.el),
    h('fieldset', {}, h('legend', {}, 'Logos'),
      h('p', { class: 'muted small rep-label' }, 'Dark theme logo (white):'), logoDark.el,
      h('p', { class: 'muted small rep-label' }, 'Light theme logo (blue):'), logoLight.el),
    h('fieldset', {}, h('legend', {}, 'SEO (Google & sharing)'),
      field('Site name', f.site_name),
      h('div', { class: 'grid2' }, field('Homepage title (English)', f.seo_title_en, 'Shown in Google results and the browser tab. ~60 characters.'), field('Homepage title (বাংলা)', f.seo_title_bn)),
      h('div', { class: 'grid2' }, field('Homepage description (English)', f.seo_description_en, 'Shown under the title in Google. ~155 characters.'), field('Homepage description (বাংলা)', f.seo_description_bn)),
      h('p', { class: 'muted small rep-label' }, 'Share image (shown when the link is shared on Facebook/WhatsApp; 1200×630 is ideal):'), ogImage.el,
      h('p', { class: 'muted small' }, 'Each course has its own SEO fields on its edit page. Note: the staging site is always hidden from Google on purpose.')),
    h('fieldset', {}, h('legend', {}, 'Footer'),
      h('div', { class: 'grid2' }, field('Footer tagline (English)', f.footer_tagline_en), field('Footer tagline (বাংলা)', f.footer_tagline_bn)),
      h('div', { class: 'grid2' }, field('Copyright (English)', f.copyright_en), field('Copyright (বাংলা)', f.copyright_bn))));
  const t = tracker(form, read, setDirtyCheck);
  let savedSocial = socials.map((x) => x.id);

  async function save() {
    formError(err, '');
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    const v = read();
    const wa = v.whatsapp_number.replace(/[\s-]/g, '');
    if (wa && !WA_NUMBER.test(wa)) return bad(f.whatsapp_number, 'WhatsApp number must start with + and the country code, e.g. +8801726415926.');
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
