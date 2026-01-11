-- Create RPC function to toggle pinned status
CREATE OR REPLACE FUNCTION toggle_wall_post_pin(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_current_pin_status BOOLEAN;
  v_new_pin_status BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT is_admin INTO v_is_admin
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Only admins can pin posts';
  END IF;

  -- Get current pin status
  SELECT is_pinned INTO v_current_pin_status
  FROM troll_wall_posts
  WHERE id = p_post_id;

  -- Toggle status
  v_new_pin_status := NOT COALESCE(v_current_pin_status, false);

  -- Update post
  UPDATE troll_wall_posts
  SET is_pinned = v_new_pin_status
  WHERE id = p_post_id;

  RETURN v_new_pin_status;
END;
$$;
