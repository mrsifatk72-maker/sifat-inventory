// Books: list with ↑ ↓ order and Online/Offline filter, add / edit / hide / delete, cover image.
import { h, put, clear, field, text, area, select, checkbox, toast, confirmDialog, errorText, busy } from '../ui.js';
import { sb, q, publicUrl } from '../db.js';
import { tracker, saveBar, formError, imageSlot, moveInList, orderButtons, mdBar } from '../forms.js';

const missingTable = (err) => /books|PGRST205|42P01|does not exist|Could not find the table/i.test(`${err?.code} ${err?.message}`);
const needSql = () => h('div', { class: 'form-error' }, 'The books page needs the latest database update first (the “articles, team & books” SQL). Run it in Supabase → SQL Editor, then reload.');

export async function render(ctx) {
  const [id] = ctx.params;
  return id ? edit(ctx, id === 'new' ? null : id) : list(ctx);
}

async function list({ root, setTitle }) {
  setTitle('Books');
  let rows;
  try { rows = await q(sb.from('books').select('*').order('sort_order').order('title')); } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, h('div', { class: 'page-head' }, h('h1', {}, 'Books')), needSql()); return;
  }
  const covers = new Map((await q(sb.from('media').select('id,path').like('path', 'books/%')).catch(() => [])).map((m) => [m.id, m.path]));
  const filter = select('', [['', 'All books'], ['online', 'Online'], ['offline', 'Offline (printed)']], { 'aria-label': 'Type', id: 'bookFilter' });
  const box = h('div', { class: 'list', id: 'bookList' });
  let moving = false;
  const draw = () => {
    clear(box);
    const shown = rows.filter((b) => !filter.value || b.book_type === filter.value);
    if (!shown.length) box.append(h('div', { class: 'empty' }, rows.length ? 'No books of this type.' : 'No books yet. Tap “+ Add book”.'));
    shown.forEach((b, i) => {
      const path = covers.get(b.cover_media_id);
      const link = h('a', { class: 'row', href: `/admin/books/${b.id}`, 'data-link': '' },
        path ? h('img', { class: 'thumb', src: publicUrl(path), alt: '', loading: 'lazy' }) : h('div', { class: 'thumb' }),
        h('div', { class: 'meta' }, h('b', {}, b.title), h('small', {}, [b.book_type === 'online' ? 'Online' : 'Offline', b.author, b.price].filter(Boolean).join(' · '))),
        h('div', { class: 'side-info' }, h('span', { class: `badge ${b.is_visible ? 'visible' : 'hidden'}` }, b.is_visible ? 'visible' : 'hidden')));
      box.append(!filter.value ? h('div', { class: 'row-wrap' }, link, orderButtons(b.title, i === 0, i === shown.length - 1, async (dir) => {
        if (moving) return; moving = true;
        try { await moveInList('books', rows, b, dir); toast('Order saved.'); } catch (e) { toast(errorText(e), 'err'); }
        moving = false; draw();
      })) : link);
    });
  };
  filter.addEventListener('input', draw);
  put(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Books'),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: '/admin/books/new', 'data-link': '' }, '+ Add book'))),
    h('p', { class: 'muted lead' }, 'Shown on the website at /books with Online / Offline tabs, in this order (use ↑ ↓ with “All books”).'),
    h('div', { class: 'toolbar' }, filter), box);
  draw();
}

