
CREATE OR REPLACE FUNCTION spend_coins(
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance BIGINT;
  v_new_balance BIGINT;
  v_bonus_message TEXT := NULL;
  v_lucky_bonus BIGINT := 0;
  v_is_lucky BOOLEAN := false;
  v_multiplier NUMERIC;
BEGIN
  -- Check current balance
  SELECT troll_coins INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance - p_amount;

  -- Lucky Gift Logic (only for gifts)
  IF p_reason = 'gift_sent' AND p_amount > 0 THEN
    -- 5% chance to trigger lucky gift
    IF random() < 0.05 THEN
      v_is_lucky := true;
      
      -- Determine multiplier tiers
      -- 90% chance: 0.1x - 1x (10-100% back)
      -- 9% chance: 2x - 10x
      -- 1% chance: 10x - 1000x (Jackpot)
      
      DECLARE
        v_tier_roll FLOAT;
      BEGIN
        v_tier_roll := random();
        
        IF v_tier_roll < 0.90 THEN
           v_multiplier := 0.1 + (random() * 0.9); -- 0.1 to 1.0
        ELSIF v_tier_roll < 0.99 THEN
           v_multiplier := 2.0 + (random() * 8.0); -- 2.0 to 10.0
        ELSE
           v_multiplier := 10.0 + (random() * 990.0); -- 10.0 to 1000.0
        END IF;
      END;

      v_lucky_bonus := floor(p_amount * v_multiplier);
      
      -- Add bonus to new balance (net effect: spend less, or even gain)
      v_new_balance := v_new_balance + v_lucky_bonus;
      v_bonus_message := format('LUCKY GIFT! You won %s coins back! (%.1fx multiplier)', v_lucky_bonus, v_multiplier);
    END IF;
  END IF;

  -- Update user balance
  UPDATE user_profiles
  SET troll_coins = v_new_balance
  WHERE id = p_user_id;

  -- Record the transaction (Spend)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    type,
    description,
    metadata
  ) VALUES (
    p_user_id,
    -p_amount, -- Negative for spending
    CASE WHEN p_reason = 'gift_sent' THEN 'gift' ELSE 'spend' END,
    p_reason,
    p_metadata
  );

  -- Record Lucky Bonus if applicable
  IF v_is_lucky THEN
    INSERT INTO coin_transactions (
      user_id,
      amount,
      type,
      description,
      metadata
    ) VALUES (
      p_user_id,
      v_lucky_bonus,
      'lucky_bonus',
      'Lucky Gift Bonus',
      jsonb_build_object('original_gift', p_amount, 'multiplier', v_multiplier)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'lucky_bonus', v_lucky_bonus,
    'message', v_bonus_message
  );
END;
$$;
