-- ============================================================
-- Fix support_screen_sessions RLS policy & is_admin() function
-- ============================================================
-- PROBLEM: Multiple migrations created duplicate is_admin() functions
-- with different signatures, causing "function is not unique" errors.
-- Also, the RLS policy on support_screen_sessions was too restrictive:
-- admins couldn't INSERT sessions for other users because the
-- WITH CHECK clause required target_user_id = auth.uid().
--
-- FIX: Drop all is_admin variants, create one clean version,
-- and fix the RLS policy to allow requested_by user access.
-- ============================================================

-- 1. Drop ALL existing is_admin function variants to resolve ambiguity
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- 2. Create a single, comprehensive is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.is_admin = true
        OR lower(coalesce(up.role, '')) IN (
          'admin', 'ceo', 'owner', 'hr_admin', 'agency_hr_manager',
          'president', 'vice_president', 'temp_city_admin', 'temp_admin',
          'troll_city_secretary', 'executive_secretary'
        )
      )
  );
$$;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- 3. Fix the support_screen_sessions RLS policies
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "admin can manage support screen sessions" ON public.support_screen_sessions;

-- SELECT: admins can see all, users can see sessions they're part of
CREATE POLICY "select support screen sessions"
  ON public.support_screen_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR target_user_id = auth.uid()
    OR requested_by = auth.uid()
  );

-- INSERT: admins can create for any target, users can create their own requests
CREATE POLICY "insert support screen sessions"
  ON public.support_screen_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR requested_by = auth.uid()
  );

-- UPDATE: admins can update any, target user can accept/decline, either party can end
CREATE POLICY "update support screen sessions"
  ON public.support_screen_sessions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR target_user_id = auth.uid()
    OR requested_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR target_user_id = auth.uid()
    OR requested_by = auth.uid()
  );

-- DELETE: only admins can delete
CREATE POLICY "delete support screen sessions"
  ON public.support_screen_sessions
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4. Re-grant table permissions (CASCADE may have revoked them)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_screen_sessions TO authenticated;
