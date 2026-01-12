-- Ensure add_xp can update user_levels (via triggers, RPCs, and streams)
-- even when the session user is not the target row owner.
-- We save the current row_security setting, temporarily turn it off,
-- and restore it before exiting so we don't break transactional expectations.

CREATE OR REPLACE FUNCTION add_xp(p_user_id uuid, p_amount bigint, p_reason text default null)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  lvl integer;
  xp bigint;
  total bigint;
  next bigint;
  v_result jsonb;
  v_saved_row_security text := current_setting('row_security', true);
BEGIN
  PERFORM set_config('row_security', 'off', true);
  BEGIN
    INSERT INTO user_levels(user_id, level, xp, total_xp, next_level_xp)
      VALUES (p_user_id, 1, 0, 0, 100)
    ON CONFLICT(user_id) DO NOTHING;

    SELECT level, xp, total_xp, next_level_xp INTO lvl, xp, total, next
    FROM user_levels
    WHERE user_id = p_user_id;

    xp := xp + p_amount;
    total := total + p_amount;
    WHILE xp >= next LOOP
      xp := xp - next;
      lvl := lvl + 1;
      next := next + 100;
    END LOOP;

    UPDATE user_levels
    SET level = lvl,
        xp = xp,
        total_xp = total,
        next_level_xp = next,
        updated_at = now()
    WHERE user_id = p_user_id;

    IF p_reason IS NOT NULL THEN
      INSERT INTO identity_reward_logs(user_id, type, amount, data)
      VALUES (p_user_id, p_reason, p_amount, '{}');
    END IF;

    v_result := jsonb_build_object(
      'success', true,
      'level', lvl,
      'xp', xp,
      'total', total,
      'next', next
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('row_security', COALESCE(v_saved_row_security, 'on'), true);
      RAISE;
  END;

  PERFORM set_config('row_security', COALESCE(v_saved_row_security, 'on'), true);
  RETURN v_result;
END;
$$;
