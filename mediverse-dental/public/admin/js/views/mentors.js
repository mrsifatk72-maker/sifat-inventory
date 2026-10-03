// Mentors: list / add / edit / change photo / hide / archive / (owner) delete when unused.
import { h, put, clear, field, text, area, select, toast, confirmDialog, errorText, busy, slugify, SLUG_RE } from '../ui.js';
import { sb, q, publicUrl } from '../db.js';
import { tracker, saveBar, formError, imageSlot, repeater } from '../forms.js';

const AVATAR = [['photo', 'Photo'], ['hijab_icon', 'Hijab icon (no photo)'], ['initials', 'Initials (no photo)']];
const LINK_TYPES = [['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['website', 'Website'], ['other', 'Other']];

export async function render(ctx) {
  const [id] = ctx.params;
  if (!id) return list(ctx);
  return edit(ctx, id === 'new' ? null : id);
}

async function list({ root, setTitle }) {
  setTitle('Mentors');
  const [mentors, media, links] = await Promise.all([
    q(sb.from('mentors').select('id,slug,name,designation_en,status,archived_at,photo_media_id,avatar_style').order('sort_order').order('name')),
    q(sb.from('media').select('id,path').like('path', 'mentors/%')),
    q(sb.from('course_mentors').select('mentor_id')),
  ]);
  const mediaPath = new Map(media.map((m) => [m.id, m.path]));
  const courseCount = links.reduce((acc, l) => acc.set(l.mentor_id, (acc.get(l.mentor_id) || 0) + 1), new Map());
  const search = h('input', { type: 'search', placeholder: 'Search mentors…', 'aria-label': 'Search mentors', id: 'mentorSearch' });
  const filter = select('current', [['current', 'All current'], ['active', 'Active'], ['hidden', 'Hidden'], ['archived', 'Archived (removed)']], { 'aria-label': 'Filter' });
  const box = h('div', { class: 'list', id: 'mentorList' });
  const countEl = h('p', { class: 'muted small' });
  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const rows = mentors.filter((m) => {
      if (filter.value === 'archived' ? !m.archived_at : m.archived_at) return false;
      if (['active', 'hidden'].includes(filter.value) && m.status !== filter.value) return false;
      return !term || [m.name, m.slug, m.designation_en].some((s) => (s || '').toLowerCase().includes(term));
    });
    clear(box);
    countEl.textContent = `${rows.length} of ${mentors.length} mentors`;
    if (!rows.length) box.append(h('div', { class: 'empty' }, 'No mentors match.'));
    for (const m of rows) {
      const path = m.avatar_style === 'photo' && mediaPath.get(m.photo_media_id);
      const n = courseCount.get(m.id) || 0;
      box.append(h('a', { class: 'row', href: `/admin/mentors/${m.id}`, 'data-link': '' },
        path ? h('img', { class: 'thumb round', src: publicUrl(path), alt: '', loading: 'lazy' }) : h('div', { class: 'thumb round' }),
        h('div', { class: 'meta' }, h('b', {}, m.name), h('small', {}, `${m.designation_en || ''} · ${n} course${n === 1 ? '' : 's'}`)),
        h('div', { class: 'side-info' }, m.archived_at ? h('span', { class: 'badge archived' }, 'archived') : h('span', { class: `badge ${m.status}` }, m.status))));
    }
  };
  search.addEventListener('input', draw); filter.addEventListener('input', draw);
  put(root, 
    h('div', { class: 'page-head' }, h('h1', {}, 'Mentors'),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: '/admin/mentors/new', 'data-link': '' }, '+ Add mentor'))),
    h('div', { class: 'toolbar' }, search, filter), countEl, box);
  draw();
}

