// Articles: list, write/edit with formatting toolbar + live preview, draft / publish / unpublish, delete.
// The body is stored as safe markup (never HTML) and rendered by the same formatter the website uses.
import { h, put, clear, field, text, area, select, toast, confirmDialog, errorText, busy, slugify, SLUG_RE } from '../ui.js';
import { sb, q, publicUrl } from '../db.js';
import { tracker, saveBar, formError, imageSlot, pickImage } from '../forms.js';
import { articleHtml, readMinutes } from '../markup.js';

const missingTable = (err) => /articles|PGRST205|42P01|does not exist|Could not find the table/i.test(`${err?.code} ${err?.message}`);
const needSql = () => h('div', { class: 'form-error' }, 'Articles need the latest database update first (the “articles, team & books” SQL). Run it in Supabase → SQL Editor, then reload.');
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const isLive = (a) => a.status === 'published' && a.published_at && new Date(a.published_at) <= new Date();

export async function render(ctx) {
  const [id] = ctx.params;
  if (!id) return list(ctx);
  return edit(ctx, id === 'new' ? null : id);
}

async function list({ root, setTitle }) {
  setTitle('Articles');
  let rows;
  try {
    rows = await q(sb.from('articles').select('id,slug,title,status,published_at,view_count,category,author_name,updated_at').order('updated_at', { ascending: false }));
  } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, h('div', { class: 'page-head' }, h('h1', {}, 'Articles')), needSql());
    return;
  }
  const search = h('input', { type: 'search', placeholder: 'Search title, category or author…', 'aria-label': 'Search articles', id: 'articleSearch' });
  const filter = select('', [['', 'All'], ['published', 'Published'], ['draft', 'Drafts']], { 'aria-label': 'Status', id: 'articleFilter' });
  const box = h('div', { class: 'list', id: 'articleList' });
  const countEl = h('p', { class: 'muted small' });
  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const shown = rows.filter((a) => (!filter.value || a.status === filter.value)
      && (!term || [a.title, a.category, a.author_name, a.slug].some((x) => (x || '').toLowerCase().includes(term))));
    clear(box);
    countEl.textContent = `${shown.length} of ${rows.length} articles`;
    if (!shown.length) box.append(h('div', { class: 'empty' }, rows.length ? 'No articles match.' : 'No articles yet. Tap “+ Write article”.'));
    for (const a of shown) {
      const badge = a.status === 'draft' ? ['hidden', 'draft'] : isLive(a) ? ['visible', 'published'] : ['upcoming', 'scheduled'];
      box.append(h('a', { class: 'row', href: `/admin/articles/${a.id}`, 'data-link': '' },
        h('div', { class: 'meta' }, h('b', {}, a.title),
          h('small', {}, [a.category, a.author_name, a.status === 'published' ? fmt(a.published_at) : `edited ${fmt(a.updated_at)}`, a.view_count ? `${a.view_count} views` : ''].filter(Boolean).join(' · '))),
        h('div', { class: 'side-info' }, h('span', { class: `badge ${badge[0]}` }, badge[1]))));
    }
  };
  search.addEventListener('input', draw); filter.addEventListener('input', draw);
  put(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Articles'),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: '/admin/articles/new', 'data-link': '' }, '+ Write article'))),
    h('p', { class: 'muted lead' }, 'Only published articles appear on the website (/articles). Drafts are private.'),
    h('div', { class: 'toolbar' }, search, filter), countEl, box);
  draw();
}

