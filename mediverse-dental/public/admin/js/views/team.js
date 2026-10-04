// Central Executives (team): list with ↑ ↓ order, add / edit / hide / delete, photo.
import { h, put, clear, field, text, checkbox, toast, confirmDialog, errorText, busy } from '../ui.js';
import { sb, q, publicUrl } from '../db.js';
import { tracker, saveBar, formError, imageSlot, moveInList, orderButtons } from '../forms.js';

const DESIGNATIONS = ['CM', 'CEO', 'Chief Academic Coordinator', 'Academic Coordinator', 'Coordinator', 'Advisor', 'Manager'];
const missingTable = (err) => /team_members|PGRST205|42P01|does not exist|Could not find the table/i.test(`${err?.code} ${err?.message}`);
const needSql = () => h('div', { class: 'form-error' }, 'The team page needs the latest database update first (the “articles, team & books” SQL). Run it in Supabase → SQL Editor, then reload.');

export async function render(ctx) {
  const [id] = ctx.params;
  return id ? edit(ctx, id === 'new' ? null : id) : list(ctx);
}

async function list({ root, setTitle }) {
  setTitle('Team');
  let rows;
  try { rows = await q(sb.from('team_members').select('*').order('sort_order').order('name')); } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, h('div', { class: 'page-head' }, h('h1', {}, 'Central Executives')), needSql()); return;
  }
  const photos = new Map((await q(sb.from('media').select('id,path').like('path', 'team/%')).catch(() => [])).map((m) => [m.id, m.path]));
  const box = h('div', { class: 'list', id: 'teamList' });
  let moving = false;
  const draw = () => {
    clear(box);
    if (!rows.length) box.append(h('div', { class: 'empty' }, 'No team members yet. Tap “+ Add member”.'));
    rows.forEach((t, i) => {
      const path = photos.get(t.photo_media_id);
      const link = h('a', { class: 'row', href: `/admin/team/${t.id}`, 'data-link': '' },
        path ? h('img', { class: 'thumb round', src: publicUrl(path), alt: '', loading: 'lazy' }) : h('div', { class: 'thumb round' }),
        h('div', { class: 'meta' }, h('b', {}, t.name), h('small', {}, [t.designation, t.college].filter(Boolean).join(' · '))),
        h('div', { class: 'side-info' }, h('span', { class: `badge ${t.is_visible ? 'visible' : 'hidden'}` }, t.is_visible ? 'visible' : 'hidden')));
      box.append(h('div', { class: 'row-wrap' }, link, orderButtons(t.name, i === 0, i === rows.length - 1, async (dir) => {
        if (moving) return; moving = true;
        try { await moveInList('team_members', rows, t, dir); toast(`${t.name} moved ${dir < 0 ? 'up' : 'down'}.`); } catch (e) { toast(errorText(e), 'err'); }
        moving = false; draw();
      })));
    });
  };
  put(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Central Executives'),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: '/admin/team/new', 'data-link': '' }, '+ Add member'))),
    h('p', { class: 'muted lead' }, 'Shown on the website at /team, in this order (use ↑ ↓). Hidden members are not shown.'),
    box);
  draw();
}

async function edit({ root, setTitle, navigate, setDirtyCheck }, id) {
  let t;
  try { t = id ? (await q(sb.from('team_members').select('*').eq('id', id).limit(1)))[0] : null; } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, needSql()); return;
  }
  if (id && !t) { put(root, h('div', { class: 'empty' }, 'Not found. ', h('a', { href: '/admin/team', 'data-link': '' }, 'Back'))); return; }
  t = t || { is_visible: true };
  const photo = t.photo_media_id ? (await q(sb.from('media').select('*').eq('id', t.photo_media_id).limit(1)))[0] : null;
  setTitle(id ? t.name : 'Add member');
  const f = {
    name: text(t.name, { maxlength: 120, id: 'name' }),
    designation: text(t.designation, { maxlength: 80, id: 'designation', list: 'desigList', placeholder: 'e.g. CEO' }),
    designation_bn: text(t.designation_bn, { maxlength: 80, id: 'designation_bn', lang: 'bn' }),
    college: text(t.college, { maxlength: 160, id: 'college', placeholder: 'e.g. Dhaka Dental College' }),
    college_bn: text(t.college_bn, { maxlength: 160, id: 'college_bn', lang: 'bn' }),
  };
  const photoSlot = imageSlot({ media: photo, folder: 'team', round: true, title: 'Profile photo' });
  const visible = checkbox('Show on the website', t.is_visible, { id: 'is_visible' });
  const read = () => ({ ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])), photo: photoSlot.get()?.id || null, visible: visible.input.checked });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'teamForm' }, err,
    h('fieldset', {}, h('legend', {}, 'Profile'),
      field('Name *', f.name),
      h('div', { class: 'grid2' }, field('Designation *', f.designation, 'Choose from the list or type a new one.'), field('Designation (বাংলা)', f.designation_bn)),
      h('datalist', { id: 'desigList' }, DESIGNATIONS.map((d) => h('option', { value: d }))),
      h('div', { class: 'grid2' }, field('College', f.college), field('College (বাংলা)', f.college_bn))),
    h('fieldset', {}, h('legend', {}, 'Photo'), photoSlot.el),
    h('fieldset', {}, h('legend', {}, 'Publishing'), visible.el));
  const tr = tracker(form, read, setDirtyCheck);
  async function save() {
    formError(err, '');
    const v = read();
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    if (!v.name.trim()) return bad(f.name, 'Name is required.');
    if (!v.designation.trim()) return bad(f.designation, 'Designation is required.');
    const n = (x) => (x.trim() ? x.trim() : null);
    const row = { name: v.name.trim(), designation: v.designation.trim(), designation_bn: n(v.designation_bn), college: n(v.college), college_bn: n(v.college_bn), photo_media_id: v.photo, is_visible: v.visible };
    if (!id) row.sort_order = ((await q(sb.from('team_members').select('sort_order').order('sort_order', { ascending: false }).limit(1)))[0]?.sort_order || 0) + 10;
    const saved = id ? await q(sb.from('team_members').update(row).eq('id', id).select().single()) : await q(sb.from('team_members').insert(row).select().single());
    tr.reset(); toast(id ? 'Saved.' : 'Member added.');
    if (!id) navigate(`/admin/team/${saved.id}`, { replace: true, force: true });
  }
  const del = id ? h('button', { class: 'btn btn-danger', type: 'button', id: 'deleteBtn' }, 'Delete member') : null;
  del?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this member?', message: `${t.name} will be removed from the team page. (The photo stays in the media library.) To hide instead, untick “Show on the website”.`, confirmLabel: 'Delete', danger: true }))) return;
    await busy(del, async () => {
      try { const gone = await q(sb.from('team_members').delete().eq('id', id).select('id')); if (!gone.length) throw new Error('Not allowed.'); toast('Member deleted.'); navigate('/admin/team', { force: true }); } catch (e) { toast(errorText(e), 'err'); }
    });
  });
  put(root, h('a', { class: 'crumb', href: '/admin/team', 'data-link': '' }, '← Team'),
    h('div', { class: 'page-head' }, h('h1', {}, id ? 'Edit member' : 'Add member')),
    form, del ? h('section', { class: 'panel', id: 'danger' }, h('h2', {}, 'Delete'), del) : null, saveBar(tr, save));
}
