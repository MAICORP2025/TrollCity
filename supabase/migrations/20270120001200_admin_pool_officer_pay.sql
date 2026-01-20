-- RPC: Pay Officer
CREATE OR REPLACE FUNCTION public.troll_bank_pay_officer(
    p_officer_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_pay_rate BIGINT;
    v_bucket_bal BIGINT;
    v_officer_name TEXT;
BEGIN
    -- Check admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get Officer Name
    SELECT username INTO v_officer_name FROM public.user_profiles WHERE id = p_officer_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Officer not found'; END IF;

    -- Get Pay Rate
    SELECT (setting_value->>'officer_pay_rate')::BIGINT INTO v_pay_rate
    FROM public.admin_app_settings
    WHERE setting_key = 'officer_pay_rate';
    
    -- Default if not set or invalid
    IF v_pay_rate IS NULL OR v_pay_rate <= 0 THEN
        v_pay_rate := 1000;
    END IF;

    -- Check Bucket Balance
    SELECT balance_coins INTO v_bucket_bal 
    FROM public.admin_pool_buckets 
    WHERE bucket_name = 'Officer Pay';

    IF v_bucket_bal < v_pay_rate THEN
        RAISE EXCEPTION 'Insufficient funds in Officer Pay bucket (Need %, Have %)', v_pay_rate, v_bucket_bal;
    END IF;

    -- 1. Deduct from Bucket
    UPDATE public.admin_pool_buckets 
    SET balance_coins = balance_coins - v_pay_rate, updated_at = NOW()
    WHERE bucket_name = 'Officer Pay';

    -- 2. Credit Officer (Coin Ledger)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES (
        p_officer_id, 
        v_pay_rate, 
        'paid', 
        'officer_pay', 
        p_admin_id::text, 
        'Officer Pay Period'
    );

    -- 3. Audit Log (Admin Pool Ledger)
    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at) 
    VALUES (
        v_pay_rate, 
        'Paid Officer @' || v_officer_name, 
        p_officer_id, 
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'amount', v_pay_rate);
END;
$$;

-- Enable RLS and Add Policy for admin_pool_ledger
ALTER TABLE public.admin_pool_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin pool ledger" ON public.admin_pool_ledger;
CREATE POLICY "Admins can view admin pool ledger"
  ON public.admin_pool_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    )
  );