async function edit({ root, setTitle, navigate, setDirtyCheck }, id) {
  let b;
  try { b = id ? (await q(sb.from('books').select('*').eq('id', id).limit(1)))[0] : null; } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, needSql()); return;
  }
  if (id && !b) { put(root, h('div', { class: 'empty' }, 'Not found. ', h('a', { href: '/admin/books', 'data-link': '' }, 'Back'))); return; }
  b = b || { is_visible: true, book_type: 'offline' };
  const cover = b.cover_media_id ? (await q(sb.from('media').select('*').eq('id', b.cover_media_id).limit(1)))[0] : null;
  setTitle(id ? b.title : 'Add book');
  const f = {
    title: text(b.title, { maxlength: 200, id: 'title' }),
    book_type: select(b.book_type, [['offline', 'Offline (printed book)'], ['online', 'Online (PDF / e-book / web)']], { id: 'book_type' }),
    author: text(b.author, { maxlength: 160, id: 'author' }),
    mentor_name: text(b.mentor_name, { maxlength: 160, id: 'mentor_name', placeholder: 'Optional' }),
    description: area(b.description, { maxlength: 2000, rows: 4, id: 'description' }),
    price: text(b.price, { maxlength: 40, id: 'price', placeholder: 'Optional, e.g. ৳ 450 or Free' }),
    link_url: h('input', { type: 'url', value: b.link_url || '', id: 'link_url', inputmode: 'url', placeholder: 'https://…' }),
    link_label: text(b.link_label, { maxlength: 40, id: 'link_label', placeholder: 'e.g. Buy now / Read online' }),
  };
  const coverSlot = imageSlot({ media: cover, folder: 'books', title: 'Book cover' });
  const visible = checkbox('Show on the website', b.is_visible, { id: 'is_visible' });
  const read = () => ({ ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])), cover: coverSlot.get()?.id || null, visible: visible.input.checked });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'bookForm' }, err,
    h('fieldset', {}, h('legend', {}, 'Book'),
      field('Title *', f.title),
      h('div', { class: 'grid2' }, field('Type *', f.book_type), field('Price', f.price)),
      h('div', { class: 'grid2' }, field('Author', f.author), field('Mentor', f.mentor_name)),
      field('Short description', mdBar(f.description))),
    h('fieldset', {}, h('legend', {}, 'Cover'), coverSlot.el),
    h('fieldset', {}, h('legend', {}, 'Link (View / Purchase / Enroll)'),
      field('Link', f.link_url, 'Must start with https://'), field('Button text', f.link_label)),
    h('fieldset', {}, h('legend', {}, 'Publishing'), visible.el));
  const tr = tracker(form, read, setDirtyCheck);
  async function save() {
    formError(err, '');
    const v = read();
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    if (!v.title.trim()) return bad(f.title, 'Title is required.');
    if (v.link_url.trim() && !/^https:\/\/[^\s<>"'`]+$/i.test(v.link_url.trim())) return bad(f.link_url, 'The link must start with https:// and contain no spaces.');
    const n = (x) => (x.trim() ? x.trim() : null);
    const row = { title: v.title.trim(), book_type: v.book_type, author: n(v.author), mentor_name: n(v.mentor_name), description: n(v.description), price: n(v.price), link_url: n(v.link_url), link_label: n(v.link_label), cover_media_id: v.cover, is_visible: v.visible };
    if (!id) row.sort_order = ((await q(sb.from('books').select('sort_order').order('sort_order', { ascending: false }).limit(1)))[0]?.sort_order || 0) + 10;
    const saved = id ? await q(sb.from('books').update(row).eq('id', id).select().single()) : await q(sb.from('books').insert(row).select().single());
    tr.reset(); toast(id ? 'Saved.' : 'Book added.');
    if (!id) navigate(`/admin/books/${saved.id}`, { replace: true, force: true });
  }
  const del = id ? h('button', { class: 'btn btn-danger', type: 'button', id: 'deleteBtn' }, 'Delete book') : null;
  del?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this book?', message: `“${b.title}” will be removed. (The cover stays in the media library.) To hide instead, untick “Show on the website”.`, confirmLabel: 'Delete', danger: true }))) return;
    await busy(del, async () => {
      try { const gone = await q(sb.from('books').delete().eq('id', id).select('id')); if (!gone.length) throw new Error('Not allowed.'); toast('Book deleted.'); navigate('/admin/books', { force: true }); } catch (e) { toast(errorText(e), 'err'); }
    });
  });
  put(root, h('a', { class: 'crumb', href: '/admin/books', 'data-link': '' }, '← Books'),
    h('div', { class: 'page-head' }, h('h1', {}, id ? 'Edit book' : 'Add book')),
    form, del ? h('section', { class: 'panel', id: 'danger' }, h('h2', {}, 'Delete'), del) : null, saveBar(tr, save));
}
