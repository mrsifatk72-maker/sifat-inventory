// Homepage sections: edit the existing page_sections (English + Bangla text, buttons,
// show/hide). Only the fields that already exist are edited; every other key in the
// section's JSON is kept exactly as it was.
import { h, put, field, text, area, select, checkbox, toast } from '../ui.js';
import { sb, q } from '../db.js';
import { tracker, saveBar, formError, repeater, mdBar, userError } from '../forms.js';

// Lists shown inside each section (each list is its own table).
// f: [key, label, kind, max] — kind: text | area | number | icon. `fixed` = edit only (no add/remove/reorder).
const LISTS = {
  hero: [{ table: 'stats', title: 'Numbers (e.g. 4,700+ Students reached)', add: '+ Add number', max: 8,
    f: [['value', 'Number', 'number'], ['suffix', 'After the number (e.g. +)', 'text', 5], ['label_en', 'Label (English)', 'text', 60], ['label_bn', 'Label (বাংলা)', 'text', 60]], required: ['label_en'] }],
  about: [
    { table: 'features', title: 'Feature cards', add: '+ Add card', max: 9,
      f: [['icon', 'Icon', 'icon'], ['title_en', 'Title (English)', 'text', 120], ['title_bn', 'Title (বাংলা)', 'text', 120], ['body_en', 'Text (English)', 'area', 500], ['body_bn', 'Text (বাংলা)', 'area', 500]], required: ['title_en'] },
    { table: 'phases', title: 'Phase cards (also used for course filters)', fixed: true,
      f: [['name_en', 'Phase name (English)', 'text', 60], ['name_bn', 'Phase name (বাংলা)', 'text', 60], ['summary_en', 'Summary (English)', 'area', 500], ['summary_bn', 'Summary (বাংলা)', 'area', 500]], required: ['name_en'] }],
  stories: [{ table: 'testimonials', title: 'Testimonials', add: '+ Add testimonial', max: 12,
    f: [['quote_en', 'Quote (English)', 'area', 1000], ['quote_bn', 'Quote (বাংলা)', 'area', 1000], ['attribution_en', 'Name / year (English)', 'text', 120], ['attribution_bn', 'Name / year (বাংলা)', 'text', 120], ['source_en', 'College (English)', 'text', 120], ['source_bn', 'College (বাংলা)', 'text', 120]], required: ['quote_en'] }],
  faq: [{ table: 'faqs', title: 'Questions & answers', add: '+ Add question', max: 30,
    f: [['question_en', 'Question (English)', 'text', 300], ['question_bn', 'Question (বাংলা)', 'text', 300], ['answer_en', 'Answer (English)', 'area', 3000], ['answer_bn', 'Answer (বাংলা)', 'area', 3000]], required: ['question_en', 'answer_en'] }],
};
const ICONS = [['video', 'Video'], ['notes', 'Notes'], ['chat', 'Chat / support']];

function listEditor(cfg, rows) {
  const ed = repeater({
    items: rows, addLabel: cfg.add, max: cfg.max, fixed: !!cfg.fixed,
    make: (it = { is_visible: true }) => {
      const inputs = {};
      const cells = cfg.f.map(([k, label, kind, max]) => {
        const bn = k.endsWith('_bn') ? { lang: 'bn' } : {};
        const el = kind === 'number' ? h('input', { type: 'number', min: 0, step: 1, value: it[k] ?? '', inputmode: 'numeric', 'aria-label': label })
          : kind === 'icon' ? select(it[k] || 'video', ICONS, { 'aria-label': label })
          : kind === 'area' ? area(it[k], { maxlength: max, rows: 3, 'aria-label': label, ...bn })
          : text(it[k], { maxlength: max, 'aria-label': label, ...bn });
        inputs[k] = el;
        return field(label, kind === 'area' ? mdBar(el) : el);
      });
      const pairs = [];
      for (let i = 0; i < cells.length; i += 2) pairs.push(h('div', { class: 'grid2' }, cells[i], cells[i + 1] || h('div')));
      const vis = cfg.fixed ? null : checkbox('Show on website', it.is_visible !== false);
      return {
        el: h('div', {}, pairs, vis?.el),
        read: () => ({ id: it.id, ...Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])), ...(vis ? { is_visible: vis.input.checked } : {}) }),
      };
    },
  });
  return ed;
}

const n = (x) => (typeof x === 'string' ? (x.trim() ? x.replace(/\r\n/g, '\n').trim() : null) : x);
function checkList(cfg, items) {
  for (const it of items) {
    for (const k of cfg.required) if (!n(it[k])) throw userError(`${cfg.title}: “${cfg.f.find((x) => x[0] === k)[1]}” cannot be empty.`);
    if ('value' in it && !/^\d{1,9}$/.test(String(it.value).trim())) throw userError(`${cfg.title}: “Number” must be a whole number.`);
  }
}

async function saveList(cfg, items, savedIds) {
  const keep = items.filter((x) => x.id).map((x) => x.id);
  const removed = cfg.fixed ? [] : savedIds.filter((id) => !keep.includes(id));
  if (removed.length) await q(sb.from(cfg.table).delete().in('id', removed));
  for (const [i, it] of items.entries()) {
    const row = Object.fromEntries(Object.entries(it).filter(([k]) => k !== 'id').map(([k, v]) => [k, k === 'value' ? Number(v) : k === 'suffix' ? (v || '').trim() : n(v)]));
    if (!cfg.fixed) row.sort_order = (i + 1) * 10;
    if (it.id) await q(sb.from(cfg.table).update(row).eq('id', it.id).select('id').single());
    else await q(sb.from(cfg.table).insert(row).select('id').single());
  }
}

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

async function edit({ root, setTitle, setDirtyCheck, navigate }, key) {
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
    const wrap = (el) => (long ? mdBar(el) : el);
    return h('div', { class: 'grid2' }, field(`${label} (English)`, wrap(inputs[k].en)), field(`${label} (বাংলা)`, wrap(inputs[k].bn)));
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
  // Courses section: optional Undergraduate / Postgraduate switch on the website.
  const levelSwitch = key === 'courses' ? checkbox('Show “Undergraduate (BDS) / Postgraduate” switch above the courses', content.show_level_switch !== false, { id: 'show_level_switch' }) : null;
  const lists = await Promise.all((LISTS[key] || []).map(async (cfg) => {
    const data = await q(sb.from(cfg.table).select('*').order('sort_order'));
    return { cfg, ids: data.map((x) => x.id), ed: listEditor(cfg, data) };
  }));

  const read = () => ({
    visible: visible.input.checked,
    text: Object.fromEntries(keys.map((k) => [k, [inputs[k].en.value, inputs[k].bn.value]])),
    buttons: buttons ? buttons.read() : null,
    lists: lists.map((l) => l.ed.read()),
    levelSwitch: levelSwitch ? levelSwitch.input.checked : null,
  });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'sectionForm' }, err,
    h('fieldset', {}, h('legend', {}, 'Visibility'), visible.el,
      levelSwitch ? [levelSwitch.el, h('p', { class: 'muted small' }, 'On: visitors choose Undergraduate (BDS) or Postgraduate; if there are no postgraduate courses yet, that tab says “coming soon”. Off: all courses are shown together. Set each course’s level on its edit page.')] : null),
    fields.length ? h('fieldset', {}, h('legend', {}, 'Text'),
      h('p', { class: 'muted small rep-label' }, 'Tips: select words and tap B for bold or Aa for gradient colour · press Enter for a new line.'), fields) : null,
    buttons ? h('fieldset', {}, h('legend', {}, 'Buttons'), buttons.el) : null,
    lists.map((l) => h('fieldset', { class: 'list-set', dataset: { table: l.cfg.table } }, h('legend', {}, l.cfg.title), l.ed.el)));
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
    if (levelSwitch) next.show_level_switch = v.levelSwitch;
    for (const [i, l] of lists.entries()) checkList(l.cfg, v.lists[i]); // check everything before saving anything
    for (const [i, l] of lists.entries()) await saveList(l.cfg, v.lists[i], l.ids);
    const saved = await q(sb.from('page_sections').update({ content: next, is_visible: v.visible }).eq('id', s.id).select().single());
    Object.assign(s, saved);
    Object.assign(content, saved.content);
    Object.assign(en, saved.content.en); Object.assign(bn, saved.content.bn);
    t.reset();
    toast('Section saved.');
    if (lists.length) navigate(location.pathname, { force: true, replace: true }); // reload lists with their new ids
  }

  put(root, 
    h('a', { class: 'crumb', href: '/admin/homepage', 'data-link': '' }, '← All sections'),
    h('div', { class: 'page-head' }, h('h1', {}, NAMES[key] || key),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-sm', href: `/#${key === 'hero' ? 'top' : key}`, target: '_blank', rel: 'noopener' }, 'View on website ↗'))),
    form, saveBar(t, save));
}
