-- ============================================================================
-- MediVerse Dental CMS — 1/5 Foundation
-- Private helper schema, enum types and shared helper functions.
-- ============================================================================

-- Helpers live in a schema that is NOT exposed through the Supabase Data API,
-- so they cannot be called as RPC endpoints. Roles only get USAGE so that RLS
-- policies can evaluate them.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
create type public.admin_role          as enum ('owner', 'editor');
create type public.course_status       as enum ('active', 'upcoming', 'hidden');
create type public.mentor_status       as enum ('active', 'hidden');
create type public.avatar_style        as enum ('photo', 'hijab_icon', 'initials');
create type public.media_kind          as enum ('image', 'flyer', 'thumbnail', 'mentor_photo', 'banner', 'logo');
create type public.nav_location        as enum ('header', 'mobile');
create type public.nav_style           as enum ('link', 'button');
create type public.footer_section_type as enum ('links', 'text', 'contact', 'social');
create type public.banner_placement    as enum ('home_top', 'home_mid', 'course_page');
create type public.social_platform     as enum ('facebook', 'youtube', 'telegram', 'whatsapp', 'instagram',
                                                'linkedin', 'tiktok', 'x', 'website', 'email', 'phone');

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Keeps updated_at current on every UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- URL allowlist used by CHECK constraints. Allows:
--   https://… / http://…, mailto:, tel:, in-page anchors (#section) and
--   site-relative paths (/courses/x). Rejects javascript:, data:, vbscript:,
--   protocol-relative //host and anything containing whitespace or quotes.
create or replace function private.is_safe_url(u text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select u is null or (
        char_length(u) <= 2048
    and u !~* '^\s*(javascript|data|vbscript|file):'
    and (
          u ~* '^https?://[^\s<>"''`]+$'
       or u ~* '^mailto:[^\s<>"''`]+$'
       or u ~  '^tel:\+?[0-9 ()-]{3,20}$'
       or u ~  '^#[A-Za-z0-9_-]*$'
       or u ~  '^/(?!/)[^\s<>"''`]*$'
    )
  );
$$;

-- URL-safe slug: lowercase words separated by single hyphens, max 80 chars.
create or replace function private.is_slug(s text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(s) <= 80;
$$;

grant execute on function private.is_safe_url(text) to anon, authenticated, service_role;
grant execute on function private.is_slug(text)     to anon, authenticated, service_role;
