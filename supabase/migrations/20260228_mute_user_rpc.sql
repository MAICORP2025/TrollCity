-- Add muted_until column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'muted_until') THEN
        ALTER TABLE user_profiles ADD COLUMN muted_until TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create mute_user RPC
CREATE OR REPLACE FUNCTION mute_user(
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
  -- If minutes is 0, we treat it as unmute.
  -- If minutes is -1, we treat it as permanent.
  
  IF minutes = 0 THEN
    UPDATE user_profiles SET muted_until = NULL WHERE id = target;
  ELSE
    UPDATE user_profiles
    SET
      muted_until = CASE 
        WHEN minutes < 0 THEN '9999-12-31 23:59:59+00'::timestamptz -- Permanent
        ELSE now() + (minutes || ' minutes')::interval 
      END,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('mute_reason', reason),
      updated_at = now()
    WHERE id = target;
  END IF;

  -- Add to officer actions log
  BEGIN
    INSERT INTO officer_actions (
      officer_id,
      target_user_id,
      action_type,
      reason
    ) VALUES (
      auth.uid(),
      target,
      'mute',
      reason
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

END;
$$;
