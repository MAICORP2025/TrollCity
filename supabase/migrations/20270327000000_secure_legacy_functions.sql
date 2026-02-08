-- Secure legacy coin functions
-- Replaces them with versions that set the bypass flag to comply with protect_sensitive_columns trigger

-- 1. Secure spend_coins (Used by useCoins hook for gifts, etc.)
CREATE OR REPLACE FUNCTION public.spend_coins(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_coin_amount numeric,
  p_source text,
  p_item text,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_sender_balance numeric;
  v_new_sender_balance numeric;
  v_receiver_balance numeric;
  v_new_receiver_balance numeric;
begin
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Validate amount
  IF p_coin_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- 1. Check sender balance
  SELECT troll_coins INTO v_sender_balance FROM user_profiles WHERE id = p_sender_id FOR UPDATE;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_coin_amount THEN
     RETURN jsonb_build_object('success', false, 'error', 'Not enough coins');
  END IF;

  -- 2. Deduct from sender
  v_new_sender_balance := v_sender_balance - p_coin_amount;
  UPDATE user_profiles SET troll_coins = v_new_sender_balance WHERE id = p_sender_id;
  
  -- Log deduction
  INSERT INTO coin_ledger (user_id, delta, bucket, source, metadata)
  VALUES (p_sender_id, -p_coin_amount, 'spend', p_source, jsonb_build_object('item', p_item, 'receiver_id', p_receiver_id));

  -- 3. If receiver != sender, credit receiver
  IF p_receiver_id IS NOT NULL AND p_receiver_id != p_sender_id THEN
      SELECT troll_coins INTO v_receiver_balance FROM user_profiles WHERE id = p_receiver_id FOR UPDATE;
      
      -- Only credit if user exists
      IF v_receiver_balance IS NOT NULL THEN
          v_new_receiver_balance := v_receiver_balance + p_coin_amount;
          UPDATE user_profiles SET troll_coins = v_new_receiver_balance WHERE id = p_receiver_id;
          
          -- Log credit
          INSERT INTO coin_ledger (user_id, delta, bucket, source, metadata)
          VALUES (p_receiver_id, p_coin_amount, 'income', p_source, jsonb_build_object('item', p_item, 'sender_id', p_sender_id));
      END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_sender_balance);
END;
$$;

-- 2. Secure add_troll_coins (Used by various legacy logic)
CREATE OR REPLACE FUNCTION public.add_troll_coins(
  p_user_id uuid,
  p_amount numeric
) returns void
language plpgsql
security definer
as $$
declare
begin
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  UPDATE user_profiles 
  SET troll_coins = COALESCE(troll_coins, 0) + p_amount 
  WHERE id = p_user_id;
  
  -- Log
  INSERT INTO coin_ledger (user_id, delta, bucket, source, metadata)
  VALUES (p_user_id, p_amount, 'income', 'add_troll_coins', '{}'::jsonb);
END;
$$;

-- 3. Secure rpc_deduct_troll_coins (Used by VerificationPage fallback etc)
CREATE OR REPLACE FUNCTION public.rpc_deduct_troll_coins(
  p_user_id uuid,
  p_amount numeric
) returns void
language plpgsql
security definer
as $$
declare
  v_balance numeric;
begin
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  SELECT troll_coins INTO v_balance FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  
  IF v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient troll_coins';
  END IF;

  UPDATE user_profiles 
  SET troll_coins = v_balance - p_amount 
  WHERE id = p_user_id;
  
  INSERT INTO coin_ledger (user_id, delta, bucket, source, metadata)
  VALUES (p_user_id, -p_amount, 'spend', 'rpc_deduct', '{}'::jsonb);
END;
$$;
