-- RPC for toggling lead officer status with proper permissions
CREATE OR REPLACE FUNCTION set_lead_officer_status(
  p_user_id UUID,
  p_make_lead BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor user_profiles;
  v_target user_profiles;
  v_action TEXT;
BEGIN
  SELECT *
  INTO v_actor
  FROM user_profiles
  WHERE id = auth.uid()
    AND (
      role = 'admin'
      OR is_admin = TRUE
      OR is_lead_officer = TRUE
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins and lead officers can change lead status');
  END IF;

  SELECT *
  INTO v_target
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Target user not found');
  END IF;

  IF NOT (
    v_target.is_troll_officer = TRUE
    OR v_target.role = 'troll_officer'
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only Troll Officers can become Lead Officers');
  END IF;

  IF p_make_lead THEN
    UPDATE user_profiles
    SET is_lead_officer = TRUE,
        updated_at = NOW()
    WHERE id = p_user_id;
    v_action := 'promoted';
  ELSE
    UPDATE user_profiles
    SET is_lead_officer = FALSE,
        updated_at = NOW()
    WHERE id = p_user_id;
    v_action := 'revoked';
  END IF;

  BEGIN
    INSERT INTO officer_actions (
      officer_id,
      target_user_id,
      action_type,
      reason
    ) VALUES (
      auth.uid(),
      p_user_id,
      CASE WHEN p_make_lead THEN 'promote_to_lead' ELSE 'revoke_lead' END,
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- optional logging table
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', format('Lead officer status %s successfully', v_action),
    'target_user_id', p_user_id,
    'promoted', p_make_lead
  );
END;
$$;

GRANT EXECUTE ON FUNCTION set_lead_officer_status(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION set_lead_officer_status(UUID, BOOLEAN) IS 'Allows admins and lead officers to promote/revoke Troll Officers to/from Lead Officer.';
