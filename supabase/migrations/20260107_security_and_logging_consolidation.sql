-- Security and Logging Consolidation Migration
-- Date: 2026-01-07
-- Purpose: Ensure RLS on sensitive tables and implement comprehensive action logging

-- ==========================================
-- 1. Secure user_tax_info
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_tax_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  legal_full_name text,
  date_of_birth date,
  country text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  tax_id_last4 text,
  tax_classification text DEFAULT 'individual',
  w9_status text DEFAULT 'not_submitted' CHECK (w9_status IN ('not_submitted', 'submitted', 'verified', 'rejected')),
  w9_verified_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_tax_info ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can view own tax info" ON public.user_tax_info;
DROP POLICY IF EXISTS "Users can insert own tax info" ON public.user_tax_info;
DROP POLICY IF EXISTS "Users can update own tax info" ON public.user_tax_info;
DROP POLICY IF EXISTS "Admins can view all tax info" ON public.user_tax_info;
DROP POLICY IF EXISTS "Admins can update tax info" ON public.user_tax_info;

-- Re-create policies
CREATE POLICY "Users can view own tax info"
  ON public.user_tax_info FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax info"
  ON public.user_tax_info FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax info"
  ON public.user_tax_info FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tax info"
  ON public.user_tax_info FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can update tax info"
  ON public.user_tax_info FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- ==========================================
-- 2. Secure referral_monthly_bonus (Referral Claims)
-- ==========================================
CREATE TABLE IF NOT EXISTS referral_monthly_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  month text NOT NULL, -- Format: 'YYYY-MM'
  coins_earned bigint NOT NULL,
  bonus_troll_coins bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (referred_user_id, month)
);

ALTER TABLE referral_monthly_bonus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bonus claims" ON referral_monthly_bonus;
DROP POLICY IF EXISTS "Admins can manage bonus claims" ON referral_monthly_bonus;

CREATE POLICY "Users can view own bonus claims"
  ON referral_monthly_bonus FOR SELECT
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage bonus claims"
  ON referral_monthly_bonus FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- ==========================================
-- 3. Action Logging System
-- ==========================================
CREATE TABLE IF NOT EXISTS public.action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.user_profiles(id), -- Who did it (can be null for system)
  target_id uuid, -- Who/what was affected
  action_type text NOT NULL, -- e.g. 'ban_user', 'approve_payout', 'login'
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view action logs" ON public.action_logs;
DROP POLICY IF EXISTS "System and Admins can insert action logs" ON public.action_logs;

CREATE POLICY "Admins can view action logs"
  ON public.action_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- Allow insert by authenticated users (for their own actions) or service role
CREATE POLICY "Authenticated can insert logs"
  ON public.action_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ==========================================
-- 4. Logging Helper Function
-- ==========================================
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action_type text,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.action_logs (
    actor_id,
    target_id,
    action_type,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    p_target_id,
    p_action_type,
    p_details,
    now()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated;