async function edit({ root, setTitle, navigate, setDirtyCheck, role }, id) {
  const [rows, used] = await Promise.all([
    id ? q(sb.from('mentors').select('*').eq('id', id).limit(1)) : Promise.resolve([]),
    id ? q(sb.from('course_mentors').select('course_id, courses(title_en)').eq('mentor_id', id)) : Promise.resolve([]),
  ]);
  if (id && !rows.length) {
    put(root, h('div', { class: 'empty' }, 'Mentor not found. ', h('a', { href: '/admin/mentors', 'data-link': '' }, 'Back to mentors')));
    return;
  }
  const m = rows[0] || { status: 'active', avatar_style: 'initials', links: [], sort_order: 1000 };
  const photo = m.photo_media_id ? (await q(sb.from('media').select('*').eq('id', m.photo_media_id).limit(1)))[0] : null;
  setTitle(id ? m.name : 'New mentor');

  const f = {
    name: text(m.name, { required: true, maxlength: 120, id: 'name' }),
    slug: text(m.slug, { maxlength: 80, id: 'slug', autocapitalize: 'off', spellcheck: 'false' }),
    designation_en: text(m.designation_en, { maxlength: 120, id: 'designation_en' }),
    designation_bn: text(m.designation_bn, { maxlength: 120, lang: 'bn' }),
    credentials: area(m.credentials, { maxlength: 500, id: 'credentials' }),
    institution: text(m.institution, { maxlength: 160 }),
    session: text(m.session, { maxlength: 40 }),
    bio_en: area(m.bio_en, { maxlength: 3000 }),
    bio_bn: area(m.bio_bn, { maxlength: 3000, lang: 'bn' }),
    avatar_style: select(m.avatar_style, AVATAR, { id: 'avatar_style' }),
    status: select(m.status, [['active', 'Active — shown on website'], ['hidden', 'Hidden — not on website']], { id: 'status' }),
    sort_order: h('input', { type: 'number', step: 1, value: m.sort_order ?? 0, inputmode: 'numeric' }),
  };
  for (const [k, el] of Object.entries(f)) el.id ||= k;
  let slugTouched = !!id;
  f.slug.addEventListener('input', () => { slugTouched = true; });
  f.name.addEventListener('input', () => { if (!slugTouched) f.slug.value = slugify(f.name.value.replace(/^dr\.?\s+/i, '')); });

  const photoSlot = imageSlot({
    media: photo, folder: 'mentors', round: true, title: 'Mentor photo',
    onChange: (p) => { if (p) f.avatar_style.value = 'photo'; else if (f.avatar_style.value === 'photo') f.avatar_style.value = 'initials'; },
  });
  const linkRows = repeater({
    items: Array.isArray(m.links) ? m.links : [],
    addLabel: '+ Add link',
    max: 10,
    make: (it = {}) => {
      const type = select(it.type || 'facebook', LINK_TYPES, { 'aria-label': 'Link type' });
      const url = h('input', { type: 'url', value: it.url || '', placeholder: 'https://…', 'aria-label': 'Link URL' });
      return { el: h('div', { class: 'grid2' }, field('Type', type), field('URL', url)), read: () => ({ ...it, type: type.value, url: url.value.trim() }) };
    },
  });
  const read = () => ({ ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])), photo: photoSlot.get()?.id || null, links: linkRows.read() });

  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'mentorForm' }, err,
    h('fieldset', {}, h('legend', {}, 'Mentor'),
      field('Full name *', f.name, 'e.g. Dr. Nusrat Jahan Efty'),
      field('Slug', f.slug, 'Lowercase letters, numbers and dashes.'),
      h('div', { class: 'grid2' }, field('Subject / designation (English)', f.designation_en, 'Shown as the tag on the mentor card.'), field('Subject / designation (বাংলা)', f.designation_bn)),
      field('Credentials', f.credentials, 'Shown when the (i) button is tapped, e.g. “BDS (DDC), FCPS Part-1”.'),
      h('div', { class: 'grid2' }, field('Institution', f.institution), field('Session', f.session))),
    h('fieldset', {}, h('legend', {}, 'Photo'), photoSlot.el, field('Picture style', f.avatar_style, '“Photo” needs an image. Hijab icon shows a neutral icon instead of a photo.')),
    h('fieldset', {}, h('legend', {}, 'Publishing'), h('div', { class: 'grid2' }, field('Status', f.status), field('Display order', f.sort_order, 'Smaller numbers come first.'))),
    h('details', { class: 'adv' }, h('summary', {}, 'Bio & links (optional)'), h('div', {},
      h('div', { class: 'grid2' }, field('Bio (English)', f.bio_en), field('Bio (বাংলা)', f.bio_bn)),
      linkRows.el)));
  const t = tracker(form, read, setDirtyCheck);

  async function save() {
    formError(err, '');
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    const v = read();
    if (!v.name.trim()) return bad(f.name, 'Name is required.');
    const slug = v.slug.trim();
    if (!SLUG_RE.test(slug)) return bad(f.slug, 'Slug must use only lowercase letters, numbers and single dashes.');
    if (v.avatar_style === 'photo' && !v.photo) return bad(f.avatar_style, 'Picture style “Photo” needs a photo. Choose a photo or another style.');
    if (!/^-?\d{1,9}$/.test(String(v.sort_order).trim())) return bad(f.sort_order, 'Display order must be a whole number.');
    const links = v.links.filter((l) => l.url);
    if (links.some((l) => !/^https:\/\/[^\s<>"'`]+$/i.test(l.url))) return formError(err, 'Every link must start with https://');
    const n = (s) => (s.trim() ? s.trim() : null);
    const row = {
      name: v.name.trim(), slug, designation_en: n(v.designation_en), designation_bn: n(v.designation_bn),
      credentials: n(v.credentials), institution: n(v.institution), session: n(v.session),
      bio_en: n(v.bio_en), bio_bn: n(v.bio_bn), avatar_style: v.avatar_style, photo_media_id: v.photo,
      status: v.status, sort_order: Number(v.sort_order), links,
    };
    const saved = id
      ? await q(sb.from('mentors').update(row).eq('id', id).select().single())
      : await q(sb.from('mentors').insert(row).select().single());
    Object.assign(m, saved);
    t.reset();
    toast(id ? 'Mentor saved.' : 'Mentor added.');
    if (!id) navigate(`/admin/mentors/${saved.id}`, { replace: true, force: true });
    else setTitle(saved.name);
  }

  put(root, 
    h('a', { class: 'crumb', href: '/admin/mentors', 'data-link': '' }, '← All mentors'),
    h('div', { class: 'page-head' }, h('h1', {}, id ? 'Edit mentor' : 'Add mentor')),
    m.archived_at ? h('div', { class: 'form-error' }, 'This mentor is archived (removed from the website). Restore below to show again.') : null,
    id && used.length ? h('p', { class: 'muted small' }, `Teaches: ${used.map((u) => u.courses?.title_en).filter(Boolean).join(', ')}`) : null,
    form, id ? dangerZone({ m, used, role, navigate, t }) : null, saveBar(t, save));
}

function dangerZone({ m, used, role, navigate, t }) {
  const box = h('section', { class: 'panel', id: 'danger' }, h('h2', {}, 'Remove mentor'));
  const setArchived = (value, btn, msg) => busy(btn, async () => {
    try {
      await q(sb.from('mentors').update({ archived_at: value }).eq('id', m.id).select('id').single());
      toast(msg);
      navigate(value ? '/admin/mentors' : `/admin/mentors/${m.id}`, { force: true, replace: !value });
    } catch (err) { toast(errorText(err), 'err'); }
  });
  if (!m.archived_at) {
    const b = h('button', { class: 'btn btn-danger', type: 'button', id: 'archiveBtn' }, 'Archive (remove from website)');
    b.addEventListener('click', async () => {
      if (t.isDirty()) return toast('Save or undo your changes first.', 'err');
      const extra = used.length ? ` They are linked to ${used.length} course(s); those course pages will stop showing them.` : '';
      if (await confirmDialog({ title: 'Archive this mentor?', message: `${m.name} will disappear from the website.${extra} Nothing is deleted — you can restore any time.`, confirmLabel: 'Archive', danger: true })) setArchived(new Date().toISOString(), b, 'Mentor archived.');
    });
    box.append(h('p', { class: 'muted small' }, 'To hide for a while, set Status to “Hidden” and save.'), b);
    return box;
  }
  const restore = h('button', { class: 'btn', type: 'button', id: 'restoreBtn' }, 'Restore mentor');
  restore.addEventListener('click', () => setArchived(null, restore, 'Mentor restored.'));
  box.append(restore);
  if (role !== 'owner') { box.append(h('p', { class: 'muted small' }, 'Only the owner can delete a mentor permanently.')); return box; }
  if (used.length) { box.append(h('p', { class: 'muted small' }, `Permanent delete is not possible while the mentor is linked to ${used.length} course(s). Remove them from those courses first.`)); return box; }
  const del = h('button', { class: 'btn btn-danger', type: 'button', id: 'deleteBtn' }, 'Delete permanently');
  del.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete permanently?', message: 'This cannot be undone. (The photo stays in the media library.)', confirmLabel: 'Delete forever', danger: true, typeToConfirm: m.slug }))) return;
    await busy(del, async () => {
      try {
        const gone = await q(sb.from('mentors').delete().eq('id', m.id).select('id'));
        if (!gone.length) throw new Error('Not allowed: only the owner can delete mentors.');
        toast('Mentor deleted.'); navigate('/admin/mentors', { force: true });
      } catch (err) { toast(errorText(err), 'err'); }
    });
  });
  box.append(' ', del);
  return box;
}
