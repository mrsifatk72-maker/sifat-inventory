// Account security: change your own password (Supabase Auth).
// The current password is checked first by signing in with it; then the new password is set
// with supabase.auth.updateUser, and every other device is signed out.
// Passwords are never stored by this app (not in the database, not in browser storage).
import { h, put, toast, errorText, busy } from '../ui.js';
import { sb } from '../db.js';

export const PASSWORD_RULES = 'At least 10 characters, with letters and numbers.';
export function passwordProblem(pw, { email = '' } = {}) {
  if (pw.length < 10) return 'The new password must be at least 10 characters long.';
  if (pw.length > 72) return 'The new password is too long (max 72 characters).';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use both letters and numbers in the new password.';
  const name = email.split('@')[0].toLowerCase();
  if (name.length >= 4 && pw.toLowerCase().includes(name)) return 'Do not use your email name inside the password.';
  return null;
}

// Password box with a show / hide button.
export function passwordInput(id, autocomplete) {
  const input = h('input', { type: 'password', id, autocomplete, maxlength: 72, spellcheck: 'false', autocapitalize: 'off' });
  const eye = h('button', { type: 'button', class: 'btn btn-sm pw-eye', 'aria-label': 'Show password', 'aria-pressed': 'false' }, 'Show');
  eye.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.textContent = show ? 'Hide' : 'Show';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  return { input, el: h('div', { class: 'pw-wrap' }, input, eye) };
}

const label = (forId, text, el, hint) => h('label', { class: 'field', for: forId }, h('span', {}, text), el, hint ? h('small', { class: 'hint' }, hint) : null);

export async function render({ root, setTitle, user, role }) {
  setTitle('Account security');
  const cur = passwordInput('currentPassword', 'current-password');
  const next = passwordInput('newPassword', 'new-password');
  const again = passwordInput('confirmPassword', 'new-password');
  const err = h('div', { class: 'form-error hidden', role: 'alert', id: 'pwError' });
  const ok = h('div', { class: 'form-ok hidden', role: 'status', id: 'pwOk' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit', id: 'changePwBtn' }, 'Change password');
  const show = (box, msg) => { box.textContent = msg; box.classList.toggle('hidden', !msg); };
  const clearAll = () => { cur.input.value = ''; next.input.value = ''; again.input.value = ''; };

  const form = h('form', { novalidate: true, id: 'passwordForm' },
    label('currentPassword', 'Current password', cur.el),
    label('newPassword', 'New password', next.el, PASSWORD_RULES),
    label('confirmPassword', 'Confirm new password', again.el),
    err, ok, submit);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    show(err, ''); show(ok, '');
    const c = cur.input.value, n = next.input.value, a = again.input.value;
    if (!c || !n || !a) return show(err, 'Fill in all three fields.');
    const problem = passwordProblem(n, { email: user.email });
    if (problem) return show(err, problem);
    if (n !== a) return show(err, 'The new password and the confirmation do not match.');
    if (n === c) return show(err, 'The new password must be different from the current one.');
    busy(submit, async () => {
      try {
        // 1. Prove the current password (a wrong one is rejected by Supabase Auth).
        const check = await sb.auth.signInWithPassword({ email: user.email, password: c });
        if (check.error) {
          cur.input.value = '';
          return show(err, /invalid login credentials/i.test(check.error.message) ? 'The current password is not correct.' : errorText(check.error));
        }
        // 2. Set the new password.
        const upd = await sb.auth.updateUser({ password: n });
        if (upd.error) {
          const m = upd.error.message || '';
          return show(err, /same.*password|different from the old/i.test(m) ? 'The new password must be different from the current one.'
            : /weak|pwned|leaked|characters/i.test(m) ? `This password is not strong enough: ${m}`
            : /reauthenticat/i.test(m) ? 'For security, please log out, log in again and then change the password.'
            : 'The password could not be changed. Please try again.');
        }
        // 3. Sign out every other device that used the old password.
        await sb.auth.signOut({ scope: 'others' }).catch(() => {});
        clearAll();
        show(ok, 'Your password has been changed. Other devices were signed out. Use the new password next time you log in.');
        toast('Password changed.');
      } catch (e2) {
        show(err, errorText(e2));
      }
    });
  });

  put(root,
    h('div', { class: 'page-head' }, h('h1', {}, 'Account security')),
    h('section', { class: 'panel' }, h('h2', {}, 'Your account'),
      h('dl', { class: 'kv' }, h('dt', {}, 'Email'), h('dd', {}, user.email), h('dt', {}, 'Role'), h('dd', {}, role))),
    h('section', { class: 'panel' }, h('h2', {}, 'Change password'),
      h('p', { class: 'muted small' }, 'You will stay logged in on this device. Forgot your password? Log out and use “Forgot password?” on the login page.'),
      form),
    h('section', { class: 'panel' }, h('h2', {}, 'Tips'),
      h('ul', { class: 'tips' },
        h('li', {}, 'Each admin should have their own login — do not share passwords.'),
        h('li', {}, 'Use a password you do not use anywhere else.'),
        h('li', {}, 'If you think someone else knows your password, change it here right away.'))));
}
