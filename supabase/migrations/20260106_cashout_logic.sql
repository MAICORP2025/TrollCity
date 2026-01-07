-- 1. RPC to submit cashout request (deducts coins transactionally)
CREATE OR REPLACE FUNCTION submit_cashout_request(
  p_user_id uuid,
  p_amount_coins int,
  p_usd_value numeric,
  p_provider text,
  p_delivery_method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance int;
  v_request_id uuid;
BEGIN
  -- Check balance
  SELECT troll_coins INTO v_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_balance < p_amount_coins THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct coins
  UPDATE user_profiles
  SET troll_coins = troll_coins - p_amount_coins
  WHERE id = p_user_id;

  -- Insert request
  INSERT INTO cashout_requests (
    user_id,
    requested_coins,
    usd_value,
    payout_method,
    gift_card_provider,
    delivery_method,
    status,
    processing_time_estimate,
    created_at
  ) VALUES (
    p_user_id,
    p_amount_coins,
    p_usd_value,
    'Gift Card',
    p_provider,
    p_delivery_method,
    'pending',
    'Under 30 minutes',
    now()
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 2. RPC to refund/deny cashout request
CREATE OR REPLACE FUNCTION process_cashout_refund(
  p_request_id uuid,
  p_admin_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request
  FROM cashout_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status = 'denied' OR v_request.status = 'fulfilled' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Refund coins
  UPDATE user_profiles
  SET troll_coins = troll_coins + v_request.requested_coins
  WHERE id = v_request.user_id;

  -- Update status
  UPDATE cashout_requests
  SET 
    status = 'denied',
    notes = p_notes
  WHERE id = p_request_id;
END;
$$;

-- 3. Update Payout History View to include Gift Cards
CREATE OR REPLACE VIEW payout_history_view AS
SELECT 
  pr.id,
  pr.user_id,
  p.username,
  COALESCE(pr.cash_amount, 0) AS cash_amount,
  COALESCE(pr.coins_redeemed, 0) AS coins_redeemed,
  pr.status,
  pr.created_at,
  pr.processed_at,
  pr.admin_id,
  admin_p.username AS admin_username,
  pr.notes,
  CASE 
    WHEN COALESCE(pr.cash_amount, 0) > 0 THEN pr.cash_amount
    ELSE 0
  END AS usd_value,
  'payout' as type
FROM payout_requests pr
LEFT JOIN user_profiles p ON p.id = pr.user_id
LEFT JOIN user_profiles admin_p ON admin_p.id = pr.admin_id

UNION ALL

SELECT 
  cr.id,
  cr.user_id,
  p.username,
  cr.usd_value AS cash_amount,
  cr.requested_coins AS coins_redeemed,
  cr.status,
  cr.created_at,
  cr.fulfilled_at AS processed_at,
  cr.fulfilled_by AS admin_id,
  admin_p.username AS admin_username,
  cr.notes,
  cr.usd_value,
  'gift_card' as type
FROM cashout_requests cr
LEFT JOIN user_profiles p ON p.id = cr.user_id
LEFT JOIN user_profiles admin_p ON admin_p.id = cr.fulfilled_by;

-- 5. Update Economy Summary View
CREATE OR REPLACE VIEW economy_summary AS
WITH 
  coins_in_circulation AS (
    SELECT 
      COALESCE(SUM(troll_coins), 0) AS total
    FROM user_profiles
  ),
  gift_coins_spent AS (
    SELECT 
      COALESCE(SUM(coins_spent), 0) AS total
    FROM gifts
  ),
  payouts_processed AS (
    SELECT 
      COALESCE(SUM(total_usd), 0) AS total_usd
    FROM (
      SELECT cash_amount AS total_usd FROM payout_requests WHERE status = 'paid' OR status = 'approved'
      UNION ALL
      SELECT usd_value AS total_usd FROM cashout_requests WHERE status = 'fulfilled' OR status = 'paid'
    ) AS combined_paid
  ),
  pending_payouts AS (
    SELECT 
      COALESCE(SUM(total_usd), 0) AS total_usd
    FROM (
      SELECT cash_amount AS total_usd FROM payout_requests WHERE status = 'pending'
      UNION ALL
      SELECT usd_value AS total_usd FROM cashout_requests WHERE status = 'pending'
    ) AS combined_pending
  ),
  revenue_summary AS (
    SELECT 
      COALESCE(SUM(platform_profit), 0) AS total_revenue
    FROM coin_transactions
    WHERE type = 'purchase'
  ),
  creator_earned AS (
    SELECT 
      COALESCE(SUM(amount), 0) AS total_coins
    FROM coin_transactions
    WHERE type IN ('gift_receive', 'gift')
      AND amount > 0
  ),
  top_broadcaster AS (
    SELECT 
      p.username,
      COALESCE(SUM(ct.amount), 0) AS total_earned
    FROM user_profiles p
    LEFT JOIN coin_transactions ct ON ct.user_id = p.id
      AND ct.type IN ('gift_receive', 'gift')
      AND ct.amount > 0
    WHERE p.is_broadcaster = true
    GROUP BY p.id, p.username
    ORDER BY total_earned DESC
    LIMIT 1
  )
SELECT 
  (SELECT total FROM coins_in_circulation) AS total_coins_in_circulation,
  (SELECT total FROM gift_coins_spent) AS total_gift_coins_spent,
  (SELECT total_usd FROM payouts_processed) AS total_payouts_processed_usd,
  (SELECT total_usd FROM pending_payouts) AS total_pending_payouts_usd,
  (SELECT total_coins FROM creator_earned) AS total_creator_earned_coins,
  (SELECT username FROM top_broadcaster) AS top_earning_broadcaster,
  (SELECT total_revenue FROM revenue_summary) AS total_revenue_usd;
