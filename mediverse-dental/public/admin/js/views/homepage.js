// Homepage sections: edit the existing page_sections (English + Bangla text, buttons,
// show/hide). Only the fields that already exist are edited; every other key in the
// section's JSON is kept exactly as it was.
import { h, put, field, text, area, select, checkbox, toast } from '../ui.js';
import { sb, q } from '../db.js';
import { tracker, saveBar, formError, repeater } from '../forms.js';

const NAMES = { hero: 'Hero (top of page)', about: 'About', courses: 'Courses', mentors: 'Mentors', stories: 'Student stories', faq: 'FAQ', contact: 'Contact / final call-to-action' };
const LABELS = {
  kicker: ['Small label above the heading', false],
  heading: ['Heading', true],
  tagline: ['Tagline', false],
  lead: ['Intro paragraph', true],
  intro: ['Intro paragraph', true],
  body: ['Text', true],
  trust_line: ['Trust line', true],
  mission_heading: ['Mission heading', false],
  mission_body: ['Mission text', true],
  highlight_value: ['Highlight number', false],
  highlight_label: ['Highlight label', false],
  search_placeholder: ['Search box placeholder', false],
};
const URL_OK = /^(https?:\/\/[^\s<>"'`]+|mailto:[^\s<>"'`]+|tel:\+?[0-9 ()-]{3,20}|#[A-Za-z0-9_-]*|\/[^\s<>"'`]*)$/i;
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);

export async function render(ctx) {
  const [key] = ctx.params;
  return key ? edit(ctx, key) : list(ctx);
}

async function list({ root, setTitle }) {
  setTitle('Homepage');
  const rows = await q(sb.from('page_sections').select('id,key,is_visible,sort_order,content').eq('page', 'home').order('sort_order'));
  put(root, 
    h('div', { class: 'page-head' }, h('h1', {}, 'Homepage sections')),
    h('p', { class: 'muted lead' }, 'Edit the English and Bangla text of each homepage section. Changes show on the website within about 1 minute.'),
    h('div', { class: 'list', id: 'sectionList' }, rows.map((s) => h('a', { class: 'row', href: `/admin/homepage/${s.key}`, 'data-link': '' },
      h('div', { class: 'meta' }, h('b', {}, NAMES[s.key] || s.key), h('small', {}, plain(s.content?.en?.heading || s.content?.en?.kicker || ''))),
      h('div', { class: 'side-info' }, h('span', { class: `badge ${s.is_visible ? 'visible' : 'hidden'}` }, s.is_visible ? 'visible' : 'hidden'))))));
}

const plain = (s) => String(s || '').replace(/\[\[|\]\]|\*\*/g, '').replace(/\n/g, ' ');

async function edit({ root, setTitle, setDirtyCheck }, key) {
  const rows = await q(sb.from('page_sections').select('*').eq('page', 'home').eq('key', key).limit(1));
  if (!rows.length) {
    put(root, h('div', { class: 'empty' }, 'Section not found. ', h('a', { href: '/admin/homepage', 'data-link': '' }, 'Back')));
    return;
  }
  const s = rows[0];
  const content = isObj(s.content) ? s.content : {};
  const en = isObj(content.en) ? content.en : {};
  const bn = isObj(content.bn) ? content.bn : {};
  setTitle(NAMES[key] || key);

  // Every text key that exists in either language, in a stable order.
  const keys = [...new Set([...Object.keys(en), ...Object.keys(bn)])]
    .filter((k) => typeof (en[k] ?? bn[k] ?? '') === 'string')
    .sort((a, b) => (Object.keys(LABELS).indexOf(a) + 1 || 99) - (Object.keys(LABELS).indexOf(b) + 1 || 99));
  const inputs = {};
  const fields = keys.map((k) => {
    const [label, long] = LABELS[k] || [k.replace(/_/g, ' '), String(en[k] || '').length > 60];
    const mk = (v, lang) => (long ? area(v, { maxlength: 2000, lang, rows: 3, id: `${lang}_${k}` }) : text(v, { maxlength: 300, lang, id: `${lang}_${k}` }));
    inputs[k] = { en: mk(en[k], 'en'), bn: mk(bn[k], 'bn') };
    return h('div', { class: 'grid2' }, field(`${label} (English)`, inputs[k].en), field(`${label} (বাংলা)`, inputs[k].bn));
  });

  const hasButtons = Array.isArray(content.buttons);
  const buttons = hasButtons ? repeater({
    items: content.buttons,
    addLabel: '+ Add button',
    max: 4,
    make: (it = {}) => {
      const le = text(it.label_en, { maxlength: 60, 'aria-label': 'Button text (English)' });
      const lb = text(it.label_bn, { maxlength: 60, lang: 'bn', 'aria-label': 'Button text (Bangla)' });
      const url = text(it.url, { maxlength: 2048, inputmode: 'url', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Button link' });
      const style = select(it.style || 'primary', [['primary', 'Filled (gradient)'], ['ghost', 'Outline']], { 'aria-label': 'Button style' });
      const nt = checkbox('Open in a new tab', it.new_tab ?? /^https?:/i.test(it.url || ''));
      return {
        el: h('div', {}, h('div', { class: 'grid2' }, field('Button text (English)', le), field('Button text (বাংলা)', lb)),
          field('Link', url, 'https://… for other sites, or #courses / #mentors / #faq / #contact for this page'),
          h('div', { class: 'grid2' }, field('Style', style), nt.el)),
        read: () => ({ ...it, label_en: le.value.trim(), label_bn: lb.value.trim(), url: url.value.trim(), style: style.value, new_tab: nt.input.checked }),
      };
    },
  }) : null;
  const visible = checkbox('Show this section on the website', s.is_visible, { id: 'is_visible' });

  const read = () => ({
    visible: visible.input.checked,
    text: Object.fromEntries(keys.map((k) => [k, [inputs[k].en.value, inputs[k].bn.value]])),
    buttons: buttons ? buttons.read() : null,
  });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'sectionForm' }, err,
    h('fieldset', {}, h('legend', {}, 'Visibility'), visible.el),
    fields.length ? h('fieldset', {}, h('legend', {}, 'Text'),
      h('p', { class: 'muted small rep-label' }, 'Tips: [[words]] = gradient colour · **words** = bold · press Enter for a new line.'), fields) : null,
    buttons ? h('fieldset', {}, h('legend', {}, 'Buttons'), buttons.el) : null);
  const t = tracker(form, read, setDirtyCheck);

  async function save() {
    formError(err, '');
    const v = read();
    for (const k of keys) {
      if (en[k] && !v.text[k][0].trim()) { inputs[k].en.focus(); return formError(err, `“${(LABELS[k] || [k])[0]}” (English) cannot be empty.`); }
    }
    if (v.buttons) {
      for (const b of v.buttons) {
        if (!b.label_en) return formError(err, 'Every button needs English text.');
        if (!URL_OK.test(b.url)) return formError(err, `Button “${b.label_en}”: the link must start with https://, #, / , mailto: or tel:`);
      }
    }
    // Start from the saved JSON so unknown keys are preserved.
    const next = structuredClone(content);
    next.en = { ...en }; next.bn = { ...bn };
    for (const k of keys) {
      const [ve, vb] = v.text[k].map((x) => x.replace(/\r\n/g, '\n').trim());
      if (k in en || ve) next.en[k] = ve;
      if (k in bn || vb) next.bn[k] = vb;
    }
    if (v.buttons) next.buttons = v.buttons;
    const saved = await q(sb.from('page_sections').update({ content: next, is_visible: v.visible }).eq('id', s.id).select().single());
    Object.assign(s, saved);
    Object.assign(content, saved.content);
    Object.assign(en, saved.content.en); Object.assign(bn, saved.content.bn);
    t.reset();
    toast('Section saved.');
  }

  put(root, 
    h('a', { class: 'crumb', href: '/admin/homepage', 'data-link': '' }, '← All sections'),
    h('div', { class: 'page-head' }, h('h1', {}, NAMES[key] || key),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-sm', href: `/#${key === 'hero' ? 'top' : key === 'stories' ? 'testimonials' : key}`, target: '_blank', rel: 'noopener' }, 'View on website ↗'))),
    form, saveBar(t, save));
}
