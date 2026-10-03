// Courses: list / search / add / edit / hide / archive / restore / (owner) delete.
import { h, put, clear, field, text, area, select, toast, confirmDialog, errorText, busy, slugify, SLUG_RE } from '../ui.js';
import { sb, q, publicUrl } from '../db.js';
import { tracker, saveBar, formError, imageSlot, repeater, mdBar } from '../forms.js';

const STATUS = [['active', 'Active — shown on website'], ['upcoming', 'Upcoming — shown as “Coming soon”'], ['hidden', 'Hidden — not on website']];

export async function render(ctx) {
  const [id] = ctx.params;
  if (!id) return list(ctx);
  return edit(ctx, id === 'new' ? null : id);
}

// ------------------------------------------------------------------ list
async function list({ root, setTitle }) {
  setTitle('Courses');
  const [courses, phases, media] = await Promise.all([
    q(sb.from('courses').select('id,slug,title_en,title_bn,status,archived_at,phase_id,flyer_media_id,sort_order').order('sort_order').order('title_en')),
    q(sb.from('phases').select('id,name_en,code').order('sort_order')),
    q(sb.from('media').select('id,path').like('path', 'flyers/%')),
  ]);
  const phaseName = new Map(phases.map((p) => [p.id, p.name_en]));
  // Same order as the website: phase by phase, then display order.
  const phaseIdx = new Map(phases.map((p, i) => [p.id, i]));
  courses.sort((a, b) => (phaseIdx.get(a.phase_id) ?? 99) - (phaseIdx.get(b.phase_id) ?? 99) || a.sort_order - b.sort_order);
  const mediaPath = new Map(media.map((m) => [m.id, m.path]));

  const search = h('input', { type: 'search', placeholder: 'Search by name or slug…', 'aria-label': 'Search courses', id: 'courseSearch' });
  const filter = select('current', [['current', 'All current'], ['active', 'Active'], ['upcoming', 'Upcoming'], ['hidden', 'Hidden'], ['archived', 'Archived (removed)']], { 'aria-label': 'Filter by status', id: 'courseFilter' });
  const phaseFilter = select('', [['', 'All phases'], ...phases.map((p) => [p.id, p.name_en])], { 'aria-label': 'Filter by phase' });
  const box = h('div', { class: 'list', id: 'courseList' });
  const countEl = h('p', { class: 'muted small' });

  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const f = filter.value;
    const rows = courses.filter((c) => {
      if (f === 'archived' ? !c.archived_at : c.archived_at) return false;
      if (!['current', 'archived'].includes(f) && c.status !== f) return false;
      if (phaseFilter.value && c.phase_id !== phaseFilter.value) return false;
      return !term || [c.title_en, c.title_bn, c.slug].some((s) => (s || '').toLowerCase().includes(term));
    });
    clear(box);
    countEl.textContent = `${rows.length} of ${courses.length} courses`;
    if (!rows.length) box.append(h('div', { class: 'empty' }, 'No courses match.'));
    for (const c of rows) {
      const path = mediaPath.get(c.flyer_media_id);
      box.append(h('a', { class: 'row', href: `/admin/courses/${c.id}`, 'data-link': '' },
        path ? h('img', { class: 'thumb', src: publicUrl(path), alt: '', loading: 'lazy' }) : h('div', { class: 'thumb' }),
        h('div', { class: 'meta' }, h('b', {}, c.title_en), h('small', {}, `${phaseName.get(c.phase_id) || ''} · /courses/${c.slug}`)),
        h('div', { class: 'side-info' }, c.archived_at ? h('span', { class: 'badge archived' }, 'archived') : h('span', { class: `badge ${c.status}` }, c.status))));
    }
  };
  for (const el of [search, filter, phaseFilter]) el.addEventListener('input', draw);

  put(root, 
    h('div', { class: 'page-head' }, h('h1', {}, 'Courses'),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: '/admin/courses/new', 'data-link': '' }, '+ Add course'))),
    h('div', { class: 'toolbar' }, search, filter, phaseFilter), countEl, box);
  draw();
}

