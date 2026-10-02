-- Authentication & authorization: owner (with/without MFA), editor, and a
-- signed-in user who is NOT an admin. Sessions are simulated exactly as
-- Supabase does it: JWT claims in request.jwt.claims + the authenticated role.
begin;
select no_plan();

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'editor@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'outsider@example.test'),
  ('a0000000-0000-4000-8000-000000000004', 'new-editor@example.test');

select is(private.bootstrap_owner('OWNER@example.test'), 'a0000000-0000-4000-8000-000000000001'::uuid,
          'bootstrap_owner promotes an existing auth user to owner (case-insensitive email)');
select throws_ok($$ select private.bootstrap_owner('nobody@example.test') $$, 'P0001', null,
                 'bootstrap_owner fails for unknown emails');

insert into public.admin_users (user_id, role, display_name)
values ('a0000000-0000-4000-8000-000000000002', 'editor', 'Editor');

insert into public.courses (slug, title_en, phase_id, status)
values ('draft-course', 'Draft course', (select id from public.phases where code = 3), 'hidden');

insert into public.analytics_sessions (session_id, visitor_id) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001');
insert into public.analytics_events (type, visitor_id, session_id, path)
values ('pageview', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '/');

-- ============================================================ OUTSIDER
-- A real signed-in Supabase user who is not in admin_users (sign-up is disabled
-- in production, but the database must not trust that alone).
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is((select private.is_admin()), false, 'outsider is not an admin');
select is((select count(*)::int from public.admin_users), 0, 'outsider sees no admin users');
select is((select count(*)::int from public.courses where slug = 'draft-course'), 0, 'outsider cannot see hidden courses');
select is((select count(*)::int from public.analytics_events), 0, 'outsider cannot read analytics events');
select is((select count(*)::int from public.analytics_sessions), 0, 'outsider cannot read analytics sessions');
select is((select count(*)::int from public.audit_log), 0, 'outsider cannot read the audit log');
select throws_ok($$ insert into public.courses (slug, title_en, phase_id) values ('x', 'x', (select id from public.phases limit 1)) $$,
                 '42501', null, 'outsider cannot create courses');
select is_empty($$ update public.courses set title_en = 'hacked' returning id $$, 'outsider cannot edit courses');
select is_empty($$ delete from public.faqs returning id $$, 'outsider cannot delete FAQs');
select throws_ok($$ insert into public.admin_users (user_id, role) values ('a0000000-0000-4000-8000-000000000003', 'owner') $$,
                 '42501', null, 'outsider cannot make themselves an admin');
reset role;

-- ============================================================== EDITOR
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select is((select private.is_admin()), true, 'editor is an admin');
select is((select private.is_owner()), false, 'editor is not an owner');
select is((select count(*)::int from public.admin_users), 1, 'editor sees only their own admin row');
select is((select count(*)::int from public.courses where slug = 'draft-course'), 1, 'editor can see hidden courses');

select lives_ok($$ insert into public.courses (slug, title_en, phase_id, status)
                   values ('editor-new-course', 'Editor course', (select id from public.phases where code = 4), 'upcoming') $$,
                'editor can create a course');
select lives_ok($$ update public.courses set title_en = 'SDM Full Course (updated)' where slug = 'sdm-full-course' $$,
                'editor can edit a course');
select lives_ok($$ update public.courses set archived_at = now() where slug = 'draft-course' $$,
                'editor can archive a course');
select is_empty($$ delete from public.courses where slug = 'editor-new-course' returning id $$,
                'editor cannot permanently delete a course');
select isnt_empty($$ delete from public.faqs where sort_order = 50 returning id $$, 'editor can delete a FAQ');
select lives_ok($$ insert into public.course_mentors (course_id, mentor_id)
                   values ((select id from public.courses where slug = 'editor-new-course'),
                           (select id from public.mentors where slug = 'm-r-sifat')) $$,
                'editor can assign a mentor to a course');

select throws_ok($$ insert into public.admin_users (user_id, role) values ('a0000000-0000-4000-8000-000000000004', 'editor') $$,
                 '42501', null, 'editor cannot add admins');
select is_empty($$ update public.admin_users set role = 'owner' where user_id = 'a0000000-0000-4000-8000-000000000002' returning user_id $$,
                'editor cannot promote themselves to owner');

select is((select count(*)::int from public.analytics_events), 1, 'editor can read analytics');
select throws_ok($$ insert into public.analytics_events (type, visitor_id, session_id, path)
                    values ('pageview', gen_random_uuid(), 'b0000000-0000-4000-8000-000000000001', '/') $$,
                 '42501', null, 'editor cannot write analytics');

select is((select actor from public.audit_log where entity = 'courses' and action = 'UPDATE'
            and changes ? 'title_en' order by id desc limit 1),
          'a0000000-0000-4000-8000-000000000002'::uuid, 'course edit is recorded in the audit log with the editor as actor');
select is((select changes -> 'title_en' ->> 'new' from public.audit_log where entity = 'courses' and action = 'UPDATE'
            and changes ? 'title_en' order by id desc limit 1),
          'SDM Full Course (updated)', 'audit log stores the changed value');
select throws_ok($$ update public.audit_log set actor = null $$, '42501', null, 'audit log cannot be edited');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'audit log cannot be deleted');

select throws_ok($$ insert into public.nav_items (location, label_en, url) values ('header', 'XSS', 'javascript:alert(1)') $$,
                 '23514', null, 'javascript: URLs are rejected');
reset role;

-- ====================================================== OWNER, no MFA
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select is((select private.is_owner()), true, 'owner is recognised');
select is((select count(*)::int from public.admin_users), 2, 'owner sees all admin users');
select throws_ok($$ insert into public.admin_users (user_id, role) values ('a0000000-0000-4000-8000-000000000004', 'editor') $$,
                 '42501', null, 'owner WITHOUT MFA cannot add admins');
select isnt_empty($$ delete from public.courses where slug = 'editor-new-course' returning id $$,
                  'owner can permanently delete a course');
reset role;

-- ==================================================== OWNER, with MFA
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select lives_ok($$ insert into public.admin_users (user_id, role) values ('a0000000-0000-4000-8000-000000000004', 'editor') $$,
                'owner WITH MFA can add an editor');
select lives_ok($$ update public.admin_users set display_name = 'New editor' where user_id = 'a0000000-0000-4000-8000-000000000004' $$,
                'owner WITH MFA can update an admin');
select throws_ok($$ delete from public.admin_users where user_id = 'a0000000-0000-4000-8000-000000000001' $$,
                 '23514', null, 'the last owner cannot be removed');
select throws_ok($$ update public.admin_users set role = 'editor' where user_id = 'a0000000-0000-4000-8000-000000000001' $$,
                 '23514', null, 'the last owner cannot be demoted');
select throws_ok($$ delete from public.media where path = 'flyers/sdm-full.jpg' $$,
                 '23503', null, 'media used by a course cannot be deleted');
select isnt_empty($$ delete from public.admin_users where user_id = 'a0000000-0000-4000-8000-000000000004' returning user_id $$,
                  'owner WITH MFA can remove an editor');
reset role;

-- Removing an auth user removes their admin access too.
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.admin_users where user_id = 'a0000000-0000-4000-8000-000000000002'), 0,
          'deleting an auth user revokes admin access');

select * from finish();
rollback;
