-- Upgrade coins to NUMERIC(20, 2) to fix integer overflow and support decimals

-- 1. Drop dependent views and triggers
DROP VIEW IF EXISTS public.earnings_view;
DROP VIEW IF EXISTS public.monthly_earnings_breakdown;
DROP VIEW IF EXISTS public.creator_earnings;

DROP TRIGGER IF EXISTS trg_sync_trollstown_coins ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_set_trollstown_coins ON public.trollstown_properties;

-- 2. Alter table columns to NUMERIC(20, 2)
-- user_profiles
ALTER TABLE public.user_profiles ALTER COLUMN troll_coins TYPE NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_earned_coins TYPE NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_spent_coins TYPE NUMERIC(20, 2);

-- Update other coin related columns if they exist (handling variations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'paid_coins') THEN
    ALTER TABLE public.user_profiles ALTER COLUMN paid_coins TYPE NUMERIC(20, 2);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'free_coin_balance') THEN
    ALTER TABLE public.user_profiles ALTER COLUMN free_coin_balance TYPE NUMERIC(20, 2);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'paid_coin_balance') THEN
    ALTER TABLE public.user_profiles ALTER COLUMN paid_coin_balance TYPE NUMERIC(20, 2);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'earned_coin_balance') THEN
    ALTER TABLE public.user_profiles ALTER COLUMN earned_coin_balance TYPE NUMERIC(20, 2);
  END IF;
END $$;

-- trollstown_properties
ALTER TABLE public.trollstown_properties ALTER COLUMN troll_coins TYPE NUMERIC(20, 2);

-- loans
ALTER TABLE public.loans ALTER COLUMN principal TYPE NUMERIC(20, 2);
ALTER TABLE public.loans ALTER COLUMN balance TYPE NUMERIC(20, 2);

-- loan_applications
ALTER TABLE public.loan_applications ALTER COLUMN requested_coins TYPE NUMERIC(20, 2);

-- bank_tiers
ALTER TABLE public.bank_tiers ALTER COLUMN max_loan_coins TYPE NUMERIC(20, 2);

-- coin_ledger
ALTER TABLE public.coin_ledger ALTER COLUMN delta TYPE NUMERIC(20, 2);

-- loan_payments
ALTER TABLE public.loan_payments ALTER COLUMN amount TYPE NUMERIC(20, 2);

-- property_loans (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_loans') THEN
    ALTER TABLE public.property_loans ALTER COLUMN total_amount TYPE NUMERIC(20, 2);
    ALTER TABLE public.property_loans ALTER COLUMN remaining_amount TYPE NUMERIC(20, 2);
    ALTER TABLE public.property_loans ALTER COLUMN monthly_payment TYPE NUMERIC(20, 2);
  END IF;
END $$;


-- 3. Update RPC functions to accept NUMERIC

-- add_troll_coins
CREATE OR REPLACE FUNCTION "public"."add_troll_coins"("user_id_input" "uuid", "coins_to_add" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_profiles
  SET 
    troll_coins = COALESCE(troll_coins, 0) + coins_to_add,
    total_earned_coins = COALESCE(total_earned_coins, 0) + coins_to_add,
    updated_at = NOW()
  WHERE id = user_id_input;
END;
$$;

-- add_earned_coins
CREATE OR REPLACE FUNCTION "public"."add_earned_coins"("user_id" "uuid", "coins" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  update user_profiles
  set earned_coin_balance = earned_coin_balance + coins,
      total_earned_coins = total_earned_coins + coins
  where id = user_id;
end;
$$;

-- add_paid_coins
CREATE OR REPLACE FUNCTION "public"."add_paid_coins"("user_id_input" "uuid", "coins_to_add" numeric) RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
  UPDATE user_profiles
  SET paid_coin_balance = COALESCE(paid_coin_balance, 0) + coins_to_add
  WHERE id = user_id_input;
$$;

-- troll_bank_credit_coins (Updated to use NUMERIC)
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins numeric, -- Changed from int to numeric
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_balance numeric(20, 2);
    v_loan_record record;
    v_repay_amount numeric(20, 2) := 0;
    v_user_gets numeric(20, 2);
    v_new_loan_balance numeric(20, 2);
    v_loan_status text;
    v_gift_repayment_enabled boolean := false;
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Lock user profile row
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Lock active loan row if exists
    SELECT * INTO v_loan_record
    FROM public.loans
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    -- Determine repayment eligibility
    -- Eligible buckets: 'paid' only (default)
    IF v_loan_record IS NOT NULL AND p_bucket = 'paid' THEN
        -- repay = min(loan_balance, floor(p_coins * 0.50))
        -- Using floor to keep integer-ish repayment logic if desired, or just exact amount.
        -- Let's stick to simple logic: 50% of incoming paid coins goes to loan.
        v_repay_amount := LEAST(v_loan_record.balance, (p_coins * 0.50));
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
    -- a) Repayment
    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id, p_metadata);

        -- Update loan
        UPDATE public.loans
        SET balance = balance - v_repay_amount,
            status = CASE WHEN balance - v_repay_amount <= 0 THEN 'paid' ELSE status END,
            closed_at = CASE WHEN balance - v_repay_amount <= 0 THEN now() ELSE closed_at END
        WHERE id = v_loan_record.id
        RETURNING balance, status INTO v_new_loan_balance, v_loan_status;
    ELSE
        v_new_loan_balance := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.balance ELSE 0 END;
        v_loan_status := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.status ELSE 'none' END;
    END IF;

    -- b) Credit
    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata);
    END IF;

    -- Update user balance (troll_coins)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_user_gets
    WHERE id = p_user_id;

    RETURN json_build_object(
        'repay', v_repay_amount,
        'user_gets', v_user_gets,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status
    );
