-- Secure broadcast and vehicle related functions
-- Adds bypass_coin_protection flag to allow coin deductions despite the trigger

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

-- 2. Secure join_stream_box (Legacy)
CREATE OR REPLACE FUNCTION public.join_stream_box(
  p_stream_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_balance INT;
  v_box_price INT;
  v_price_type TEXT;
BEGIN
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Get stream details
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Stream not found'); END IF;

  v_box_price := COALESCE(v_stream.box_price_amount, 0);
  v_price_type := COALESCE(v_stream.box_price_type, 'per_minute');

  -- Check user balance
  SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
  
  IF v_user_balance < v_box_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins to join box');
  END IF;

  -- If flat fee, charge immediately
  IF v_box_price > 0 AND v_price_type = 'flat' THEN
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_box_price
    WHERE id = p_user_id;
    
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, metadata)
    VALUES (p_user_id, -v_box_price, 'spend', 'stream_box_fee', json_build_object('stream_id', p_stream_id));
  END IF;

  RETURN json_build_object('success', true);
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
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Get stream info
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  
  IF v_stream IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Stream not found'::TEXT;
    RETURN;
  END IF;

  v_user_id := auth.uid();
  
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

-- 4. Secure pay_vehicle_insurance
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
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    v_user_id := auth.uid();

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

-- 5. Secure kick_user_paid
CREATE OR REPLACE FUNCTION kick_user_paid(p_stream_id TEXT, p_target_user_id UUID, p_kicker_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER := 100;
    v_balance INTEGER;
BEGIN
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- Check balance
    SELECT troll_coins INTO v_balance FROM user_profiles WHERE id = p_kicker_id;
    
    IF v_balance IS NULL OR v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds (100 coins required)');
    END IF;

    -- Deduct coins
    UPDATE user_profiles SET troll_coins = troll_coins - v_cost WHERE id = p_kicker_id;

    -- Add to kick/ban list
    INSERT INTO stream_bans (stream_id, user_id, banned_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, p_kicker_id, 'Paid Kick', NOW() + INTERVAL '24 hours')
    ON CONFLICT (stream_id, user_id) 
    DO UPDATE SET expires_at = NOW() + INTERVAL '24 hours', banned_by = p_kicker_id;

    -- Remove from viewers
    DELETE FROM stream_viewers WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Secure pay_kick_fee
CREATE OR REPLACE FUNCTION pay_kick_fee(p_stream_id TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER := 100;
    v_balance INTEGER;
BEGIN
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- Check balance
    SELECT troll_coins INTO v_balance FROM user_profiles WHERE id = p_user_id;
    
    IF v_balance IS NULL OR v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds to pay kick fee');
    END IF;

    -- Deduct coins
    UPDATE user_profiles SET troll_coins = troll_coins - v_cost WHERE id = p_user_id;

    -- Remove from bans
    DELETE FROM stream_bans WHERE stream_id = p_stream_id AND user_id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
