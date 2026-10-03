import { h, put } from '../ui.js';
import { sb, q } from '../db.js';

const count = (table, filter) => {
  let r = sb.from(table).select('*', { count: 'exact', head: true });
  if (filter) r = filter(r);
  return q(r);
};

export async function render({ root, setTitle, user }) {
  setTitle('Dashboard');
  const [courses, live, mentors, sections, visibleSections, media] = await Promise.all([
    count('courses', (r) => r.is('archived_at', null)),
    count('courses', (r) => r.is('archived_at', null).in('status', ['active', 'upcoming'])),
    count('mentors', (r) => r.is('archived_at', null)),
    count('page_sections'),
    count('page_sections', (r) => r.eq('is_visible', true)),
    count('media'),
  ]);
  const card = (href, n, label, sub) => h('a', { class: 'stat-card', href, 'data-link': '' }, h('b', { class: 'grad-text' }, String(n)), h('span', {}, label), sub ? h('small', {}, sub) : null);
  put(root, 
    h('div', { class: 'page-head' }, h('h1', {}, 'Welcome back')),
    h('p', { class: 'muted lead' }, `Logged in as ${user.email}`),
    h('div', { class: 'cards', id: 'stats' },
      card('/admin/courses', courses, 'Total Courses', `${live} visible on the website`),
      card('/admin/mentors', mentors, 'Total Mentors'),
      card('/admin/homepage', sections, 'Homepage Sections', `${visibleSections} visible`),
      card('/admin/media', media, 'Media Files')),
    h('section', { class: 'panel' }, h('h2', {}, 'Quick actions'),
      h('div', { class: 'quick' },
        h('a', { class: 'btn btn-primary', href: '/admin/courses/new', 'data-link': '' }, '+ Add course'),
        h('a', { class: 'btn', href: '/admin/mentors/new', 'data-link': '' }, '+ Add mentor'),
        h('a', { class: 'btn', href: '/admin/homepage', 'data-link': '' }, 'Edit homepage text'),
        h('a', { class: 'btn', href: '/admin/settings', 'data-link': '' }, 'Contact, social & SEO'),
        h('a', { class: 'btn', href: '/admin/media', 'data-link': '' }, 'Upload image'),
        h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'Open website ↗'))),
    h('p', { class: 'muted small' }, 'Changes appear on the website within about 1 minute after you save.'),
  );
}
