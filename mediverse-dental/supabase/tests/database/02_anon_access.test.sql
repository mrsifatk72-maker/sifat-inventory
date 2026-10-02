-- What an anonymous website visitor (anon key, no login) can and cannot do.
-- Requires the seed (22 active courses, 10 active mentors, 29 media).
begin;
select no_plan();

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'owner@example.test');
insert into public.admin_users (user_id, role) values ('a0000000-0000-4000-8000-000000000001', 'owner');

insert into public.media (path, kind, mime, size_bytes)
values ('flyers/hidden-course.jpg', 'flyer', 'image/jpeg', 1000),
       ('images/unused-upload.jpg', 'image', 'image/jpeg', 1000);

insert into public.courses (slug, title_en, phase_id, status, flyer_media_id)
values ('secret-hidden-course', 'Hidden course', (select id from public.phases where code = 1), 'hidden',
        (select id from public.media where path = 'flyers/hidden-course.jpg'));
insert into public.courses (slug, title_en, phase_id, status, archived_at)
values ('old-archived-course', 'Archived course', (select id from public.phases where code = 1), 'active', now());
insert into public.courses (slug, title_en, phase_id, status)
values ('coming-soon-course', 'Upcoming course', (select id from public.phases where code = 2), 'upcoming');

insert into public.mentors (slug, name, status) values ('hidden-mentor', 'Hidden Mentor', 'hidden');
insert into public.faqs (question_en, answer_en, is_visible) values ('Hidden Q', 'Hidden A', false);
insert into public.nav_items (location, label_en, url, is_visible) values ('header', 'Hidden link', '#x', false);

insert into public.analytics_sessions (session_id, visitor_id) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001');
insert into public.analytics_events (type, visitor_id, session_id, path)
values ('pageview', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '/');

-- ------------------------------------------------------- act as visitor
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is((select auth.uid()), null, 'anonymous visitor has no user id');

-- Public content: only what the website shows
select is((select count(*)::int from public.courses), 23, 'anon sees 22 active + 1 upcoming course');
select is((select count(*)::int from public.courses where slug in ('secret-hidden-course', 'old-archived-course')), 0,
          'anon cannot see hidden or archived courses');
select is((select status::text from public.courses where slug = 'coming-soon-course'), 'upcoming',
          'anon sees upcoming courses');
select is((select count(*)::int from public.mentors), 10, 'anon sees the 10 active mentors');
select is((select count(*)::int from public.mentors where slug = 'hidden-mentor'), 0, 'anon cannot see hidden mentors');
select is((select count(*)::int from public.course_mentors), 7, 'anon sees mentor assignments of visible courses');
select is((select count(*)::int from public.media), 29, 'anon sees only media used on the public site');
select is((select count(*)::int from public.media where path in ('flyers/hidden-course.jpg', 'images/unused-upload.jpg')), 0,
          'anon cannot see unused media or flyers of hidden courses');
select is((select count(*)::int from public.faqs where question_en = 'Hidden Q'), 0, 'anon cannot see hidden FAQs');
select is((select count(*)::int from public.nav_items where label_en = 'Hidden link'), 0, 'anon cannot see hidden menu items');
select is((select count(*)::int from public.site_settings), 1, 'anon can read public site settings');

-- Admin data: no access at all
select throws_ok('select * from public.admin_users', '42501', null, 'anon cannot read admin_users');
select throws_ok('select * from public.audit_log', '42501', null, 'anon cannot read audit_log');
select throws_ok('select * from public.media_usage', '42501', null, 'anon cannot read media_usage');

-- Analytics: no access at all
select throws_ok(format('select * from public.%I', t), '42501', null, 'anon cannot read ' || t)
  from unnest(array['analytics_sessions', 'analytics_events', 'analytics_daily',
                    'analytics_daily_pages', 'analytics_daily_dims']) as t;
select throws_ok(
  $$ insert into public.analytics_events (type, visitor_id, session_id, path)
     values ('pageview', gen_random_uuid(), 'b0000000-0000-4000-8000-000000000001', '/') $$,
  '42501', null, 'anon cannot write analytics directly');

-- No writes to content
select throws_ok($$ insert into public.courses (slug, title_en, phase_id) values ('x', 'x', (select id from public.phases limit 1)) $$,
                 '42501', null, 'anon cannot create courses');
select throws_ok($$ update public.courses set title_en = 'hacked' $$, '42501', null, 'anon cannot edit courses');
select throws_ok($$ delete from public.courses $$, '42501', null, 'anon cannot delete courses');
select throws_ok($$ update public.site_settings set whatsapp_number = '+8800000000000' $$, '42501', null,
                 'anon cannot change site settings');
select throws_ok($$ insert into public.admin_users (user_id, role) values (gen_random_uuid(), 'owner') $$, '42501', null,
                 'anon cannot add admins');
select throws_ok($$ select private.bootstrap_owner('owner@example.test') $$, '42501', null,
                 'anon cannot call bootstrap_owner');

reset role;
select is((select title_en from public.courses where slug = 'sdm-full-course'), 'SDM Full Course', 'course data unchanged');

select * from finish();
rollback;
