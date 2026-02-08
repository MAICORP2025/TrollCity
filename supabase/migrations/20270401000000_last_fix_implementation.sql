-- Migration: Implement Enforcement, Government, and Fixes (Prompt 1, 2, 3)
-- Created: 2027-04-01

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.abuse_type AS ENUM ('spam', 'harassment', 'hate_speech', 'sexual_content', 'violence', 'impersonation', 'fraud', 'underage', 'disruptive_behavior', 'streaming_violation', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.review_status AS ENUM ('pending', 'under_review', 'action_taken', 'dismissed', 'escalated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.enforcement_action AS ENUM ('restrict_messaging', 'restrict_posting', 'restrict_broadcasting', 'restrict_podcast_start', 'restrict_podcast_join', 'restrict_stream_join', 'restrict_stream_start', 'restrict_all_live', 'warning_only', 'temporary_suspension');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.abuse_source_type AS ENUM ('post', 'message', 'stream', 'podcast', 'profile', 'comment', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. TABLES (Safe Create)
-- ============================================================================

-- ABUSE REPORTS
CREATE TABLE IF NOT EXISTS public.abuse_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_user_id UUID REFERENCES public.user_profiles(id),
    reported_user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    source_type public.abuse_source_type, 
    source_id UUID,
    abuse_type public.abuse_type,
    description TEXT,
    status public.review_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add columns if table exists but columns missing (idempotency)
DO $$ BEGIN
    ALTER TABLE public.abuse_reports ADD COLUMN IF NOT EXISTS source_type public.abuse_source_type;
    ALTER TABLE public.abuse_reports ADD COLUMN IF NOT EXISTS abuse_type public.abuse_type;
    ALTER TABLE public.abuse_reports ADD COLUMN IF NOT EXISTS status public.review_status DEFAULT 'pending';
EXCEPTION
    WHEN others THEN null;
END $$;


-- REVIEW CASES
CREATE TABLE IF NOT EXISTS public.review_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    abuse_report_id UUID REFERENCES public.abuse_reports(id),
    assigned_reviewer_id UUID REFERENCES public.user_profiles(id),
    reviewer_role TEXT, -- admin, president, vice_president
    status public.review_status,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- USER RESTRICTIONS
CREATE TABLE IF NOT EXISTS public.user_restrictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id),
    enforcement_action public.enforcement_action,
    reason TEXT,
    imposed_by UUID REFERENCES public.user_profiles(id),
    imposed_role TEXT,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REVIEW ACTIONS LOG
CREATE TABLE IF NOT EXISTS public.review_actions_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_user_id UUID REFERENCES public.user_profiles(id),
    actor_role TEXT,
    action_taken TEXT,
    target_user_id UUID REFERENCES public.user_profiles(id),
    restriction_id UUID REFERENCES public.user_restrictions(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GOVERNMENT ACTIONS LOG
CREATE TABLE IF NOT EXISTS public.government_actions_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_user_id UUID REFERENCES public.user_profiles(id),
    actor_role TEXT,
    action_type TEXT,
    target TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VISA REDEMPTIONS (For Giftcard Cashout) - Ensure it exists
CREATE TABLE IF NOT EXISTS public.visa_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  email TEXT,
  payout_method TEXT,
  payout_details TEXT,
  coins_reserved INTEGER NOT NULL CHECK (coins_reserved > 0),
  usd_amount NUMERIC(10, 2) NOT NULL CHECK (usd_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
  giftcard_code TEXT, 
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  processed_by UUID REFERENCES public.user_profiles(id)
);

-- ============================================================================
-- 3. FUNCTIONS & RPCS
-- ============================================================================

-- ENFORCEMENT CHECK
CREATE OR REPLACE FUNCTION public.is_user_restricted(p_user_id UUID, p_action public.enforcement_action)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_restricted BOOLEAN;
BEGIN
    -- Check for 'temporary_suspension' (overrides all)
    SELECT EXISTS (
        SELECT 1 FROM public.user_restrictions
        WHERE user_id = p_user_id
        AND is_active = true
        AND (ends_at IS NULL OR ends_at > NOW())
        AND starts_at <= NOW()
        AND enforcement_action = 'temporary_suspension'
    ) INTO v_restricted;
    
    IF v_restricted THEN RETURN TRUE; END IF;

    -- Check for 'restrict_all_live' if action is live-related
    IF p_action IN ('restrict_stream_join', 'restrict_stream_start', 'restrict_podcast_join', 'restrict_podcast_start', 'restrict_broadcasting') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_restrictions
            WHERE user_id = p_user_id
            AND is_active = true
            AND (ends_at IS NULL OR ends_at > NOW())
            AND starts_at <= NOW()
            AND enforcement_action = 'restrict_all_live'
        ) INTO v_restricted;
        
        IF v_restricted THEN RETURN TRUE; END IF;
    END IF;

    -- Check specific action
    SELECT EXISTS (
        SELECT 1 FROM public.user_restrictions
        WHERE user_id = p_user_id
        AND is_active = true
        AND (ends_at IS NULL OR ends_at > NOW())
        AND starts_at <= NOW()
        AND enforcement_action = p_action
    ) INTO v_restricted;

    RETURN v_restricted;
END;
$$;

-- SECURE SPEND (FIX)
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
  FROM public.user_profiles
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
  
  UPDATE public.user_profiles
  SET troll_coins = v_new_balance
  WHERE id = p_user_id;

  -- Insert into ledger
  INSERT INTO public.coin_ledger (
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

-- GRANT EXECUTE ON SPEND
GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins_secure(uuid, numeric, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins_secure(uuid, numeric, text, text, text, jsonb) TO service_role;

-- LOG GOVERNMENT ACTION
CREATE OR REPLACE FUNCTION public.log_government_action(
    p_actor_id UUID,
    p_actor_role TEXT,
    p_action_type TEXT,
    p_target TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.government_actions_log (
        actor_user_id,
        actor_role,
        action_type,
        target,
        metadata
    ) VALUES (
        p_actor_id,
        p_actor_role,
        p_action_type,
        p_target,
        p_metadata
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_government_action(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- REQUEST VISA REDEMPTION (CASHOUT)
CREATE OR REPLACE FUNCTION public.request_visa_redemption(
    p_user_id UUID,
    p_amount INTEGER,
    p_usd_value NUMERIC,
    p_method TEXT,
    p_details TEXT,
    p_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result JSONB;
BEGIN
    -- 1. Deduct coins securely (bucket: 'cashout_hold')
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_user_id,
        p_amount::numeric,
        'cashout_hold',
        'cashout_request',
        NULL,
        jsonb_build_object('method', p_method, 'usd', p_usd_value)
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- 2. Insert into redemptions
    INSERT INTO public.visa_redemptions (
        user_id,
        username,
        full_name,
        email,
        payout_method,
        payout_details,
        coins_reserved,
        usd_amount,
        status
    ) 
    SELECT 
        id, 
        username, 
        p_full_name, 
        email, 
        p_method, 
        p_details, 
        p_amount, 
        p_usd_value, 
        'pending'
    FROM public.user_profiles WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_visa_redemption(UUID, INTEGER, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- SEND PREMIUM GIFT (FIX)
CREATE OR REPLACE FUNCTION public.send_premium_gift(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_stream_id UUID,
    p_gift_id TEXT,
    p_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result JSONB;
    v_cashback INTEGER := 0;
    v_receiver_credit INTEGER;
    v_sender_balance NUMERIC;
    v_rgb_awarded BOOLEAN := false;
    v_gold_awarded BOOLEAN := false;
BEGIN
    -- 1. Deduct from sender
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_sender_id,
        p_cost::numeric,
        'paid',
        'gift_sent',
        p_gift_id,
        jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id)
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    v_sender_balance := (v_spend_result->>'new_balance')::numeric;

    -- 2. Credit Receiver (95%)
    v_receiver_credit := FLOOR(p_cost * 0.95);
    IF v_receiver_credit > 0 THEN
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins + v_receiver_credit 
        WHERE id = p_receiver_id;
        
        -- Log receiver credit
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, direction)
        VALUES (p_receiver_id, v_receiver_credit, 'earned', 'gift_received', p_gift_id, 'in');
    END IF;

    -- 3. Cashback Chance (10% chance to get 5% back)
    IF random() < 0.10 THEN
        v_cashback := FLOOR(p_cost * 0.05);
        IF v_cashback > 0 THEN
            UPDATE public.user_profiles 
            SET troll_coins = troll_coins + v_cashback 
            WHERE id = p_sender_id;
            
            v_sender_balance := v_sender_balance + v_cashback;
            
            INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, direction)
            VALUES (p_sender_id, v_cashback, 'bonus', 'gift_cashback', p_gift_id, 'in');
        END IF;
    END IF;

    -- 4. RGB / Gold Logic (Simplified for now)
    -- If cost > 500, maybe award something? (Leaving simple for now as prompt didn't specify exact odds)

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_sender_balance,
        'cashback', v_cashback,
        'rgb_awarded', v_rgb_awarded,
        'gold_awarded', v_gold_awarded
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_premium_gift(UUID, UUID, UUID, TEXT, INTEGER) TO authenticated;


-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- User Restrictions: Public read (for transparency/UI), Admin/Gov write (via RPC/Table)
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read restrictions" ON public.user_restrictions;
CREATE POLICY "Public read restrictions" ON public.user_restrictions FOR SELECT USING (true);

-- Abuse Reports: Reporter can see own, Admins/Gov can see all
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reporters view own" ON public.abuse_reports;
CREATE POLICY "Reporters view own" ON public.abuse_reports FOR SELECT USING (auth.uid() = reporter_user_id);
DROP POLICY IF EXISTS "Staff view all" ON public.abuse_reports;
CREATE POLICY "Staff view all" ON public.abuse_reports FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'president', 'vice_president', 'secretary') OR is_admin = true))
);
DROP POLICY IF EXISTS "Users create reports" ON public.abuse_reports;
CREATE POLICY "Users create reports" ON public.abuse_reports FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

-- Visa Redemptions (Cashouts)
ALTER TABLE public.visa_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own redemptions" ON public.visa_redemptions;
CREATE POLICY "Users view own redemptions" ON public.visa_redemptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all redemptions" ON public.visa_redemptions;
CREATE POLICY "Admins view all redemptions" ON public.visa_redemptions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'secretary') OR is_admin = true))
);

