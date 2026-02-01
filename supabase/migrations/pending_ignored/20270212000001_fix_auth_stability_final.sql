-- 1. CLEANUP LEGACY TRIGGERS AND FUNCTIONS
-- Drop any triggers that might be causing transaction aborts or "function does not exist" errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

-- Drop legacy functions to ensure they aren't called
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_credit CASCADE;
DROP FUNCTION IF EXISTS public.create_user_credit_on_signup CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_signup CASCADE;
DROP FUNCTION IF EXISTS public.grant_starter_vehicle CASCADE;

-- 2. SCHEMA TYPE SAFETY FIXES (INTEGER -> TEXT)
-- Ensure all vehicle_id references are TEXT to support both UUIDs and numeric IDs
DO $$ 
BEGIN
    -- Fix vehicle_upgrades
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='vehicle_upgrades') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_upgrades' AND column_name='vehicle_id' AND data_type='integer') THEN
            ALTER TABLE public.vehicle_upgrades ALTER COLUMN vehicle_id TYPE TEXT USING vehicle_id::text;
        END IF;
    END IF;

    -- Fix vehicle_listings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='vehicle_listings') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_listings' AND column_name='vehicle_id' AND data_type='integer') THEN
            ALTER TABLE public.vehicle_listings ALTER COLUMN vehicle_id TYPE TEXT USING vehicle_id::text;
        END IF;
    END IF;

    -- Fix user_cars (if needed, usually car_id or similar)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_cars') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_cars' AND column_name='vehicle_id' AND data_type='integer') THEN
            ALTER TABLE public.user_cars ALTER COLUMN vehicle_id TYPE TEXT USING vehicle_id::text;
        END IF;
    END IF;
END $$;

-- 3. CREATE ROBUST "FAIL-SAFE" USER CREATION HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_role TEXT;
    v_username TEXT;
BEGIN
    -- Extract metadata with safe defaults
    v_user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', NEW.email);

    -- 1. Create Profile (Essential)
    BEGIN
        INSERT INTO public.user_profiles (
            id,
            username,
            role,
            tier,
            troll_coins,
            total_earned_coins,
            total_spent_coins,
            avatar_url,
            email,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            v_username,
            v_user_role,
            'Bronze',
            0,
            0,
            0,
            'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username,
            NEW.email,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
        -- We do NOT return NULL here, we continue to try other things
    END;

    -- 2. Grant Starting Credits (Bonus - Fail Safe)
    BEGIN
        INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
        VALUES (NEW.id, 400, 'Building', 0, NOW())
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Credit creation failed for user %: %', NEW.id, SQLERRM;
    END;

    -- 3. Grant Starter Vehicle (Bonus - Fail Safe)
    BEGIN
        -- Check if vouchers table exists first to avoid errors
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_vouchers') THEN
            INSERT INTO public.user_vouchers (
                user_id,
                voucher_type,
                item_id,
                item_name,
                description,
                is_active
            )
            VALUES (
                NEW.id,
                'vehicle',
                'ac8121bd-0320-45eb-8b3c-7d9b445c7b38', -- Default starter car ID
                'Free Starter Vehicle',
                'Welcome voucher for a free starter vehicle.',
                true
            )
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Voucher grant failed for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- 4. ATTACH SINGLE SAFE TRIGGER
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 5. UPDATE DEPENDENT FUNCTIONS TO USE TEXT
CREATE OR REPLACE FUNCTION public.add_owned_vehicle_to_profile(p_vehicle_id TEXT) 
RETURNS JSONB
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public', 'extensions' 
AS $$
DECLARE
    v_user_id UUID;
    v_owned_ids JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    UPDATE public.user_profiles
    SET owned_vehicle_ids = (
        SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
        FROM jsonb_array_elements(coalesce(owned_vehicle_ids, '[]'::jsonb) || to_jsonb(p_vehicle_id)) AS e(elem)
    )
    WHERE id = v_user_id
    RETURNING owned_vehicle_ids INTO v_owned_ids;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found for id %', v_user_id; END IF;
    
    RETURN jsonb_build_object('owned_vehicle_ids', v_owned_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_owned_vehicle_to_profile(TEXT) TO authenticated;
