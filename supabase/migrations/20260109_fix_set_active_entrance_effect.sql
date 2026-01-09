-- Replace set_active_entrance_effect to avoid inserting TEXT into UUID columns
-- Uses user_entrance_effects (TEXT effect_id) and user_profiles.active_entrance_effect
CREATE OR REPLACE FUNCTION set_active_entrance_effect(
    p_effect_id TEXT DEFAULT NULL,
    p_item_type TEXT DEFAULT 'effect'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_has_effect BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Deactivate all current entrance/role effects tracked in user_entrance_effects
    UPDATE user_entrance_effects
    SET is_active = false
    WHERE user_id = v_user_id;

    IF p_effect_id IS NULL THEN
        -- Clear active effect
        UPDATE user_profiles
        SET active_entrance_effect = NULL
        WHERE id = v_user_id;

        RETURN jsonb_build_object('success', true, 'active', NULL);
    END IF;

    -- Verify catalog effect exists (optional)
    PERFORM 1 FROM entrance_effects WHERE id = p_effect_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'effect_not_found');
    END IF;

    -- Mark the user's purchased effect active if owned
    SELECT EXISTS(
        SELECT 1 FROM user_entrance_effects
        WHERE user_id = v_user_id AND effect_id = p_effect_id
    ) INTO v_has_effect;

    IF v_has_effect THEN
        UPDATE user_entrance_effects
        SET is_active = true
        WHERE user_id = v_user_id AND effect_id = p_effect_id;
    END IF;

    -- Set active effect on profile (text id)
    UPDATE user_profiles
    SET active_entrance_effect = p_effect_id
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'active', p_effect_id, 'type', p_item_type);
END;
$$;

