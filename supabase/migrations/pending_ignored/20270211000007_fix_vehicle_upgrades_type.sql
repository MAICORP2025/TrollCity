-- Fix type mismatch for vehicle_id in vehicle_upgrades and vehicle_listings
-- Previous migrations defined these as INTEGER, but the application logic treats them as TEXT (UUIDs or Slugs)
-- This resolves the "operator does not exist: integer = text" error in update_car_value()

BEGIN;

-- 1. Fix vehicle_upgrades
-- It was defined as INTEGER but needs to match vehicles_catalog.id (UUID) or slug (TEXT)
ALTER TABLE public.vehicle_upgrades 
ALTER COLUMN vehicle_id TYPE TEXT USING vehicle_id::text;

-- 2. Fix vehicle_listings
-- Proactively fixing this as it likely suffers from the same issue
ALTER TABLE public.vehicle_listings 
ALTER COLUMN vehicle_id TYPE TEXT USING vehicle_id::text;

-- 3. Update get_vehicle_details to remove integer casting
CREATE OR REPLACE FUNCTION public.get_vehicle_details(p_car_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_car public.user_cars%ROWTYPE;
    v_upgrades JSONB;
    v_upgrade_total INTEGER := 0;
    v_base_price INTEGER := 0; 
    v_catalog_price INTEGER;
    v_owner_name TEXT;
    v_notary_name TEXT;
    v_car_model_id TEXT;
BEGIN
    SELECT * INTO v_car FROM public.user_cars WHERE id = p_car_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found');
    END IF;

    -- Attempt to get owner name
    SELECT username INTO v_owner_name FROM public.user_profiles WHERE id = v_car.user_id;
    
    -- Attempt to get notary name
    IF v_car.notary_id IS NOT NULL THEN
        SELECT username INTO v_notary_name FROM public.user_profiles WHERE id = v_car.notary_id;
    END IF;

    -- Use car_id directly as text (it stores the slug or UUID)
    v_car_model_id := v_car.car_id;

    -- Fetch Upgrades
    IF v_car_model_id IS NOT NULL THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'upgrade_type', upgrade_type,
                'cost', cost,
                'status', status
            )
        ), COALESCE(SUM(cost), 0)
        INTO v_upgrades, v_upgrade_total
        FROM public.vehicle_upgrades
        WHERE user_id = v_car.user_id 
          AND vehicle_id = v_car_model_id
          AND status = 'installed';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'car', to_jsonb(v_car),
        'owner_username', v_owner_name,
        'notary_username', v_notary_name,
        'upgrades', COALESCE(v_upgrades, '[]'::jsonb),
        'upgrade_value', v_upgrade_total
    );
END;
$$;

-- 4. Overload add_owned_vehicle_to_profile to accept TEXT
CREATE OR REPLACE FUNCTION public.add_owned_vehicle_to_profile(
  p_vehicle_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_owned_ids JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_profiles
  SET owned_vehicle_ids = (
    SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
    FROM jsonb_array_elements(
      coalesce(owned_vehicle_ids, '[]'::jsonb) || to_jsonb(p_vehicle_id)
    ) AS e(elem)
  )
  WHERE id = v_user_id
  RETURNING owned_vehicle_ids INTO v_owned_ids;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for id %', v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'owned_vehicle_ids', v_owned_ids
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_owned_vehicle_to_profile(TEXT) TO authenticated;

-- 5. Update transfer_user_car to remove integer casting and use new text function
CREATE OR REPLACE FUNCTION public.transfer_user_car(
    p_listing_id UUID,
    p_buyer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listing public.vehicle_listings%ROWTYPE;
    v_car public.user_cars%ROWTYPE;
    v_car_model_id TEXT;
BEGIN
    -- Verify listing
    SELECT * INTO v_listing FROM public.vehicle_listings WHERE id = p_listing_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Listing not found');
    END IF;

    -- Check if listing has user_car_id (new system)
    IF v_listing.user_car_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Listing is legacy (no specific car attached)');
    END IF;

    SELECT * INTO v_car FROM public.user_cars WHERE id = v_listing.user_car_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Car not found');
    END IF;

    -- Transfer ownership
    UPDATE public.user_cars
    SET user_id = p_buyer_id,
        is_active = false, 
        title_status = 'draft', 
        notary_id = NULL,
        notarized_at = NULL
    WHERE id = v_listing.user_car_id;

    -- Update vehicle_upgrades
    v_car_model_id := v_car.car_id;
    
    UPDATE public.vehicle_upgrades
    SET user_id = p_buyer_id
    WHERE user_id = v_listing.seller_id
      AND vehicle_id = v_car_model_id;

    -- Update legacy profile array for buyer using the TEXT version
    PERFORM public.add_owned_vehicle_to_profile(v_car.car_id);
    
    -- Remove from seller's legacy profile array
    UPDATE public.user_profiles
    SET owned_vehicle_ids = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(owned_vehicle_ids) elem
        WHERE elem::text <> v_car.car_id
    )
    WHERE id = v_listing.seller_id;

    RETURN jsonb_build_object('success', true, 'message', 'Vehicle transferred successfully');
END;
$$;

COMMIT;
