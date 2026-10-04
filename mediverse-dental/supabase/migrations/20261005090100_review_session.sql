-- Reviews: add the student's session (e.g. "2019-20") next to name and college.
-- Optional, like name and college. Safe to run twice.
alter table public.course_reviews add column if not exists reviewer_session text;
alter table public.course_reviews drop constraint if exists course_reviews_session_check;
alter table public.course_reviews add constraint course_reviews_session_check
  check (reviewer_session is null or char_length(reviewer_session) between 1 and 30);
comment on column public.course_reviews.reviewer_session is 'Optional academic session, e.g. 2019-20.';
