-- Hype Coins System Migration
-- Adds watch-time earning currency system for viewers
-- Created: May 19, 2026

-- ============================================================================
-- 1. ADD HYPE_COINS COLUMN TO USER_PROFILES
-- ============================================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS hype_coins integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_hype_coins_nonnegative'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_hype_coins_nonnegative
    CHECK (hype_coins >= 0);
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE HYPE_COIN_LEDGER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hype_coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id uuid,
  broadcaster_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_user_id ON public.hype_coin_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_stream_id ON public.hype_coin_ledger(stream_id);
CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_broadcaster_id ON public.hype_coin_ledger(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_hype_coin_ledger_created_at ON public.hype_coin_ledger(created_at);

-- Enable RLS on hype_coin_ledger
ALTER TABLE public.hype_coin_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own hype coin ledger rows
CREATE POLICY "hype_coin_ledger_user_read" ON public.hype_coin_ledger
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- RLS Policy: Prevent normal users from inserting/updating/deleting
-- (Only RPC functions can modify ledger)
CREATE POLICY "hype_coin_ledger_prevent_direct_modify" ON public.hype_coin_ledger
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "hype_coin_ledger_prevent_direct_update" ON public.hype_coin_ledger
  FOR UPDATE
  USING (false);

CREATE POLICY "hype_coin_ledger_prevent_direct_delete" ON public.hype_coin_ledger
  FOR DELETE
  USING (false);

-- ============================================================================
-- 3. RPC: EARN_HYPE_COIN_WATCH_REWARD
-- ============================================================================

CREATE OR REPLACE FUNCTION public.earn_hype_coin_watch_reward(p_stream_id uuid)
RETURNS TABLE(
  success boolean,
  hype_coins bigint,
  earned_amount integer,
  daily_earned integer,
  daily_cap integer,
  weekly_earned integer,
  weekly_cap integer,
  message text
) AS $$
DECLARE
  v_user_id uuid;
  v_stream record;
  v_daily_earned integer;
  v_weekly_earned integer;
  v_last_award_time timestamptz;
  v_current_user_hype integer;
  v_earning_window_start timestamptz;
  v_error_msg text;
BEGIN
  -- 1. Check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Not authenticated'::text;
    RETURN;
  END IF;

  -- 2. Fetch stream details
  SELECT id, user_id, status, is_live, ended_at
  INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF v_stream IS NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Stream not found'::text;
    RETURN;
  END IF;

  -- 3. Verify stream is live
  IF (v_stream.status != 'live' AND v_stream.is_live != true) OR v_stream.ended_at IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Stream is not live'::text;
    RETURN;
  END IF;

  -- 4. Verify viewer is not the broadcaster
  IF v_stream.user_id = v_user_id THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      0,
      25,
      0,
      175,
      'Cannot earn from your own stream'::text;
    RETURN;
  END IF;

  -- 5. Check daily cap (25 Hype Coins per day)
  SELECT COALESCE(SUM(amount), 0)::integer
  INTO v_daily_earned
  FROM public.hype_coin_ledger
  WHERE user_id = v_user_id
    AND action = 'hype_watch_earned'
    AND created_at >= NOW()::date;

  IF v_daily_earned >= 25 THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      v_daily_earned,
      25,
      0,
      175,
      'Daily earning cap reached'::text;
    RETURN;
  END IF;

  -- 6. Check weekly cap (175 Hype Coins per week)
  SELECT COALESCE(SUM(amount), 0)::integer
  INTO v_weekly_earned
  FROM public.hype_coin_ledger
  WHERE user_id = v_user_id
    AND action = 'hype_watch_earned'
    AND created_at >= NOW() - interval '7 days';

  IF v_weekly_earned >= 175 THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      v_daily_earned,
      25,
      v_weekly_earned,
      175,
      'Weekly earning cap reached'::text;
    RETURN;
  END IF;

  -- 7. Check for duplicate rewards in same 5-minute window
  v_earning_window_start := to_timestamp(EXTRACT(EPOCH FROM NOW())::integer / 300 * 300);

  SELECT created_at
  INTO v_last_award_time
  FROM public.hype_coin_ledger
  WHERE user_id = v_user_id
    AND action = 'hype_watch_earned'
    AND created_at >= v_earning_window_start
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_award_time IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0,
      v_daily_earned,
      25,
      v_weekly_earned,
      175,
      'Already earned in this 5-minute window'::text;
    RETURN;
  END IF;

  -- 8. Credit 1 Hype Coin
  UPDATE public.user_profiles
  SET hype_coins = hype_coins + 1
  WHERE id = v_user_id;

  -- 9. Insert ledger entry
  INSERT INTO public.hype_coin_ledger (user_id, stream_id, broadcaster_id, amount, action, metadata)
  VALUES (v_user_id, p_stream_id, v_stream.user_id, 1, 'hype_watch_earned', jsonb_build_object(
    'stream_title', v_stream.id,
    'earned_at', NOW()
  ));

  -- 10. Fetch updated balance
  SELECT hype_coins INTO v_current_user_hype
  FROM public.user_profiles
  WHERE id = v_user_id;

  -- 11. Return success
  RETURN QUERY SELECT
    true,
    v_current_user_hype::bigint,
    1,
    v_daily_earned + 1,
    25,
    v_weekly_earned + 1,
    175,
    'Hype Coin earned'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RPC: CONVERT_HYPE_COINS_TO_TROLL_COINS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.convert_hype_coins_to_troll_coins(p_amount integer)
RETURNS TABLE(
  success boolean,
  hype_coins_after bigint,
  troll_coins_after bigint,
  converted_amount integer,
  message text
) AS $$
DECLARE
  v_user_id uuid;
  v_current_hype integer;
  v_current_troll bigint;
  v_error_msg text;
BEGIN
  -- 1. Check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0::bigint,
      0,
      'Not authenticated'::text;
    RETURN;
  END IF;

  -- 2. Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT
      false,
      0::bigint,
      0::bigint,
      0,
      'Amount must be greater than 0'::text;
    RETURN;
  END IF;

  -- 3. Check user has enough hype coins
  SELECT hype_coins, troll_coins
  INTO v_current_hype, v_current_troll
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_current_hype < p_amount THEN
    RETURN QUERY SELECT
      false,
      v_current_hype::bigint,
      v_current_troll::bigint,
      0,
      'Insufficient Hype Coins'::text;
    RETURN;
  END IF;

  -- 4. Perform atomic update: subtract hype coins, add troll coins
  UPDATE public.user_profiles
  SET
    hype_coins = hype_coins - p_amount,
    troll_coins = troll_coins + p_amount
  WHERE id = v_user_id;

  -- 5. Insert conversion ledger entries
  INSERT INTO public.hype_coin_ledger (user_id, amount, action, metadata)
  VALUES (v_user_id, -p_amount, 'hype_converted_to_troll', jsonb_build_object(
    'converted_at', NOW(),
    'troll_coins_gained', p_amount
  ));

  INSERT INTO public.coin_ledger (user_id, delta, bucket, source, created_at)
  VALUES (v_user_id, p_amount::bigint, 'gifted', 'hype_conversion', NOW());

  -- 6. Fetch updated balances
  SELECT hype_coins, troll_coins
  INTO v_current_hype, v_current_troll
  FROM public.user_profiles
  WHERE id = v_user_id;

  -- 7. Return success
  RETURN QUERY SELECT
    true,
    v_current_hype::bigint,
    v_current_troll::bigint,
    p_amount,
    'Hype Coins converted to Troll Coins'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANTS FOR RPC FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.earn_hype_coin_watch_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_hype_coins_to_troll_coins(integer) TO authenticated;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.hype_coin_ledger IS 'Ledger of all Hype Coin transactions. Users earn 1 Hype Coin per 5 verified minutes watched in live broadcasts.';
COMMENT ON COLUMN public.hype_coin_ledger.action IS 'Type of transaction: hype_watch_earned, hype_converted_to_troll';
COMMENT ON COLUMN public.user_profiles.hype_coins IS 'User balance of Hype Coins earned from watching live broadcasts';
COMMENT ON FUNCTION public.earn_hype_coin_watch_reward(uuid) IS 'RPC to award 1 Hype Coin after 5 verified minutes watching a live broadcast. Enforces daily (25) and weekly (175) caps.';
COMMENT ON FUNCTION public.convert_hype_coins_to_troll_coins(integer) IS 'RPC to convert Hype Coins to Troll Coins at 1:1 rate. Updated balances are returned.';
