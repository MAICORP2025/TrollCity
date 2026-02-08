-- Walkie Talkie Permissions RPC
-- This function verifies if a user is allowed to access the Walkie system.

CREATE OR REPLACE FUNCTION public.check_walkie_access(
    p_channel_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_role TEXT;
    v_is_admin BOOLEAN;
    v_is_officer BOOLEAN;
    v_is_secretary BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Not authenticated');
    END IF;

    SELECT 
        role, 
        is_admin,
        (role = 'officer' OR role = 'lead_troll_officer' OR is_lead_officer = true),
        (role = 'secretary')
    INTO v_role, v_is_admin, v_is_officer, v_is_secretary
    FROM public.user_profiles
    WHERE id = v_user_id;

    -- Staff check: Admin, Officer, Secretary
    IF v_is_admin OR v_is_officer OR v_is_secretary OR v_role = 'admin' THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    RETURN jsonb_build_object('allowed', false, 'reason', 'Not authorized (Staff only)');
END;
$$;
