-- STAGING ONLY: paste into Supabase → SQL Editor of project hhcxwianpbkhqqhccwbk and press Run.
-- Articles, Central Executives (team), Books, image folders, view counter, menu + homepage order.
-- Run part6-all-new-features.sql first if you have not. Removes nothing. Safe to run more than once.
begin;
-- Articles (blog), Central Executives (team), Books, new image folders, menu + homepage order.
-- Security model is the same as every other content table:
--   * RLS on; visitors (anon) can only SELECT what the website shows
--     (published articles, visible team members / books);
--   * only users in public.admin_users can insert/update/delete (private.is_admin());
--   * every change is written to the audit log.
-- Nothing is deleted. Existing menu items that are no longer wanted are only hidden.
-- Safe to run more than once.

-- ============================================================================
-- 1. Image folders: articles/, books/, team/ (in the existing public-media bucket)
-- ============================================================================
alter table public.media drop constraint if exists media_path_check;
alter table public.media add constraint media_path_check
  check (path ~ '^(flyers|thumbnails|mentors|banners|logos|images|articles|books|team)/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|avif)$');

create or replace function private.is_allowed_media_path(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name ~ '^(flyers|thumbnails|mentors|banners|logos|images|articles|books|team)/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|avif)$';
$$;

-- ============================================================================
-- 2. Tables
-- ============================================================================
create table if not exists public.articles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (private.is_slug(slug)),
  title           text not null check (char_length(title) between 1 and 200),
  excerpt         text check (char_length(excerpt) <= 600),
  body            text not null default '' check (char_length(body) <= 100000),   -- safe markup, no HTML
  lang            text not null default 'bn' check (lang in ('bn', 'en')),
  category        text check (char_length(category) <= 40),
  author_name     text not null default 'MediVerse Dental' check (char_length(author_name) between 1 and 120),
  cover_media_id  uuid references public.media (id) on delete restrict,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  published_at    timestamptz,
  view_count      bigint not null default 0 check (view_count >= 0),
  read_minutes    smallint check (read_minutes between 1 and 600),          -- set by the admin on save
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (status = 'draft' or published_at is not null)
);
create index if not exists articles_published_idx on public.articles (status, published_at desc);

create table if not exists public.team_members (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 120),
  designation     text not null check (char_length(designation) between 1 and 80),   -- e.g. CM, CEO, Chief Academic Coordinator
  designation_bn  text check (char_length(designation_bn) <= 80),
  college         text check (char_length(college) <= 160),
  college_bn      text check (char_length(college_bn) <= 160),
  photo_media_id  uuid references public.media (id) on delete restrict,
  is_visible      boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 200),
  author          text check (char_length(author) <= 160),
  mentor_name     text check (char_length(mentor_name) <= 160),
  description     text check (char_length(description) <= 2000),
  book_type       text not null default 'offline' check (book_type in ('online', 'offline')),
  price           text check (char_length(price) <= 40),            -- e.g. "৳ 450" or "Free"
  link_url        text check (private.is_safe_url(link_url) and link_url ~* '^https://'),
  link_label      text check (char_length(link_label) <= 40),       -- e.g. "Buy now", "Read online"
  cover_media_id  uuid references public.media (id) on delete restrict,
  is_visible      boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at + audit log, RLS, grants, policies (same pattern as the other content tables)
do $$
declare
  t text;
begin
  foreach t in array array['articles', 'team_members', 'books'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_admin_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_admin()))', t || '_admin_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_admin_delete', t);
  end loop;
end;
$$;

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles
  for select to anon, authenticated
  using (status = 'published' and published_at <= now());

drop policy if exists team_members_public_read on public.team_members;
create policy team_members_public_read on public.team_members
  for select to anon, authenticated using (is_visible);

drop policy if exists books_public_read on public.books;
create policy books_public_read on public.books
  for select to anon, authenticated using (is_visible);

