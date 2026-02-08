-- Migration: Secure Admin, Profile, and Seat Updates
-- Description: Provides secure RPCs for role/profile updates and fixes join_seat_atomic to bypass coin protection triggers.

-- 1. Secure Role Update (for Admin Dashboard)
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    p_target_user_id UUID,
    p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify caller is an admin
    SELECT role INTO v_admin_role FROM public.user_profiles WHERE id = auth.uid();
    
    IF v_admin_role NOT IN ('admin', 'secretary', 'lead_troll_officer') AND 
       NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    UPDATE public.user_profiles
    SET role = p_new_role, updated_at = NOW()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Secure Profile Cost Update (for Profile Page)
CREATE OR REPLACE FUNCTION public.update_profile_costs(
    p_message_cost INT,
    p_view_cost INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    UPDATE public.user_profiles 
    SET message_cost = p_message_cost, 
        profile_view_cost = p_view_cost,
        updated_at = NOW()
    WHERE id = auth.uid();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Secure Ban Status Update (for Moderation Edge Function)
CREATE OR REPLACE FUNCTION public.admin_update_ban_status(
    p_target_user_id UUID,
    p_is_banned BOOLEAN,
    p_ban_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify caller is an admin/mod
    SELECT role INTO v_admin_role FROM public.user_profiles WHERE id = auth.uid();
    
    -- Add more roles if needed (e.g. troll_officer?)
    IF v_admin_role NOT IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer') AND 
       NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    UPDATE public.user_profiles
    SET is_banned = p_is_banned,
        ban_expires_at = p_ban_expires_at,
        updated_at = NOW()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Secure Officer Promotion (for Training Edge Function)
CREATE OR REPLACE FUNCTION public.system_promote_officer(
    p_target_user_id UUID,
    p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function is intended to be called by Service Role (Edge Functions)
    -- We can check if auth.role() is 'service_role' or just trust the SECURITY DEFINER context 
    -- if we assume it's only exposed to trusted callers.
    -- However, to be safe, we might want to restrict it or rely on the fact that
    -- regular users can't call this unless granted. By default, public might execute it?
    -- No, usually we should revoke public execute if sensitive.
    -- For now, we'll check if the caller is service_role OR admin.
    
    IF auth.role() != 'service_role' AND 
       NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'secretary') OR is_admin = true)) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    UPDATE public.user_profiles
    SET role = p_new_role, updated_at = NOW()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Fix Join Seat Atomic (Bypass Coin Protection)
DROP FUNCTION IF EXISTS join_seat_atomic(uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.join_seat_atomic(p_stream_id UUID, p_seat_index INTEGER, p_price INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_locked BOOLEAN;
    v_seat_price INTEGER;
    v_exists BOOLEAN;
    v_stream_owner_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if stream exists and get settings
    SELECT are_seats_locked, seat_price, user_id INTO v_is_locked, v_seat_price, v_stream_owner_id
    FROM public.streams WHERE id = p_stream_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Stream not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_is_locked THEN
        RETURN QUERY SELECT false, 'Seats are currently locked'::TEXT;
        RETURN;
    END IF;

    -- Check if seat is occupied
    SELECT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) INTO v_exists;
    
    IF v_exists THEN
        RETURN QUERY SELECT false, 'Seat is already occupied'::TEXT;
        RETURN;
    END IF;

    -- Check if user is already in a seat
    SELECT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND user_id = v_user_id 
        AND status = 'active'
    ) INTO v_exists;
    
    IF v_exists THEN
        RETURN QUERY SELECT false, 'You are already in a seat'::TEXT;
        RETURN;
    END IF;

    -- Handle Payment if needed
    IF v_seat_price > 0 THEN
        IF (SELECT troll_coins FROM public.user_profiles WHERE id = v_user_id) < v_seat_price THEN
            RETURN QUERY SELECT false, 'Insufficient coins'::TEXT;
            RETURN;
        END IF;
        
        -- Set bypass flag for coin updates
        PERFORM set_config('app.bypass_coin_protection', 'true', true);
        
        -- Deduct coins
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_seat_price 
        WHERE id = v_user_id;
        
        -- Pay Host
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_seat_price
        WHERE id = v_stream_owner_id;
    END IF;

    -- Insert Session
    INSERT INTO public.stream_seat_sessions (stream_id, user_id, seat_index, status, price_paid)
    VALUES (p_stream_id, v_user_id, p_seat_index, 'active', v_seat_price);

    RETURN QUERY SELECT true, 'Joined seat successfully'::TEXT;
END;
$$;
