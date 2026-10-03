-- STAGING ONLY: paste into Supabase → SQL Editor of project hhcxwianpbkhqqhccwbk and press Run.
-- One file for all new features: theme/colours/fonts + GA4/GTM, course reviews (with session),
-- Undergraduate/Postgraduate course level. Removes nothing. Safe to run more than once,
-- also if an earlier part6/part7 file was already run.
begin;

-- ===== 20261004090000_theme_analytics =====
-- Theme, fonts and Google Analytics / Tag Manager settings for the website.
-- Adds optional columns to the single site_settings row. Nothing is removed,
-- RLS is unchanged (admins edit, the public site reads), and every value is
-- validated so no free-form code can be stored.
-- Safe to run twice.

alter table public.site_settings
  add column if not exists theme_default      text not null default 'dark',
  add column if not exists color_cyan         text,
  add column if not exists color_blue         text,
  add column if not exists color_violet       text,
  add column if not exists font_en            text,
  add column if not exists font_bn            text,
  add column if not exists ga4_measurement_id text,
  add column if not exists gtm_container_id   text;

alter table public.site_settings drop constraint if exists site_settings_theme_default_check;
alter table public.site_settings add constraint site_settings_theme_default_check
  check (theme_default in ('dark', 'light'));

alter table public.site_settings drop constraint if exists site_settings_colors_check;
alter table public.site_settings add constraint site_settings_colors_check
  check (coalesce(color_cyan, '#000000') ~ '^#[0-9A-Fa-f]{6}$'
     and coalesce(color_blue, '#000000') ~ '^#[0-9A-Fa-f]{6}$'
     and coalesce(color_violet, '#000000') ~ '^#[0-9A-Fa-f]{6}$');

alter table public.site_settings drop constraint if exists site_settings_fonts_check;
alter table public.site_settings add constraint site_settings_fonts_check
  check ((font_en is null or font_en in ('Plus Jakarta Sans', 'Poppins', 'Inter', 'Montserrat', 'Nunito', 'Lato'))
     and (font_bn is null or font_bn in ('Hind Siliguri', 'Noto Sans Bengali', 'Baloo Da 2', 'Anek Bangla', 'Tiro Bangla')));

alter table public.site_settings drop constraint if exists site_settings_tracking_ids_check;
alter table public.site_settings add constraint site_settings_tracking_ids_check
  check ((ga4_measurement_id is null or ga4_measurement_id ~ '^G-[A-Z0-9]{4,20}$')
     and (gtm_container_id is null or gtm_container_id ~ '^GTM-[A-Z0-9]{4,12}$'));

comment on column public.site_settings.theme_default is 'Theme a first-time visitor sees (dark/light); the visitor toggle still works.';
comment on column public.site_settings.ga4_measurement_id is 'Google Analytics 4 ID (G-XXXX). Only the ID is stored; the site adds the official tag.';
comment on column public.site_settings.gtm_container_id is 'Google Tag Manager ID (GTM-XXXX). Only the ID is stored; the site adds the official tag.';

-- ===== 20261004090100_course_reviews =====
-- Course reviews entered by admins in "Reviews" (from feedback students send to the team):
-- course, optional student name + college, star rating 1–5, review text in English/Bangla.
-- Shown on that course's page.
-- Same security model as the other content tables: RLS on, visitors read only
-- visible reviews of visible courses, admins read/write. Safe to run twice.

create table if not exists public.course_reviews (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses (id) on delete cascade,
  reviewer_name  text check (char_length(reviewer_name) between 1 and 80),          -- optional
  reviewer_info_en text check (char_length(reviewer_info_en) <= 120),   -- college, optional, e.g. "Dhaka Dental College"
  reviewer_info_bn text check (char_length(reviewer_info_bn) <= 120),
  rating         smallint not null check (rating between 1 and 5),      -- 1 Very bad … 5 Very good
  review_en      text check (char_length(review_en) <= 2000),
  review_bn      text check (char_length(review_bn) <= 2000),
  is_visible     boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (review_en is not null or review_bn is not null)
);
create index if not exists course_reviews_course_idx on public.course_reviews (course_id, sort_order);

drop trigger if exists course_reviews_updated_at on public.course_reviews;
create trigger course_reviews_updated_at before update on public.course_reviews
  for each row execute function private.set_updated_at();
drop trigger if exists course_reviews_audit on public.course_reviews;
create trigger course_reviews_audit after insert or update or delete on public.course_reviews
  for each row execute function private.audit_row();

alter table public.course_reviews enable row level security;
revoke all on public.course_reviews from anon, authenticated;
grant select on public.course_reviews to anon;
grant select, insert, update, delete on public.course_reviews to authenticated;

drop policy if exists course_reviews_admin_select on public.course_reviews;
drop policy if exists course_reviews_admin_insert on public.course_reviews;
drop policy if exists course_reviews_admin_update on public.course_reviews;
drop policy if exists course_reviews_admin_delete on public.course_reviews;
drop policy if exists course_reviews_public_read on public.course_reviews;
create policy course_reviews_admin_select on public.course_reviews
  for select to authenticated using ((select private.is_admin()));
create policy course_reviews_admin_insert on public.course_reviews
  for insert to authenticated with check ((select private.is_admin()));
create policy course_reviews_admin_update on public.course_reviews
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy course_reviews_admin_delete on public.course_reviews
  for delete to authenticated using ((select private.is_admin()));
create policy course_reviews_public_read on public.course_reviews
  for select to anon, authenticated
  using (is_visible and exists (select 1 from public.courses c
                                where c.id = course_id and c.status in ('active', 'upcoming') and c.archived_at is null));

-- ===== 20261005090000_course_level =====
-- Course level: Undergraduate (BDS, phase-wise) or Postgraduate.
-- Existing courses become 'undergraduate'. Postgraduate courses do not need a BDS phase;
-- undergraduate courses still must have one. Nothing is removed. Safe to run twice.

alter table public.courses add column if not exists level text not null default 'undergraduate';

alter table public.courses drop constraint if exists courses_level_check;
alter table public.courses add constraint courses_level_check
  check (level in ('undergraduate', 'postgraduate'));

alter table public.courses alter column phase_id drop not null;

alter table public.courses drop constraint if exists courses_phase_required_check;
alter table public.courses add constraint courses_phase_required_check
  check (level = 'postgraduate' or phase_id is not null);

comment on column public.courses.level is 'undergraduate (BDS, needs a phase) or postgraduate (phase optional).';

-- ===== 20261005090100_review_session =====
-- Reviews: add the student's session (e.g. "2019-20") next to name and college.
-- Optional, like name and college. Safe to run twice.
alter table public.course_reviews add column if not exists reviewer_session text;
alter table public.course_reviews drop constraint if exists course_reviews_session_check;
alter table public.course_reviews add constraint course_reviews_session_check
  check (reviewer_session is null or char_length(reviewer_session) between 1 and 30);
comment on column public.course_reviews.reviewer_session is 'Optional academic session, e.g. 2019-20.';
commit;
