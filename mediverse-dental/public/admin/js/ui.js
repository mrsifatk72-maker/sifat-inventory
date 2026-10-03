// Small, safe DOM helpers. Text is always set with textContent (never innerHTML),
// so nothing typed into the admin can inject HTML into the admin itself.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'html') throw new Error('html attribute is not allowed');
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Like el.append(), but skips null/false (so conditional parts can be written inline).
export const put = (el, ...children) => { append(el, children); return el; };
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
export const spinner = (text = 'Loading…') => h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spin' }), text);

// SVG icons (static, trusted markup built with DOM APIs).
const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  courses: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z',
  mentors: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  homepage: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  media: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  settings: 'M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.48.48 0 0 0 13.93 2h-3.86a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.71 8.47a.49.49 0 0 0 .12.61l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.41.48.41h3.86c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
  external: 'M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm5 16H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z',
};
export function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'currentColor');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] || '');
  svg.append(p);
  return svg;
}

// ------------------------------------------------------------------ toasts
export function toast(message, type = 'ok', ms = 4000) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast ${type}`, role: type === 'err' ? 'alert' : 'status' }, message);
  box.append(t);
  setTimeout(() => t.remove(), type === 'err' ? Math.max(ms, 7000) : ms);
}

// ------------------------------------------------------------------ modals
export function modal(content, { wide = false, onClose } = {}) {
  const box = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true' }, content);
  const wrap = h('div', { class: 'modal-wrap' }, box);
  const close = () => { wrap.remove(); document.body.classList.remove('lock'); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  document.body.classList.add('lock');
  box.querySelector('input,select,textarea,button')?.focus();
  return { close, box };
}

// Promise<boolean>. `typeToConfirm` makes the user type a word (e.g. a slug) first.
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, typeToConfirm }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; m.close(); resolve(v); } };
    const input = typeToConfirm ? h('input', { type: 'text', autocomplete: 'off', 'aria-label': `Type ${typeToConfirm} to confirm` }) : null;
    const ok = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', disabled: !!typeToConfirm, onclick: () => finish(true) }, confirmLabel);
    input?.addEventListener('input', () => { ok.disabled = input.value.trim() !== typeToConfirm; });
    const m = modal([
      h('h2', {}, title),
      h('p', {}, message),
      input && h('label', { class: 'field' }, h('span', {}, 'Type ', h('b', {}, typeToConfirm), ' to confirm'), input),
      h('div', { class: 'btns' },
        h('button', { class: 'btn', type: 'button', onclick: () => finish(false) }, 'Cancel'),
        ok),
    ], { onClose: () => { if (!done) { done = true; resolve(false); } } });
  });
}

// ------------------------------------------------------------------ form fields
let uid = 0;
export function field(label, input, hint) {
  const id = input.id || (input.id = `f${++uid}`);
  return h('label', { class: 'field', for: id }, h('span', {}, label), input, hint ? h('small', { class: 'hint' }, hint) : null);
}
export const text = (value, attrs = {}) => h('input', { type: 'text', value: value ?? '', ...attrs });
export const area = (value, attrs = {}) => h('textarea', { rows: 3, ...attrs, value: value ?? '' });
export function select(value, options, attrs = {}) {
  const s = h('select', attrs, options.map(([v, label]) => h('option', { value: v }, label)));
  s.value = value ?? '';
  return s;
}
export const checkbox = (label, checked, attrs = {}) => {
  const c = h('input', { type: 'checkbox', checked, ...attrs });
  return { el: h('label', { class: 'check' }, c, label), input: c };
};

// ------------------------------------------------------------------ errors
// Turn database / storage errors into plain words.
export function errorText(err) {
  if (!err) return 'Something went wrong.';
  const code = err.code || err.statusCode || err.status;
  const msg = String(err.message || err.msg || err.error_description || err.error || err);
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Not allowed: your admin account does not have permission for this action.';
  if (code === '23505' || /duplicate key/i.test(msg)) {
    if (/slug/.test(msg)) return 'That slug (web address) is already used. Choose another.';
    if (/sha256/.test(msg)) return 'This exact image is already in the media library.';
    if (/path/.test(msg)) return 'A file with this name already exists in that folder.';
    return 'This item already exists.';
  }
  if (code === '23503' || /foreign key/i.test(msg)) return 'This item is still being used somewhere else, so it cannot be deleted.';
  if (code === '23514' || /check constraint/i.test(msg)) return `A value is not in the allowed format (${(/"([^"]+)"/.exec(msg) || [])[1] || 'check the fields'}).`;
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Network problem — check your internet connection and try again.';
  if (/JWT expired|invalid JWT/i.test(msg)) return 'Your login has expired. Please log in again.';
  return msg;
}

// Buttons that show a spinner while an async action runs.
export async function busy(btn, fn) {
  const old = [...btn.childNodes];
  btn.disabled = true;
  clear(btn).append(h('span', { class: 'spin' }), 'Working…');
  try { return await fn(); } finally { btn.disabled = false; clear(btn).append(...old); }
}

export const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[_\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
