// MediVerse Dental admin — app shell: login, admin check, layout, routing.
import { h, clear, icon, toast, confirmDialog, errorText, spinner, busy } from './ui.js';
import { initClient, sb, q } from './db.js';

const app = document.getElementById('app');
const views = {
  dashboard: () => import('./views/dashboard.js'),
  courses: () => import('./views/courses.js'),
  mentors: () => import('./views/mentors.js'),
  homepage: () => import('./views/homepage.js'),
  media: () => import('./views/media.js'),
  settings: () => import('./views/settings.js'),
  reviews: () => import('./views/reviews.js'),
};
const NAV = [
  ['/admin', 'dashboard', 'Dashboard'],
  ['/admin/courses', 'courses', 'Courses'],
  ['/admin/mentors', 'mentors', 'Mentors'],
  ['/admin/reviews', 'reviews', 'Reviews'],
  ['/admin/homepage', 'homepage', 'Homepage'],
  ['/admin/media', 'media', 'Media'],
  ['/admin/settings', 'settings', 'Settings'],
];

const state = { user: null, role: null, path: location.pathname, dirty: null, shell: null };

// ------------------------------------------------------------ unsaved changes
// A view registers a function that says whether its form has unsaved edits.
export function setDirtyCheck(fn) { state.dirty = fn; }
const isDirty = () => { try { return !!state.dirty?.(); } catch { return false; } };
let leaving = false; // page is being closed/reloaded: requests get cancelled, that is not an error
window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } else leaving = true; });
window.addEventListener('pageshow', () => { leaving = false; });

async function leaveOk() {
  if (!isDirty()) return true;
  return confirmDialog({ title: 'Leave without saving?', message: 'You have unsaved changes on this page. They will be lost.', confirmLabel: 'Leave page', danger: true });
}

export async function navigate(path, { replace = false, force = false } = {}) {
  if (!force && path !== location.pathname + location.search && !(await leaveOk())) return;
  state.dirty = null;
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  route();
}

window.addEventListener('popstate', async () => {
  if (isDirty() && !(await leaveOk())) { history.pushState({}, '', state.path); return; }
  state.dirty = null;
  route();
});

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  closeMenu();
  navigate(a.getAttribute('href'));
});

// ------------------------------------------------------------------ boot
async function boot() {
  try {
    await initClient();
  } catch (err) {
    return renderFatal(err.message);
  }
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') { state.user = null; state.role = null; state.shell = null; state.dirty = null; history.replaceState({}, '', '/admin/login'); setTimeout(route, 0); }
  });
  route();
}

function renderFatal(message) {
  clear(app).append(h('div', { class: 'denied' }, h('div', { class: 'login-card' },
    h('img', { src: '/admin/logo-white.png', alt: 'MediVerse Dental' }),
    h('h1', {}, 'Admin unavailable'), h('p', { class: 'muted' }, message),
    h('button', { class: 'btn', onclick: () => location.reload() }, 'Try again'))));
}

// Is the logged-in user an admin? Reads only their own row (RLS allows exactly that).
async function loadAdmin() {
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return false;
  state.user = user;
  const rows = await q(sb.from('admin_users').select('role,display_name').eq('user_id', user.id).limit(1));
  state.role = rows[0]?.role || null;
  return true;
}

async function route() {
  state.path = location.pathname;
  const path = location.pathname.replace(/\/+$/, '') || '/admin';
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    if (path !== '/admin/login') {
      const next = path === '/admin' ? '' : `?next=${encodeURIComponent(path)}`;
      history.replaceState({}, '', `/admin/login${next}`);
    }
    return renderLogin();
  }
  if (!state.user) {
    clear(app).append(h('div', { class: 'boot', role: 'status' }, h('span', { class: 'spin' }), 'Checking your account…'));
    try {
      if (!(await loadAdmin())) { await sb.auth.signOut(); return; }
    } catch (err) {
      return renderFatal(errorText(err));
    }
  }
  if (!state.role) return renderDenied();
  if (path === '/admin/login') {
    const next = new URLSearchParams(location.search).get('next');
    history.replaceState({}, '', next && next.startsWith('/admin/') ? next : '/admin');
    return route();
  }
  renderShell();
  const parts = path.split('/').slice(2); // ['courses', 'id']
  const name = parts[0] || 'dashboard';
  for (const a of state.shell.nav.querySelectorAll('a')) a.classList.toggle('active', a.dataset.view === name);
  const main = clear(state.shell.main);
  if (!views[name]) {
    main.append(h('div', { class: 'empty' }, 'Page not found. ', h('a', { href: '/admin', 'data-link': '' }, 'Go to the dashboard')));
    return;
  }
  main.append(spinner());
  window.scrollTo(0, 0);
  try {
    const mod = await views[name]();
    if (state.path !== location.pathname) return;
    clear(main);
    await mod.render({ root: main, params: parts.slice(1), user: state.user, role: state.role, navigate, setDirtyCheck, setTitle });
  } catch (err) {
    if (leaving) return;
    console.error(err);
    clear(main).append(h('div', { class: 'form-error' }, 'Could not load this page: ', errorText(err)),
      h('button', { class: 'btn', onclick: () => route() }, 'Try again'));
  }
}

