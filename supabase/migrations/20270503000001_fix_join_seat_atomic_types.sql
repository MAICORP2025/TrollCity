-- Migration: Fix join_seat_atomic for Broadcaster/Admin
-- Description: 
-- 1. Updates v_user_balance to BIGINT to avoid overflow for rich users (Admin/Broadcaster).
-- 2. Handles stream owner check more robustly (user_id OR broadcaster_id).
-- 3. Ensures p_price defaults to 0 if NULL.

CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id UUID,
    p_seat_index INTEGER,
    p_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_balance BIGINT; -- Changed from INTEGER to BIGINT
    v_active_session_id UUID;
    v_already_paid BOOLEAN := FALSE;
    v_stream_owner UUID;
    v_new_session_id UUID;
    v_actual_price INTEGER;
BEGIN
    -- Strict Auth Check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Handle NULL price
    v_actual_price := COALESCE(p_price, 0);

    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 1. Validate Stream & Owner
    -- Check both user_id and broadcaster_id
    SELECT COALESCE(user_id, broadcaster_id) INTO v_stream_owner 
    FROM public.streams 
    WHERE id = p_stream_id;
    
    -- If stream doesn't exist or has no owner identified
    IF NOT FOUND OR v_stream_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
    END IF;

    -- 2. Check if seat is occupied
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat already taken');
    END IF;

    -- 3. Check Payment History (Idempotency)
    -- If user previously paid for this seat but isn't active (e.g. rejoined), we might skip payment?
    -- Logic from previous migration 20270327000007
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions
        WHERE stream_id = p_stream_id
        AND user_id = v_user_id
        AND seat_index = p_seat_index
        AND price_paid >= v_actual_price
    ) THEN
        v_already_paid := TRUE;
    END IF;

    -- 4. Process Payment
    IF v_actual_price > 0 AND NOT v_already_paid THEN
        -- Lock & Check Balance
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
        
        IF v_user_balance IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
        END IF;

        IF v_user_balance < v_actual_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
        END IF;

        -- Deduct from User
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_actual_price 
        WHERE id = v_user_id;

        -- Credit to Host (90%)
        -- If host is same as user, this effectively burns 10% and returns 90%
        -- Or we could skip if host == user? 
        -- Standard logic: always charge fee.
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + FLOOR(v_actual_price * 0.9)
        WHERE id = v_stream_owner;
        
        -- Log Transaction
        INSERT INTO public.coin_transactions (user_id, amount, type, description)
        VALUES (v_user_id, -v_actual_price, 'purchase', 'Seat ' || p_seat_index || ' in stream ' || p_stream_id);
    END IF;

    -- 5. Create Session
    INSERT INTO public.stream_seat_sessions (
        stream_id, user_id, seat_index, price_paid, status, joined_at
    ) VALUES (
        p_stream_id, v_user_id, p_seat_index, CASE WHEN v_already_paid THEN 0 ELSE v_actual_price END, 'active', now()
    ) RETURNING id INTO v_new_session_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_new_session_id);
END;
$$;
