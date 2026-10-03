-- ============================================================================
-- MediVerse Dental CMS — 2/5 Admin authentication & authorization + audit log
--
-- Identity is Supabase Auth (auth.users). Public sign-up is disabled in the
-- Auth settings; only users listed in public.admin_users can use the admin
-- panel. Roles:
--   owner  — everything, incl. managing admin users (requires MFA / aal2)
--   editor — content, courses, mentors, header/footer, media
-- ============================================================================

create table public.admin_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         public.admin_role not null default 'editor',
  display_name text check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.admin_users is
  'Allowlist of admin panel users. Only owners (with MFA) can change it.';

create trigger admin_users_updated_at
  before update on public.admin_users
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so they can read admin_users
-- without being blocked by its own RLS; they only ever answer about the
-- caller, identified by auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- True when the caller's session passed multi-factor authentication.
create or replace function private.has_mfa()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

revoke all on function private.is_admin(), private.is_owner(), private.has_mfa() from public;
grant execute on function private.is_admin(), private.is_owner(), private.has_mfa()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Guard: never allow the last owner to be removed or demoted.
-- ---------------------------------------------------------------------------
create or replace function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and (select count(*) from public.admin_users where role = 'owner') <= 1 then
    raise exception 'Cannot remove or demote the last owner'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger admin_users_protect_last_owner
  before update or delete on public.admin_users
  for each row execute function private.protect_last_owner();

-- ---------------------------------------------------------------------------
-- One-time bootstrap: promote an existing auth user (invited from the
-- Supabase dashboard) to owner. Callable only by the database owner
-- (SQL editor / CLI), never through the API.
-- ---------------------------------------------------------------------------
create or replace function private.bootstrap_owner(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then
    raise exception 'No auth user with email %', p_email;
  end if;
  insert into public.admin_users (user_id, role)
  values (v_id, 'owner')
  on conflict (user_id) do update set role = 'owner';
  return v_id;
end;
$$;

revoke all on function private.bootstrap_owner(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS for admin_users
-- ---------------------------------------------------------------------------
alter table public.admin_users enable row level security;

revoke all on public.admin_users from anon, authenticated;
grant select, insert, update, delete on public.admin_users to authenticated;

-- An admin can see their own row; owners can see everyone.
create policy admin_users_select on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));

-- Only owners who passed MFA can add, change or remove admins.
create policy admin_users_insert on public.admin_users
  for insert to authenticated
  with check ((select private.is_owner()) and (select private.has_mfa()));

create policy admin_users_update on public.admin_users
  for update to authenticated
  using ((select private.is_owner()) and (select private.has_mfa()))
  with check ((select private.is_owner()) and (select private.has_mfa()));

create policy admin_users_delete on public.admin_users
  for delete to authenticated
  using ((select private.is_owner()) and (select private.has_mfa()));

-- ============================================================================
-- Audit log — written only by triggers, readable by admins, immutable.
-- ============================================================================
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,                       -- auth.uid(); null = system/seed
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity     text not null,              -- table name
  entity_id  text,
  changes    jsonb                       -- INSERT: new row, DELETE: old row, UPDATE: {field: {old, new}}
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id  text  := coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'key',
                          concat_ws(':', v_row ->> 'course_id', v_row ->> 'mentor_id'));
  v_changes jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(v_new) n
     where n.key <> 'updated_at' and (v_old -> n.key) is distinct from n.value;
    if v_changes = '{}'::jsonb then
      return new;  -- nothing meaningful changed
    end if;
  else
    v_changes := v_row;
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, changes)
  values ((select auth.uid()), tg_op, tg_table_name, v_id, v_changes);

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_row() from public, anon, authenticated;

create trigger admin_users_audit
  after insert or update or delete on public.admin_users
  for each row execute function private.audit_row();

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Admins can read; nobody can insert/update/delete through the API.
create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using ((select private.is_admin()));
