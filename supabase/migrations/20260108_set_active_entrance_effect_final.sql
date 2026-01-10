CREATE OR REPLACE FUNCTION set_active_entrance_effect(p_effect_id TEXT, p_item_type TEXT DEFAULT 'effect')
RETURNS VOID AS $$
BEGIN
  -- 1. Deactivate all entrance effects (both purchased and role-based)
  DELETE FROM user_active_items
  WHERE user_id = auth.uid() 
  AND item_type IN ('effect', 'role_effect');

  -- Deactivate legacy entrance effects table if present
  UPDATE user_entrance_effects
  SET is_active = false
  WHERE user_id = auth.uid();

  -- Clear user_profiles active field
  UPDATE user_profiles
  SET active_entrance_effect = NULL
  WHERE id = auth.uid();

  -- 2. Activate the new effect if provided
  IF p_effect_id IS NOT NULL THEN
    -- Only insert into user_active_items for items that are UUID-based (non-role effects)
    IF p_item_type <> 'role_effect' THEN
      INSERT INTO user_active_items (user_id, item_id, item_type)
      VALUES (auth.uid(), p_effect_id::uuid, p_item_type)
      ON CONFLICT (user_id, item_id) DO NOTHING;

      UPDATE user_entrance_effects
      SET is_active = true
      WHERE user_id = auth.uid() AND effect_id = p_effect_id;
    END IF;

    -- Always update user_profiles with the provided effect identifier (text)
    UPDATE user_profiles
    SET active_entrance_effect = p_effect_id
    WHERE id = auth.uid();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
