-- RPC: toggle_entrance_effect
-- Toggle activation of a user's entrance effect by user_entrance_effects UUID
-- Ensures single active effect per user and syncs user_profiles.active_entrance_effect
CREATE OR REPLACE FUNCTION toggle_entrance_effect(
  p_user_id uuid,
  p_item_id uuid,
  p_active boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effect_id text;
  v_auth_user uuid;
BEGIN
  -- Validate caller is the same as p_user_id
  v_auth_user := auth.uid();
  IF v_auth_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_auth_user <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  -- Verify the inventory record exists and get effect_id (TEXT)
  SELECT effect_id INTO v_effect_id
  FROM user_entrance_effects
  WHERE id = p_item_id
    AND user_id = p_user_id;

  IF v_effect_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owned');
  END IF;

  -- Enforce single-active: deactivate all first
  UPDATE user_entrance_effects
  SET is_active = false
  WHERE user_id = p_user_id;

  -- Activate or deactivate the requested effect
  UPDATE user_entrance_effects
  SET is_active = p_active
  WHERE id = p_item_id
    AND user_id = p_user_id;

  -- Sync the user's active_entrance_effect column
  IF p_active THEN
    UPDATE user_profiles
    SET active_entrance_effect = v_effect_id
    WHERE id = p_user_id;
  ELSE
    UPDATE user_profiles
    SET active_entrance_effect = NULL
    WHERE id = p_user_id AND active_entrance_effect = v_effect_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'effect_id', v_effect_id, 'active', p_active);
END;
$$;