// Toolbar for the article body: inserts the website's safe markup.
function editorBar(ta) {
  const insert = (before, after = '', placeholder = '') => {
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const sel = value.slice(a, b) || placeholder;
    ta.value = value.slice(0, a) + before + sel + after + value.slice(b);
    ta.focus();
    ta.setSelectionRange(a + before.length, a + before.length + sel.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const linePrefix = (prefix, numbered = false) => {
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const start = value.lastIndexOf('\n', a - 1) + 1;
    let n = 0;
    const block = value.slice(start, b).split('\n').map((l) => (numbered ? `${++n}. ${l.replace(/^\d+[.)]\s+/, '')}` : l.startsWith(prefix) ? l : prefix + l)).join('\n');
    ta.value = value.slice(0, start) + block + value.slice(b);
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const newLine = () => (ta.selectionStart > 0 && ta.value[ta.selectionStart - 1] !== '\n' ? '\n' : '');
  const btn = (label, title, fn, cls = '') => h('button', { type: 'button', title, 'aria-label': title, class: cls, onclick: fn }, label);
  return h('div', { class: 'mdbar wrap-bar' },
    btn('B', 'Bold', () => insert('**', '**', 'bold text')),
    btn('Aa', 'Gradient highlight', () => insert('[[', ']]', 'highlight'), 'grad'),
    btn('H2', 'Heading', () => insert(`${newLine()}## `, '\n', 'Heading')),
    btn('H3', 'Sub-heading', () => insert(`${newLine()}### `, '\n', 'Sub-heading')),
    btn('• List', 'Bullet list', () => linePrefix('- ')),
    btn('1. List', 'Numbered list', () => linePrefix('', true)),
    btn('❝', 'Quote', () => linePrefix('> ')),
    btn('🔗', 'Link (select text first)', () => insert('[', '](https://)', 'link text')),
    btn('🖼 Image', 'Insert image', async () => {
      const m = await pickImage({ folder: 'articles', title: 'Insert image into the article' });
      if (m) insert(`${newLine()}![${(m.alt_en || m.path.split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')).replace(/[[\]]/g, '')}](${m.path})\n`);
    }));
}

async function edit({ root, setTitle, navigate, setDirtyCheck }, id) {
  let a;
  try {
    a = id ? (await q(sb.from('articles').select('*').eq('id', id).limit(1)))[0] : null;
  } catch (err) {
    if (!missingTable(err)) throw err;
    put(root, h('div', { class: 'page-head' }, h('h1', {}, 'Articles')), needSql());
    return;
  }
  if (id && !a) {
    put(root, h('div', { class: 'empty' }, 'Article not found. ', h('a', { href: '/admin/articles', 'data-link': '' }, 'Back to articles')));
    return;
  }
  a = a || { status: 'draft', lang: 'bn', author_name: 'MediVerse Dental', body: '' };
  const cover = a.cover_media_id ? (await q(sb.from('media').select('*').eq('id', a.cover_media_id).limit(1)))[0] : null;
  setTitle(id ? 'Edit article' : 'Write article');

  const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const f = {
    title: text(a.title, { maxlength: 200, id: 'title' }),
    slug: text(a.slug, { maxlength: 80, id: 'slug', autocapitalize: 'off', spellcheck: 'false', placeholder: 'e.g. why-we-forget' }),
    category: text(a.category, { maxlength: 40, id: 'category', placeholder: 'e.g. Guidelines, Pharmacology', list: 'catList' }),
    author_name: text(a.author_name, { maxlength: 120, id: 'author_name' }),
    lang: select(a.lang || 'bn', [['bn', 'বাংলা (Bangla)'], ['en', 'English']], { id: 'lang' }),
    published_at: h('input', { type: 'datetime-local', value: toLocal(a.published_at), id: 'published_at' }),
    excerpt: area(a.excerpt, { maxlength: 600, rows: 3, id: 'excerpt' }),
    body: area(a.body, { maxlength: 100000, rows: 18, id: 'body', class: 'tall body-editor' }),
  };
  let slugTouched = !!id;
  f.slug.addEventListener('input', () => { slugTouched = true; });
  f.title.addEventListener('input', () => { if (!slugTouched) f.slug.value = slugify(f.title.value); });
  const coverSlot = imageSlot({ media: cover, folder: 'articles', title: 'Cover image (1200×630 works best)' });

  // Live preview, rendered by the same formatter as the website (all text is escaped).
  const preview = h('div', { class: 'art-preview hidden', id: 'preview' });
  const previewBtn = h('button', { type: 'button', class: 'btn btn-sm', id: 'previewBtn' }, '👁 Preview');
  const drawPreview = () => {
    const html = articleHtml(f.body.value, (p) => publicUrl(p));
    preview.replaceChildren(...new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild.childNodes);
    preview.lang = f.lang.value;
  };
  previewBtn.addEventListener('click', () => {
    const show = preview.classList.toggle('hidden') === false;
    previewBtn.textContent = show ? '✎ Back to editing' : '👁 Preview';
    f.body.classList.toggle('hidden', show);
    if (show) drawPreview();
  });
  const words = h('span', { class: 'muted small' });
  const countWords = () => { words.textContent = `${f.body.value.split(/\s+/).filter(Boolean).length} words · about ${readMinutes(f.body.value)} min read`; };
  f.body.addEventListener('input', countWords); countWords();

  const read = () => ({ ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])), cover: coverSlot.get()?.id || null });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const statusLine = h('p', { class: 'muted small', id: 'statusLine' });
  const drawStatus = () => {
    statusLine.textContent = a.status === 'draft' ? 'Status: Draft (not on the website)'
      : isLive(a) ? `Status: Published · ${a.view_count || 0} views` : `Status: Scheduled for ${fmt(a.published_at)}`;
  };
  drawStatus();
  const form = h('form', { novalidate: true, id: 'articleForm' }, err, statusLine,
    h('fieldset', {}, h('legend', {}, 'Article'),
      field('Title *', f.title),
      field('Web address (slug) *', f.slug, 'Lowercase English letters, numbers and dashes. Page: /articles/<slug>. For a Bangla title, type a short English slug.'),
      h('div', { class: 'grid2' }, field('Category', f.category), field('Author name *', f.author_name)),
      h('datalist', { id: 'catList' }, ['Guidelines', 'Study tips', 'Pharmacology', 'Clinical', 'Exam', 'Career'].map((c) => h('option', { value: c }))),
      h('div', { class: 'grid2' }, field('Language of the article', f.lang), field('Publish date', f.published_at, 'Empty = now, when you publish. A future date schedules it.')),
      field('Short description (shown on the article list)', f.excerpt)),
    h('fieldset', {}, h('legend', {}, 'Cover image'), coverSlot.el),
    h('fieldset', {}, h('legend', {}, 'Article text'),
      h('div', { class: 'editor-head' }, editorBar(f.body), previewBtn),
      f.body, preview, words,
      h('p', { class: 'muted small' }, 'Tips: ## Heading · ### Sub-heading · “- ” bullet · “1. ” numbered · “> ” quote · empty line = new paragraph. Images come from the media library.')));
  const t = tracker(form, read, setDirtyCheck);

  async function save(status) {
    formError(err, '');
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    const bad = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.focus(); formError(err, msg); };
    const v = read();
    if (!v.title.trim()) return bad(f.title, 'Title is required.');
    const slug = v.slug.trim();
    if (!SLUG_RE.test(slug)) return bad(f.slug, 'Slug must use only lowercase English letters, numbers and single dashes (e.g. why-we-forget).');
    if (!v.author_name.trim()) return bad(f.author_name, 'Author name is required.');
    if (status === 'published' && !v.body.trim()) return bad(f.body, 'Write the article text before publishing.');
    const n = (x) => (x.trim() ? x.replace(/\r\n/g, '\n').trim() : null);
    let publishedAt = v.published_at ? new Date(v.published_at).toISOString() : null;
    if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString();
    const row = {
      title: v.title.trim(), slug, category: n(v.category), author_name: v.author_name.trim(), lang: v.lang,
      excerpt: n(v.excerpt), body: v.body.replace(/\r\n/g, '\n'), cover_media_id: v.cover, status,
      published_at: status === 'published' ? publishedAt : (publishedAt || null), read_minutes: readMinutes(v.body),
    };
    const saved = id
      ? await q(sb.from('articles').update(row).eq('id', id).select().single())
      : await q(sb.from('articles').insert(row).select().single());
    Object.assign(a, saved);
    f.published_at.value = toLocal(saved.published_at);
    t.reset();
    drawStatus();
    toast(status === 'published' ? (isLive(saved) ? 'Article published.' : 'Article scheduled.') : 'Draft saved.');
    if (!id) navigate(`/admin/articles/${saved.id}`, { replace: true, force: true });
    else drawExtra();
  }

  const extra = h('span', {});
  const drawExtra = () => {
    clear(extra);
    const pub = h('button', { class: 'btn btn-primary', type: 'button', id: 'publishBtn' }, a.status === 'published' ? 'Update' : 'Publish');
    pub.addEventListener('click', () => busy(pub, () => save('published').catch((e) => toast(errorText(e), 'err'))));
    const unpub = a.status === 'published' ? h('button', { class: 'btn', type: 'button', id: 'unpublishBtn' }, 'Unpublish') : null;
    unpub?.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Unpublish this article?', message: 'It will disappear from the website and become a draft again.', confirmLabel: 'Unpublish' }))) return;
      busy(unpub, () => save('draft').catch((e) => toast(errorText(e), 'err')));
    });
    extra.append(...[unpub, pub].filter(Boolean));
  };
  drawExtra();
  const bar = saveBar(t, () => save(a.status === 'published' ? 'published' : 'draft'), [extra]);
  bar.querySelector('#saveBtn').textContent = a.status === 'published' ? 'Save' : 'Save draft';
  bar.querySelector('#saveBtn').classList.remove('btn-primary');

  const del = id ? h('button', { class: 'btn btn-danger', type: 'button', id: 'deleteBtn' }, 'Delete article') : null;
  del?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this article?', message: 'This cannot be undone. (Its images stay in the media library.) To hide it instead, use Unpublish.', confirmLabel: 'Delete forever', danger: true, typeToConfirm: a.slug }))) return;
    await busy(del, async () => {
      try {
        const gone = await q(sb.from('articles').delete().eq('id', id).select('id'));
        if (!gone.length) throw new Error('Not allowed: your account cannot delete articles.');
        toast('Article deleted.'); navigate('/admin/articles', { force: true });
      } catch (e) { toast(errorText(e), 'err'); }
    });
  });
  put(root,
    h('a', { class: 'crumb', href: '/admin/articles', 'data-link': '' }, '← All articles'),
    h('div', { class: 'page-head' }, h('h1', {}, id ? 'Edit article' : 'Write article'),
      id && isLive(a) ? h('div', { class: 'actions' }, h('a', { class: 'btn btn-sm', href: `/articles/${a.slug}`, target: '_blank', rel: 'noopener' }, 'View on website ↗')) : null),
    form,
    del ? h('section', { class: 'panel', id: 'danger' }, h('h2', {}, 'Delete'), del) : null,
    bar);
}
