-- Storage bucket configuration and permissions for "public-media".
-- Files are readable by public URL (bucket is public); listing and all writes
-- are admin-only and restricted to known image folders/extensions.
begin;
select no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000002', 'editor@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'outsider@example.test');
insert into public.admin_users (user_id, role) values ('a0000000-0000-4000-8000-000000000002', 'editor');
insert into storage.objects (bucket_id, name) values ('public-media', 'flyers/existing.jpg');

-- Bucket configuration
select is((select public from storage.buckets where id = 'public-media'), true, 'public-media bucket is public-read');
select is((select file_size_limit from storage.buckets where id = 'public-media'), 5242880::bigint, 'file size limit is 5 MB');
select set_eq($$ select unnest(allowed_mime_types) from storage.buckets where id = 'public-media' $$,
              array['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
              'only raster image types are allowed (no SVG)');

-- ------------------------------------------------------------------ anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from storage.objects), 0, 'anon cannot list stored files');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'flyers/anon.jpg') $$,
                 '42501', null, 'anon cannot upload');
select is_empty($$ delete from storage.objects returning id $$, 'anon cannot delete files');
reset role;

-- --------------------------------------------------------- non-admin user
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from storage.objects), 0, 'non-admin user cannot list files');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'flyers/outsider.jpg') $$,
                 '42501', null, 'non-admin user cannot upload');
select is_empty($$ update storage.objects set name = 'flyers/renamed.jpg' returning id $$, 'non-admin user cannot rename files');
select is_empty($$ delete from storage.objects returning id $$, 'non-admin user cannot delete files');
reset role;

-- ---------------------------------------------------------------- editor
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from storage.objects), 1, 'admin can list files');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'flyers/new-course.webp') $$,
                'admin can upload a flyer');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'mentors/new-mentor.jpg') $$,
                'admin can upload a mentor photo');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'secrets/notes.jpg') $$,
                 '42501', null, 'uploads outside the allowed folders are rejected');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'flyers/evil.svg') $$,
                 '42501', null, 'SVG uploads are rejected');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'flyers/../../x.jpg') $$,
                 '42501', null, 'path traversal names are rejected');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('other-bucket', 'flyers/x.jpg') $$,
                 '42501', null, 'uploads to other buckets are rejected');
select throws_ok($$ update storage.objects set name = 'flyers/x.html' where name = 'flyers/existing.jpg' $$,
                 '42501', null, 'renaming to a disallowed extension is rejected');
select isnt_empty($$ delete from storage.objects where name = 'flyers/new-course.webp' returning id $$,
                  'admin can delete a file');
reset role;

select * from finish();
rollback;
