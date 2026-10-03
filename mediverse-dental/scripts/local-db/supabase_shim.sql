-- ============================================================================
-- LOCAL TESTING ONLY — never run against a real Supabase project.
--
-- Recreates the parts of a Supabase database that our migrations and RLS
-- policies depend on, so they can be tested on a plain PostgreSQL server
-- when the Supabase Docker stack is unavailable:
--   * roles anon / authenticated / service_role (service_role bypasses RLS)
--   * auth.users, auth.uid(), auth.jwt(), auth.role() — read from the
--     request.jwt.claims setting exactly like Supabase/PostgREST does
--   * storage.buckets / storage.objects (RLS on) + storage.foldername/extension
--   * Supabase's default privileges: anon/authenticated get ALL on new public
--     tables, so RLS + our explicit REVOKEs are what actually protect data
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------- auth ----
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  aud         text default 'authenticated',
  role        text default 'authenticated',
  created_at  timestamptz default now()
);

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select auth.jwt() ->> 'role';
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

-- ------------------------------------------------------------- storage ----
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null unique,
  owner               uuid,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets (id),
  name        text,
  owner       uuid,
  metadata    jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

create or replace function storage.extension(name text) returns text
language sql immutable as $$
  select reverse(split_part(reverse(name), '.', 1));
$$;
