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
