begin;
select plan(12);

select has_table('public', 'course_reviews', 'course_reviews exists');
select ok((select relrowsecurity from pg_class where oid = 'public.course_reviews'::regclass), 'RLS is on');

insert into public.course_reviews (course_id, reviewer_name, rating, review_en, is_visible)
select id, 'Visible', 5, 'Great course', true from public.courses where slug = 'decode-the-opg';
insert into public.course_reviews (course_id, reviewer_name, rating, review_en, is_visible)
select id, 'Hidden', 4, 'Hidden review', false from public.courses where slug = 'decode-the-opg';

select throws_ok($$insert into public.course_reviews (course_id, reviewer_name, rating, review_en)
                   select id, 'x', 6, 'y' from public.courses limit 1$$, '23514', null, 'rating above 5 rejected');
select throws_ok($$insert into public.course_reviews (course_id, reviewer_name, rating, review_en)
                   select id, 'x', 0, 'y' from public.courses limit 1$$, '23514', null, 'rating below 1 rejected');
select lives_ok($$insert into public.course_reviews (course_id, rating, review_bn, is_visible)
                  select id, 4, 'নাম ছাড়া রিভিউ', false from public.courses where slug = 'decode-the-opg'$$, 'name and college are optional');
select throws_ok($$insert into public.course_reviews (course_id, reviewer_name, rating)
                   select id, 'x', 3 from public.courses limit 1$$, '23514', null, 'review text required');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.course_reviews), 1, 'visitors see only visible reviews');
select throws_ok($$insert into public.course_reviews (course_id, reviewer_name, rating, review_en)
                   select id, 'spam', 5, 'fake' from public.courses limit 1$$, '42501', null, 'visitors cannot add reviews');
reset role;

-- A signed-in user who is not an admin cannot add or change reviews.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'notadmin@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000aa"}', true);
select throws_ok($$insert into public.course_reviews (course_id, reviewer_name, rating, review_en)
                   select id, 'spam', 5, 'fake' from public.courses limit 1$$, '42501', null, 'non-admin cannot add reviews');
select is((with u as (select 1) select count(*)::int from public.course_reviews), 1, 'non-admin also sees only visible reviews');
reset role;

-- Hiding the course hides its reviews; deleting the course deletes them.
update public.courses set status = 'hidden' where slug = 'decode-the-opg';
set local role anon;
select is((select count(*)::int from public.course_reviews), 0, 'reviews of a hidden course are not public');
reset role;
delete from public.courses where slug = 'decode-the-opg';
select is((select count(*)::int from public.course_reviews), 0, 'reviews are removed with their course');

select * from finish();
rollback;
