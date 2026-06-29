-- ============================================================
-- Staff Action Audit Log & Role Permission Matrix
-- Migration: 20260629000002_staff_audit_system.sql
-- Purpose: Ensure every page and every action performed by
--          staff is logged and permission-gated correctly
-- ============================================================

-- ============================================================
-- PART 1: STAFF ACTION AUDIT LOG
-- ============================================================

-- Table to log every action performed by staff members
CREATE TABLE IF NOT EXISTS public.staff_action_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_role    TEXT NOT NULL,          -- role at time of action
  staff_email   TEXT,                   -- email at time of action
  action_type   TEXT NOT NULL,          -- e.g. 'page_view', 'coin_grant', 'user_ban', 'role_change'
  action_category TEXT NOT NULL,        -- e.g. 'moderation', 'finance', 'admin', 'court', 'auction'
  target_type   TEXT,                   -- e.g. 'user', 'stream', 'auction', 'docket'
  target_id     TEXT,                   -- ID of the target entity
  target_name   TEXT,                   -- Human-readable target name
  details       JSONB DEFAULT '{}',     -- Arbitrary action details
  route_path    TEXT,                   -- Frontend route where action occurred
  ip_address    INET,                   -- Client IP (if available)
  user_agent    TEXT,                   -- Client user agent
  result        TEXT DEFAULT 'success', -- 'success', 'denied', 'error'
  error_message TEXT,                   -- Error details if result = 'error'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_staff_audit_staff_user ON public.staff_action_audit_log (staff_user_id);
CREATE INDEX idx_staff_audit_action_type ON public.staff_action_audit_log (action_type);
CREATE INDEX idx_staff_audit_category ON public.staff_action_audit_log (action_category);
CREATE INDEX idx_staff_audit_target ON public.staff_action_audit_log (target_type, target_id);
CREATE INDEX idx_staff_audit_created ON public.staff_action_audit_log (created_at DESC);
CREATE INDEX idx_staff_audit_role ON public.staff_action_audit_log (staff_role);
CREATE INDEX idx_staff_audit_result ON public.staff_action_audit_log (result);

-- RLS policies
ALTER TABLE public.staff_action_audit_log ENABLE ROW LEVEL SECURITY;

-- Staff can view their own audit log
CREATE POLICY "staff_view_own_audit" ON public.staff_action_audit_log
  FOR SELECT USING (
    staff_user_id = auth.uid()
  );

-- Admins can view all audit logs
CREATE POLICY "admin_view_all_audit" ON public.staff_action_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'superadmin', 'ceo'))
    )
  );

-- Secretaries can view audit logs (read-only)
CREATE POLICY "secretary_view_audit" ON public.staff_action_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_secretary = true OR role = 'secretary')
    )
  );

-- Lead officers can view audit logs
CREATE POLICY "lead_officer_view_audit" ON public.staff_action_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_lead_officer = true OR role = 'lead_troll_officer')
    )
  );

-- System/service role can insert audit logs
CREATE POLICY "authenticated_insert_audit" ON public.staff_action_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- No one can update or delete audit logs (immutable)
CREATE POLICY "no_update_audit" ON public.staff_action_audit_log
  FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY "no_delete_audit" ON public.staff_action_audit_log
  FOR DELETE USING (false);

-- Auto-cleanup: partition or archive after 1 year
-- (Implement via pg_cron or external job if needed)

-- ============================================================
-- PART 2: ROLE PERMISSION MATRIX
-- ============================================================

-- Defines which roles can access which pages/actions
CREATE TABLE IF NOT EXISTS public.role_permission_matrix (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name   TEXT NOT NULL,            -- e.g. 'admin', 'troll_officer', 'auctioneer'
  resource    TEXT NOT NULL,            -- e.g. 'page:/admin/role-management', 'action:grant_coins'
  permission  TEXT NOT NULL DEFAULT 'allow', -- 'allow' or 'deny'
  conditions  JSONB DEFAULT '{}',       -- Optional conditions (e.g. time restrictions)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_name, resource)
);

