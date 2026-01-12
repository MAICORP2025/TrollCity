-- No Buy Policy & Payment Verification
-- Adds paid flag, helper RPCs, and RLS adjustments for restricted features.

BEGIN;

-- 1. Track whether a user has made a verified purchase
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS has_paid BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Helper/guard functions
CREATE OR REPLACE FUNCTION public.is_paid_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND has_paid = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_paid_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_user_paid(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_id_missing');
  END IF;

  UPDATE public.user_profiles
  SET has_paid = TRUE,
      updated_at = NOW()
  WHERE id = p_user_id
    AND has_paid IS DISTINCT FROM TRUE;

  GET DIAGNOSTICS v_updated = ROW_COUNT > 0;

  RETURN jsonb_build_object(
    'success', TRUE,
    'updated', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_user_paid(UUID) TO service_role;

-- 3. Broadcast seats must be paid to interact
DROP POLICY IF EXISTS "Paid users can manage broadcast seats" ON public.broadcast_seats;
CREATE POLICY "Paid users can manage broadcast seats"
  ON public.broadcast_seats
  FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (is_paid_user(auth.uid()))
  WITH CHECK (is_paid_user(auth.uid()));

-- 4. Chat messages only from paid users
DROP POLICY IF EXISTS messages_insert_self ON public.messages;
CREATE POLICY messages_insert_self
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_paid_user(auth.uid()));

-- 5. Gifts can only be sent by paid senders
CREATE POLICY IF NOT EXISTS gifts_insert_paid
  ON public.gifts
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_paid_user(auth.uid()));

-- 6. Coin transactions restricted to paid users
DROP POLICY IF EXISTS coin_tx_insert_self ON public.coin_transactions;
DROP POLICY IF EXISTS coin_tx_update_self ON public.coin_transactions;
CREATE POLICY coin_tx_insert_paid
  ON public.coin_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_paid_user(auth.uid()));
CREATE POLICY coin_tx_update_paid
  ON public.coin_transactions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_paid_user(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND is_paid_user(auth.uid()));

-- 7. Payout requests require verified purchase
DROP POLICY IF EXISTS payouts_insert_self ON public.payout_requests;
CREATE POLICY payouts_insert_paid
  ON public.payout_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_paid_user(auth.uid()));

-- 8. Court cases require paid participants for inserts
DROP POLICY IF EXISTS "Officers can create cases" ON public.court_cases;
CREATE POLICY "Paid officers can create cases"
  ON public.court_cases
  FOR INSERT
  TO authenticated
  WITH CHECK (is_paid_user(auth.uid()));

-- 9. Court docket entries require paid users
CREATE POLICY IF NOT EXISTS "Paid users can create court docket entries"
  ON public.court_docket
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_paid_user(auth.uid()));
CREATE POLICY IF NOT EXISTS "Paid users can update their docket entries"
  ON public.court_docket
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_paid_user(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND is_paid_user(auth.uid()));

-- 10. Troll events / gambling actions require paid participants
CREATE POLICY IF NOT EXISTS "Paid users can create troll events"
  ON public.troll_events
  FOR INSERT
  TO authenticated
  WITH CHECK (is_paid_user(auth.uid()));
DROP POLICY IF EXISTS "Users can claim events" ON public.troll_event_claims;
CREATE POLICY "Paid users can claim troll events"
  ON public.troll_event_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_paid_user(auth.uid()));

-- 11. Gift ledger also limited
DROP POLICY IF EXISTS "Authenticated gift ledger insert" ON public.gift_transactions;
CREATE POLICY "Paid users can log gifts"
  ON public.gift_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_paid_user(auth.uid()));

COMMIT;
