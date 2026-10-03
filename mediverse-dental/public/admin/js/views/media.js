// Media library for the existing "public-media" bucket: browse by folder, upload,
// preview, copy public URL, edit alt text, replace the file, delete when unused.
import { h, put, clear, field, text, select, modal, toast, confirmDialog, errorText, busy, fmtBytes } from '../ui.js';
import { sb, q, publicUrl, uploadMedia, replaceMedia, deleteMedia, mediaUsage, FOLDERS, checkFile } from '../db.js';

const USED_BY = {
  'courses.flyer': 'Course flyer', 'courses.thumbnail': 'Course thumbnail', 'mentors.photo': 'Mentor photo',
  'page_sections.image': 'Homepage section', 'banners.image': 'Banner',
  'site_settings.logo_dark': 'Site logo (dark)', 'site_settings.logo_light': 'Site logo (light)', 'site_settings.og_image': 'Share image',
};

export async function render({ root, setTitle }) {
  setTitle('Media');
  let items = [];
  let usage = new Map();
  const folder = select('', [['', 'All folders'], ...FOLDERS.map(([f, , label]) => [f, `${label} (${f}/)`])], { 'aria-label': 'Folder', id: 'mediaFolder' });
  const search = h('input', { type: 'search', placeholder: 'Search file name…', 'aria-label': 'Search media', id: 'mediaSearch' });
  const grid = h('div', { class: 'media-grid', id: 'mediaGrid' });
  const countEl = h('p', { class: 'muted small' });

  const load = async () => {
    const [rows, uses] = await Promise.all([
      q(sb.from('media').select('*').order('path')),
      q(sb.from('media_usage').select('media_id,used_by')),
    ]);
    items = rows;
    usage = uses.reduce((m, u) => m.set(u.media_id, [...(m.get(u.media_id) || []), u.used_by]), new Map());
    draw();
  };
  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const rows = items.filter((m) => (!folder.value || m.path.startsWith(folder.value + '/')) && (!term || m.path.toLowerCase().includes(term) || (m.alt_en || '').toLowerCase().includes(term)));
    countEl.textContent = `${rows.length} of ${items.length} files`;
    clear(grid);
    if (!rows.length) grid.append(h('div', { class: 'empty' }, 'No files here yet.'));
    for (const m of rows) {
      const n = (usage.get(m.id) || []).length;
      grid.append(h('button', { class: 'tile', type: 'button', title: m.path, onclick: () => details(m) },
        h('div', { class: 'img' }, h('img', { src: publicUrl(m.path), alt: m.alt_en || '', loading: 'lazy' })),
        h('div', { class: 'cap' }, h('b', {}, m.path), h('br'), `${fmtBytes(m.size_bytes)} · ${n ? `used ${n}×` : 'not used'}`)));
    }
  };
  folder.addEventListener('input', draw);
  search.addEventListener('input', draw);

  // ---- upload
  const upFolder = select('images', FOLDERS.map(([f, , label]) => [f, `${label} → ${f}/`]), { id: 'uploadFolder' });
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', id: 'uploadFile', multiple: true });
  const alt = text('', { maxlength: 300, id: 'uploadAlt', placeholder: 'Describe the image (optional)' });
  const upBtn = h('button', { class: 'btn btn-primary', type: 'button', id: 'uploadBtn' }, 'Upload');
  upBtn.addEventListener('click', () => busy(upBtn, async () => {
    const files = [...file.files];
    if (!files.length) return toast('Choose an image first.', 'err');
    for (const f of files) {
      const bad = checkFile(f);
      if (bad) { toast(`${f.name}: ${bad}`, 'err'); continue; }
      try {
        const { media, duplicate } = await uploadMedia(f, upFolder.value, { alt_en: alt.value.trim() || null });
        toast(duplicate ? `${f.name} is already in the library as ${media.path}.` : `Uploaded ${media.path}`, duplicate ? 'err' : 'ok');
      } catch (err) { toast(`${f.name}: ${errorText(err)}`, 'err'); }
    }
    file.value = ''; alt.value = '';
    folder.value = upFolder.value;
    await load();
  }));

  async function details(m) {
    const used = await mediaUsage(m.id).catch(() => []);
    const url = publicUrl(m.path);
    const altEn = text(m.alt_en, { maxlength: 300, id: 'altEn' });
    const altBn = text(m.alt_bn, { maxlength: 300, lang: 'bn', id: 'altBn' });
    const copy = h('button', { class: 'btn btn-sm', type: 'button', id: 'copyUrl' }, 'Copy public URL');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); toast('Public URL copied.'); } catch { urlBox.select(); toast('Select and copy the URL from the box.'); }
    });
    const urlBox = h('input', { type: 'text', value: url, readonly: true, 'aria-label': 'Public URL', id: 'publicUrl' });
    const saveAlt = h('button', { class: 'btn btn-sm', type: 'button' }, 'Save description');
    saveAlt.addEventListener('click', () => busy(saveAlt, async () => {
      try {
        Object.assign(m, await q(sb.from('media').update({ alt_en: altEn.value.trim() || null, alt_bn: altBn.value.trim() || null }).eq('id', m.id).select().single()));
        toast('Description saved.');
      } catch (err) { toast(errorText(err), 'err'); }
    }));
    const repFile = h('input', { type: 'file', accept: m.mime, id: 'replaceFile' });
    const repBtn = h('button', { class: 'btn btn-sm', type: 'button', id: 'replaceBtn' }, 'Replace image');
    repBtn.addEventListener('click', () => busy(repBtn, async () => {
      const f = repFile.files[0];
      if (!f) return toast('Choose the new image first.', 'err');
      if (!(await confirmDialog({ title: 'Replace this image?', message: `Every page that uses ${m.path} will show the new image (it can take up to ~10 minutes to appear everywhere). The web address stays the same.`, confirmLabel: 'Replace' }))) return;
      try { Object.assign(m, await replaceMedia(m, f)); toast('Image replaced.'); dlg.close(); await load(); } catch (err) { toast(errorText(err), 'err'); }
    }));
    const delBtn = h('button', { class: 'btn btn-sm btn-danger', type: 'button', id: 'deleteMediaBtn', disabled: used.length > 0 }, 'Delete');
    delBtn.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Delete this image?', message: `${m.path} will be deleted permanently. Anyone with the old link will no longer see it.`, confirmLabel: 'Delete', danger: true }))) return;
      await busy(delBtn, async () => {
        try { const r = await deleteMedia(m); toast(r.warning || 'Image deleted.', r.warning ? 'err' : 'ok'); dlg.close(); await load(); } catch (err) { toast(errorText(err), 'err'); }
      });
    });
    const dlg = modal([
      h('h2', {}, m.path.split('/').pop()),
      h('div', { class: 'preview' }, h('img', { class: 'pimg big', src: url, alt: m.alt_en || '' }),
        h('dl', { class: 'kv pinfo' },
          h('dt', {}, 'Folder'), h('dd', {}, m.path.split('/')[0] + '/'),
          h('dt', {}, 'Path'), h('dd', {}, m.path),
          h('dt', {}, 'Type'), h('dd', {}, m.mime),
          h('dt', {}, 'Size'), h('dd', {}, `${fmtBytes(m.size_bytes)}${m.width ? ` · ${m.width}×${m.height}px` : ''}`),
          h('dt', {}, 'Used by'), h('dd', { id: 'usedBy' }, used.length ? used.map((u) => USED_BY[u.used_by] || u.used_by).join(', ') : 'Not used anywhere'))),
      field('Public URL', urlBox), copy,
      h('h2', { class: 'pick-head' }, 'Description (alt text)'),
      h('div', { class: 'grid2' }, field('English', altEn), field('বাংলা', altBn)), saveAlt,
      h('h2', { class: 'pick-head' }, 'Replace image'),
      h('p', {}, `Upload a new ${m.mime.replace('image/', '').toUpperCase()} file to replace this one. The web address stays the same.`),
      field('New file', repFile), repBtn,
      h('h2', { class: 'pick-head' }, 'Delete'),
      h('p', {}, used.length ? 'This image is in use, so it cannot be deleted. Change it on those pages first.' : 'Not used anywhere — safe to delete.'),
      delBtn,
      h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Close')),
    ], { wide: true });
  }

  put(root, 
    h('div', { class: 'page-head' }, h('h1', {}, 'Media library')),
    h('section', { class: 'panel' }, h('h2', {}, 'Upload images'),
      h('p', { class: 'muted small' }, 'JPG, PNG, WebP or AVIF · max 5 MB each · stored in the public-media bucket.'),
      h('div', { class: 'grid2' }, field('Folder', upFolder), field('Image file(s)', file)),
      field('Description (alt text, English)', alt), upBtn),
    h('div', { class: 'toolbar' }, search, folder), countEl, grid);
  grid.append(h('div', { class: 'loading' }, h('span', { class: 'spin' }), 'Loading…'));
  await load();
}
