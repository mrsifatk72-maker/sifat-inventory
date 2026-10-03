// Shared form pieces: sticky save bar with unsaved-changes tracking, image picker.
import { h, clear, modal, toast, busy, errorText, spinner, fmtBytes, checkbox } from './ui.js';
import { sb, q, publicUrl, uploadMedia, FOLDERS, checkFile, resizeEnabled, setResizeEnabled, RESIZE_MAX } from './db.js';

// Tracks whether a form differs from its last saved state.
// `read()` returns a plain JSON-able object of the current form values.
export function tracker(form, read, setDirtyCheck) {
  let saved = JSON.stringify(read());
  const state = h('span', { class: 'state' }, 'All changes saved');
  const t = {
    isDirty: () => JSON.stringify(read()) !== saved,
    reset() { saved = JSON.stringify(read()); t.update(); },
    update() {
      const d = t.isDirty();
      state.textContent = d ? 'Unsaved changes' : 'All changes saved';
      state.classList.toggle('dirty', d);
    },
    state,
  };
  form.addEventListener('input', t.update);
  form.addEventListener('change', t.update);
  setDirtyCheck(t.isDirty);
  return t;
}

export function saveBar(t, onSave, extra = []) {
  const btn = h('button', { class: 'btn btn-primary', type: 'submit', id: 'saveBtn' }, 'Save');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await busy(btn, async () => {
      try { await onSave(); } catch (err) { console.error(err); toast(errorText(err), 'err'); }
    });
    t.update();
  });
  return h('div', { class: 'savebar' }, t.state, ...extra, btn);
}

// On/Off switch for the image resizer (remembered in this browser).
export function resizeToggle() {
  const c = checkbox(`Make images smaller before upload (max ${RESIZE_MAX}px, WebP) — saves space`, resizeEnabled(), { class: 'resize-toggle' });
  c.input.addEventListener('change', () => { setResizeEnabled(c.input.checked); for (const x of document.querySelectorAll('.resize-toggle')) x.checked = c.input.checked; });
  return c.el;
}
export const savedText = (o) => (o && o.to < o.from ? ` (${fmtBytes(o.from)} → ${fmtBytes(o.to)})` : '');

export const formError = (box, msg) => { box.textContent = msg; box.classList.toggle('hidden', !msg); if (msg) box.scrollIntoView({ block: 'center', behavior: 'smooth' }); };

// --------------------------------------------------------------- image picker
// Opens a modal: choose an existing image from one folder, or upload a new one.
// Resolves the chosen media row, or null when cancelled.
export function pickImage({ folder, title = 'Choose image' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; m.close(); resolve(v); } };
    const grid = h('div', { class: 'media-grid' }, spinner());
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', id: 'pickFile' });
    const up = h('button', { class: 'btn btn-primary', type: 'button' }, 'Upload & use');
    up.addEventListener('click', () => busy(up, async () => {
      const f = file.files[0];
      const bad = checkFile(f);
      if (bad) return toast(bad, 'err');
      try {
        const { media, duplicate, optimized } = await uploadMedia(f, folder);
        toast(duplicate ? `This image was already uploaded (${media.path}) — using it.` : `Image uploaded${savedText(optimized)}.`);
        finish(media);
      } catch (err) { toast(errorText(err), 'err'); }
    }));
    const label = (FOLDERS.find((x) => x[0] === folder) || [])[2] || folder;
    const m = modal([
      h('h2', {}, title),
      h('p', {}, `Upload a new image (JPG, PNG, WebP or AVIF) or pick one from “${label}”.`),
      h('div', { class: 'drop' }, h('label', { class: 'field', for: 'pickFile' }, h('span', {}, 'New image'), file), resizeToggle(), up),
      h('h2', { class: 'pick-head' }, 'Already uploaded'),
      grid,
      h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => finish(null) }, 'Cancel')),
    ], { wide: true, onClose: () => { if (!done) { done = true; resolve(null); } } });
    q(sb.from('media').select('*').like('path', `${folder}/%`).order('created_at', { ascending: false }))
      .then((rows) => {
        clear(grid);
        if (!rows.length) grid.append(h('div', { class: 'empty' }, 'No images in this folder yet.'));
        for (const r of rows) {
          grid.append(h('button', { class: 'tile', type: 'button', onclick: () => finish(r), title: r.path },
            h('div', { class: 'img' }, h('img', { src: publicUrl(r.path), alt: r.alt_en || '', loading: 'lazy' })),
            h('div', { class: 'cap' }, h('b', {}, r.path.split('/').pop()), ` · ${fmtBytes(r.size_bytes)}`)));
        }
      })
      .catch((err) => { clear(grid).append(h('div', { class: 'form-error' }, errorText(err))); });
  });
}

// An image slot inside a form: preview + Change / Remove buttons.
export function imageSlot({ media, folder, round = false, title, allowRemove = true, onChange }) {
  let current = media || null;
  const box = h('div', { class: 'preview' });
  const changed = () => { onChange?.(current); box.dispatchEvent(new Event('input', { bubbles: true })); };
  const draw = () => {
    clear(box);
    box.append(current
      ? h('img', { class: `pimg${round ? ' round' : ''}`, src: publicUrl(current.path), alt: current.alt_en || '' })
      : h('div', { class: `pimg empty${round ? ' round' : ''}` }, 'No image'));
    const change = h('button', { class: 'btn btn-sm', type: 'button' }, current ? 'Change image' : 'Choose image');
    change.addEventListener('click', async () => {
      const picked = await pickImage({ folder, title });
      if (picked) { current = picked; draw(); changed(); }
    });
    const remove = current && allowRemove ? h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => { current = null; draw(); changed(); } }, 'Remove') : null;
    box.append(h('div', { class: 'pinfo' }, current ? current.path : 'Nothing selected', h('br'), change, remove));
  };
  draw();
  return { el: box, get: () => current };
}

// Repeatable list editor (features, links, buttons…).
export function repeater({ items, make, addLabel, max = 30, onChange }) {
  const list = h('div', { class: 'rep' });
  const rows = [];
  const notify = () => { list.dispatchEvent(new Event('input', { bubbles: true })); onChange?.(); };
  const add = (item) => {
    const r = make(item);
    const up = h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Move up' }, '↑');
    const down = h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Move down' }, '↓');
    const del = h('button', { class: 'btn btn-sm btn-danger', type: 'button' }, 'Remove');
    const wrap = h('div', { class: 'rep-item' }, h('div', { class: 'rep-tools' }, up, down, del), r.el);
    const entry = { wrap, read: r.read };
    up.addEventListener('click', () => { const i = rows.indexOf(entry); if (i > 0) { rows.splice(i, 1); rows.splice(i - 1, 0, entry); redraw(); notify(); } });
    down.addEventListener('click', () => { const i = rows.indexOf(entry); if (i < rows.length - 1) { rows.splice(i, 1); rows.splice(i + 1, 0, entry); redraw(); notify(); } });
    del.addEventListener('click', () => { rows.splice(rows.indexOf(entry), 1); redraw(); notify(); });
    rows.push(entry);
  };
  const redraw = () => { clear(list); for (const r of rows) list.append(r.wrap); addBtn.disabled = rows.length >= max; };
  const addBtn = h('button', { class: 'btn btn-sm', type: 'button' }, addLabel);
  addBtn.addEventListener('click', () => { add(undefined); redraw(); notify(); rows.at(-1).wrap.querySelector('input,select,textarea')?.focus(); });
  for (const it of items || []) add(it);
  redraw();
  return { el: h('div', {}, list, addBtn), read: () => rows.map((r) => r.read()) };
}
