// Review management: add/edit/hide/delete course reviews in one place.
// Course (any existing or future course), optional student name + college,
// rating 1–5 stars, review text in English and/or Bangla.
import { h, put, clear, field, text, area, select, checkbox, toast, confirmDialog, errorText, busy } from '../ui.js';
import { sb, q } from '../db.js';
import { tracker, saveBar, formError, mdBar } from '../forms.js';

export const RATINGS = [
  [5, 'Very good', 'খুব ভালো'], [4, 'Good', 'ভালো'], [3, 'Average', 'মোটামুটি'], [2, 'Bad', 'খারাপ'], [1, 'Very bad', 'খুব খারাপ'],
];
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const missingTable = (err) => /course_reviews|PGRST205|42P01|relation .* does not exist|Could not find the table/i.test(`${err?.code} ${err?.message}`);
const needSql = () => h('div', { class: 'form-error' }, 'Reviews need one small database update first (the “course reviews” SQL). Run it in Supabase → SQL Editor, then reload this page.');

async function loadCourses() {
  const [courses, phases] = await Promise.all([
    q(sb.from('courses').select('id,title_en,slug,status,archived_at,phase_id,sort_order')),
    q(sb.from('phases').select('id,name_en,sort_order').order('sort_order')),
  ]);
  const rank = new Map(phases.map((p, i) => [p.id, i]));
  const phaseName = new Map(phases.map((p) => [p.id, p.name_en]));
  courses.sort((a, b) => (rank.get(a.phase_id) ?? 99) - (rank.get(b.phase_id) ?? 99) || a.sort_order - b.sort_order);
  return { courses, phaseName };
}

export async function render(ctx) {
  const [id] = ctx.params;
  if (!id) return list(ctx);
  return edit(ctx, id === 'new' ? null : id);
}

// ------------------------------------------------------------------ list
async function list({ root, setTitle }) {
  setTitle('Reviews');
  const params = new URLSearchParams(location.search);
  let reviews;
  try {
    reviews = await q(sb.from('course_reviews').select('*').order('created_at', { ascending: false }));
  } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, h('div', { class: 'page-head' }, h('h1', {}, 'Reviews')), needSql());
    return;
  }
  const { courses } = await loadCourses();
  const title = new Map(courses.map((c) => [c.id, c.title_en]));
  const courseFilter = select(params.get('course') || '', [['', 'All courses'], ...courses.map((c) => [c.id, c.title_en + (c.archived_at ? ' (archived)' : c.status === 'hidden' ? ' (hidden)' : '')])], { 'aria-label': 'Course', id: 'reviewCourse' });
  const search = h('input', { type: 'search', placeholder: 'Search name, college or text…', 'aria-label': 'Search reviews', id: 'reviewSearch' });
  const box = h('div', { class: 'list', id: 'reviewList' });
  const countEl = h('p', { class: 'muted small' });
  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const rows = reviews.filter((r) => (!courseFilter.value || r.course_id === courseFilter.value)
      && (!term || [r.reviewer_name, r.reviewer_info_en, r.reviewer_info_bn, r.review_en, r.review_bn].some((x) => (x || '').toLowerCase().includes(term))));
    clear(box);
    const avg = rows.length ? (rows.reduce((a, r) => a + r.rating, 0) / rows.length).toFixed(1) : null;
    countEl.textContent = `${rows.length} review${rows.length === 1 ? '' : 's'}${avg ? ` · average ${avg} / 5` : ''}`;
    if (!rows.length) box.append(h('div', { class: 'empty' }, 'No reviews yet. Tap “+ Add review”.'));
    for (const r of rows) {
      box.append(h('a', { class: 'row', href: `/admin/reviews/${r.id}`, 'data-link': '' },
        h('div', { class: 'meta' },
          h('b', {}, h('span', { class: 'stars-txt' }, stars(r.rating)), ' ', r.reviewer_name || 'Student'),
          h('small', {}, `${title.get(r.course_id) || 'Unknown course'}${r.reviewer_info_en || r.reviewer_info_bn ? ` · ${r.reviewer_info_en || r.reviewer_info_bn}` : ''}`),
          h('small', {}, (r.review_en || r.review_bn || '').replace(/\*\*|\[\[|\]\]/g, '').slice(0, 90))),
        h('div', { class: 'side-info' }, h('span', { class: `badge ${r.is_visible ? 'visible' : 'hidden'}` }, r.is_visible ? 'visible' : 'hidden'))));
    }
  };
  courseFilter.addEventListener('input', () => { history.replaceState({}, '', courseFilter.value ? `?course=${courseFilter.value}` : location.pathname); draw(); });
  search.addEventListener('input', draw);
  const addHref = () => `/admin/reviews/new${courseFilter.value ? `?course=${courseFilter.value}` : ''}`;
  const add = h('a', { class: 'btn btn-primary', href: addHref(), 'data-link': '' }, '+ Add review');
  courseFilter.addEventListener('input', () => add.setAttribute('href', addHref()));
  put(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Reviews'), h('div', { class: 'actions' }, add)),
    h('p', { class: 'muted lead' }, 'Course reviews from students, shown on each course page. Only visible reviews of visible courses appear on the website.'),
    h('div', { class: 'toolbar' }, courseFilter, search), countEl, box);
  draw();
}

