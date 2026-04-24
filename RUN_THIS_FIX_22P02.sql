-- Fix for Error 22P02: invalid input syntax for type uuid
-- This file fixes the insurance system to use TEXT plan IDs instead of UUID
-- Run this in your Supabase SQL Editor

-- 1. Fix car_insurance_policies.plan_id column type

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'car_insurance_policies' 
    AND column_name = 'plan_id'
    AND data_type != 'text'
  ) THEN
    ALTER TABLE public.car_insurance_policies 
      ALTER COLUMN plan_id TYPE TEXT;
    RAISE NOTICE 'car_insurance_policies.plan_id converted to TEXT ✓';
  ELSE
    RAISE NOTICE 'car_insurance_policies.plan_id already TEXT or column does not exist';
  END IF;
END $$;

-- 2. Fix property_insurance_policies.plan_id column type

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'property_insurance_policies' 
    AND column_name = 'plan_id'
    AND data_type != 'text'
  ) THEN
    ALTER TABLE public.property_insurance_policies 
      ALTER COLUMN plan_id TYPE TEXT;
    RAISE NOTICE 'property_insurance_policies.plan_id converted to TEXT ✓';
  ELSE
    RAISE NOTICE 'property_insurance_policies.plan_id already TEXT or column does not exist';
  END IF;
END $$;

-- 3. Update buy_car_insurance function signature

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

  -- Try to get plan details from insurance_plans, otherwise use defaults
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
  
  -- Deduct coins
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

-- 4. Seed insurance_options with default plans

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
      ('insurance_bankrupt_week', 'Bankruptcy Protection (1 Week)', 300, 'Protects against bankruptcy for 7 days', 168, 'bankrupt', '💰', true)
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      cost = EXCLUDED.cost,
      description = EXCLUDED.description,
      duration_hours = EXCLUDED.duration_hours,
      protection_type = EXCLUDED.protection_type,
      icon = EXCLUDED.icon,
      is_active = EXCLUDED.is_active;
    RAISE NOTICE 'insurance_options table seeded ✓';
  ELSE
    RAISE NOTICE 'insurance_options table does not exist - skipping seed';
  END IF;
END $$;

-- All fixes completed!
-- car_insurance_policies.plan_id: UUID → TEXT
-- property_insurance_policies.plan_id: UUID → TEXT
-- buy_car_insurance function: accepts TEXT plan_id
-- Default insurance options seeded

