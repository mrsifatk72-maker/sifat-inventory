begin;
select plan(26);

-- tables + RLS
select has_table('public', 'articles', 'articles exists');
select has_table('public', 'team_members', 'team_members exists');
select has_table('public', 'books', 'books exists');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.articles'::regclass, 'public.team_members'::regclass, 'public.books'::regclass)), 'RLS on for all three');

-- seed some rows as superuser
insert into public.media (path, kind, mime, size_bytes) values ('articles/cover-a.webp', 'image', 'image/webp', 100), ('articles/inline-a.webp', 'image', 'image/webp', 100), ('articles/draft.webp', 'image', 'image/webp', 100), ('team/p1.webp', 'image', 'image/webp', 100), ('books/c1.webp', 'image', 'image/webp', 100);
insert into public.articles (slug, title, body, status, published_at, cover_media_id)
  values ('published-one', 'Published', 'Text ![x](articles/inline-a.webp)', 'published', now() - interval '1 day', (select id from public.media where path='articles/cover-a.webp')),
         ('draft-one', 'Draft', 'Secret draft', 'draft', null, (select id from public.media where path='articles/draft.webp')),
         ('future-one', 'Scheduled', 'Later', 'published', now() + interval '7 days', null);
insert into public.team_members (name, designation, is_visible, photo_media_id) values ('Visible Exec', 'CEO', true, (select id from public.media where path='team/p1.webp')), ('Hidden Exec', 'CM', false, null);
insert into public.books (title, book_type, is_visible, cover_media_id) values ('Visible Book', 'online', true, (select id from public.media where path='books/c1.webp')), ('Hidden Book', 'offline', false, null);

select throws_ok($$insert into public.articles (slug, title, status) values ('x-pub', 'x', 'published')$$, '23514', null, 'published article needs a publish date');
select throws_ok($$insert into public.books (title, link_url) values ('x', 'javascript:alert(1)')$$, '23514', null, 'unsafe book link rejected');
select throws_ok($$insert into public.books (title, link_url) values ('x', 'http://insecure.example')$$, '23514', null, 'book link must be https');
select throws_ok($$insert into public.media (path, kind, mime, size_bytes) values ('secret/x.webp', 'image', 'image/webp', 1)$$, '23514', null, 'unknown image folder still rejected');
select ok(private.is_allowed_media_path('team/a.webp') and private.is_allowed_media_path('articles/a.png') and private.is_allowed_media_path('books/a.jpg'), 'new folders allowed in storage');

-- visitors
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(slug order by slug) from public.articles), array['published-one'], 'visitors see only published, already-live articles');
select is((select count(*)::int from public.team_members), 1, 'visitors see only visible team members');
select is((select count(*)::int from public.books), 1, 'visitors see only visible books');
select is((select count(*)::int from public.media where path in ('articles/cover-a.webp', 'articles/inline-a.webp', 'team/p1.webp', 'books/c1.webp')), 4, 'images of public items are visible');
select is((select count(*)::int from public.media where path = 'articles/draft.webp'), 0, 'draft article cover stays private');
select throws_ok($$insert into public.articles (slug, title) values ('spam', 'spam')$$, '42501', null, 'visitors cannot add articles');
select throws_ok($$update public.articles set view_count = 999999$$, '42501', null, 'visitors cannot edit view counts directly');
select lives_ok($$select public.record_article_view('published-one')$$, 'visitors can record a view');
select lives_ok($$select public.record_article_view('draft-one')$$, 'recording a view of a draft does nothing (no error)');
select throws_ok($$select * from public.media_usage$$, '42501', null, 'visitors cannot read media usage');
reset role;
select is((select view_count from public.articles where slug = 'published-one'), 1::bigint, 'view counted once');
select is((select view_count from public.articles where slug = 'draft-one'), 0::bigint, 'draft views not counted');
select is((select count(*)::int from public.audit_log where entity = 'articles' and action = 'UPDATE'), 0, 'view counts do not fill the audit log');

-- logged-in non-admin
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000bb', 'user@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000bb"}', true);
select throws_ok($$insert into public.team_members (name, designation) values ('x', 'y')$$, '42501', null, 'non-admin cannot add team members');
select is((select count(*)::int from public.articles), 1, 'non-admin also sees only published articles');
reset role;

-- usage tracking protects images from deletion
select ok(exists (select 1 from public.media_usage u join public.media m on m.id = u.media_id where m.path = 'articles/inline-a.webp' and u.used_by = 'articles.inline'), 'inline article image counted as in use');
select is((select sort_order from public.page_sections where key = 'stories') < (select sort_order from public.page_sections where key = 'mentors'), true, 'reviews come before mentors on the homepage');

select * from finish();
rollback;
