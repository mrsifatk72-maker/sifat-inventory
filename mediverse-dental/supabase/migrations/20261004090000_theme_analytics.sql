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
