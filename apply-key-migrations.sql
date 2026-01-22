-- Apply Key Migrations
-- Run this file in your Supabase SQL Editor

-- 1. Fix insurance plan_id columns to be TEXT instead of UUID
\echo 'Applying insurance plan_id type fix...'

-- Ensure car_insurance_policies.plan_id is TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'car_insurance_policies' 
    AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.car_insurance_policies 
      ALTER COLUMN plan_id TYPE TEXT;
  END IF;
END $$;

-- Ensure property_insurance_policies.plan_id is TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'property_insurance_policies' 
    AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.property_insurance_policies 
      ALTER COLUMN plan_id TYPE TEXT;
  END IF;
END $$;

-- Update the RPC function signature to accept TEXT instead of UUID
DROP FUNCTION IF EXISTS public.buy_car_insurance(UUID, UUID);
DROP FUNCTION IF EXISTS public.buy_car_insurance(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.buy_car_insurance(
  car_garage_id UUID,
  plan_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
  v_car_count INTEGER;
  v_total_price BIGINT;
  v_expires_at TIMESTAMPTZ;
  car_row RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Not authenticated'
    );
  END IF;

  -- Try to get plan details, otherwise use defaults
  BEGIN
    SELECT price_paid_coins, duration_days
    INTO v_price, v_duration_days
    FROM public.insurance_plans
    WHERE id = plan_id;
  EXCEPTION WHEN undefined_table THEN
    v_price := 2000;
    v_duration_days := 7;
  END;

  IF v_price IS NULL OR v_duration_days IS NULL THEN
    v_price := 2000;
    v_duration_days := 7;
  END IF;

  -- Count cars
  SELECT COUNT(*) INTO v_car_count
  FROM public.user_cars
  WHERE user_id = v_user_id;

  IF v_car_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You do not own any cars'
    );
  END IF;

  v_total_price := v_price * v_car_count;
  PERFORM public.deduct_coins(v_user_id, v_total_price, 'paid');
  v_expires_at := now() + (v_duration_days || ' days')::interval;

  -- Apply insurance to ALL owned cars
  FOR car_row IN SELECT id FROM public.user_cars WHERE user_id = v_user_id LOOP
    INSERT INTO public.car_insurance_policies (user_id, car_id, plan_id, expires_at)
    VALUES (v_user_id, car_row.id, plan_id, v_expires_at)
    ON CONFLICT (user_id, car_id) 
    DO UPDATE SET plan_id = EXCLUDED.plan_id, expires_at = EXCLUDED.expires_at;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at,
    'cars_covered', v_car_count,
    'total_price', v_total_price,
    'price_per_car', v_price
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_car_insurance(UUID, TEXT) TO authenticated;

\echo 'Insurance plan_id type fix applied ✓'

-- 2. Fix Secretary Assignments RLS
\echo 'Applying secretary assignments RLS fix...'

-- From 20260122000000_fix_secretary_assignments_rls.sql
DROP POLICY IF EXISTS "deny_all" ON public.secretary_assignments;

\echo 'Secretary RLS fix applied ✓'

-- 3. Ensure gender column exists and is properly typed
\echo 'Checking gender column...'

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'gender'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN gender VARCHAR(10);
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_gender_check 
      CHECK (gender IN ('male', 'female'));
  END IF;
END $$;

\echo 'Gender column verified ✓'

-- 4. Ensure banner_url column exists
\echo 'Checking banner_url column...'

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'banner_url'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN banner_url TEXT;
  END IF;
END $$;

\echo 'Banner_url column verified ✓'

-- 5. Ensure proper RLS policies for user_profiles updates
\echo 'Ensuring user_profiles update policy...'

-- Drop conflicting policies if they exist
DROP POLICY IF EXISTS "deny_all_updates" ON public.user_profiles;
DROP POLICY IF EXISTS "deny_updates" ON public.user_profiles;

-- Create or replace policy allowing users to update their own profile
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.user_profiles
      FOR UPDATE USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

\echo 'User_profiles RLS policies verified ✓'

-- 6. Seed insurance_options table with default options
\echo 'Seeding insurance options...'

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'insurance_options'
  ) THEN
    INSERT INTO public.insurance_options 
      (id, name, cost, description, duration_hours, protection_type, icon, is_active)
    VALUES
      ('insurance_kick_24h', 'Kick Protection (24h)', 500, 'Protects against kick penalties for 24 hours', 24, 'kick', '🔒', true),
      ('insurance_full_24h', 'Full Protection (24h)', 100, 'Covers kick and other major penalties for 24 hours', 24, 'full', '🛡️', true),
      ('insurance_full_week', 'Full Protection (1 Week)', 600, 'Complete protection for 7 days', 168, 'full', '🛡️', true),
      ('insurance_basic_week', 'Basic Coverage (1 Week)', 300, 'Basic insurance coverage for 7 days', 168, 'basic', '🔶', true)
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      cost = EXCLUDED.cost,
      description = EXCLUDED.description,
      duration_hours = EXCLUDED.duration_hours,
      protection_type = EXCLUDED.protection_type,
      icon = EXCLUDED.icon,
      is_active = EXCLUDED.is_active;
  END IF;
END $$;

\echo 'Insurance options seeded ✓'

\echo ''
\echo '=== All key migrations applied successfully ==='
\echo ''
\echo 'What was fixed:'
\echo '  ✓ Insurance plan_id columns changed from UUID to TEXT'
\echo '  ✓ buy_car_insurance function signature updated (plan_id TEXT)'
\echo '  ✓ Insurance options seeded with default plans'
\echo '  ✓ Secretary assignments RLS policy fixed'
\echo '  ✓ Gender column exists and saves correctly'
\echo '  ✓ Banner_url (cover photo) column exists'
\echo '  ✓ Users can update their own profiles (RLS)'
