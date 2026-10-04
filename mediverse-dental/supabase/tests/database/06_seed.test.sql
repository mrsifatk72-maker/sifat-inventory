-- The seed reproduces today's website content exactly.
begin;
select no_plan();

select is((select count(*)::int from public.site_settings), 1, '1 site settings row');
select is((select count(*)::int from public.phases), 4, '4 phases');
select is((select count(*)::int from public.courses), 22, '22 courses');
select is((select count(*)::int from public.courses where status = 'active' and archived_at is null), 22, 'all seeded courses are active');
select is((select count(*)::int from public.courses where flyer_media_id is not null), 21, '21 courses have a flyer');
select is((select count(*)::int from public.courses where short_desc_bn is null or short_desc_bn = ''), 0,
          'every course has a Bangla description');
select is((select count(*)::int from public.courses where external_url !~ '^https://mediversebd\.com'), 0,
          'every course CTA points to the Mediverse platform');
select is((select count(*)::int from public.courses c join public.phases p on p.id = c.phase_id where p.code = 3), 4,
          '4 courses in 3rd Phase (C&C, Peri & Oral Patho crash, Medicine, Surgery)');
select is((select count(*)::int from public.mentors), 10, '10 mentors');
select is((select count(*)::int from public.mentors where avatar_style = 'hijab_icon'), 4, '4 mentors use the hijab icon');
select is((select count(*)::int from public.mentors where avatar_style = 'photo'), 6, '6 mentors have photos');
select is((select count(*)::int from public.course_mentors), 7, '7 mentor assignments taken from flyers');
select is((select count(*)::int from public.media), 29, '29 media files');
select is((select count(*)::int from public.media where id not in (select media_id from public.media_usage)), 0,
          'no unused media after seeding');
select is((select count(*)::int from public.page_sections where key in ('hero','about','courses','mentors','stories','faq','contact')), 7, '7 original homepage sections');
select is((select count(*)::int from public.page_sections where content -> 'bn' = '{}'::jsonb), 0, 'every section has Bangla copy');
select is((select content -> 'en' ->> 'heading' from public.page_sections where key = 'hero'),
          E'Future Dentistry\n[[Begins Here.]]', 'hero heading uses safe markup (no HTML)');
select is((select count(*)::int from public.page_sections where content::text ~ '<[a-z/]'), 0,
          'no raw HTML stored in section content');
select is((select count(*)::int from public.stats), 4, '4 hero stats');
select is((select count(*)::int from public.features), 3, '3 feature cards');
select is((select count(*)::int from public.faqs), 5, '5 FAQs');
select is((select count(*)::int from public.faqs where answer_en ~ '<[a-z/]'), 0, 'no raw HTML in FAQ answers');
select is((select count(*)::int from public.testimonials), 3, '3 testimonials');
select is((select count(*)::int from public.nav_items where location = 'header' and url not in ('/articles','/books','/team')), 6, '6 original header items (5 links + Enroll button)');
select is((select count(*)::int from public.nav_items where location = 'mobile' and url not in ('/articles','/books','/team')), 7, '7 original mobile menu items');
select is((select count(*)::int from public.footer_sections), 4, '4 footer sections');
select is((select count(*)::int from public.footer_links), 12, '12 footer links');
select is((select count(*)::int from public.social_links), 4, '4 social links');

select * from finish();
rollback;
