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
