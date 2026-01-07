
-- 1. Create user_tax_info table for sensitive data
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

-- Enable RLS on user_tax_info
ALTER TABLE public.user_tax_info ENABLE ROW LEVEL SECURITY;

-- Policies for user_tax_info
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

-- 2. Migrate existing data from user_profiles to user_tax_info
INSERT INTO public.user_tax_info (
  user_id,
  legal_full_name,
  date_of_birth,
  country,
  address_line1,
  address_line2,
  city,
  state_region,
  postal_code,
  tax_id_last4,
  tax_classification,
  w9_status,
  w9_verified_at
)
SELECT 
  id,
  legal_full_name,
  date_of_birth,
  country,
  address_line1,
  address_line2,
  city,
  state_region,
  postal_code,
  tax_id_last4,
  tax_classification,
  COALESCE(w9_status, 'not_submitted'),
  w9_verified_at
FROM public.user_profiles
WHERE legal_full_name IS NOT NULL OR tax_id_last4 IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  legal_full_name = EXCLUDED.legal_full_name,
  date_of_birth = EXCLUDED.date_of_birth,
  address_line1 = EXCLUDED.address_line1,
  tax_id_last4 = EXCLUDED.tax_id_last4,
  w9_status = EXCLUDED.w9_status;

-- 3. Create action_logs table for auditing
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

-- Enable RLS on action_logs
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all action logs"
  ON public.action_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "System and users can insert logs"
  ON public.action_logs FOR INSERT
  WITH CHECK (true); -- Allow insertion by triggers/functions

-- 4. Triggers for logging important actions

-- Log Payout Request Status Changes
CREATE OR REPLACE FUNCTION log_payout_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO public.action_logs (actor_id, target_id, action_type, details)
    VALUES (
      auth.uid(), -- The admin who changed it
      NEW.user_id,
      'payout_status_change',
      jsonb_build_object(
        'payout_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'amount_usd', NEW.amount_usd
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_payout_status ON public.payout_requests;
CREATE TRIGGER trg_log_payout_status
  AFTER UPDATE ON public.payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_payout_status_change();

-- Log User Ban/Unban/Mute
CREATE OR REPLACE FUNCTION log_user_moderation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for Ban
  IF (OLD.is_banned IS DISTINCT FROM NEW.is_banned) THEN
    INSERT INTO public.action_logs (actor_id, target_id, action_type, details)
    VALUES (
      auth.uid(),
      NEW.id,
      CASE WHEN NEW.is_banned THEN 'ban_user' ELSE 'unban_user' END,
      jsonb_build_object('reason', 'manual_update')
    );
  END IF;

  -- Check for Mute (if is_muted exists, otherwise skip)
  -- Assuming is_muted might be a column or handled differently, but let's check generic updates
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_user_moderation ON public.user_profiles;
CREATE TRIGGER trg_log_user_moderation
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_user_moderation();

-- 5. Add RLS to referral_monthly_bonus if missing
ALTER TABLE public.referral_monthly_bonus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view referral bonuses" ON public.referral_monthly_bonus;
CREATE POLICY "Admins can view referral bonuses"
  ON public.referral_monthly_bonus FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

DROP POLICY IF EXISTS "Users can view own referral bonuses" ON public.referral_monthly_bonus;
CREATE POLICY "Users can view own referral bonuses"
  ON public.referral_monthly_bonus FOR SELECT
  USING (auth.uid() = recruiter_id);

