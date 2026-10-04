// MediVerse Dental admin — app shell: login, admin check, layout, routing.
import { h, clear, icon, toast, confirmDialog, errorText, spinner, busy } from './ui.js';
import { initClient, sb, q } from './db.js';
import { passwordInput, passwordProblem, PASSWORD_RULES } from './views/account.js';

const app = document.getElementById('app');
const views = {
  dashboard: () => import('./views/dashboard.js'),
  courses: () => import('./views/courses.js'),
  mentors: () => import('./views/mentors.js'),
  homepage: () => import('./views/homepage.js'),
  media: () => import('./views/media.js'),
  settings: () => import('./views/settings.js'),
  reviews: () => import('./views/reviews.js'),
  articles: () => import('./views/articles.js'),
  team: () => import('./views/team.js'),
  books: () => import('./views/books.js'),
  navigation: () => import('./views/navigation.js'),
  account: () => import('./views/account.js'),
};
const NAV = [
  ['/admin', 'dashboard', 'Dashboard'],
  ['/admin/courses', 'courses', 'Courses'],
  ['/admin/mentors', 'mentors', 'Mentors'],
  ['/admin/reviews', 'reviews', 'Reviews'],
  ['/admin/articles', 'articles', 'Articles'],
  ['/admin/team', 'team', 'Team'],
  ['/admin/books', 'books', 'Books'],
  ['/admin/homepage', 'homepage', 'Homepage'],
  ['/admin/navigation', 'navigation', 'Navigation'],
  ['/admin/media', 'media', 'Media'],
  ['/admin/settings', 'settings', 'Settings'],
  ['/admin/account', 'account', 'Account security'],
];

const state = { user: null, role: null, path: location.pathname, dirty: null, shell: null };
let notice = ''; // one-time message for the login page (e.g. after a password reset)

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
  if (path === '/admin/reset') return renderReset();
  if (path === '/admin/forgot') return renderForgot();
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
  const info = notice ? h('div', { class: 'form-ok', role: 'status' }, notice) : null;
  notice = '';
  const forgot = h('a', { href: '/admin/forgot', class: 'forgot', id: 'forgotLink' }, 'Forgot password?');
  forgot.addEventListener('click', (e) => { e.preventDefault(); history.pushState({}, '', '/admin/forgot'); route(); });
  const form = h('form', { novalidate: true },
    info,
    h('label', { class: 'field', for: 'email' }, h('span', {}, 'Email'), email),
    h('label', { class: 'field', for: 'password' }, h('span', {}, 'Password'), password),
    err, submit, forgot);
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

const card = (...kids) => clear(app).append(h('div', { class: 'login' }, h('div', { class: 'login-card' }, h('img', { src: '/admin/logo-white.png', alt: 'MediVerse Dental' }), ...kids)));
const backToLogin = () => { const a = h('a', { href: '/admin/login', class: 'forgot' }, '← Back to login'); a.addEventListener('click', (e) => { e.preventDefault(); history.pushState({}, '', '/admin/login'); route(); }); return a; };

// "Forgot password?": Supabase emails a one-time reset link that opens /admin/reset.
// The answer is the same whether or not the email has an account (nothing is revealed).
let lastResetRequest = 0;
function renderForgot() {
  state.shell = null;
  setTitle('Reset password');
  const email = h('input', { type: 'email', id: 'resetEmail', autocomplete: 'username', inputmode: 'email', required: true });
  const msg = h('div', { class: 'form-ok hidden', role: 'status', id: 'resetSent' });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit', id: 'sendResetBtn' }, 'Send reset link');
  const form = h('form', { novalidate: true }, h('label', { class: 'field', for: 'resetEmail' }, h('span', {}, 'Admin email'), email), err, msg, submit, backToLogin());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { err.textContent = 'Enter your admin email address.'; err.classList.remove('hidden'); return; }
    if (Date.now() - lastResetRequest < 60000) { err.textContent = 'Please wait a minute before asking for another link.'; err.classList.remove('hidden'); return; }
    await busy(submit, async () => {
      lastResetRequest = Date.now();
      const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: `${location.origin}/admin/reset` });
      if (error && /fetch|network/i.test(error.message)) { err.textContent = errorText(error); err.classList.remove('hidden'); return; }
      msg.textContent = 'If this email belongs to an admin account, a reset link has been sent. Check your inbox (and spam). The link works once and expires soon.';
      msg.classList.remove('hidden');
    });
  });
  card(h('h1', {}, 'Forgot password?'), h('p', { class: 'muted' }, 'Enter your admin email. We will send you a link to set a new password.'), form);
  email.focus();
}

// Opened from the reset email. Supabase signs the person in with a one-time recovery session;
// they choose a new password, then every session is signed out and they log in again.
async function renderReset() {
  state.shell = null;
  setTitle('Set a new password');
  const { data: { session } } = await sb.auth.getSession();
  history.replaceState({}, '', '/admin/reset'); // remove the one-time tokens from the address bar
  if (!session) {
    const again = h('a', { href: '/admin/forgot', class: 'btn btn-primary' }, 'Request a new link');
    again.addEventListener('click', (e) => { e.preventDefault(); history.pushState({}, '', '/admin/forgot'); route(); });
    card(h('h1', {}, 'Link not valid'), h('p', { class: 'muted', id: 'resetInvalid' }, 'This password-reset link is invalid or has expired. Request a new one.'), again, h('p', {}, backToLogin()));
    return;
  }
  const next = passwordInput('resetNew', 'new-password');
  const again = passwordInput('resetConfirm', 'new-password');
  const err = h('div', { class: 'form-error hidden', role: 'alert', id: 'resetError' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit', id: 'setPasswordBtn' }, 'Save new password');
  const form = h('form', { novalidate: true },
    h('label', { class: 'field', for: 'resetNew' }, h('span', {}, 'New password'), next.el, h('small', { class: 'hint' }, PASSWORD_RULES)),
    h('label', { class: 'field', for: 'resetConfirm' }, h('span', {}, 'Confirm new password'), again.el), err, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    const n = next.input.value;
    const problem = passwordProblem(n, { email: session.user?.email || '' }) || (n !== again.input.value ? 'The two passwords do not match.' : null);
    if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
    await busy(submit, async () => {
      const { error } = await sb.auth.updateUser({ password: n });
      if (error) {
        err.textContent = /same.*password|different from the old/i.test(error.message) ? 'Choose a password you have not used before.' : 'The password could not be changed. Request a new link and try again.';
        err.classList.remove('hidden');
        return;
      }
      next.input.value = ''; again.input.value = '';
      notice = 'Password updated. Log in with your new password.';
      await sb.auth.signOut({ scope: 'global' }); // ends every session, including this one → login page
    });
  });
  card(h('h1', {}, 'Set a new password'), h('p', { class: 'muted' }, `For ${session.user?.email || 'your account'}.`), form);
  next.input.focus();
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
