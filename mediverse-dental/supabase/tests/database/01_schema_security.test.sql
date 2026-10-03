-- Schema-level security guarantees: RLS everywhere, no write privileges for
-- anonymous visitors, sensitive tables closed to anon, safe helper functions.
begin;
select no_plan();

-- Every table in public has Row-Level Security enabled.
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'RLS is enabled on every public table');

select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'RLS is enabled on storage.objects');

-- Every public table has at least one policy (no table left unintentionally closed/open).
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'every public table has at least one RLS policy');

-- Anonymous visitors hold no write privilege on any public table.
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'p')
        and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')  -- skip extension-owned objects (e.g. pgTAP)
        and (has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE')
          or has_table_privilege('anon', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'TRUNCATE')) $$,
  'anon has no INSERT/UPDATE/DELETE/TRUNCATE on any public table or view');

-- Sensitive tables are not even SELECT-able by anon.
select ok(not has_table_privilege('anon', 'public.' || t, 'SELECT'), 'anon has no SELECT on ' || t)
  from unnest(array['admin_users', 'audit_log', 'media_usage', 'analytics_sessions', 'analytics_events',
                    'analytics_daily', 'analytics_daily_pages', 'analytics_daily_dims']) as t;

-- Signed-in users can never write analytics or the audit log directly.
select ok(not (has_table_privilege('authenticated', 'public.' || t, 'INSERT')
            or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
            or has_table_privilege('authenticated', 'public.' || t, 'DELETE')),
          'authenticated cannot write ' || t)
  from unnest(array['audit_log', 'analytics_sessions', 'analytics_events',
                    'analytics_daily', 'analytics_daily_pages', 'analytics_daily_dims']) as t;

-- Privileged helper functions are not callable through the API roles.
select ok(not has_function_privilege(r, 'private.bootstrap_owner(text)', 'EXECUTE'),
          r || ' cannot execute private.bootstrap_owner')
  from unnest(array['anon', 'authenticated', 'service_role']) as r;

select ok(not has_function_privilege(r, 'private.audit_row()', 'EXECUTE'),
          r || ' cannot execute private.audit_row')
  from unnest(array['anon', 'authenticated']) as r;

-- SECURITY DEFINER functions pin their search_path (prevents search_path hijacking).
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'all SECURITY DEFINER functions set search_path');

-- No SECURITY DEFINER functions are exposed in the public (API) schema.
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef $$,
  'no SECURITY DEFINER functions in the API-exposed public schema');

-- The media usage view respects the caller's RLS.
select ok(
  (select coalesce('security_invoker=true' = any(reloptions), false) from pg_class where oid = 'public.media_usage'::regclass),
  'media_usage view uses security_invoker');

select * from finish();
rollback;
