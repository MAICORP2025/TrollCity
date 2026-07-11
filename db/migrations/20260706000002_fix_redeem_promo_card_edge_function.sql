-- Migrate: Fix redeem_promo_card for edge function usage (MaiTalent.fun redemption)
-- Date: 2026-07-06
-- Problem: auth.uid() is NULL when called from Supabase Edge Functions using service_role
-- Fix: Allow service-role callers to redeem by code without user match, and support
--      an optional p_user_id parameter for cases where the caller does know the owner.

CREATE OR REPLACE FUNCTION public.redeem_promo_card(
    p_code text,
    p_requestor_platform text DEFAULT NULL,
    p_requestor_account_id text DEFAULT NULL,
    p_requestor_metadata jsonb DEFAULT NULL,
    p_user_id uuid DEFAULT NULL
) RETURNS TABLE (
    success boolean,
    code text,
    token_amount numeric,
    promo_id uuid,
    status text,
    redeemed_at timestamptz,
    error text,
    error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_card promo_cards%ROWTYPE;
    v_user uuid;
    v_code_lookup text;
BEGIN
    v_code_lookup := btrim(p_code);

    IF v_code_lookup IS NULL OR v_code_lookup = '' THEN
        RETURN QUERY SELECT false, NULL, NULL, NULL, NULL, NULL, 'Missing promo code', 'INVALID_REQUEST';
        RETURN;
    END IF;

    IF auth.role() = 'service_role' AND p_user_id IS NOT NULL THEN
        v_user := p_user_id;
    ELSIF auth.role() = 'service_role' AND p_user_id IS NULL THEN
        v_user := NULL;
    ELSE
        v_user := auth.uid();
    END IF;

    IF v_user IS NOT NULL THEN
        SELECT * INTO v_card
        FROM public.promo_cards
        WHERE code = v_code_lookup
          AND user_id = v_user
          AND status = 'available'
          AND redeemed_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE;
    ELSE
        SELECT * INTO v_card
        FROM public.promo_cards
        WHERE code = v_code_lookup
          AND status = 'available'
          AND redeemed_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        IF v_user IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM public.promo_cards WHERE code = v_code_lookup AND user_id = v_user) THEN
                IF EXISTS (SELECT 1 FROM public.promo_cards WHERE code = v_code_lookup AND user_id = v_user AND redeemed_at IS NOT NULL) THEN
                    RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Promo code already redeemed', 'ALREADY_REDEEMED';
                ELSIF EXISTS (SELECT 1 FROM public.promo_cards WHERE code = v_code_lookup AND user_id = v_user AND expires_at <= NOW()) THEN
                    RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Promo code expired', 'EXPIRED_CODE';
                ELSE
                    RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Promo code not available', 'NOT_AVAILABLE';
                END IF;
            ELSE
                RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Invalid promo code for this user', 'INVALID_CODE';
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM public.promo_cards WHERE code = v_code_lookup) THEN
                IF EXISTS (SELECT 1 FROM public.promo_cards WHERE code = v_code_lookup AND redeemed_at IS NOT NULL) THEN
                    RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Promo code already redeemed', 'ALREADY_REDEEMED';
                ELSIF EXISTS (SELECT 1 FROM public.promo_cards WHERE code = v_code_lookup AND expires_at <= NOW()) THEN
                    RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Promo code expired', 'EXPIRED_CODE';
                ELSE
                    RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Promo code not available', 'NOT_AVAILABLE';
                END IF;
            ELSE
                RETURN QUERY SELECT false, v_code_lookup, NULL, NULL, NULL, NULL, 'Invalid promo code', 'INVALID_CODE';
            END IF;
        END IF;
    END IF;

    UPDATE public.promo_cards
    SET status = 'redeemed', redeemed_at = NOW(), redeemed_by = v_user, updated_at = NOW()
    WHERE id = v_card.id;

    INSERT INTO public.promo_card_redemptions (
        promo_card_id, requestor_platform, requestor_account_id, requestor_metadata
    )
    VALUES (
        v_card.id, p_requestor_platform, p_requestor_account_id, p_requestor_metadata
    );

    RETURN QUERY SELECT true, v_card.code, v_card.token_amount, v_card.id, v_card.status, NOW(), NULL, NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_card(text, text, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_card(text, text, text, jsonb, uuid) TO service_role;
