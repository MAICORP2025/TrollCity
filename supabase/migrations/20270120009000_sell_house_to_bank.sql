-- Migration: Sell House to Bank & Bank Reserves
-- Description: Implements sell_house_to_bank RPC with 50/50 split and deed transfer, and get_bank_reserves RPC.

-- 1. sell_house_to_bank RPC
DROP FUNCTION IF EXISTS public.sell_house_to_bank(UUID);

CREATE OR REPLACE FUNCTION public.sell_house_to_bank(
    house_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house RECORD;
    v_seller_id UUID;
    v_admin_id UUID;
    v_price BIGINT;
    v_seller_share BIGINT;
    v_admin_share BIGINT;
BEGIN
    -- Get House Details
    SELECT * INTO v_house FROM public.properties WHERE id = house_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    v_seller_id := v_house.owner_user_id;
    
    -- Verify ownership (caller must be owner)
    IF v_seller_id <> auth.uid() THEN
        RAISE EXCEPTION 'You do not own this property';
    END IF;

    -- Get Admin User (Bank)
    -- Prioritize user with role 'admin'
    SELECT id INTO v_admin_id 
    FROM public.user_profiles 
    WHERE role = 'admin' OR is_admin = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Bank admin not found';
    END IF;

    -- Calculate Values
    -- Using base_value from properties table
    v_price := COALESCE(v_house.base_value, 0);
    
    -- If base_value is null/zero, try ask_price or fallback
    IF v_price <= 0 THEN
       v_price := COALESCE(v_house.ask_price, 0);
    END IF;
    
    IF v_price <= 0 THEN
        -- Fallback default for starter home if unknown
        IF v_house.is_starter THEN
             v_price := 1500;
        ELSE
             RAISE EXCEPTION 'Property has no value';
        END IF;
    END IF;

    v_seller_share := FLOOR(v_price * 0.50);
    v_admin_share := v_price - v_seller_share; -- Remainder to admin

    -- Credit Seller
    PERFORM public.troll_bank_credit_coins(
        v_seller_id,
        v_seller_share::INT,
        'paid', 
        'property_sale_seller',
        house_id::TEXT
    );

    -- Credit Admin Pool (Admin User)
    PERFORM public.troll_bank_credit_coins(
        v_admin_id,
        v_admin_share::INT,
        'paid', 
        'property_sale_admin_pool',
        house_id::TEXT
    );

    -- Audit Log for Admin Pool
    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
    VALUES (v_admin_share, 'Property Sale Profit (50% Split) - House ' || house_id, v_seller_id, NOW());

    -- Transfer Property to Admin
    UPDATE public.properties
    SET owner_user_id = v_admin_id,
        is_listed = false,
        is_active_home = false,
        updated_at = NOW()
    WHERE id = house_id;

    RETURN jsonb_build_object(
        'success', true,
        'seller_share', v_seller_share,
        'admin_share', v_admin_share
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_house_to_bank(UUID) TO authenticated;

-- 2. get_bank_reserves RPC
CREATE OR REPLACE FUNCTION public.get_bank_reserves()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT troll_coins INTO v_balance
    FROM public.user_profiles
    WHERE role = 'admin' OR is_admin = true
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN COALESCE(v_balance, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bank_reserves() TO authenticated, anon;