-- Index for fast lookups
CREATE INDEX idx_permission_role ON public.role_permission_matrix (role_name);
CREATE INDEX idx_permission_resource ON public.role_permission_matrix (resource);
CREATE INDEX idx_permission_role_resource ON public.role_permission_matrix (role_name, resource);

-- RLS
ALTER TABLE public.role_permission_matrix ENABLE ROW LEVEL SECURITY;

-- Anyone can read the permission matrix (needed for frontend checks)
CREATE POLICY "anyone_read_permissions" ON public.role_permission_matrix
  FOR SELECT USING (true);

-- Only admins can modify the permission matrix
CREATE POLICY "admin_modify_permissions" ON public.role_permission_matrix
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'superadmin', 'ceo'))
    )
  );

-- ============================================================
-- PART 3: SEED PERMISSION MATRIX
-- ============================================================

-- Admin: Full access to everything
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('admin', 'page:/admin', 'allow'),
  ('admin', 'page:/admin/*', 'allow'),
  ('admin', 'page:/store-debug', 'allow'),
  ('admin', 'page:/admin-mobile', 'allow'),
  ('admin', 'page:/changelog', 'allow'),
  ('admin', 'page:/rtcadminmonitor', 'allow'),
  ('admin', 'action:grant_coins', 'allow'),
  ('admin', 'action:edit_role', 'allow'),
  ('admin', 'action:ban_user', 'allow'),
  ('admin', 'action:jail_user', 'allow'),
  ('admin', 'action:mute_user', 'allow'),
  ('admin', 'action:process_cashout', 'allow'),
  ('admin', 'action:view_audit_logs', 'allow'),
  ('admin', 'action:manage_permissions', 'allow'),
  ('admin', 'action:send_notifications', 'allow'),
  ('admin', 'action:export_data', 'allow'),
  ('admin', 'action:manage_marketplace', 'allow'),
  ('admin', 'action:manage_economy', 'allow'),
  ('admin', 'action:manage_officers', 'allow'),
  ('admin', 'action:ghost_mode', 'allow'),
  ('admin', 'action:manage_stream', 'allow'),
  ('admin', 'action:manage_auctions', 'allow'),
  ('admin', 'action:manage_court', 'allow'),
  ('admin', 'action:manage_jail', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Superadmin: Same as admin plus system-level actions
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('superadmin', 'page:/admin', 'allow'),
  ('superadmin', 'page:/admin/*', 'allow'),
  ('superadmin', 'action:grant_coins', 'allow'),
  ('superadmin', 'action:edit_role', 'allow'),
  ('superadmin', 'action:ban_user', 'allow'),
  ('superadmin', 'action:jail_user', 'allow'),
  ('superadmin', 'action:mute_user', 'allow'),
  ('superadmin', 'action:process_cashout', 'allow'),
  ('superadmin', 'action:view_audit_logs', 'allow'),
  ('superadmin', 'action:manage_permissions', 'allow'),
  ('superadmin', 'action:system_config', 'allow'),
  ('superadmin', 'action:manage_stream', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- CEO: Admin-level access plus executive actions
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('ceo', 'page:/admin', 'allow'),
  ('ceo', 'page:/admin/night-watch', 'allow'),
  ('ceo', 'page:/admin/meetings', 'allow'),
  ('ceo', 'page:/rtcadminmonitor', 'allow'),
  ('ceo', 'action:ghost_mode', 'allow'),
  ('ceo', 'action:view_audit_logs', 'allow'),
  ('ceo', 'action:manage_stream', 'allow'),
  ('ceo', 'action:manage_economy', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Lead Troll Officer
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('lead_troll_officer', 'page:/lead-officer', 'allow'),
  ('lead_troll_officer', 'page:/officer/*', 'allow'),
  ('lead_troll_officer', 'page:/admin/night-watch', 'allow'),
  ('lead_troll_officer', 'page:/admin/creator-approvals', 'allow'),
  ('lead_troll_officer', 'page:/admin/meetings', 'allow'),
  ('lead_troll_officer', 'page:/rtcadminmonitor', 'allow'),
  ('lead_troll_officer', 'page:/inmates', 'allow'),
  ('lead_troll_officer', 'action:jail_user', 'allow'),
  ('lead_troll_officer', 'action:mute_user', 'allow'),
  ('lead_troll_officer', 'action:warn_user', 'allow'),
  ('lead_troll_officer', 'action:view_audit_logs', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Troll Officer
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('troll_officer', 'page:/officer/*', 'allow'),
  ('troll_officer', 'page:/admin/payments', 'allow'),
  ('troll_officer', 'page:/admin/economy', 'allow'),
  ('troll_officer', 'page:/admin/tax-reviews', 'allow'),
  ('troll_officer', 'page:/admin/referrals', 'allow'),
  ('troll_officer', 'page:/admin/night-watch', 'allow'),
  ('troll_officer', 'page:/admin/meetings', 'allow'),
  ('troll_officer', 'page:/rtcadminmonitor', 'allow'),
  ('troll_officer', 'page:/inmates', 'allow'),
  ('troll_officer', 'action:jail_user', 'allow'),
  ('troll_officer', 'action:mute_user', 'allow'),
  ('troll_officer', 'action:warn_user', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Secretary
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('secretary', 'page:/secretary', 'allow'),
  ('secretary', 'page:/admin/creator-approvals', 'allow'),
  ('secretary', 'page:/admin/manual-orders', 'allow'),
  ('secretary', 'page:/admin/appeals', 'allow'),
  ('secretary', 'page:/admin/meetings', 'allow'),
  ('secretary', 'page:/admin/advertisements', 'allow'),
  ('secretary', 'page:/admin/officer-payroll', 'allow'),
  ('secretary', 'page:/admin/night-watch', 'allow'),
  ('secretary', 'page:/rtcadminmonitor', 'allow'),
  ('secretary', 'page:/president/secretary', 'allow'),
  ('secretary', 'action:view_audit_logs', 'allow'),
  ('secretary', 'action:process_manual_orders', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Prosecutor
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('prosecutor', 'page:/prosecutor', 'allow'),
  ('prosecutor', 'page:/troll-court', 'allow'),
  ('prosecutor', 'page:/court/:courtId', 'allow'),
  ('prosecutor', 'action:file_charges', 'allow'),
  ('prosecutor', 'action:prosecute_case', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Attorney
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('attorney', 'page:/attorney', 'allow'),
  ('attorney', 'page:/troll-court', 'allow'),
  ('attorney', 'page:/court/:courtId', 'allow'),
  ('attorney', 'page:/notary', 'allow'),
  ('attorney', 'action:defend_case', 'allow'),
  ('attorney', 'action:notarize', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Judge
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('judge', 'page:/troll-court', 'allow'),
  ('judge', 'page:/court/:courtId', 'allow'),
  ('judge', 'action:preside_trial', 'allow'),
  ('judge', 'action:issue_sentence', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Auctioneer
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('auctioneer', 'page:/auctions/studio', 'allow'),
  ('auctioneer', 'page:/auctions/studio/*', 'allow'),
  ('auctioneer', 'page:/auctions/my-shows', 'allow'),
  ('auctioneer', 'page:/auctions/bidders', 'allow'),
  ('auctioneer', 'page:/auctions/sales', 'allow'),
  ('auctioneer', 'page:/auctions/analytics', 'allow'),
  ('auctioneer', 'page:/auctions/settings', 'allow'),
  ('auctioneer', 'page:/auctions/inventory', 'allow'),
  ('auctioneer', 'page:/auctions/orders', 'allow'),
  ('auctioneer', 'page:/auctions/packing', 'allow'),
  ('auctioneer', 'page:/auctions/devices', 'allow'),
  ('auctioneer', 'page:/auctioneer/scanner', 'allow'),
  ('auctioneer', 'action:create_auction', 'allow'),
  ('auctioneer', 'action:manage_lots', 'allow'),
  ('auctioneer', 'action:start_live_auction', 'allow'),
  ('auctioneer', 'action:view_bidder_info', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Pastor
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('pastor', 'page:/church/pastor', 'allow'),
  ('pastor', 'action:lead_service', 'allow'),
  ('pastor', 'action:manage_prayers', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Journalist / TCNN
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('journalist', 'page:/tcnn/dashboard', 'allow'),
  ('journalist', 'action:write_article', 'allow'),
  ('tcnn_news_caster', 'page:/tcnn/dashboard', 'allow'),
  ('tcnn_news_caster', 'page:/tcnn/setup', 'allow'),
  ('tcnn_news_caster', 'page:/tcnn/broadcaster', 'allow'),
  ('tcnn_news_caster', 'page:/tcnn/broadcaster/:streamId', 'allow'),
  ('tcnn_news_caster', 'action:go_live_tcnn', 'allow'),
  ('tcnn_chief_news_caster', 'page:/tcnn/dashboard', 'allow'),
  ('tcnn_chief_news_caster', 'page:/tcnn/setup', 'allow'),
  ('tcnn_chief_news_caster', 'page:/tcnn/broadcaster', 'allow'),
  ('tcnn_chief_news_caster', 'page:/tcnn/broadcaster/:streamId', 'allow'),
  ('tcnn_chief_news_caster', 'action:go_live_tcnn', 'allow'),
  ('tcnn_chief_news_caster', 'action:manage_tcnn', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- CEO Assistant
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('ceo_assistant', 'page:/ceo-assistant-dashboard', 'allow'),
  ('ceo_assistant', 'page:/admin/night-watch', 'allow'),
  ('ceo_assistant', 'action:view_audit_logs', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Noah Assistant
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('noah_assistant', 'page:/noah-assistant-dashboard', 'allow'),
  ('noah_assistant', 'page:/admin/night-watch', 'allow'),
  ('noah_assistant', 'action:view_audit_logs', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- President
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('president', 'page:/president/dashboard', 'allow'),
  ('president', 'page:/president/treasury', 'allow'),
  ('president', 'action:manage_treasury', 'allow'),
  ('president', 'action:issue_executive_order', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- HR Admin
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('hr_admin', 'page:/hr-center', 'allow'),
  ('hr_admin', 'page:/agency-hr-dashboard', 'allow'),
  ('hr_admin', 'page:/rtcadminmonitor', 'allow'),
  ('hr_admin', 'action:manage_roles', 'allow'),
  ('hr_admin', 'action:view_payroll', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Agency HR Manager
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('agency_hr_manager', 'page:/agency-hr-dashboard', 'allow'),
  ('agency_hr_manager', 'page:/hr-center', 'allow'),
  ('agency_hr_manager', 'page:/rtcadminmonitor', 'allow'),
  ('agency_hr_manager', 'page:/admin/night-watch', 'allow'),
  ('agency_hr_manager', 'action:view_payroll', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Academy Teacher
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('academy_teacher', 'page:/academy/teacher/dashboard', 'allow'),
  ('academy_teacher', 'action:create_course', 'allow'),
  ('academy_teacher', 'action:grade_assignment', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Academy Director
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('academy_director', 'page:/academy/admin', 'allow'),
  ('academy_director', 'action:manage_academy', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- Marketing Readonly
INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('marketing_readonly', 'page:/admin/economy', 'allow'),
  ('marketing_readonly', 'page:/admin/sub-analytics', 'allow'),
  ('marketing_readonly', 'action:view_analytics', 'allow')
ON CONFLICT (role_name, resource) DO NOTHING;

-- ============================================================
-- PART 4: RPC TO LOG STAFF ACTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_staff_action(
  p_action_type   TEXT,
  p_action_category TEXT,
  p_target_type   TEXT DEFAULT NULL,
  p_target_id     TEXT DEFAULT NULL,
  p_target_name   TEXT DEFAULT NULL,
  p_details       JSONB DEFAULT '{}',
  p_route_path    TEXT DEFAULT NULL,
  p_result        TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_id UUID;
  v_staff_role TEXT;
  v_staff_email TEXT;
  v_log_id UUID;
BEGIN
  -- Get current user info
  v_staff_id := auth.uid();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get staff role and email from user_profiles
  SELECT COALESCE(role, 'user'), email INTO v_staff_role, v_staff_email
  FROM public.user_profiles
  WHERE id = v_staff_id;

  INSERT INTO public.staff_action_audit_log (
    staff_user_id, staff_role, staff_email,
    action_type, action_category,
    target_type, target_id, target_name,
    details, route_path,
    result, error_message
  ) VALUES (
    v_staff_id, v_staff_role, v_staff_email,
    p_action_type, p_action_category,
    p_target_type, p_target_id, p_target_name,
    p_details, p_route_path,
    p_result, p_error_message
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================
-- PART 5: RPC TO CHECK PERMISSIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_staff_permission(
  p_role_name TEXT,
  p_resource  TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permission_matrix
    WHERE role_name = p_role_name
      AND resource = p_resource
      AND permission = 'allow'
  );
$$;

-- ============================================================
-- PART 6: RPC TO GET STAFF AUDIT SUMMARY
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_staff_audit_summary(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  staff_role    TEXT,
  action_type   TEXT,
  action_count  BIGINT,
  last_action   TIMESTAMPTZ,
  denied_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    staff_role,
    action_type,
    COUNT(*) as action_count,
    MAX(created_at) as last_action,
    COUNT(*) FILTER (WHERE result = 'denied') as denied_count
  FROM public.staff_action_audit_log
  WHERE created_at > now() - (p_days || ' days')::INTERVAL
  GROUP BY staff_role, action_type
  ORDER BY action_count DESC;
$$;

-- ============================================================
-- PART 7: FIX UNPROTECTED ROUTES — Add RLS for sensitive pages
-- ============================================================

-- Enable RLS on user_role_grants (CRITICAL FIX)
ALTER TABLE public.user_role_grants ENABLE ROW LEVEL SECURITY;

-- Only admins can read/modify role grants
CREATE POLICY "admin_manage_role_grants" ON public.user_role_grants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'superadmin', 'ceo'))
    )
  );

-- Staff can view their own grants
CREATE POLICY "staff_view_own_grants" ON public.user_role_grants
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- ============================================================
-- PART 8: CONSOLIDATED ADMIN CHECK FUNCTION
-- ============================================================
-- ⚠️  IMPORTANT: We do NOT replace the existing is_admin() function.
-- ⚠️  Many RLS policies, triggers, and other DB objects depend on
-- ⚠️  the current is_admin() signature and behavior. Replacing it
-- ⚠️  could break existing policies across 100+ tables.
-- ⚠️
-- ⚠️  Instead, we create a NEW function `is_admin_consolidated()`
-- ⚠️  that includes all the checks (boolean, role text, grants).
-- ⚠️  New code should use is_admin_consolidated().
-- ⚠️  Existing is_admin() remains untouched.
-- ============================================================

-- New consolidated admin check (does NOT replace is_admin())
CREATE OR REPLACE FUNCTION public.is_admin_consolidated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        is_admin = true
        OR role IN ('admin', 'superadmin', 'ceo')
        OR (admin_override_until IS NOT NULL AND admin_override_until > now())
        OR EXISTS (
          SELECT 1 FROM public.user_role_grants urg
          JOIN public.system_roles sr ON sr.id = urg.role_id
          WHERE urg.user_id = auth.uid()
            AND sr.is_admin = true
            AND urg.revoked_at IS NULL
            AND (urg.expires_at IS NULL OR urg.expires_at > now())
        )
      )
  );
$$;

-- Parameterized version (does NOT replace is_admin(UUID))
CREATE OR REPLACE FUNCTION public.is_admin_consolidated(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        is_admin = true
        OR role IN ('admin', 'superadmin', 'ceo')
        OR (admin_override_until IS NOT NULL AND admin_override_until > now())
        OR EXISTS (
          SELECT 1 FROM public.user_role_grants urg
          JOIN public.system_roles sr ON sr.id = urg.role_id
          WHERE urg.user_id = p_user_id
            AND sr.is_admin = true
            AND urg.revoked_at IS NULL
            AND (urg.expires_at IS NULL OR urg.expires_at > now())
        )
      )
  );
$$;

-- ============================================================
-- PART 9: is_staff() CONSOLIDATED FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_staff_consolidated(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        is_admin = true
        OR is_troll_officer = true
        OR is_lead_officer = true
        OR is_secretary = true
        OR is_prosecutor = true
        OR is_attorney = true
        OR is_auctioneer = true
        OR is_ceo = true
        OR (is_officer = true AND is_officer_active = true)
        OR role IN (
          'admin', 'superadmin', 'ceo', 'owner', 'staff',
          'lead_troll_officer', 'troll_officer', 'officer',
          'secretary', 'executive_secretary', 'troll_city_secretary',
          'prosecutor', 'attorney', 'judge', 'auctioneer',
          'pastor', 'journalist', 'ceo_assistant', 'noah_assistant',
          'president', 'vice_president', 'hr_admin', 'hr_manager',
          'agency_hr', 'agency_hr_manager', 'agency_leader',
          'marketing_readonly', 'empire_partner', 'notary', 'broadofficer',
          'academy_teacher', 'academy_director', 'admissions_officer',
          'temp_city_admin', 'temp_admin', 'moderator'
        )
        OR troll_role IN (
          'admin', 'superadmin', 'ceo', 'owner', 'staff',
          'lead_troll_officer', 'troll_officer', 'officer',
          'secretary', 'prosecutor', 'attorney', 'judge', 'auctioneer',
          'pastor', 'journalist', 'ceo_assistant', 'noah_assistant',
          'president', 'hr_admin', 'agency_hr_manager', 'agency_leader'
        )
      )
  );
$$;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.staff_action_audit_log IS 'Immutable audit log of every action performed by staff members. Used for security review and compliance.';
COMMENT ON TABLE public.role_permission_matrix IS 'Data-driven permission matrix defining which roles can access which pages and actions. Replaces scattered inline role checks.';
COMMENT ON FUNCTION public.log_staff_action IS 'Logs a staff action to the audit trail. Automatically captures the current user, role, and email.';
COMMENT ON FUNCTION public.check_staff_permission IS 'Checks if a role has permission to access a resource. Used by frontend and edge functions.';
COMMENT ON FUNCTION public.get_staff_audit_summary IS 'Returns a summary of staff actions over the last N days. Used by the Staff Audit Dashboard.';
COMMENT ON FUNCTION public.is_admin_consolidated() IS 'Consolidated admin check: is_admin boolean, role text, admin_override_until, or active user_role_grants. Does NOT replace is_admin() — existing RLS policies depend on the original.';
COMMENT ON FUNCTION public.is_admin_consolidated(UUID) IS 'Parameterized consolidated admin check. Does NOT replace is_admin(UUID).';
COMMENT ON FUNCTION public.is_staff_consolidated IS 'Consolidated staff check covering all 35+ staff roles via boolean flags, role text, and troll_role text.';
