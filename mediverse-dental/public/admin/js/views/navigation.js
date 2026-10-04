// Menus: the desktop header menu and the mobile (hamburger) menu, from nav_items.
import { h, put, field, text, select, checkbox, toast } from '../ui.js';
import { sb, q } from '../db.js';
import { tracker, saveBar, formError, repeater, userError } from '../forms.js';

// Same rule as the database (private.is_safe_url): https/http, mailto, tel, #section or /page.
const URL_OK = /^(https?:\/\/[^\s<>"'`]+|mailto:[^\s<>"'`]+|tel:\+?[0-9 ()-]{3,20}|#[A-Za-z0-9_-]*|\/(?!\/)[^\s<>"'`]*)$/i;
const MENUS = [['header', 'Header menu (desktop)', 'Shown at the top on computers. Keep it to about 6 links.'],
  ['mobile', 'Mobile menu (☰)', 'Shown when the ☰ button is tapped on phones.']];

export async function render({ root, setTitle, setDirtyCheck }) {
  setTitle('Navigation');
  const items = await q(sb.from('nav_items').select('*').order('sort_order'));
  const editors = MENUS.map(([loc, title, hint]) => {
    const rows = items.filter((n) => n.location === loc);
    const ed = repeater({
      items: rows, addLabel: '+ Add menu item', max: 15,
      make: (it = { location: loc, style: 'link', is_visible: true, open_new_tab: false }) => {
        const le = text(it.label_en, { maxlength: 60, 'aria-label': 'Label (English)' });
        const lb = text(it.label_bn, { maxlength: 60, lang: 'bn', 'aria-label': 'Label (Bangla)' });
        const url = text(it.url, { maxlength: 2048, autocapitalize: 'off', spellcheck: 'false', inputmode: 'url', 'aria-label': 'Link', placeholder: '#courses, /articles or https://…' });
        const style = select(it.style, [['link', 'Link'], ['button', 'Button (highlighted)']], { 'aria-label': 'Style' });
        const vis = checkbox('Show', it.is_visible);
        const tab = checkbox('Open in new tab', it.open_new_tab);
        return {
          el: h('div', {}, h('div', { class: 'grid2' }, field('Label (English)', le), field('Label (বাংলা)', lb)),
            h('div', { class: 'grid2' }, field('Link', url, '#section on the homepage, /page on this site, or https://'), field('Style', style)),
            h('div', { class: 'checks' }, vis.el, tab.el)),
          read: () => ({ id: it.id, location: loc, label_en: le.value.trim(), label_bn: lb.value.trim(), url: url.value.trim(), style: style.value, is_visible: vis.input.checked, open_new_tab: tab.input.checked }),
        };
      },
    });
    return { loc, title, hint, ed, ids: rows.map((r) => r.id) };
  });
  const read = () => editors.map((e) => e.ed.read());
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'navForm' }, err,
    editors.map((e) => h('fieldset', { dataset: { menu: e.loc } }, h('legend', {}, e.title), h('p', { class: 'muted small rep-label' }, e.hint), e.ed.el)));
  const t = tracker(form, read, setDirtyCheck);
  async function save() {
    formError(err, '');
    const all = read();
    for (const list of all) for (const it of list) {
      if (!it.label_en) throw userError('Every menu item needs an English label.');
      if (!URL_OK.test(it.url)) throw userError(`Menu item “${it.label_en}”: the link must be #section, /page, https://, mailto: or tel:`);
    }
    for (const [i, e] of editors.entries()) {
      const keep = all[i].filter((x) => x.id).map((x) => x.id);
      const removed = e.ids.filter((id) => !keep.includes(id));
      if (removed.length) await q(sb.from('nav_items').delete().in('id', removed));
      for (const [k, it] of all[i].entries()) {
        const row = { location: it.location, label_en: it.label_en, label_bn: it.label_bn || null, url: it.url, style: it.style, is_visible: it.is_visible,
          open_new_tab: it.open_new_tab, is_external: /^https?:/i.test(it.url), sort_order: (k + 1) * 10 };
        if (it.id) await q(sb.from('nav_items').update(row).eq('id', it.id).select('id').single());
        else await q(sb.from('nav_items').insert(row).select('id').single());
      }
    }
    t.reset();
    toast('Menus saved.');
    setTimeout(() => location.reload(), 500); // reload so new items get their ids
  }
  put(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Navigation')),
    h('p', { class: 'muted lead' }, 'Edit, reorder (↑ ↓), hide or add menu items. Changes show on the website within about 1 minute.'),
    form, saveBar(t, save));
}