END;
$$;

-- troll_bank_apply_for_loan (Updated to use NUMERIC)
CREATE OR REPLACE FUNCTION public.troll_bank_apply_for_loan(
    p_requested_coins numeric -- Changed from int to numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user record;
    v_active_loan_exists boolean;
    v_account_age_days int;
    v_max_allowed numeric(20, 2);
    v_tier_name text;
    v_result json;
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'reason', 'Unauthorized: no user');
    END IF;

    -- Get user info
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'reason', 'User not found');
    END IF;

    -- Check active loan (One active loan at a time)
    SELECT EXISTS (
        SELECT 1 FROM public.loans WHERE user_id = v_user_id AND status = 'active'
    ) INTO v_active_loan_exists;

    IF v_active_loan_exists THEN
        RETURN json_build_object('success', false, 'reason', 'Active loan exists');
    END IF;

    -- Calculate account age
    v_account_age_days := EXTRACT(DAY FROM (now() - v_user.created_at));

    -- Determine Max Loan Amount based on Tiers
    SELECT max_loan_coins, tier_name INTO v_max_allowed, v_tier_name
    FROM public.bank_tiers
    WHERE min_tenure_days <= v_account_age_days
    ORDER BY min_tenure_days DESC
    LIMIT 1;
    v_max_allowed := COALESCE(v_max_allowed, 0);

    IF p_requested_coins > v_max_allowed THEN
        RETURN json_build_object(
            'success', false, 
            'reason', 'Requested amount exceeds limit based on tenure', 
            'limit', v_max_allowed,
            'current_tenure_days', v_account_age_days,
            'tier', v_tier_name
        );
    END IF;

    -- Create application (Auto-approved)
    INSERT INTO public.loan_applications (user_id, requested_coins, status, auto_approved, reason)
    VALUES (v_user_id, p_requested_coins, 'approved', true, 'Auto-approved by Troll Bank Tier System');

    -- Create active loan
    INSERT INTO public.loans (user_id, principal, balance, status)
    VALUES (v_user_id, p_requested_coins, p_requested_coins, 'active');

    -- Disburse coins
    -- Calls the credit function internally
    SELECT public.troll_bank_credit_coins(
        v_user_id,
        p_requested_coins,
        'loan',
        'loan_disbursement',
        NULL,
        jsonb_build_object('tier', v_tier_name, 'tenure', v_account_age_days)
    ) INTO v_result;

    RETURN json_build_object(
        'success', true,
        'loan_details', v_result,
        'principal', p_requested_coins,
        'tier', v_tier_name
    );
END;
$$;

