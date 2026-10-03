begin;
select plan(6);

select is((select count(*)::int from public.courses where level = 'undergraduate'), 22, 'existing 22 courses are undergraduate');
select throws_ok($$update public.courses set level = 'phd' where slug = 'decode-the-opg'$$, '23514', null, 'unknown level rejected');
select throws_ok($$insert into public.courses (slug, title_en, level) values ('ug-no-phase', 'x', 'undergraduate')$$,
                 '23514', null, 'undergraduate course needs a phase');
select lives_ok($$insert into public.courses (slug, title_en, level, external_url) values ('fcps-part-1', 'FCPS Part-1', 'postgraduate', 'https://mediversebd.com/courses/fcps')$$,
                'postgraduate course without a phase is allowed');
set local role anon;
select is((select level from public.courses where slug = 'fcps-part-1'), 'postgraduate', 'visitors can read the level');
select throws_ok($$update public.courses set level = 'undergraduate'$$, '42501', null, 'visitors cannot change courses');
reset role;

select * from finish();
rollback;