// ------------------------------------------------------------------ edit
async function edit({ root, setTitle, navigate, setDirtyCheck, role }, id) {
  const [phases, orders, mentors, rows, links] = await Promise.all([
    q(sb.from('phases').select('id,name_en').order('sort_order')),
    q(sb.from('courses').select('phase_id,sort_order')),
    q(sb.from('mentors').select('id,name,slug,archived_at,status').order('sort_order')),
    id ? q(sb.from('courses').select('*').eq('id', id).limit(1)) : Promise.resolve([]),
    id ? q(sb.from('course_mentors').select('*').eq('course_id', id).order('sort_order')) : Promise.resolve([]),
  ]);
  if (id && !rows.length) {
    put(root, h('div', { class: 'empty' }, 'Course not found. ', h('a', { href: '/admin/courses', 'data-link': '' }, 'Back to courses')));
    return;
  }
  const c = rows[0] || { status: 'hidden', info: {}, search_keywords: [], sort_order: 1000, phase_id: phases[0]?.id, cta_label_en: 'Enroll on Mediverse', cta_label_bn: 'মেডিভার্সে এনরোল করো' };
  const flyer = c.flyer_media_id ? (await q(sb.from('media').select('*').eq('id', c.flyer_media_id).limit(1)))[0] : null;
  const info = c.info && typeof c.info === 'object' ? c.info : {};
  setTitle(id ? c.title_en : 'New course');

  // --- fields
  const f = {
    title_en: text(c.title_en, { required: true, maxlength: 160, id: 'title_en' }),
    title_bn: text(c.title_bn, { maxlength: 160, lang: 'bn', id: 'title_bn' }),
    slug: text(c.slug, { maxlength: 80, id: 'slug', autocapitalize: 'off', spellcheck: 'false' }),
    phase_id: select(c.phase_id, phases.map((p) => [p.id, p.name_en]), { id: 'phase_id' }),
    status: select(c.status, STATUS, { id: 'status' }),
    external_url: h('input', { type: 'url', value: c.external_url || '', id: 'external_url', placeholder: 'https://mediversebd.com/courses/…', inputmode: 'url' }),
    cta_label_en: text(c.cta_label_en, { maxlength: 60 }),
    cta_label_bn: text(c.cta_label_bn, { maxlength: 60, lang: 'bn' }),
    short_desc_en: area(c.short_desc_en, { maxlength: 400, id: 'short_desc_en' }),
    short_desc_bn: area(c.short_desc_bn, { maxlength: 400, lang: 'bn' }),
    details_en: area(c.details_en, { maxlength: 20000, class: 'tall', id: 'details_en' }),
    details_bn: area(c.details_bn, { maxlength: 20000, class: 'tall', lang: 'bn' }),
    total_classes: h('input', { type: 'number', min: 0, max: 10000, step: 1, value: info.total_classes ?? '', inputmode: 'numeric', id: 'total_classes' }),
    access_period_en: text(info.access_period_en, { maxlength: 80 }),
    access_period_bn: text(info.access_period_bn, { maxlength: 80, lang: 'bn' }),
    search_keywords: text((c.search_keywords || []).join(', ')),
    sort_order: h('input', { type: 'number', step: 1, value: c.sort_order ?? 0, inputmode: 'numeric' }),
    seo_title_en: text(c.seo_title_en, { maxlength: 120 }),
    seo_title_bn: text(c.seo_title_bn, { maxlength: 120, lang: 'bn' }),
    seo_description_en: area(c.seo_description_en, { maxlength: 300 }),
    seo_description_bn: area(c.seo_description_bn, { maxlength: 300, lang: 'bn' }),
  };
  for (const [k, el] of Object.entries(f)) el.id ||= k;
  // New course: put it at the end of its phase (the website lists courses phase by phase).
  const nextOrder = (phaseId) => Math.max(0, ...orders.filter((o) => o.phase_id === phaseId).map((o) => o.sort_order)) + 10;
  if (!id) {
    f.sort_order.value = nextOrder(f.phase_id.value);
    let orderTouched = false;
    f.sort_order.addEventListener('input', () => { orderTouched = true; });
    f.phase_id.addEventListener('change', () => { if (!orderTouched) f.sort_order.value = nextOrder(f.phase_id.value); });
  }
  let slugTouched = !!id;
  f.slug.addEventListener('input', () => { slugTouched = true; });
  f.title_en.addEventListener('input', () => { if (!slugTouched) f.slug.value = slugify(f.title_en.value); });

  const flyerSlot = imageSlot({ media: flyer, folder: 'flyers', title: 'Course flyer' });
  const features = repeater({
    items: Array.isArray(info.features) ? info.features : [],
    addLabel: '+ Add feature',
    make: (it = {}) => {
      const en = text(it.en, { maxlength: 200 }), bn = text(it.bn, { maxlength: 200, lang: 'bn' });
      return { el: h('div', { class: 'grid2' }, field('Feature (English)', en), field('Feature (বাংলা)', bn)), read: () => ({ ...it, en: en.value.trim(), bn: bn.value.trim() }) };
    },
  });
  const mentorById = new Map(mentors.map((m) => [m.id, m]));
  const mentorRows = repeater({
    items: links.map((l) => ({ mentor_id: l.mentor_id, role: l.role })),
    addLabel: '+ Add mentor',
    max: 20,
    make: (it = {}) => {
      const opts = mentors.filter((m) => !m.archived_at || m.id === it.mentor_id).map((m) => [m.id, m.name + (m.status === 'hidden' ? ' (hidden)' : '')]);
      const m = select(it.mentor_id || '', [['', '— choose mentor —'], ...opts], { 'aria-label': 'Mentor' });
      const r = select(it.role || 'mentor', [['lead', 'Lead mentor'], ['mentor', 'Mentor']], { 'aria-label': 'Role' });
      return { el: h('div', { class: 'grid2' }, field('Mentor', m), field('Role', r)), read: () => ({ mentor_id: m.value, role: r.value }) };
    },
  });

  const read = () => ({
    ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])),
    flyer: flyerSlot.get()?.id || null, features: features.read(), mentors: mentorRows.read(),
  });

  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'courseForm' },
    err,
    h('fieldset', {}, h('legend', {}, 'Course name'),
      h('div', { class: 'grid2' }, field('Name (English) *', f.title_en), field('Name (বাংলা)', f.title_bn, 'Leave empty to show the English name.')),
      field('Web address (slug)', f.slug, 'Lowercase letters, numbers and dashes. Page: /courses/<slug>. Changing it breaks old links.')),
    h('fieldset', {}, h('legend', {}, 'Publishing'),
      h('div', { class: 'grid2' }, field('Phase', f.phase_id), field('Status', f.status)),
      field('Display order inside the phase', f.sort_order, 'Courses are shown phase by phase; inside a phase, smaller numbers come first.')),
    h('fieldset', {}, h('legend', {}, 'Enrollment (Mediverse platform)'),
      field('Mediverse enrollment URL', f.external_url, 'Must start with https:// — the “Enroll” button opens this.'),
      h('div', { class: 'grid2' }, field('Button text (English)', f.cta_label_en), field('Button text (বাংলা)', f.cta_label_bn))),
    h('fieldset', {}, h('legend', {}, 'Flyer image'), flyerSlot.el),
    h('fieldset', {}, h('legend', {}, 'Description'),
      h('div', { class: 'grid2' }, field('Short description (English)', mdBar(f.short_desc_en), 'Shown on the course card.'), field('Short description (বাংলা)', mdBar(f.short_desc_bn))),
      h('div', { class: 'grid2' }, field('Course details (English)', mdBar(f.details_en, { bullets: true }), 'Shown on the course page. Select words and tap B for bold, Aa for gradient colour, • List for bullet points.'), field('Course details (বাংলা)', mdBar(f.details_bn, { bullets: true })))),
    h('fieldset', {}, h('legend', {}, 'Course info'),
      h('div', { class: 'grid2' }, field('Total classes', f.total_classes), h('div')),
      h('div', { class: 'grid2' }, field('Access period (English)', f.access_period_en, 'e.g. 6 months'), field('Access period (বাংলা)', f.access_period_bn)),
      h('p', { class: 'muted small rep-label' }, 'What’s included (bullet list on the course page)'), features.el),
    h('fieldset', {}, h('legend', {}, 'Mentors'), mentorRows.el),
    h('details', { class: 'adv' }, h('summary', {}, 'Search & SEO (optional)'), h('div', {},
      field('Search keywords', f.search_keywords, 'Comma separated, e.g. opg, radiology'),
      h('div', { class: 'grid2' }, field('SEO title (English)', f.seo_title_en), field('SEO title (বাংলা)', f.seo_title_bn)),
      h('div', { class: 'grid2' }, field('SEO description (English)', f.seo_description_en), field('SEO description (বাংলা)', f.seo_description_bn)))),
  );
  const t = tracker(form, read, setDirtyCheck);

  async function save() {
    formError(err, '');
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    const v = read();
    const slug = v.slug.trim();
    if (!v.title_en.trim()) return bad(f.title_en, 'English name is required.');
    if (!SLUG_RE.test(slug)) return bad(f.slug, 'Slug must use only lowercase letters, numbers and single dashes (e.g. decode-the-opg).');
    const url = v.external_url.trim();
    if (url && !/^https:\/\/[^\s<>"'`]+$/i.test(url)) return bad(f.external_url, 'The enrollment URL must start with https:// and contain no spaces.');
    const total = v.total_classes.trim();
    if (total && !/^\d{1,5}$/.test(total)) return bad(f.total_classes, 'Total classes must be a whole number.');
    if (!/^-?\d{1,9}$/.test(String(v.sort_order).trim())) return bad(f.sort_order, 'Display order must be a whole number.');
    const ms = v.mentors.filter((m) => m.mentor_id);
    if (new Set(ms.map((m) => m.mentor_id)).size !== ms.length) return formError(err, 'The same mentor is added twice.');

    // Keep any info keys this form does not edit.
    const newInfo = { ...info };
    const setOrDrop = (k, val) => { if (val === '' || val == null) delete newInfo[k]; else newInfo[k] = val; };
    setOrDrop('total_classes', total ? Number(total) : '');
    setOrDrop('access_period_en', v.access_period_en.trim());
    setOrDrop('access_period_bn', v.access_period_bn.trim());
    const feats = v.features.filter((x) => x.en || x.bn).map((x) => { const o = { ...x }; if (!o.bn) delete o.bn; return o; });
    if (feats.some((x) => !x.en)) return formError(err, 'Each feature needs English text.');
    setOrDrop('features', feats.length ? feats : '');

    const n = (s) => (s.trim() ? s.trim() : null);
    const row = {
      slug, title_en: v.title_en.trim(), title_bn: n(v.title_bn),
      phase_id: v.phase_id, status: v.status, sort_order: Number(v.sort_order),
      external_url: url || null, cta_label_en: n(v.cta_label_en), cta_label_bn: n(v.cta_label_bn),
      short_desc_en: n(v.short_desc_en), short_desc_bn: n(v.short_desc_bn),
      details_en: n(v.details_en), details_bn: n(v.details_bn),
      info: newInfo, flyer_media_id: v.flyer,
      search_keywords: v.search_keywords.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      seo_title_en: n(v.seo_title_en), seo_title_bn: n(v.seo_title_bn),
      seo_description_en: n(v.seo_description_en), seo_description_bn: n(v.seo_description_bn),
    };
    if (id && slug !== c.slug && !(await confirmDialog({ title: 'Change the web address?', message: `The page will move from /courses/${c.slug} to /courses/${slug}. Old links to this course will stop working.`, confirmLabel: 'Change it' }))) return;

    const savedRow = id
      ? await q(sb.from('courses').update(row).eq('id', id).select().single())
      : await q(sb.from('courses').insert(row).select().single());

    // Mentors: remove the ones taken out, then upsert the list in order.
    const keep = ms.map((m) => m.mentor_id);
    const old = links.map((l) => l.mentor_id).filter((x) => !keep.includes(x));
    if (old.length) await q(sb.from('course_mentors').delete().eq('course_id', savedRow.id).in('mentor_id', old));
    if (ms.length) await q(sb.from('course_mentors').upsert(ms.map((m, i) => ({ course_id: savedRow.id, mentor_id: m.mentor_id, role: m.role, sort_order: i * 10 })), { onConflict: 'course_id,mentor_id' }));

    Object.assign(c, savedRow);
    links.splice(0, links.length, ...ms.map((m) => ({ mentor_id: m.mentor_id, role: m.role })));
    t.reset();
    toast(id ? 'Course saved.' : 'Course created.');
    if (!id) navigate(`/admin/courses/${savedRow.id}`, { replace: true, force: true });
    else setTitle(savedRow.title_en);
  }

  // --- danger zone (existing courses only)
  const zone = id ? dangerZone({ c, role, navigate, t }) : null;
  const live = id && !c.archived_at && c.status !== 'hidden';
  put(root, 
    h('a', { class: 'crumb', href: '/admin/courses', 'data-link': '' }, '← All courses'),
    h('div', { class: 'page-head' }, h('h1', {}, id ? 'Edit course' : 'Add course'),
      live ? h('div', { class: 'actions' }, h('a', { class: 'btn btn-sm', href: `/courses/${c.slug}`, target: '_blank', rel: 'noopener' }, 'View on website ↗')) : null),
    c.archived_at ? h('div', { class: 'form-error' }, 'This course is archived (removed from the website). Restore it below to show it again.') : null,
    form, zone, saveBar(t, save));
}

function dangerZone({ c, role, navigate, t }) {
  const box = h('section', { class: 'panel', id: 'danger' }, h('h2', {}, 'Remove course'));
  if (!c.archived_at) {
    const b = h('button', { class: 'btn btn-danger', type: 'button', id: 'archiveBtn' }, 'Archive (remove from website)');
    b.addEventListener('click', async () => {
      if (t.isDirty()) return toast('Save or undo your changes first.', 'err');
      if (!(await confirmDialog({ title: 'Archive this course?', message: `“${c.title_en}” will disappear from the website. Nothing is deleted — you can restore it any time.`, confirmLabel: 'Archive', danger: true }))) return;
      await busy(b, async () => {
        try { await q(sb.from('courses').update({ archived_at: new Date().toISOString() }).eq('id', c.id).select('id').single()); toast('Course archived.'); navigate('/admin/courses', { force: true }); } catch (err) { toast(errorText(err), 'err'); }
      });
    });
    box.append(h('p', { class: 'muted small' }, 'To hide a course for a while, set Status to “Hidden” and save. Archiving removes it from the list of current courses.'), b);
    return box;
  }
  const restore = h('button', { class: 'btn', type: 'button', id: 'restoreBtn' }, 'Restore course');
  restore.addEventListener('click', () => busy(restore, async () => {
    try { await q(sb.from('courses').update({ archived_at: null }).eq('id', c.id).select('id').single()); toast('Course restored.'); navigate(`/admin/courses/${c.id}`, { force: true, replace: true }); } catch (err) { toast(errorText(err), 'err'); }
  }));
  box.append(restore);
  if (role === 'owner') {
    const del = h('button', { class: 'btn btn-danger', type: 'button', id: 'deleteBtn' }, 'Delete permanently');
    del.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Delete permanently?', message: 'This cannot be undone. The course and its mentor links are deleted. (Images stay in the media library.)', confirmLabel: 'Delete forever', danger: true, typeToConfirm: c.slug }))) return;
      await busy(del, async () => {
        try {
          const gone = await q(sb.from('courses').delete().eq('id', c.id).select('id'));
          if (!gone.length) throw new Error('Not allowed: only the owner can delete courses.');
          toast('Course deleted.'); navigate('/admin/courses', { force: true });
        } catch (err) { toast(errorText(err), 'err'); }
      });
    });
    box.append(' ', del);
  } else {
    box.append(h('p', { class: 'muted small' }, 'Only the owner can delete a course permanently.'));
  }
  return box;
}
