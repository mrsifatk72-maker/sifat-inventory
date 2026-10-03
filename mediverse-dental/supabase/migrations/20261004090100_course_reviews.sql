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
