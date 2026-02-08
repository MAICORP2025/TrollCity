-- Fix NULL user_id issues in transaction functions
-- Adds strict authentication checks to prevent execution by unauthenticated users
-- Fixes "null value in column user_id of relation coin_transactions" error

-- 1. Secure join_seat_atomic
DROP FUNCTION IF EXISTS join_seat_atomic(uuid, integer, integer);
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
    v_user_balance INTEGER;
    v_active_session_id UUID;
    v_already_paid BOOLEAN := FALSE;
    v_stream_owner UUID;
    v_new_session_id UUID;
BEGIN
    -- Strict Auth Check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 1. Validate Stream & Owner
    SELECT user_id INTO v_stream_owner FROM public.streams WHERE id = p_stream_id;
    IF v_stream_owner IS NULL THEN
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
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions
        WHERE stream_id = p_stream_id
        AND user_id = v_user_id
        AND seat_index = p_seat_index
        AND price_paid >= p_price
    ) THEN
        v_already_paid := TRUE;
    END IF;

    -- 4. Process Payment
    IF p_price > 0 AND NOT v_already_paid THEN
        -- Lock & Check Balance
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
        
        IF v_user_balance IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
        END IF;

        IF v_user_balance < p_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
        END IF;

        -- Deduct from User
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - p_price 
        WHERE id = v_user_id;

        -- Credit to Host (90%)
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + FLOOR(p_price * 0.9)
        WHERE id = v_stream_owner;
        
        -- Log Transaction
        INSERT INTO public.coin_transactions (user_id, amount, type, description)
        VALUES (v_user_id, -p_price, 'purchase', 'Seat ' || p_seat_index || ' in stream ' || p_stream_id);
    END IF;

    -- 5. Create Session
    INSERT INTO public.stream_seat_sessions (
        stream_id, user_id, seat_index, price_paid, status, joined_at
    ) VALUES (
        p_stream_id, v_user_id, p_seat_index, CASE WHEN v_already_paid THEN 0 ELSE p_price END, 'active', now()
    ) RETURNING id INTO v_new_session_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_new_session_id);
END;
$$;

