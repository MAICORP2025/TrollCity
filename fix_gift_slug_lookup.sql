-- ============================================================================
-- FIX: Gift lookup in send_gift_in_stream was failing because:
--   1. The RPC was looking up from the `gifts` table (a transaction/ledger table)
--      instead of `gift_items` (the actual gift catalog)
--   2. The frontend queries `gift_items` and passes gift.id (UUID) to the RPC
--   3. The `gifts` ledger table has different columns than `gift_items`
--
-- Solution: Update the RPC to look up from `gift_items` table instead of `gifts`.
--           Match by id (UUID), gift_slug, or name.
--           Use COALESCE(coin_cost, value) as the cost (from gift_items).
-- ============================================================================

-- No schema changes needed — gift_items already has: id, name, value, gift_slug, coin_cost

-- 1. Update the 6-parameter send_gift_in_stream function to fix the gift lookup
CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT,
  p_quantity INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_cost BIGINT;
  v_total_cost BIGINT;
  v_gift_name TEXT;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
  v_gift_record_id BIGINT;
  v_gift_record_uuid UUID;
  v_xp_result JSONB;
  v_id_type TEXT;
BEGIN
  -- 1. Get gift cost and name from gift_items (the catalog table)
  --    Match by: UUID id, gift_slug, or name (case-insensitive)
  SELECT COALESCE(coin_cost, value), name INTO v_gift_cost, v_gift_name
  FROM public.gift_items
  WHERE id = p_gift_id::uuid
     OR gift_slug = p_gift_id
     OR LOWER(name) = LOWER(p_gift_id)
  LIMIT 1;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- 2. Check sender's balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  IF v_sender_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct cost from sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_total_cost
  WHERE id = p_sender_id;

  -- 4. Credit receiver (100% of gift value)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_total_cost
  WHERE id = p_receiver_id;

  -- 4b. Update stream's total_gifts_coins if stream_id provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- 5. Record gift in stream_gifts and capture the ID
  SELECT data_type INTO v_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'stream_gifts' AND column_name = 'id';
  
  IF v_id_type = 'bigint' THEN
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_id;
    
    BEGIN
        PERFORM public.grant_xp(
            p_sender_id,
            FLOOR(v_total_cost * 1.1),
            'gift_sent',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'is_live', true)
        );
        
        PERFORM public.grant_xp(
            p_receiver_id,
            FLOOR(v_total_cost * 1.0),
            'gift_received',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  ELSE
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_uuid;

    BEGIN
        v_xp_result := public.process_gift_xp(v_gift_record_uuid, p_stream_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  END IF;

  -- 6. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 7. Battle Scoring Logic
  SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
  FROM public.battles
  WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
    AND status = 'active'
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    IF v_is_challenger THEN
      UPDATE public.battles
      SET score_challenger = COALESCE(score_challenger, 0) + v_total_cost,
          pot_challenger = COALESCE(pot_challenger, 0) + v_total_cost
      WHERE id = v_battle_id;
    ELSE
      UPDATE public.battles
      SET score_opponent = COALESCE(score_opponent, 0) + v_total_cost,
          pot_opponent = COALESCE(pot_opponent, 0) + v_total_cost
      WHERE id = v_battle_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully', 'xp_awarded', true);
END;
$$;

-- 2. Update the 7-parameter version (with txn_key) with the same fix
CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id UUID,
  p_quantity INTEGER,
  p_txn_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_cost BIGINT;
  v_total_cost BIGINT;
  v_gift_name TEXT;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
  v_gift_record_id BIGINT;
  v_gift_record_uuid UUID;
  v_xp_result JSONB;
  v_id_type TEXT;
  v_gift_id_text TEXT;
BEGIN
  -- Convert UUID param to text for flexible matching
  v_gift_id_text := p_gift_id::text;

  -- 1. Get gift cost and name from gift_items (the catalog table)
  --    Match by: UUID id, gift_slug, or name (case-insensitive)
  SELECT COALESCE(coin_cost, value), name INTO v_gift_cost, v_gift_name
  FROM public.gift_items
  WHERE id = p_gift_id
     OR gift_slug = v_gift_id_text
     OR LOWER(name) = LOWER(v_gift_id_text)
  LIMIT 1;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- 2. Check sender's balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  IF v_sender_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct cost from sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_total_cost
  WHERE id = p_sender_id;

  -- 4. Credit receiver (100% of gift value)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_total_cost
  WHERE id = p_receiver_id;

  -- 4b. Update stream's total_gifts_coins if stream_id provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- 5. Record gift in stream_gifts and award XP
  SELECT data_type INTO v_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'stream_gifts' AND column_name = 'id';
  
  IF v_id_type = 'bigint' THEN
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, v_gift_id_text, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_id;
    
    BEGIN
        PERFORM public.grant_xp(
            p_sender_id,
            FLOOR(v_total_cost * 1.1),
            'gift_sent',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'is_live', true)
        );
        
        PERFORM public.grant_xp(
            p_receiver_id,
            FLOOR(v_total_cost * 1.0),
            'gift_received',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  ELSE
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, v_gift_id_text, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_uuid;

    BEGIN
        v_xp_result := public.process_gift_xp(v_gift_record_uuid, p_stream_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  END IF;

  -- 6. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 7. Battle Scoring Logic
  SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
  FROM public.battles
  WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
    AND status = 'active'
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    IF v_is_challenger THEN
      UPDATE public.battles
      SET score_challenger = COALESCE(score_challenger, 0) + v_total_cost,
          pot_challenger = COALESCE(pot_challenger, 0) + v_total_cost
      WHERE id = v_battle_id;
    ELSE
      UPDATE public.battles
      SET score_opponent = COALESCE(score_opponent, 0) + v_total_cost,
          pot_opponent = COALESCE(pot_opponent, 0) + v_total_cost
      WHERE id = v_battle_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully', 'xp_awarded', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO service_role;
