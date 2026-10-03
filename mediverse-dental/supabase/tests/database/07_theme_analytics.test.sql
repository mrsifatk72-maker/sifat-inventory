begin;
select plan(12);

select has_column('public', 'site_settings', 'theme_default', 'theme_default exists');
select has_column('public', 'site_settings', 'ga4_measurement_id', 'ga4_measurement_id exists');
select is((select theme_default from public.site_settings), 'dark', 'existing site keeps the dark default');
select is((select count(*)::int from public.site_settings where color_cyan is null and font_en is null and ga4_measurement_id is null), 1,
          'existing row unchanged (new settings empty = current design)');

select lives_ok($$update public.site_settings set theme_default = 'light', color_cyan = '#00AAFF', font_en = 'Poppins',
                  font_bn = 'Noto Sans Bengali', ga4_measurement_id = 'G-ABC123XYZ', gtm_container_id = 'GTM-N4JDQJNM'$$,
                'valid theme / font / tracking values accepted');
select throws_ok($$update public.site_settings set theme_default = 'pink'$$, '23514', null, 'unknown theme rejected');
select throws_ok($$update public.site_settings set color_blue = 'red;}body{display:none'$$, '23514', null, 'non-hex colour rejected (no CSS injection)');
select throws_ok($$update public.site_settings set font_en = 'Comic Sans'$$, '23514', null, 'font outside the allow-list rejected');
select throws_ok($$update public.site_settings set ga4_measurement_id = '<script>alert(1)</script>'$$, '23514', null, 'GA4 value must be an ID, not code');
select throws_ok($$update public.site_settings set gtm_container_id = 'GTM-1"onload="x'$$, '23514', null, 'GTM value must be an ID, not code');

-- RLS still applies: anonymous visitors can read but not change settings.
set local role anon;
select lives_ok($$select theme_default, ga4_measurement_id from public.site_settings$$, 'anon can read the new columns');
select throws_ok($$update public.site_settings set theme_default = 'dark'$$, '42501', null, 'anon cannot update settings');
reset role;

select * from finish();
rollback;
