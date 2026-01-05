-- Create payment_holds table
CREATE TABLE IF NOT EXISTS payment_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  hold_type text NOT NULL, -- 'all', 'cashout', 'payout', 'withdrawal'
  reason text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_holds ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own payment holds"
  ON payment_holds
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and officers can view all payment holds"
  ON payment_holds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_lead_officer = true OR is_troll_officer = true OR role = 'admin')
    )
  );

CREATE POLICY "Admins and officers can insert payment holds"
  ON payment_holds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_lead_officer = true OR is_troll_officer = true OR role = 'admin')
    )
  );

CREATE POLICY "Admins and officers can update payment holds"
  ON payment_holds
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_lead_officer = true OR is_troll_officer = true OR role = 'admin')
    )
  );

-- Create ban_user RPC function
CREATE OR REPLACE FUNCTION ban_user(
  target uuid,
  minutes integer,
  reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_role text;
  v_is_admin boolean;
  v_is_lead_officer boolean;
  v_is_troll_officer boolean;
  v_troll_role text;
BEGIN
  -- Check permissions
  SELECT role, is_admin, is_lead_officer, is_troll_officer, troll_role
  INTO v_actor_role, v_is_admin, v_is_lead_officer, v_is_troll_officer, v_troll_role
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT (v_is_admin OR v_is_lead_officer OR v_is_troll_officer OR v_actor_role = 'admin' OR v_troll_role IN ('admin', 'lead_troll_officer', 'troll_officer')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update target user
  UPDATE user_profiles
  SET
    is_banned = true,
    banned_until = CASE 
      WHEN minutes > 0 THEN now() + (minutes || ' minutes')::interval 
      ELSE NULL -- Permanent ban
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('ban_reason', reason),
    updated_at = now()
  WHERE id = target;

  -- Add to officer actions log if table exists (optional, but good practice based on codebase)
  BEGIN
    INSERT INTO officer_actions (
      officer_id,
      target_user_id,
      action_type,
      reason
    ) VALUES (
      auth.uid(),
      target,
      'ban_user',
      reason
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if table doesn't exist or other error
    NULL;
  END;

END;
$$;
