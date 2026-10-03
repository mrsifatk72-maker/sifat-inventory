-- ============================================================================
-- MediVerse Dental — STAGING DATABASE SETUP — PART 3 of 5 (generated file)
-- Run the parts in order: 1 → 2 → 3 → 4 → 5, each in its own SQL Editor query.
-- All-or-nothing: if anything fails, nothing from this part is saved.
-- ============================================================================

begin;

do $$
begin
  if not (to_regclass('public.media_usage') is not null) then
    raise exception 'Please run PART 2 first — nothing was changed. (আগের অংশটি আগে চালান)';
  end if;
  if to_regclass('public.analytics_events') is not null then
    raise exception 'PART 3 IS ALREADY DONE — nothing was changed. Go to PART 4. (এই অংশ আগেই হয়ে গেছে, পরের অংশে যান)';
  end if;
end;
$$;

-- ============================================================================
-- Triggers: updated_at + audit log on every content table
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'media', 'site_settings', 'page_sections', 'stats', 'features', 'faqs', 'testimonials',
    'banners', 'phases', 'courses', 'mentors', 'nav_items', 'footer_sections',
    'footer_links', 'social_links'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      t || '_updated_at', t);
  end loop;

  foreach t in array array[
    'media', 'site_settings', 'page_sections', 'stats', 'features', 'faqs', 'testimonials',
    'banners', 'phases', 'courses', 'mentors', 'course_mentors', 'nav_items', 'footer_sections',
    'footer_links', 'social_links'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
      t || '_audit', t);
  end loop;
end;
$$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

-- Is this media file referenced by something visitors can see?
-- (Unused / draft uploads are hidden from the public API.)
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
                  where p_media_id in (x.logo_dark_media_id, x.logo_light_media_id, x.og_image_media_id));
$$;
revoke all on function private.media_is_public(uuid) from public;
grant execute on function private.media_is_public(uuid) to anon, authenticated, service_role;

do $$
declare
  t text;
begin
  -- Every content table: RLS on, visitors read-only, admins read/write via policies.
  foreach t in array array[
    'media', 'site_settings', 'page_sections', 'stats', 'features', 'faqs', 'testimonials',
    'banners', 'phases', 'courses', 'mentors', 'course_mentors', 'nav_items', 'footer_sections',
    'footer_links', 'social_links'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_admin()))',
      t || '_admin_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))',
      t || '_admin_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      t || '_admin_update', t);
  end loop;

  -- Delete: editors may delete list items; permanent deletion of courses,
  -- mentors and site settings is owner-only (editors archive instead).
  foreach t in array array[
    'media', 'page_sections', 'stats', 'features', 'faqs', 'testimonials', 'banners',
    'course_mentors', 'nav_items', 'footer_sections', 'footer_links', 'social_links'
  ] loop
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))',
      t || '_admin_delete', t);
  end loop;

  foreach t in array array['courses', 'mentors', 'phases', 'site_settings'] loop
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_owner()))',
      t || '_owner_delete', t);
  end loop;
end;
$$;

-- Public (anon + any signed-in user) read policies: only what the website shows.
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);

create policy phases_public_read on public.phases
  for select to anon, authenticated using (true);

create policy courses_public_read on public.courses
  for select to anon, authenticated
  using (status in ('active', 'upcoming') and archived_at is null);

create policy mentors_public_read on public.mentors
  for select to anon, authenticated
  using (status = 'active' and archived_at is null);

create policy course_mentors_public_read on public.course_mentors
  for select to anon, authenticated
  using (
    exists (select 1 from public.courses c
             where c.id = course_id and c.status in ('active', 'upcoming') and c.archived_at is null)
    and exists (select 1 from public.mentors t
                 where t.id = mentor_id and t.status = 'active' and t.archived_at is null)
  );

create policy media_public_read on public.media
  for select to anon, authenticated using ((select private.media_is_public(id)));

create policy page_sections_public_read on public.page_sections
  for select to anon, authenticated using (is_visible);

create policy stats_public_read on public.stats
  for select to anon, authenticated using (is_visible);

create policy features_public_read on public.features
  for select to anon, authenticated using (is_visible);

create policy faqs_public_read on public.faqs
  for select to anon, authenticated using (is_visible);

create policy testimonials_public_read on public.testimonials
  for select to anon, authenticated using (is_visible);

create policy banners_public_read on public.banners
  for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

create policy nav_items_public_read on public.nav_items
  for select to anon, authenticated using (is_visible);

create policy footer_sections_public_read on public.footer_sections
  for select to anon, authenticated using (is_visible);

create policy footer_links_public_read on public.footer_links
  for select to anon, authenticated
  using (is_visible and exists (select 1 from public.footer_sections s where s.id = section_id and s.is_visible));

create policy social_links_public_read on public.social_links
  for select to anon, authenticated using (is_visible);

-- The usage view is for the admin media library only.
revoke all on public.media_usage from anon, authenticated;
grant select on public.media_usage to authenticated;
-- ============================================================================
-- MediVerse Dental CMS — 4/5 Anonymous visitor analytics
--
-- Privacy rules (enforced by schema design):
--   * Visitors are anonymous website visitors — never "students".
--   * No names, emails, phone numbers, IP addresses or raw user-agent strings
--     are stored. visitor_id / session_id are random browser-generated UUIDs.
--   * Referrer is reduced to a domain; country is a 2-letter code from the
--     hosting platform's geo header (the IP itself is discarded).
--   * Only the server (/api/track, using the service role) writes here.
--     Anonymous visitors cannot read or write any analytics table.
--   * Admins can read. Rollups and retention jobs come in a later phase.
-- ============================================================================

