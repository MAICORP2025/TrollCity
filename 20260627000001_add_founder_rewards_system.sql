-- =====================================================
-- Founder Rewards System Migration
-- Grants Secretaries ability to award exclusive perks:
--   1. CEO Fam Badge (profile frame)
--   2. 1 Free Agency Application Fee (waived)
--   3. Early Supporter recognition
--   4. Founder status
-- =====================================================

-- 1. Founder Rewards table (tracks what each user has)
CREATE TABLE IF NOT EXISTS public.founder_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ceo_fam_badge BOOLEAN NOT NULL DEFAULT FALSE,
  agency_fee_waived BOOLEAN NOT NULL DEFAULT FALSE,
  early_supporter BOOLEAN NOT NULL DEFAULT FALSE,
  founder_status BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Grant audit log (tracks who granted what)
CREATE TABLE IF NOT EXISTS public.founder_rewards_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('ceo_fam_badge', 'agency_fee_waived', 'early_supporter', 'founder_status')),
  admin_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_username TEXT,
  target_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_founder_rewards_user_id ON public.founder_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_rewards_grants_user_id ON public.founder_rewards_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_rewards_grants_created_at ON public.founder_rewards_grants(created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.founder_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_rewards_grants ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Users can read their own rewards
CREATE POLICY "users_read_own_rewards" ON public.founder_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Admins/Secretaries can read all rewards
CREATE POLICY "admin_read_all_rewards" ON public.founder_rewards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

-- Admins/Secretaries can insert/update rewards
CREATE POLICY "admin_manage_rewards" ON public.founder_rewards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

-- Grant log: admins can read all
CREATE POLICY "admin_read_grants" ON public.founder_rewards_grants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

-- Grant log: admins can insert
CREATE POLICY "admin_create_grants" ON public.founder_rewards_grants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

-- 6. Function to grant a reward (used by edge function or direct RPC)
CREATE OR REPLACE FUNCTION public.grant_founder_reward(
  p_target_user_id UUID,
  p_reward_type TEXT,
  p_admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_target_username TEXT;
  v_admin_username TEXT;
BEGIN
  -- Verify admin permissions
  SELECT role, username INTO v_admin_role, v_admin_username
  FROM public.user_profiles
  WHERE id = p_admin_id;

  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get target user info
  SELECT username INTO v_target_username
  FROM public.user_profiles
  WHERE id = p_target_user_id;

  IF v_target_username IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found');
  END IF;

  -- Upsert the reward
  INSERT INTO public.founder_rewards (user_id, ceo_fam_badge, agency_fee_waived, early_supporter, founder_status)
  VALUES (
    p_target_user_id,
    CASE WHEN p_reward_type = 'ceo_fam_badge' THEN TRUE ELSE FALSE END,
    CASE WHEN p_reward_type = 'agency_fee_waived' THEN TRUE ELSE FALSE END,
    CASE WHEN p_reward_type = 'early_supporter' THEN TRUE ELSE FALSE END,
    CASE WHEN p_reward_type = 'founder_status' THEN TRUE ELSE FALSE END
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    ceo_fam_badge = CASE WHEN p_reward_type = 'ceo_fam_badge' THEN TRUE ELSE public.founder_rewards.ceo_fam_badge END,
    agency_fee_waived = CASE WHEN p_reward_type = 'agency_fee_waived' THEN TRUE ELSE public.founder_rewards.agency_fee_waived END,
    early_supporter = CASE WHEN p_reward_type = 'early_supporter' THEN TRUE ELSE public.founder_rewards.early_supporter END,
    founder_status = CASE WHEN p_reward_type = 'founder_status' THEN TRUE ELSE public.founder_rewards.founder_status END,
    updated_at = NOW();

  -- Log the grant
  INSERT INTO public.founder_rewards_grants (user_id, reward_type, admin_id, admin_username, target_username)
  VALUES (p_target_user_id, p_reward_type, p_admin_id, v_admin_username, v_target_username);

  RETURN json_build_object('success', true, 'message', 'Reward granted successfully');
END;
$$;

-- 9. Add fee_waived column to agency_applications if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agency_applications' AND column_name = 'fee_waived'
  ) THEN
    ALTER TABLE public.agency_applications ADD COLUMN fee_waived BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 10. Grant execute to authenticated users (function handles permission check)
GRANT EXECUTE ON FUNCTION public.grant_founder_reward TO authenticated;

-- 11. Add comments
COMMENT ON TABLE public.founder_rewards IS 'Tracks exclusive founder rewards granted to users by Secretaries';
COMMENT ON TABLE public.founder_rewards_grants IS 'Audit log of all founder reward grants';
COMMENT ON FUNCTION public.grant_founder_reward IS 'Grants a founder reward to a user. Requires admin/secretary role.';