-- buy_property_with_loan (Updated to use NUMERIC)
CREATE OR REPLACE FUNCTION public.buy_property_with_loan(p_property_id UUID, p_down_payment numeric)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_price numeric(20, 2);
    v_loan_amount numeric(20, 2);
    v_min_down numeric(20, 2);
    v_balance numeric(20, 2);
    v_loan_id UUID;
    v_prev_owner_id UUID;
BEGIN
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    -- Use price column
    v_price := v_property.price;
    v_min_down := ceil(v_price * 0.10); -- 10% minimum

    IF p_down_payment < v_min_down THEN
        RETURN jsonb_build_object('success', false, 'error', 'Down payment must be at least 10%');
    END IF;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for down payment');
    END IF;

    v_loan_amount := v_price - p_down_payment;
    v_prev_owner_id := v_property.owner_id;

    -- Deduct Down Payment
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_down_payment WHERE id = v_user_id;
    
    -- Update Property Ownership
    UPDATE public.properties 
    SET owner_id = v_user_id, 
        owner_user_id = v_user_id, 
        is_for_sale = false, 
        is_for_rent = true 
    WHERE id = p_property_id;

    -- Create Loan if amount > 0
    IF v_loan_amount > 0 THEN
        INSERT INTO public.property_loans (
            user_id, property_id, total_amount, remaining_amount, monthly_payment, next_payment_due_at
        ) VALUES (
            v_user_id, p_property_id, v_loan_amount, v_loan_amount, ceil(v_loan_amount / 4.0), NOW() + INTERVAL '7 days'
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- pay_loan (Updated to use NUMERIC)
CREATE OR REPLACE FUNCTION public.pay_loan(p_loan_id UUID, p_amount numeric)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_loan RECORD;
    v_balance numeric(20, 2);
BEGIN
    SELECT * INTO v_loan FROM public.property_loans WHERE id = p_loan_id;
    
    IF NOT FOUND OR v_loan.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    IF v_loan.status != 'active' THEN
         RETURN jsonb_build_object('success', false, 'error', 'Loan is not active');
    END IF;

    IF p_amount > v_loan.remaining_amount THEN
        p_amount := v_loan.remaining_amount;
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_amount THEN
         RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;
    
    -- Deduct coins
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_amount WHERE id = v_user_id;

    -- Update loan
    UPDATE public.property_loans 
    SET remaining_amount = remaining_amount - p_amount,
        last_payment_at = NOW(),
        status = CASE WHEN remaining_amount - p_amount <= 0 THEN 'paid' ELSE 'active' END
    WHERE id = p_loan_id;

    RETURN jsonb_build_object('success', true, 'new_balance', v_loan.remaining_amount - p_amount);
END;
$$;


-- 4. Recreate Triggers
CREATE TRIGGER trg_sync_trollstown_coins
  AFTER UPDATE OF troll_coins ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_trollstown_coins_from_profiles();

CREATE TRIGGER trg_set_trollstown_coins
  BEFORE INSERT ON public.trollstown_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trollstown_coins_on_insert();

-- 5. Recreate Views

-- monthly_earnings_breakdown
CREATE OR REPLACE VIEW monthly_earnings_breakdown AS
SELECT 
  p.id AS user_id,
  p.username,
  DATE_TRUNC('month', g.created_at) AS month,
  SUM(g.coins_spent) AS coins_earned_from_gifts,
  COUNT(DISTINCT g.id) AS gift_count,
  COUNT(DISTINCT g.sender_id) AS unique_gifters,
  SUM(CASE WHEN g.gift_type = 'paid' THEN g.coins_spent ELSE 0 END) AS paid_coins_earned,
  SUM(CASE WHEN g.gift_type = 'free' THEN g.coins_spent ELSE 0 END) AS free_coins_earned
FROM user_profiles p
JOIN gifts g ON g.receiver_id = p.id
WHERE p.is_broadcaster = true OR p.total_earned_coins > 0
GROUP BY p.id, p.username, DATE_TRUNC('month', g.created_at)
ORDER BY month DESC, coins_earned_from_gifts DESC;

GRANT SELECT ON monthly_earnings_breakdown TO authenticated;

-- earnings_view
CREATE OR REPLACE VIEW earnings_view AS
WITH gift_earnings AS (
    SELECT 
      receiver_id AS user_id,
      DATE_TRUNC('month', created_at) AS month,
      SUM(coins_spent) AS total_coins_earned,
      COUNT(id) AS gift_count
    FROM gifts
    GROUP BY receiver_id, DATE_TRUNC('month', created_at)
  ),
  transaction_earnings AS (
    SELECT 
      user_id,
      DATE_TRUNC('month', created_at) AS month,
      SUM(amount) AS total_coins_earned,
      COUNT(id) AS transaction_count
    FROM coin_transactions
    WHERE type IN ('gift_receive', 'stream_income', 'referral_bonus') 
      AND amount > 0
    GROUP BY user_id, DATE_TRUNC('month', created_at)
  ),
  combined_earnings AS (
    SELECT 
      COALESCE(g.user_id, t.user_id) AS user_id,
      COALESCE(g.month, t.month) AS month,
      COALESCE(g.total_coins_earned, 0) + COALESCE(t.total_coins_earned, 0) AS total_coins,
      COALESCE(g.gift_count, 0) + COALESCE(t.transaction_count, 0) AS transaction_count
    FROM gift_earnings g
    FULL OUTER JOIN transaction_earnings t 
      ON g.user_id = t.user_id AND g.month = t.month
  ),
  payout_summary AS (
    SELECT 
      user_id,
      DATE_TRUNC('month', created_at) AS month,
      SUM(CASE WHEN status = 'paid' THEN COALESCE(cash_amount, 0) ELSE 0 END) AS paid_out_usd,
      SUM(CASE WHEN status = 'pending' THEN COALESCE(cash_amount, 0) ELSE 0 END) AS pending_usd,
      SUM(CASE WHEN status = 'approved' THEN COALESCE(cash_amount, 0) ELSE 0 END) AS approved_usd,
      COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
    FROM payout_requests
    GROUP BY user_id, DATE_TRUNC('month', created_at)
  ),
  yearly_payouts AS (
    SELECT 
      user_id,
      DATE_PART('year', created_at)::int AS year,
      SUM(COALESCE(cash_amount, 0)) AS total_paid_usd,
      COUNT(*) AS payout_count
    FROM payout_requests
    WHERE status = 'paid'
    GROUP BY user_id, DATE_PART('year', created_at)
  )
SELECT 
  p.id,
  p.username,
  p.total_earned_coins,
  p.troll_coins,
  COALESCE(ce.total_coins, 0) AS current_month_earnings,
  COALESCE(ce.transaction_count, 0) AS current_month_transactions,
  COALESCE(ps.paid_out_usd, 0) AS current_month_paid_out,
  COALESCE(ps.pending_usd, 0) AS current_month_pending,
  COALESCE(ps.approved_usd, 0) AS current_month_approved,
  COALESCE(ps.paid_count, 0) AS current_month_paid_count,
  COALESCE(ps.pending_count, 0) AS current_month_pending_count,
  COALESCE(yp.total_paid_usd, 0) AS yearly_paid_usd,
  COALESCE(yp.payout_count, 0) AS yearly_payout_count,
  COALESCE(yp.year, DATE_PART('year', NOW())::int) AS tax_year,
  CASE 
    WHEN COALESCE(yp.total_paid_usd, 0) >= 600 THEN 'over_threshold'
    WHEN COALESCE(yp.total_paid_usd, 0) >= 500 THEN 'nearing_threshold'
    ELSE 'below_threshold'
  END AS irs_threshold_status,
  (SELECT MAX(pr.created_at) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'paid') AS last_payout_at,
  (SELECT COUNT(*) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'pending') AS pending_requests_count,
  (SELECT SUM(COALESCE(pr.cash_amount, 0)) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'paid') AS lifetime_paid_usd
FROM user_profiles p
LEFT JOIN combined_earnings ce 
  ON ce.user_id = p.id 
  AND ce.month = DATE_TRUNC('month', NOW())
LEFT JOIN payout_summary ps 
  ON ps.user_id = p.id 
  AND ps.month = DATE_TRUNC('month', NOW())
LEFT JOIN yearly_payouts yp 
  ON yp.user_id = p.id 
  AND yp.year = DATE_PART('year', NOW())::int
WHERE p.is_broadcaster = true OR p.total_earned_coins > 0;

GRANT SELECT ON earnings_view TO authenticated;