create type public.analytics_event_type as enum ('pageview', 'course_view', 'outbound_click', 'engagement');
create type public.device_type as enum ('mobile', 'tablet', 'desktop', 'other');

create table public.analytics_sessions (
  session_id       uuid primary key,
  visitor_id       uuid not null,
  is_new_visitor   boolean not null default false,
  started_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  engaged_ms       bigint not null default 0 check (engaged_ms >= 0),
  pageviews        integer not null default 0 check (pageviews >= 0),
  entry_path       text check (char_length(entry_path) <= 512),
  exit_path        text check (char_length(exit_path) <= 512),
  referrer_domain  text check (referrer_domain ~ '^[a-z0-9.-]{1,253}$'),
  utm_source       text check (char_length(utm_source) <= 100),
  utm_medium       text check (char_length(utm_medium) <= 100),
  utm_campaign     text check (char_length(utm_campaign) <= 100),
  device_type      public.device_type,
  browser          text check (char_length(browser) <= 40),
  os               text check (char_length(os) <= 40),
  country          text check (country ~ '^[A-Z]{2}$'),
  lang             text check (lang in ('en', 'bn'))
);
create index analytics_sessions_started_idx on public.analytics_sessions (started_at);
create index analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id);

create table public.analytics_events (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  type             public.analytics_event_type not null,
  visitor_id       uuid not null,
  session_id       uuid not null references public.analytics_sessions (session_id) on delete cascade,
  path             text not null check (path ~ '^/' and char_length(path) <= 512),
  page_type        text not null default 'other' check (page_type in ('home', 'course', 'other')),
  course_id        uuid references public.courses (id) on delete set null,
  target_url       text check (char_length(target_url) <= 2048),        -- outbound_click only
  referrer_domain  text check (referrer_domain ~ '^[a-z0-9.-]{1,253}$'),
  utm_source       text check (char_length(utm_source) <= 100),
  utm_medium       text check (char_length(utm_medium) <= 100),
  utm_campaign     text check (char_length(utm_campaign) <= 100),
  device_type      public.device_type,
  browser          text check (char_length(browser) <= 40),
  os               text check (char_length(os) <= 40),
  country          text check (country ~ '^[A-Z]{2}$'),
  lang             text check (lang in ('en', 'bn')),
  engaged_ms       integer check (engaged_ms between 0 and 86400000)
);
create index analytics_events_occurred_idx on public.analytics_events (occurred_at);
create index analytics_events_course_idx on public.analytics_events (course_id, occurred_at) where course_id is not null;
create index analytics_events_session_idx on public.analytics_events (session_id);
create index analytics_events_path_idx on public.analytics_events (path, occurred_at);

-- Daily rollups (filled by a scheduled job in the analytics phase).
create table public.analytics_daily (
  day                 date primary key,
  visitors            integer not null default 0,
  new_visitors        integer not null default 0,
  returning_visitors  integer not null default 0,
  sessions            integer not null default 0,
  pageviews           integer not null default 0,
  course_views        integer not null default 0,
  avg_engaged_ms      integer not null default 0
);

create table public.analytics_daily_pages (
  day        date not null,
  path       text not null,
  course_id  uuid references public.courses (id) on delete set null,
  views      integer not null default 0,
  visitors   integer not null default 0,
  primary key (day, path)
);

create table public.analytics_daily_dims (
  day        date not null,
  dimension  text not null check (dimension in ('device', 'browser', 'os', 'country', 'source', 'lang')),
  value      text not null,
  visitors   integer not null default 0,
  pageviews  integer not null default 0,
  primary key (day, dimension, value)
);

-- ---------------------------------------------------------------------------
-- RLS: no anonymous access at all; admins read-only; writes = service role.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'analytics_sessions', 'analytics_events', 'analytics_daily',
    'analytics_daily_pages', 'analytics_daily_dims'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_admin()))',
      t || '_admin_select', t);
  end loop;
end;
$$;

revoke all on sequence public.analytics_events_id_seq from anon, authenticated;
-- ============================================================================
-- MediVerse Dental CMS — 5/5 Storage
--
-- Bucket "public-media": public READ by URL (served by Supabase's CDN), so
-- flyers / photos / banners load on the website without auth.
-- Listing objects and every write (upload / replace / delete) is admin-only.
-- Only raster images in known folders are accepted (SVG is blocked because it
-- can carry scripts). Max 5 MB per file.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media', 'public-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: is this object path an allowed media location + image extension?
create or replace function private.is_allowed_media_path(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name ~ '^(flyers|thumbnails|mentors|banners|logos|images)/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|avif)$';
$$;
grant execute on function private.is_allowed_media_path(text) to authenticated, service_role;

-- No SELECT policy for anon: visitors fetch files by public URL only and
-- cannot list the bucket.
create policy public_media_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'public-media' and (select private.is_admin()));

create policy public_media_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-media'
    and (select private.is_admin())
    and private.is_allowed_media_path(name)
  );

create policy public_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and (select private.is_admin()))
  with check (
    bucket_id = 'public-media'
    and (select private.is_admin())
    and private.is_allowed_media_path(name)
  );

create policy public_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and (select private.is_admin()));

commit;

select 'PART 3 DONE ✅ — now run PART 4' as result;
