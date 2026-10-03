-- ============================================================================
-- MediVerse Dental CMS — 3/5 Content
-- Media, site settings, homepage sections, courses, mentors, header & footer.
--
-- Conventions
--   * Visitor-facing text comes in _en / _bn pairs; empty _bn falls back to _en.
--   * Rich text uses a tiny safe markup rendered server-side (never raw HTML):
--       [[text]]   → gradient highlight     \n → line break
--       [label](https://url) → link (FAQ answers / details only)
--   * No admin identifiers are stored in publicly readable tables; who changed
--     what is recorded in public.audit_log.
--   * Images are referenced through public.media with ON DELETE RESTRICT, so a
--     file that is in use can never be deleted.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Media library
-- ---------------------------------------------------------------------------
create table public.media (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null default 'public-media' check (bucket = 'public-media'),
  path        text not null unique
              check (path ~ '^(flyers|thumbnails|mentors|banners|logos|images)/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|avif)$'),
  kind        public.media_kind not null,
  mime        text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes  integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  width       integer check (width > 0 and width <= 10000),
  height      integer check (height > 0 and height <= 10000),
  alt_en      text check (char_length(alt_en) <= 300),
  alt_bn      text check (char_length(alt_bn) <= 300),
  sha256      text unique check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index media_kind_idx on public.media (kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Site settings (single row)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id                     boolean primary key default true check (id),  -- singleton
  site_name              text not null default 'MediVerse Dental' check (char_length(site_name) <= 100),
  logo_dark_media_id     uuid references public.media (id) on delete restrict,  -- logo for dark theme (white)
  logo_light_media_id    uuid references public.media (id) on delete restrict,  -- logo for light theme (blue)
  og_image_media_id      uuid references public.media (id) on delete restrict,
  seo_title_en           text check (char_length(seo_title_en) <= 120),
  seo_title_bn           text check (char_length(seo_title_bn) <= 120),
  seo_description_en     text check (char_length(seo_description_en) <= 300),
  seo_description_bn     text check (char_length(seo_description_bn) <= 300),
  whatsapp_number        text check (whatsapp_number ~ '^\+[0-9]{8,15}$'),
  whatsapp_message_en    text check (char_length(whatsapp_message_en) <= 300),
  contact_email          text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  contact_phone          text check (contact_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  address_en             text check (char_length(address_en) <= 300),
  address_bn             text check (char_length(address_bn) <= 300),
  copyright_en           text check (char_length(copyright_en) <= 200),
  copyright_bn           text check (char_length(copyright_bn) <= 200),
  footer_tagline_en      text check (char_length(footer_tagline_en) <= 200),
  footer_tagline_bn      text check (char_length(footer_tagline_bn) <= 200),
  primary_cta_url        text check (private.is_safe_url(primary_cta_url)),   -- main Mediverse platform
  analytics_enabled      boolean not null default true,
  analytics_retention_days integer not null default 395 check (analytics_retention_days between 30 and 1095),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Homepage sections: hero, about, courses, mentors, stories, faq, contact
-- content shape (validated by the API layer):
--   { "en": { "kicker": "", "heading": "", "body": "", ... },
--     "bn": { ...same keys... },
--     "buttons": [ { "label_en": "", "label_bn": "", "url": "", "style": "primary|ghost", "new_tab": false } ] }
-- ---------------------------------------------------------------------------
create table public.page_sections (
  id          uuid primary key default gen_random_uuid(),
  page        text not null default 'home' check (page in ('home')),
  key         text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  content     jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  media_id    uuid references public.media (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (page, key)
);

create table public.stats (
  id          uuid primary key default gen_random_uuid(),
  value       integer not null check (value >= 0),
  suffix      text not null default '' check (char_length(suffix) <= 5),
  label_en    text not null check (char_length(label_en) between 1 and 60),
  label_bn    text check (char_length(label_bn) <= 60),
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.features (
  id          uuid primary key default gen_random_uuid(),
  icon        text not null default 'video' check (icon ~ '^[a-z0-9-]{1,30}$'),
  title_en    text not null check (char_length(title_en) between 1 and 120),
  title_bn    text check (char_length(title_bn) <= 120),
  body_en     text check (char_length(body_en) <= 500),
  body_bn     text check (char_length(body_bn) <= 500),
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  question_en  text not null check (char_length(question_en) between 1 and 300),
  question_bn  text check (char_length(question_bn) <= 300),
  answer_en    text not null check (char_length(answer_en) between 1 and 3000),
  answer_bn    text check (char_length(answer_bn) <= 3000),
  is_visible   boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.testimonials (
  id              uuid primary key default gen_random_uuid(),
  quote_en        text not null check (char_length(quote_en) between 1 and 1000),
  quote_bn        text check (char_length(quote_bn) <= 1000),
  attribution_en  text check (char_length(attribution_en) <= 120),   -- e.g. "3rd Prof student"
  attribution_bn  text check (char_length(attribution_bn) <= 120),
  source_en       text check (char_length(source_en) <= 120),        -- e.g. "Dhaka Dental College"
  source_bn       text check (char_length(source_bn) <= 120),
  is_visible      boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),   -- internal name
  media_id    uuid not null references public.media (id) on delete restrict,
  link_url    text check (private.is_safe_url(link_url)),
  placement   public.banner_placement not null default 'home_top',
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- Courses & mentors
-- ---------------------------------------------------------------------------
create table public.phases (
  id          uuid primary key default gen_random_uuid(),
  code        smallint not null unique check (code between 1 and 9),
  name_en     text not null check (char_length(name_en) between 1 and 60),
  name_bn     text check (char_length(name_bn) <= 60),
  summary_en  text check (char_length(summary_en) <= 500),
  summary_bn  text check (char_length(summary_bn) <= 500),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.courses (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (private.is_slug(slug)),
  title_en            text not null check (char_length(title_en) between 1 and 160),
  title_bn            text check (char_length(title_bn) <= 160),
  short_desc_en       text check (char_length(short_desc_en) <= 400),
  short_desc_bn       text check (char_length(short_desc_bn) <= 400),
  details_en          text check (char_length(details_en) <= 20000),
  details_bn          text check (char_length(details_bn) <= 20000),
  -- { "features": [{ "en": "", "bn": "" }], "total_classes": 60, "access_period_en": "", ... }
  info                jsonb not null default '{}'::jsonb check (jsonb_typeof(info) = 'object'),
  phase_id            uuid not null references public.phases (id) on delete restrict,
  flyer_media_id      uuid references public.media (id) on delete restrict,
  thumbnail_media_id  uuid references public.media (id) on delete restrict,
  external_url        text check (private.is_safe_url(external_url) and external_url ~* '^https://'),
  cta_label_en        text check (char_length(cta_label_en) <= 60),
  cta_label_bn        text check (char_length(cta_label_bn) <= 60),
  search_keywords     text[] not null default '{}',
  seo_title_en        text check (char_length(seo_title_en) <= 120),
  seo_title_bn        text check (char_length(seo_title_bn) <= 120),
  seo_description_en  text check (char_length(seo_description_en) <= 300),
  seo_description_bn  text check (char_length(seo_description_bn) <= 300),
  status              public.course_status not null default 'active',
  sort_order          integer not null default 0,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index courses_listing_idx on public.courses (status, sort_order) where archived_at is null;
create index courses_phase_idx on public.courses (phase_id);

create table public.mentors (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (private.is_slug(slug)),
  name             text not null check (char_length(name) between 1 and 120),
  designation_en   text check (char_length(designation_en) <= 120),   -- subject tag, e.g. "Orthodontics"
  designation_bn   text check (char_length(designation_bn) <= 120),
  credentials      text check (char_length(credentials) <= 500),      -- e.g. "MBBS (DMC), BCS (Health)"
  bio_en           text check (char_length(bio_en) <= 3000),
  bio_bn           text check (char_length(bio_bn) <= 3000),
  institution      text check (char_length(institution) <= 160),
  session          text check (char_length(session) <= 40),
  photo_media_id   uuid references public.media (id) on delete restrict,
  avatar_style     public.avatar_style not null default 'initials',
  -- [{ "type": "facebook|linkedin|website|…", "url": "https://…" }]
  links            jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  status           public.mentor_status not null default 'active',
  sort_order       integer not null default 0,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (avatar_style <> 'photo' or photo_media_id is not null)
);
create index mentors_listing_idx on public.mentors (status, sort_order) where archived_at is null;

create table public.course_mentors (
  course_id   uuid not null references public.courses (id) on delete cascade,
  mentor_id   uuid not null references public.mentors (id) on delete cascade,
  role        text not null default 'mentor' check (role ~ '^[a-z_]{1,30}$'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (course_id, mentor_id)
);
create index course_mentors_mentor_idx on public.course_mentors (mentor_id);

-- ---------------------------------------------------------------------------
-- Header & footer
-- ---------------------------------------------------------------------------
create table public.nav_items (
  id            uuid primary key default gen_random_uuid(),
  location      public.nav_location not null,
  label_en      text not null check (char_length(label_en) between 1 and 60),
  label_bn      text check (char_length(label_bn) <= 60),
  url           text not null check (private.is_safe_url(url)),
  is_external   boolean not null default false,
  open_new_tab  boolean not null default false,
  style         public.nav_style not null default 'link',
  parent_id     uuid references public.nav_items (id) on delete cascade,
  is_visible    boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index nav_items_location_idx on public.nav_items (location, sort_order);

create table public.footer_sections (
  id          uuid primary key default gen_random_uuid(),
  type        public.footer_section_type not null default 'links',
  title_en    text check (char_length(title_en) <= 60),
  title_bn    text check (char_length(title_bn) <= 60),
  body_en     text check (char_length(body_en) <= 1000),
  body_bn     text check (char_length(body_bn) <= 1000),
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.footer_links (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.footer_sections (id) on delete cascade,
  label_en     text not null check (char_length(label_en) between 1 and 60),
  label_bn     text check (char_length(label_bn) <= 60),
  url          text not null check (private.is_safe_url(url)),
  is_external  boolean not null default false,
  is_visible   boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index footer_links_section_idx on public.footer_links (section_id, sort_order);

create table public.social_links (
  id               uuid primary key default gen_random_uuid(),
  platform         public.social_platform not null,
  url              text not null check (private.is_safe_url(url)),
  label_en         text check (char_length(label_en) <= 60),
  label_bn         text check (char_length(label_bn) <= 60),
  subtitle_en      text check (char_length(subtitle_en) <= 80),   -- e.g. "100+ free classes"
  subtitle_bn      text check (char_length(subtitle_bn) <= 80),
  show_in_header   boolean not null default true,    -- mobile menu
  show_in_footer   boolean not null default true,
  show_in_contact  boolean not null default true,
  is_visible       boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Media usage (for the media library's "used in…" and "unused" filter)
-- security_invoker → the caller's RLS applies.
-- ---------------------------------------------------------------------------
create view public.media_usage
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
  ) u on true;

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