function setTitle(t) {
  document.title = `${t} · MediVerse Dental Admin`;
  if (state.shell) state.shell.title.textContent = t;
}

// ------------------------------------------------------------------ login
function renderLogin() {
  state.shell = null;
  setTitle('Log in');
  const email = h('input', { type: 'email', id: 'email', autocomplete: 'username', required: true, inputmode: 'email' });
  const password = h('input', { type: 'password', id: 'password', autocomplete: 'current-password', required: true });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Log in');
  const form = h('form', { novalidate: true },
    h('label', { class: 'field', for: 'email' }, h('span', {}, 'Email'), email),
    h('label', { class: 'field', for: 'password' }, h('span', {}, 'Password'), password),
    err, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    if (!email.value.trim() || !password.value) { err.textContent = 'Enter your email and password.'; err.classList.remove('hidden'); return; }
    await busy(submit, async () => {
      const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
      if (error) {
        err.textContent = /invalid login credentials/i.test(error.message) ? 'Wrong email or password.'
          : /email not confirmed/i.test(error.message) ? 'This email is not confirmed yet. Ask the owner to confirm it in Supabase.'
          : errorText(error);
        err.classList.remove('hidden');
        password.value = '';
        password.focus();
        return;
      }
      password.value = '';
      state.user = null;
      await route();
    });
  });
  clear(app).append(h('div', { class: 'login' }, h('div', { class: 'login-card' },
    h('img', { src: '/admin/logo-white.png', alt: 'MediVerse Dental' }),
    h('h1', {}, 'Admin login'),
    h('p', { class: 'muted' }, 'For MediVerse Dental team members only.'),
    form)));
  email.focus();
}

function renderDenied() {
  state.shell = null;
  setTitle('No access');
  const out = h('button', { class: 'btn btn-primary' }, 'Log out');
  out.addEventListener('click', () => busy(out, () => sb.auth.signOut()));
  clear(app).append(h('div', { class: 'denied' }, h('div', { class: 'login-card' },
    h('img', { src: '/admin/logo-white.png', alt: 'MediVerse Dental' }),
    h('h1', {}, 'No admin access'),
    h('p', { class: 'muted' }, `You are logged in as ${state.user?.email || 'this user'}, but this account is not an admin.`),
    h('p', { class: 'muted small' }, 'Ask the site owner to add you as an admin.'),
    out)));
}

// ------------------------------------------------------------------ layout
function closeMenu() {
  state.shell?.side.classList.remove('open');
  state.shell?.scrim.classList.add('hidden');
  document.body.classList.remove('lock');
}

function renderShell() {
  if (state.shell) return;
  const nav = h('nav', { 'aria-label': 'Admin' }, NAV.map(([href, view, label]) =>
    h('a', { href, 'data-link': '', dataset: { view } }, icon(view), label)));
  const logout = h('button', { class: 'btn btn-sm', type: 'button' }, 'Log out');
  logout.addEventListener('click', async () => {
    if (!(await leaveOk())) return;
    state.dirty = null;
    await busy(logout, () => sb.auth.signOut());
    toast('You are logged out.');
  });
  const side = h('aside', { class: 'side', id: 'side' },
    h('div', { class: 'brand' }, h('img', { src: '/admin/logo-white.png', alt: 'MediVerse Dental' }), h('b', {}, 'Admin')),
    nav,
    h('a', { class: 'btn btn-sm view-site', href: '/', target: '_blank', rel: 'noopener' }, icon('external'), 'View website'),
    h('div', { class: 'who' }, h('div', {}, state.user.email), h('span', { class: `badge ${state.role}` }, state.role), logout));
  const scrim = h('div', { class: 'scrim hidden', onclick: closeMenu });
  const title = h('div', { class: 'title' });
  const menuBtn = h('button', { class: 'btn btn-icon menu-btn', type: 'button', 'aria-label': 'Open menu', 'aria-controls': 'side' }, icon('menu'));
  menuBtn.addEventListener('click', () => { side.classList.add('open'); scrim.classList.remove('hidden'); document.body.classList.add('lock'); });
  const main = h('main', { class: 'content', id: 'main' });
  clear(app).append(side, scrim, h('div', { class: 'shell' },
    h('header', { class: 'topbar' }, menuBtn, h('img', { src: '/admin/logo-white.png', alt: '' }), title), main));
  state.shell = { side, scrim, nav, main, title };
}

boot();