// ------------------------------------------------------------------ edit
async function edit({ root, setTitle, navigate, setDirtyCheck }, id) {
  let r;
  try {
    r = id ? (await q(sb.from('course_reviews').select('*').eq('id', id).limit(1)))[0] : null;
  } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, h('div', { class: 'page-head' }, h('h1', {}, 'Reviews')), needSql());
    return;
  }
  if (id && !r) {
    put(root, h('div', { class: 'empty' }, 'Review not found. ', h('a', { href: '/admin/reviews', 'data-link': '' }, 'Back to reviews')));
    return;
  }
  const { courses, phaseName } = await loadCourses();
  const pre = new URLSearchParams(location.search).get('course');
  r = r || { course_id: courses.some((c) => c.id === pre) ? pre : '', rating: 5, is_visible: true, sort_order: 0 };
  setTitle(id ? 'Edit review' : 'Add review');

  // Every course (current and future) can be chosen; archived ones only if already linked.
  const options = courses.filter((c) => !c.archived_at || c.id === r.course_id)
    .map((c) => [c.id, `${c.title_en} — ${phaseName.get(c.phase_id) || ''}${c.status === 'hidden' ? ' (hidden)' : ''}`]);
  const f = {
    course_id: select(r.course_id || '', [['', '— Choose course —'], ...options], { id: 'course_id' }),
    rating: select(String(r.rating), RATINGS.map(([n, en, bn]) => [String(n), `${stars(n)}  ${n} — ${en} (${bn})`]), { id: 'rating' }),
    reviewer_name: text(r.reviewer_name, { maxlength: 80, id: 'reviewer_name', placeholder: 'Optional' }),
    reviewer_info_en: text(r.reviewer_info_en, { maxlength: 120, id: 'reviewer_info_en', placeholder: 'Optional, e.g. Dhaka Dental College' }),
    reviewer_info_bn: text(r.reviewer_info_bn, { maxlength: 120, id: 'reviewer_info_bn', lang: 'bn', placeholder: 'ঐচ্ছিক' }),
    review_en: area(r.review_en, { maxlength: 2000, rows: 5, id: 'review_en' }),
    review_bn: area(r.review_bn, { maxlength: 2000, rows: 5, id: 'review_bn', lang: 'bn' }),
    sort_order: h('input', { type: 'number', step: 1, value: r.sort_order ?? 0, inputmode: 'numeric', id: 'sort_order' }),
  };
  const visible = checkbox('Show on the course page', r.is_visible, { id: 'is_visible' });
  const read = () => ({ ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])), is_visible: visible.input.checked });

  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { novalidate: true, id: 'reviewForm' }, err,
    h('fieldset', {}, h('legend', {}, 'Course & rating'),
      field('Course *', f.course_id, 'All courses are listed here, including new ones you add later.'),
      field('Rating *', f.rating)),
    h('fieldset', {}, h('legend', {}, 'Student (optional)'),
      field('Name', f.reviewer_name, 'Leave empty to show “Student”.'),
      h('div', { class: 'grid2' }, field('College (English)', f.reviewer_info_en), field('College (বাংলা)', f.reviewer_info_bn))),
    h('fieldset', {}, h('legend', {}, 'Review'),
      h('div', { class: 'grid2' }, field('Review (English)', mdBar(f.review_en)), field('Review (বাংলা)', mdBar(f.review_bn))),
      h('p', { class: 'muted small' }, 'Write at least one language. If only one is filled, it is shown in both languages.')),
    h('fieldset', {}, h('legend', {}, 'Publishing'), visible.el, field('Display order', f.sort_order, 'Smaller numbers come first on the course page.')));
  const t = tracker(form, read, setDirtyCheck);

  async function save() {
    formError(err, '');
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    const v = read();
    if (!v.course_id) return bad(f.course_id, 'Choose the course this review is for.');
    if (!v.review_en.trim() && !v.review_bn.trim()) return bad(f.review_en, 'Write the review in English or Bangla.');
    if (!/^-?\d{1,9}$/.test(String(v.sort_order).trim())) return bad(f.sort_order, 'Display order must be a whole number.');
    const n = (x) => (x.trim() ? x.replace(/\r\n/g, '\n').trim() : null);
    const row = {
      course_id: v.course_id, rating: Number(v.rating), reviewer_name: n(v.reviewer_name),
      reviewer_info_en: n(v.reviewer_info_en), reviewer_info_bn: n(v.reviewer_info_bn),
      review_en: n(v.review_en), review_bn: n(v.review_bn), is_visible: v.is_visible, sort_order: Number(v.sort_order),
    };
    const saved = id
      ? await q(sb.from('course_reviews').update(row).eq('id', id).select().single())
      : await q(sb.from('course_reviews').insert(row).select().single());
    t.reset();
    toast(id ? 'Review saved.' : 'Review added.');
    if (!id) navigate(`/admin/reviews/${saved.id}`, { replace: true, force: true });
  }

  const del = id ? h('button', { class: 'btn btn-danger', type: 'button', id: 'deleteBtn' }, 'Delete review') : null;
  del?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this review?', message: 'It will be removed from the course page. To keep it but hide it, untick “Show on the course page” instead.', confirmLabel: 'Delete', danger: true }))) return;
    await busy(del, async () => {
      try {
        const gone = await q(sb.from('course_reviews').delete().eq('id', id).select('id'));
        if (!gone.length) throw new Error('Not allowed: your admin account cannot delete reviews.');
        toast('Review deleted.');
        navigate('/admin/reviews', { force: true });
      } catch (e) { toast(errorText(e), 'err'); }
    });
  });
  const course = courses.find((c) => c.id === r.course_id);
  put(root,
    h('a', { class: 'crumb', href: '/admin/reviews', 'data-link': '' }, '← All reviews'),
    h('div', { class: 'page-head' }, h('h1', {}, id ? 'Edit review' : 'Add review'),
      course && !course.archived_at && course.status !== 'hidden' ? h('div', { class: 'actions' }, h('a', { class: 'btn btn-sm', href: `/courses/${course.slug}#reviews`, target: '_blank', rel: 'noopener' }, 'View on website ↗')) : null),
    form,
    del ? h('section', { class: 'panel', id: 'danger' }, h('h2', {}, 'Delete'), del) : null,
    saveBar(t, save));
}
