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
