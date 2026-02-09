-- Migration: Fix Admin Update RPC and Bank Types
-- 1. Updates admin_update_any_profile_field to include free_coin_balance
-- 2. Ensures troll_bank_credit_coins accepts NUMERIC
-- 3. Ensures troll_bank_spend_coins_secure accepts NUMERIC

-- 1. Admin Update RPC
CREATE OR REPLACE FUNCTION public.admin_update_any_profile_field(
    p_user_id UUID,
    p_updates JSONB,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Admin Update'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key TEXT;
    v_val TEXT;
    v_query TEXT;
    v_admin_role TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- 1. Verify Admin Permissions
    SELECT role, is_admin INTO v_admin_role, v_is_admin
    FROM user_profiles
    WHERE id = p_admin_id;

    IF v_admin_role NOT IN ('admin', 'lead_troll_officer') AND v_is_admin IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Unauthorized: Only Admins can perform this action';
    END IF;

    -- 2. Set Bypass Flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 3. Safety check
    IF jsonb_typeof(p_updates) != 'object' THEN
        RAISE EXCEPTION 'Updates must be a JSON object';
    END IF;

    -- 4. Perform Update
    -- Added free_coin_balance, full_name, email handling
    UPDATE user_profiles
    SET 
        role = COALESCE((p_updates->>'role')::text, role),
        is_admin = COALESCE((p_updates->>'is_admin')::boolean, is_admin),
        is_lead_officer = COALESCE((p_updates->>'is_lead_officer')::boolean, is_lead_officer),
        is_troll_officer = COALESCE((p_updates->>'is_troll_officer')::boolean, is_troll_officer),
        is_troller = COALESCE((p_updates->>'is_troller')::boolean, is_troller),
        troll_coins = COALESCE((p_updates->>'troll_coins')::bigint, troll_coins),
        free_coin_balance = COALESCE((p_updates->>'free_coin_balance')::bigint, free_coin_balance),
        level = COALESCE((p_updates->>'level')::int, level),
        xp = COALESCE((p_updates->>'xp')::int, xp),
        bypass_broadcast_restriction = COALESCE((p_updates->>'bypass_broadcast_restriction')::boolean, bypass_broadcast_restriction),
        rgb_username_expires_at = COALESCE((p_updates->>'rgb_username_expires_at')::timestamptz, rgb_username_expires_at),
        glowing_username_color = COALESCE((p_updates->>'glowing_username_color')::text, glowing_username_color),
        username_style = COALESCE((p_updates->>'username_style')::text, username_style),
        badge = COALESCE((p_updates->>'badge')::text, badge),
        full_name = COALESCE((p_updates->>'full_name')::text, full_name),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 5. Log Action
    INSERT INTO admin_audit_logs (admin_id, target_id, action, details, created_at)
    VALUES (p_admin_id, p_user_id, 'update_profile_field', jsonb_build_object('updates', p_updates, 'reason', p_reason), NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Secure troll_bank_credit_coins (NUMERIC)
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins numeric,
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_balance numeric(20, 2);
    v_loan_record record;
    v_repay_amount numeric(20, 2) := 0;
    v_user_gets numeric(20, 2);
    v_new_loan_balance numeric(20, 2);
    v_loan_status text;
BEGIN
    -- Set bypass flag for the transaction
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

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
    IF v_loan_record IS NOT NULL AND p_bucket = 'paid' THEN
        v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50));
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
    -- a) Repayment
    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id, p_metadata, 'out');

        -- Update loan
        UPDATE public.loans
        SET balance = balance - v_repay_amount,
            status = CASE WHEN balance - v_repay_amount <= 0 THEN 'paid' ELSE status END,
            closed_at = CASE WHEN balance - v_repay_amount <= 0 THEN now() ELSE closed_at END
        WHERE id = v_loan_record.id
        RETURNING balance, status INTO v_new_loan_balance, v_loan_status;
    END IF;

    -- b) Credit User
    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata, 'in');

        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_user_gets
        WHERE id = p_user_id;
    END IF;

    RETURN json_build_object(
        'repay', v_repay_amount,
        'user_gets', v_user_gets,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status
    );
END;
$$;

-- 3. Secure troll_bank_spend_coins_secure (NUMERIC)
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins_secure(
    p_user_id UUID,
    p_amount NUMERIC,
    p_bucket TEXT DEFAULT 'paid',
    p_source TEXT DEFAULT 'purchase',
    p_ref_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance NUMERIC;
    v_new_balance NUMERIC;
    v_ledger_id UUID;
BEGIN
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- 1. Check balance
    SELECT troll_coins INTO v_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'current_balance', v_balance);
    END IF;

    -- 2. Deduct
    v_new_balance := v_balance - p_amount;
    
    UPDATE public.user_profiles
    SET troll_coins = v_new_balance
    WHERE id = p_user_id;

    -- 3. Log to Ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
    VALUES (p_user_id, -p_amount, p_bucket, p_source, p_ref_id, p_metadata, 'out')
    RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'ledger_id', v_ledger_id);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_update_any_profile_field(UUID, JSONB, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.troll_bank_credit_coins(uuid, numeric, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins_secure(UUID, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO service_role;
