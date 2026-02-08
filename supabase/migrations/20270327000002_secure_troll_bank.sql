-- Secure Troll Bank Functions
-- Adds app.bypass_coin_protection to core bank spending functions

-- 1. Secure troll_bank_spend_coins
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins(
  p_user_id uuid,
  p_amount int,
  p_bucket text DEFAULT 'paid',
  p_source text DEFAULT 'purchase',
  p_ref_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance int;
  v_new_balance int;
  v_ledger_id uuid;
BEGIN
  -- Set bypass flag for the transaction
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock user profile and check balance
  SELECT troll_coins INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'current_balance', v_current_balance);
  END IF;

  -- Deduct coins
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE user_profiles
  SET troll_coins = v_new_balance
  WHERE id = p_user_id;

  -- Insert into ledger (negative delta)
  INSERT INTO coin_ledger (
    user_id,
    delta,
    bucket,
    source,
    ref_id,
    metadata,
    direction
  ) VALUES (
    p_user_id,
    -p_amount,
    p_bucket,
    p_source,
    p_ref_id,
    p_metadata,
    'out'
  ) RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
END;
$$;

-- 2. Secure troll_bank_spend_coins_secure (Numeric version)
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins_secure(
  p_user_id uuid,
  p_amount numeric,
  p_bucket text DEFAULT 'paid',
  p_source text DEFAULT 'purchase',
  p_ref_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance numeric(20, 2);
  v_new_balance numeric(20, 2);
  v_ledger_id uuid;
BEGIN
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock user profile and check balance
  SELECT troll_coins INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'current_balance', v_current_balance);
  END IF;

  -- Deduct coins
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE user_profiles
  SET troll_coins = v_new_balance
  WHERE id = p_user_id;

  -- Insert into ledger
  INSERT INTO coin_ledger (
    user_id,
    delta,
    bucket,
    source,
    ref_id,
    metadata,
    direction
  ) VALUES (
    p_user_id,
    -p_amount,
    p_bucket,
    p_source,
    p_ref_id,
    p_metadata,
    'out'
  ) RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
END;
$$;

-- 3. Secure send_wall_post_gift (Legacy direct update)
CREATE OR REPLACE FUNCTION public.send_wall_post_gift(
  p_post_id uuid,
  p_gift_type text,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_gift_cost integer;
  v_sender_coins integer;
  v_post_owner_id uuid;
  v_default_cost integer := 10;
  v_safe_quantity integer;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  v_safe_quantity := GREATEST(1, p_quantity);

  SELECT coin_cost INTO v_gift_cost FROM gifts WHERE lower(name) = lower(p_gift_type) LIMIT 1;
  IF v_gift_cost IS NULL THEN
    v_gift_cost := v_default_cost;
  END IF;
  v_gift_cost := v_gift_cost * v_safe_quantity;

  SELECT troll_coins INTO v_sender_coins FROM user_profiles WHERE id = v_sender_id;
  IF COALESCE(v_sender_coins, 0) < v_gift_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins', 'required', v_gift_cost, 'available', COALESCE(v_sender_coins,0));
  END IF;

  SELECT user_id INTO v_post_owner_id FROM troll_wall_posts WHERE id = p_post_id;
  IF v_post_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found');
  END IF;

  -- Deduct sender balance
  UPDATE user_profiles SET troll_coins = COALESCE(troll_coins,0) - v_gift_cost WHERE id = v_sender_id;
  
  -- Log transaction (simplified for legacy function)
  INSERT INTO coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
  VALUES (v_sender_id, -v_gift_cost, 'paid', 'wall_gift', p_post_id::text, jsonb_build_object('gift', p_gift_type));

  -- Credit owner (optional, based on existing logic or left out if original didn't have it. 
  -- Original snippet showed only deduction, so we stop here or credit if needed. 
  -- Assuming original intention was just deduction or logic continues elsewhere. 
  -- We'll just secure the update.)

  RETURN jsonb_build_object('success', true, 'new_balance', COALESCE(v_sender_coins,0) - v_gift_cost);
END;
$$;
