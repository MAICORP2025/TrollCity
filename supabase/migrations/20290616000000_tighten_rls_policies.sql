-- Tighten RLS on system_errors: only allow inserting error logs, not arbitrary data
-- Drop the overly permissive policy
drop policy if exists "Enable insert for authenticated users" on "public"."system_errors";

-- Recreate with validation: only allow inserts with valid error structure
create policy "Users can insert their own error logs"
on "public"."system_errors"
as permissive
for insert
to authenticated
with check (
  -- Ensure the user is inserting their own errors (if user_id column exists)
  -- and that required fields are present
  (user_id IS NULL OR user_id = auth.uid())
  AND message IS NOT NULL
  AND created_at IS NOT NULL
);

-- Tighten RLS on system_roles: only staff/admin should see role definitions
drop policy if exists "Public read system roles" on "public"."system_roles";

create policy "Only staff can read system roles"
on "public"."system_roles"
for select
to authenticated
using (
  exists (
    select 1 from user_profiles
    where id = auth.uid()
    and (
      is_admin = true
      or is_troll_officer = true
      or role = 'secretary'
      or role = 'admin'
    )
  )
);

-- Tighten RLS on user_role_grants: only staff/admin should see role grants
drop policy if exists "Public read role grants" on "public"."user_role_grants";

create policy "Only staff can read role grants"
on "public"."user_role_grants"
for select
to authenticated
using (
  exists (
    select 1 from user_profiles
    where id = auth.uid()
    and (
      is_admin = true
      or is_troll_officer = true
      or role = 'secretary'
      or role = 'admin'
    )
  )
);

-- Users can see their own role grants
create policy "Users can read their own role grants"
on "public"."user_role_grants"
for select
to authenticated
using (user_id = auth.uid());
