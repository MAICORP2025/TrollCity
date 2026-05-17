-- Fix infinite recursion in organization_admins RLS policies
-- This removes the circular reference that causes: "infinite recursion detected in policy for relation \"organization_admins\""

DROP POLICY IF EXISTS "org_admins_can_view_own_org" ON organization_admins;
DROP POLICY IF EXISTS "org_admins_can_manage_own" ON organization_admins;

-- Recreate policies without circular subquery to organizations table
CREATE POLICY "org_admins_can_view_own_org" ON organization_admins
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

CREATE POLICY "org_admins_can_manage_own" ON organization_admins
  FOR ALL USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );
