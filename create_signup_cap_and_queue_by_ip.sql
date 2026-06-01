-- ============================================================================
-- SIGNUP CAP + QUEUE BY IP — Admin Control Panel
-- ============================================================================
-- Adds:
-- 1. A signup_cap setting in admin_app_settings (if not present)
-- 2. IP-based queue tracking in signup_queue
-- 3. Helper RPC for admin to set cap and manage queue
-- ============================================================================

-- 1. Add ip_address column to signup_queue if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signup_queue' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE public.signup_queue ADD COLUMN ip_address inet;
  END IF;
END$$;

-- Add priority column for queue ordering (lower = higher priority)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signup_queue' AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.signup_queue ADD COLUMN priority integer DEFAULT 0;
  END IF;
END$$;

-- Add admitted_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signup_queue' AND column_name = 'admitted_at'
  ) THEN
    ALTER TABLE public.signup_queue ADD COLUMN admitted_at timestamptz;
  END IF;
END$$;

-- Add admitted_by uuid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signup_queue' AND column_name = 'admitted_by'
  ) THEN
    ALTER TABLE public.signup_queue ADD COLUMN admitted_by uuid REFERENCES auth.users(id);
  END IF;
END$$;

-- Index on ip_address for fast queue lookups
CREATE INDEX IF NOT EXISTS idx_signup_queue_ip ON public.signup_queue (ip_address);
CREATE INDEX IF NOT EXISTS idx_signup_queue_notified ON public.signup_queue (notified) WHERE NOT notified;

-- 2. Ensure signup_cap setting exists in admin_app_settings
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES (
  'signup_cap',
  '{"enabled": false, "cap": 100}'::jsonb,
  'Signup cap: enabled=true means only N users can sign up. 0 = disabled/unlimited.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 3. RPC: admin_set_signup_cap — set the signup cap from admin panel
CREATE OR REPLACE FUNCTION public.admin_set_signup_cap(
  p_cap integer,
  p_enabled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Verify caller is admin (not troller, not superadmin-dependent)
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        role IN ('admin', 'ceo', 'president', 'owner')
        OR is_admin = true
        OR is_ceo = true
        OR is_president = true
      )
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.admin_app_settings
  SET setting_value = jsonb_build_object('enabled', p_enabled, 'cap', p_cap),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE setting_key = 'signup_cap';

  RETURN jsonb_build_object('success', true, 'cap', p_cap, 'enabled', p_enabled);
END;
$$;

-- 4. RPC: admin_get_signup_queue — get queue with IP info for admin panel
CREATE OR REPLACE FUNCTION public.admin_get_signup_queue(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  username text,
  ip_address inet,
  priority integer,
  notified boolean,
  created_at timestamptz,
  admitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        role IN ('admin', 'ceo', 'president', 'owner', 'secretary')
        OR is_admin = true
        OR is_ceo = true
        OR is_president = true
        OR is_secretary = true
      )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sq.id, sq.email, sq.username, sq.ip_address, sq.priority,
         sq.notified, sq.created_at, sq.admitted_at
  FROM public.signup_queue sq
  WHERE sq.notified = false
  ORDER BY sq.priority ASC, sq.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 5. RPC: admin_admit_from_queue — admit a user from the queue
CREATE OR REPLACE FUNCTION public.admin_admit_from_queue(
  p_queue_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        role IN ('admin', 'ceo', 'president', 'owner', 'secretary')
        OR is_admin = true
        OR is_ceo = true
        OR is_president = true
        OR is_secretary = true
      )
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.signup_queue
  SET notified = true,
      admitted_at = now(),
      admitted_by = auth.uid()
  WHERE id = p_queue_id AND notified = false;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Queue entry not found or already admitted');
  END IF;
END;
$$;

-- 6. RPC: admin_get_queue_stats — get queue stats grouped by IP
CREATE OR REPLACE FUNCTION public.admin_get_queue_stats()
RETURNS TABLE (
  total_waiting bigint,
  unique_ips bigint,
  top_ips jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (
        role IN ('admin', 'ceo', 'president', 'owner', 'secretary')
        OR is_admin = true
        OR is_ceo = true
        OR is_president = true
        OR is_secretary = true
      )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_waiting,
    COUNT(DISTINCT ip_address)::bigint AS unique_ips,
    COALESCE(
      (SELECT jsonb_agg(sub.json_row)
       FROM (
         SELECT jsonb_build_object(
           'ip', ip_address::text,
           'count', COUNT(*)
         ) AS json_row
         FROM public.signup_queue
         WHERE notified = false AND ip_address IS NOT NULL
         GROUP BY ip_address
         ORDER BY COUNT(*) DESC
         LIMIT 20
       ) sub),
      '[]'::jsonb
    ) AS top_ips
  FROM public.signup_queue
  WHERE notified = false;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.admin_set_signup_cap TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_signup_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_admit_from_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_queue_stats TO authenticated;
