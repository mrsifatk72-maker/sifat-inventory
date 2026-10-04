-- Data-integrity guards that protect the public site from bad admin input.
begin;
select no_plan();

-- URL allowlist
select ok(private.is_safe_url(u), 'safe URL accepted: ' || u)
  from unnest(array['https://mediversebd.com/courses/x', 'http://example.com', '#courses', '/courses/sdm',
                    'mailto:hello@mediversebd.com', 'tel:+8801726415926',
                    'https://wa.me/8801726415926?text=Hello%20there']) as u;
select ok(not private.is_safe_url(u), 'unsafe URL rejected: ' || u)
  from unnest(array['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)',
                    'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:x', '//evil.example',
                    'https://ok.com/"onmouseover="x', 'https://ok.com/<script>', 'ftp://x']) as u;

-- Slugs
select throws_ok($$ insert into public.courses (slug, title_en, phase_id) values ('Bad Slug!', 'x', (select id from public.phases limit 1)) $$,
                 '23514', null, 'invalid course slug rejected');
select throws_ok($$ insert into public.courses (slug, title_en, phase_id, external_url)
                    values ('http-link', 'x', (select id from public.phases limit 1), 'http://mediversebd.com') $$,
                 '23514', null, 'course CTA link must be https');
select throws_ok($$ insert into public.courses (slug, title_en, phase_id) values ('sdm-full-course', 'dup', (select id from public.phases limit 1)) $$,
                 '23505', null, 'duplicate course slug rejected');

-- Media
select throws_ok($$ insert into public.media (path, kind, mime, size_bytes) values ('flyers/x.svg', 'flyer', 'image/svg+xml', 10) $$,
                 '23514', null, 'SVG media rejected');
select throws_ok($$ insert into public.media (path, kind, mime, size_bytes) values ('other/x.jpg', 'flyer', 'image/jpeg', 10) $$,
                 '23514', null, 'media outside allowed folders rejected');
select throws_ok($$ insert into public.media (path, kind, mime, size_bytes) values ('flyers/big.jpg', 'flyer', 'image/jpeg', 6000000) $$,
                 '23514', null, 'media over 5 MB rejected');

-- Mentors
select throws_ok($$ insert into public.mentors (slug, name, avatar_style) values ('no-photo', 'No Photo', 'photo') $$,
                 '23514', null, 'photo avatar requires a photo');

-- Settings singleton
select throws_ok($$ insert into public.site_settings (id) values (false) $$, '23514', null, 'only one site_settings row allowed');
select throws_ok($$ update public.site_settings set whatsapp_number = '01726' $$, '23514', null, 'WhatsApp number must be international format');

-- Analytics privacy-shaped columns
select throws_ok($$ insert into public.analytics_sessions (session_id, visitor_id, country) values (gen_random_uuid(), gen_random_uuid(), 'Bangladesh') $$,
                 '23514', null, 'country must be a 2-letter code');
select throws_ok($$ insert into public.analytics_sessions (session_id, visitor_id, referrer_domain)
                    values (gen_random_uuid(), gen_random_uuid(), 'https://facebook.com/some/path?fbclid=1') $$,
                 '23514', null, 'referrer must be a bare domain (no full URLs)');

-- Audit trail: system/seed changes have no actor; triggers fire on every content table
select ok((select count(*) from public.audit_log where entity = 'courses' and action = 'INSERT') >= 22,
          'seed inserts are audited');

-- updated_at and audit triggers are installed on every content table
select has_trigger('public', t, t || '_updated_at', t || ' maintains updated_at')
  from unnest(array['media', 'site_settings', 'page_sections', 'stats', 'features', 'faqs', 'testimonials',
                    'banners', 'phases', 'courses', 'mentors', 'nav_items', 'footer_sections',
                    'footer_links', 'social_links', 'admin_users']) as t;
select has_trigger('public', t, t || '_audit', t || ' writes to the audit log')
  from unnest(array['media', 'site_settings', 'page_sections', 'stats', 'features', 'faqs', 'testimonials',
                    'banners', 'phases', 'courses', 'mentors', 'course_mentors', 'nav_items', 'footer_sections',
                    'footer_links', 'social_links', 'admin_users']) as t;

select * from finish();
rollback;