-- 2. Secure pay_vehicle_insurance
CREATE OR REPLACE FUNCTION pay_vehicle_insurance(
    p_user_vehicle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_policy RECORD;
    v_fee INTEGER;
    v_user_balance BIGINT;
BEGIN
    v_user_id := auth.uid();
    
    -- Strict Auth Check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    SELECT * INTO v_policy FROM public.vehicle_insurance_policies WHERE user_vehicle_id = p_user_vehicle_id;
    IF v_policy IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Policy not found');
    END IF;

    -- Verify ownership
    PERFORM 1 FROM public.user_vehicles WHERE id = p_user_vehicle_id AND user_id = v_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not owned by you');
    END IF;

    SELECT amount INTO v_fee FROM public.tmv_fee_schedule WHERE fee_type = 'insurance_premium';
    v_fee := COALESCE(v_fee, 2000);

    -- Check balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
    
    IF v_user_balance IS NULL THEN
         RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    IF v_user_balance < v_fee THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_fee WHERE id = v_user_id;

    -- Update Policy
    UPDATE public.vehicle_insurance_policies
    SET status = 'active',
    expires_at = NOW() + INTERVAL '30 days'
    WHERE id = v_policy.id;

    -- Log
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (v_user_id, p_user_vehicle_id, 'insurance_payment', v_fee, jsonb_build_object('period', '30 days'));

    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (v_user_id, -v_fee, 'purchase', 'Paid Vehicle Insurance');

    RETURN jsonb_build_object('success', true, 'message', 'Insurance paid');
END;
$$;

-- 3. Secure purchase_rgb_broadcast
CREATE OR REPLACE FUNCTION purchase_rgb_broadcast(p_stream_id UUID, p_enable BOOLEAN)
RETURNS TABLE (success BOOLEAN, message TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream record;
  v_user_id uuid;
  v_balance bigint;
  v_cost bigint := 10;
BEGIN
  v_user_id := auth.uid();
  
  -- Strict Auth Check
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Get stream info
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  
  IF v_stream IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Stream not found'::TEXT;
    RETURN;
  END IF;

  -- Check ownership (or admin)
  IF v_stream.user_id != v_user_id AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id AND (role = 'admin' OR is_admin = true)) THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Not authorized'::TEXT;
    RETURN;
  END IF;

  -- If enabling
  IF p_enable THEN
    -- Check if already purchased
    IF v_stream.rgb_purchased THEN
      -- Just enable
      UPDATE public.streams SET has_rgb_effect = true WHERE id = p_stream_id;
      RETURN QUERY SELECT true, 'Enabled', NULL::TEXT;
    ELSE
      -- Need to purchase
      -- Check balance
      SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
      
      IF v_balance IS NULL THEN
         RETURN QUERY SELECT false, NULL::TEXT, 'User profile not found'::TEXT;
         RETURN;
      END IF;

      IF v_balance < v_cost THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Insufficient coins (Cost: 10)'::TEXT;
        RETURN;
      END IF;
      
      -- Deduct coins
      UPDATE public.user_profiles 
      SET troll_coins = troll_coins - v_cost 
      WHERE id = v_user_id;
      
      -- Update stream
      UPDATE public.streams 
      SET rgb_purchased = true, has_rgb_effect = true 
      WHERE id = p_stream_id;
      
      RETURN QUERY SELECT true, 'Purchased & Enabled', NULL::TEXT;
    END IF;
  ELSE
    -- Disable
    UPDATE public.streams SET has_rgb_effect = false WHERE id = p_stream_id;
    RETURN QUERY SELECT true, 'Disabled', NULL::TEXT;
  END IF;
END;
$$;

-- 4. Secure shop_buy_perk
CREATE OR REPLACE FUNCTION shop_buy_perk(
    p_user_id UUID,
    p_perk_id TEXT,
    p_cost BIGINT,
    p_duration_minutes INT,
    p_metadata JSONB DEFAULT '{}'::jsonB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_balance BIGINT;
    v_expires_at TIMESTAMPTZ;
    v_perk_name TEXT;
BEGIN
    -- Strict ID Check
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required';
    END IF;

    -- 1. Check Balance
    SELECT troll_coins INTO v_user_balance
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_user_balance IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    IF v_user_balance < p_cost THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- 2. Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 3. Deduct Coins
    UPDATE user_profiles
    SET troll_coins = troll_coins - p_cost
    WHERE id = p_user_id;

    -- 4. Calculate Expiry
    v_expires_at := NOW() + (p_metadata->>'duration_minutes')::INT * INTERVAL '1 minute';
    -- Fallback if not in metadata
    IF v_expires_at IS NULL THEN
        v_expires_at := NOW() + p_duration_minutes * INTERVAL '1 minute';
    END IF;

    v_perk_name := p_metadata->>'perk_name';
    IF v_perk_name IS NULL THEN
         SELECT name INTO v_perk_name FROM perks WHERE id = p_perk_id;
    END IF;

    -- 5. Insert into user_perks
    INSERT INTO user_perks (user_id, perk_id, expires_at, is_active, metadata)
    VALUES (
        p_user_id, 
        p_perk_id, 
        v_expires_at, 
        true, 
        p_metadata || jsonb_build_object('final_cost', p_cost, 'purchased_at', NOW())
    );

    -- 6. Log Transaction
    INSERT INTO coin_transactions (user_id, amount, type, description, metadata)
    VALUES (
        p_user_id, 
        -p_cost, 
        'perk_purchase', 
        'Purchased perk: ' || COALESCE(v_perk_name, p_perk_id), 
        p_metadata || jsonb_build_object('perk_id', p_perk_id)
    );

    -- 7. Handle Special Perks (Side Effects)
    IF p_perk_id = 'perk_rgb_username' THEN
        UPDATE user_profiles
        SET rgb_username_expires_at = v_expires_at
        WHERE id = p_user_id;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'new_balance', v_user_balance - p_cost, 'expires_at', v_expires_at);
END;
$$;