-- ============================================================================
-- 3. Article view counter. Visitors cannot update articles; they may only call
--    this function, which adds 1 to a published article's counter and nothing else.
-- ============================================================================
-- The privileged part lives in the unexposed `private` schema; the public wrapper
-- runs with the caller's rights and can do nothing except call it.
create or replace function private.record_article_view(p_slug text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.articles
     set view_count = view_count + 1
   where slug = p_slug and status = 'published' and published_at <= now();
$$;
revoke all on function private.record_article_view(text) from public, anon, authenticated;
grant execute on function private.record_article_view(text) to anon, authenticated, service_role;

create or replace function public.record_article_view(p_slug text)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_article_view(p_slug);
$$;
revoke all on function public.record_article_view(text) from public, anon, authenticated;
grant execute on function public.record_article_view(text) to anon, authenticated, service_role;

-- A view-count-only update must not write the audit log or change updated_at.
drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at before update on public.articles for each row
  when ((to_jsonb(old) - 'view_count' - 'updated_at') is distinct from (to_jsonb(new) - 'view_count' - 'updated_at'))
  execute function private.set_updated_at();
drop trigger if exists articles_audit on public.articles;
create trigger articles_audit after insert or delete on public.articles
  for each row execute function private.audit_row();
drop trigger if exists articles_audit_update on public.articles;
create trigger articles_audit_update after update on public.articles for each row
  when ((to_jsonb(old) - 'view_count' - 'updated_at') is distinct from (to_jsonb(new) - 'view_count' - 'updated_at'))
  execute function private.audit_row();

-- ============================================================================
-- 4. Which images visitors may see / which images are "in use"
-- ============================================================================
create or replace function private.media_is_public(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.courses c
                  where (c.flyer_media_id = p_media_id or c.thumbnail_media_id = p_media_id)
                    and c.status in ('active', 'upcoming') and c.archived_at is null)
      or exists (select 1 from public.mentors t
                  where t.photo_media_id = p_media_id and t.status = 'active' and t.archived_at is null)
      or exists (select 1 from public.page_sections s where s.media_id = p_media_id and s.is_visible)
      or exists (select 1 from public.banners b
                  where b.media_id = p_media_id and b.is_active
                    and (b.starts_at is null or b.starts_at <= now())
                    and (b.ends_at is null or b.ends_at > now()))
      or exists (select 1 from public.site_settings x
                  where p_media_id in (x.logo_dark_media_id, x.logo_light_media_id, x.og_image_media_id))
      or exists (select 1 from public.articles a
                  where a.status = 'published' and a.published_at <= now()
                    and (a.cover_media_id = p_media_id
                         or exists (select 1 from public.media m
                                     where m.id = p_media_id and strpos(a.body, '(' || m.path || ')') > 0)))
      or exists (select 1 from public.team_members tm where tm.photo_media_id = p_media_id and tm.is_visible)
      or exists (select 1 from public.books bk where bk.cover_media_id = p_media_id and bk.is_visible);
$$;
revoke all on function private.media_is_public(uuid) from public;
grant execute on function private.media_is_public(uuid) to anon, authenticated, service_role;

create or replace view public.media_usage
with (security_invoker = true) as
  select m.id as media_id, u.used_by, u.ref_id
  from public.media m
  join lateral (
              select 'courses.flyer'::text as used_by, c.id::text as ref_id from public.courses c where c.flyer_media_id = m.id
    union all select 'courses.thumbnail', c.id::text from public.courses c where c.thumbnail_media_id = m.id
    union all select 'mentors.photo', t.id::text from public.mentors t where t.photo_media_id = m.id
    union all select 'page_sections.image', s.key from public.page_sections s where s.media_id = m.id
    union all select 'banners.image', b.id::text from public.banners b where b.media_id = m.id
    union all select 'site_settings.logo_dark', 'site' from public.site_settings x where x.logo_dark_media_id = m.id
    union all select 'site_settings.logo_light', 'site' from public.site_settings x where x.logo_light_media_id = m.id
    union all select 'site_settings.og_image', 'site' from public.site_settings x where x.og_image_media_id = m.id
    union all select 'articles.cover', a.id::text from public.articles a where a.cover_media_id = m.id
    union all select 'articles.inline', a.id::text from public.articles a where strpos(a.body, '(' || m.path || ')') > 0
    union all select 'team_members.photo', tm.id::text from public.team_members tm where tm.photo_media_id = m.id
    union all select 'books.cover', bk.id::text from public.books bk where bk.cover_media_id = m.id
  ) u on true;
revoke all on public.media_usage from anon, authenticated;
grant select on public.media_usage to authenticated;

-- ============================================================================
-- 5. Homepage: reviews above mentors, "Latest articles" and "Central Executives" blocks,
--    hero's second button → Articles (only if it still points to #mentors).
-- ============================================================================
update public.page_sections set sort_order = 35 where page = 'home' and key = 'stories' and sort_order = 50;

insert into public.page_sections (page, key, is_visible, sort_order, content)
values
  ('home', 'articles', true, 55, jsonb_build_object(
     'en', jsonb_build_object('kicker', 'Articles', 'heading', 'Read, learn, [[stay ahead]].',
                              'intro', 'Study tips, exam guidelines and clinical notes from our mentors.'),
     'bn', jsonb_build_object('kicker', 'আর্টিকেল', 'heading', 'পড়ো, শেখো, [[এগিয়ে থাকো]]।',
                              'intro', 'মেন্টরদের লেখা পড়ার টিপস, পরীক্ষার গাইডলাইন আর ক্লিনিক্যাল নোটস।'),
     'buttons', jsonb_build_array(jsonb_build_object('url', '/articles', 'style', 'ghost', 'new_tab', false,
                                                     'label_en', 'View all articles', 'label_bn', 'সব আর্টিকেল দেখো')))),
  ('home', 'team', true, 65, jsonb_build_object(
     'en', jsonb_build_object('kicker', 'Our team', 'heading', 'The people behind [[MediVerse Dental]].',
                              'intro', 'Meet the central executives who keep MediVerse running.'),
     'bn', jsonb_build_object('kicker', 'আমাদের টিম', 'heading', '[[মেডিভার্স ডেন্টালের]] পেছনের মানুষগুলো।',
                              'intro', 'মেডিভার্স যাঁরা চালান, সেই সেন্ট্রাল এক্সিকিউটিভদের সাথে পরিচিত হও।'),
     'buttons', jsonb_build_array(jsonb_build_object('url', '/team', 'style', 'primary', 'new_tab', false,
                                                     'label_en', 'Meet Our Central Executives', 'label_bn', 'সেন্ট্রাল এক্সিকিউটিভদের দেখো'))))
on conflict (page, key) do nothing;

update public.page_sections
   set content = jsonb_set(content, '{buttons,1}',
         (content -> 'buttons' -> 1) || jsonb_build_object('url', '/articles', 'label_en', 'Read Articles', 'label_bn', 'আর্টিকেল পড়ো'))
 where page = 'home' and key = 'hero' and content -> 'buttons' -> 1 ->> 'url' = '#mentors';

-- ============================================================================
-- 6. Menus. Mobile (hamburger): Home, Courses, Mentors, Reviews, Articles,
--    Central Executives, Books, Contact (+ Enroll button). Header (desktop):
--    Courses, Mentors, Reviews, Articles, Books, Team (+ Enroll button).
--    Old items are hidden, not deleted.
-- ============================================================================
update public.nav_items set is_visible = false where location = 'header' and url in ('#about', '#faq');
update public.nav_items set label_en = 'Reviews' where location = 'header' and url = '#stories' and label_en = 'Stories';
update public.nav_items set sort_order = 10 where location = 'header' and url = '#courses';
update public.nav_items set sort_order = 20 where location = 'header' and url = '#mentors';
update public.nav_items set sort_order = 30 where location = 'header' and url = '#stories';
update public.nav_items set sort_order = 90 where location = 'header' and style = 'button';
insert into public.nav_items (location, label_en, label_bn, url, sort_order)
select v.loc::public.nav_location, v.en, v.bn, v.url, v.ord
  from (values ('header', 'Articles', 'আর্টিকেল', '/articles', 40),
               ('header', 'Books', 'বই', '/books', 50),
               ('header', 'Team', 'টিম', '/team', 60)) as v(loc, en, bn, url, ord)
 where not exists (select 1 from public.nav_items n where n.location = v.loc::public.nav_location and n.url = v.url);

update public.nav_items set is_visible = false where location = 'mobile' and url = '#about';
update public.nav_items set label_en = 'Mentors', label_bn = 'মেন্টর' where location = 'mobile' and url = '#mentors' and label_en = 'Mentor Panel';
update public.nav_items set label_en = 'Reviews', label_bn = 'রিভিউ' where location = 'mobile' and url = '#stories' and label_en = 'Student Stories';
update public.nav_items set label_en = 'Contact', label_bn = 'যোগাযোগ', url = '#contact' where location = 'mobile' and url = '#faq' and label_en = 'FAQ & Contact';
update public.nav_items set sort_order = 10 where location = 'mobile' and url = '#top';
update public.nav_items set sort_order = 20 where location = 'mobile' and url = '#courses';
update public.nav_items set sort_order = 30 where location = 'mobile' and url = '#mentors';
update public.nav_items set sort_order = 40 where location = 'mobile' and url = '#stories';
update public.nav_items set sort_order = 80 where location = 'mobile' and url = '#contact';
update public.nav_items set sort_order = 90 where location = 'mobile' and style = 'button';
insert into public.nav_items (location, label_en, label_bn, url, sort_order)
select v.loc::public.nav_location, v.en, v.bn, v.url, v.ord
  from (values ('mobile', 'Articles', 'আর্টিকেল', '/articles', 50),
               ('mobile', 'Central Executives', 'সেন্ট্রাল এক্সিকিউটিভ', '/team', 60),
               ('mobile', 'Books', 'বই', '/books', 70)) as v(loc, en, bn, url, ord)
 where not exists (select 1 from public.nav_items n where n.location = v.loc::public.nav_location and n.url = v.url);

-- ============================================================================
-- 7. Official email (given by the owner) for "Apply via Email" — only if none is set yet.
-- ============================================================================
update public.site_settings set contact_email = 'mediversedental1@gmail.com' where contact_email is null;
commit;
