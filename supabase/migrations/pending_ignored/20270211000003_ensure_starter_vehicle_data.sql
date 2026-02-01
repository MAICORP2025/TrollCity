-- Migration: Ensure vehicles_catalog has seed data and fix starter vehicle grant
-- This ensures new users get a starter vehicle on signup

-- 1. Ensure vehicles_catalog has at least one vehicle (the starter car)
-- Using ON CONFLICT to avoid duplicates
INSERT INTO public.vehicles_catalog 
(name, slug, tier, style, price, speed, armor, color_from, color_to, image_url, model_url, category) 
VALUES
('Troll Compact S1', 'troll_compact_s1', 'Starter', 'Compact modern starter sedan', 5000, 40, 20, '#38bdf8', '#22c55e', '/assets/cars/troll_compact_s1.png', '/models/vehicles/troll_compact_s1.glb', 'Car')
ON CONFLICT (name) DO NOTHING;

-- Also insert other vehicles if they don't exist
INSERT INTO public.vehicles_catalog 
(name, slug, tier, style, price, speed, armor, color_from, color_to, image_url, model_url, category) 
VALUES
('Midline XR', 'midline_xr', 'Mid', 'Mid-size SUV / crossover', 12000, 60, 35, '#fbbf24', '#f87171', '/assets/cars/midline_xr.png', '/models/vehicles/midline_xr.glb', 'Car'),
('Urban Drift R', 'urban_drift_r', 'Mid', 'Aggressive street tuner coupe', 18000, 75, 30, '#a855f7', '#ec4899', '/assets/cars/urban_drift_r.png', '/models/vehicles/urban_drift_r.glb', 'Car'),
('Ironclad GT', 'ironclad_gt', 'Luxury', 'Heavy luxury muscle car', 45000, 85, 60, '#94a3b8', '#475569', '/assets/cars/ironclad_gt.png', '/models/vehicles/ironclad_gt.glb', 'Car'),
('Vanta LX', 'vanta_lx', 'Luxury', 'High-end performance motorcycle', 60000, 92, 35, '#1e293b', '#000000', '/assets/cars/vanta_lx.png', '/models/vehicles/vanta_lx.glb', 'Car'),
('Phantom X', 'phantom_x', 'Super', 'Stealth supercar', 150000, 110, 40, '#4c1d95', '#8b5cf6', '/assets/cars/phantom_x.png', '/models/vehicles/phantom_x.glb', 'Car'),
('Obsidian One Apex', 'obsidian_one_apex', 'Elite / Hyper', 'Ultra-elite hypercar', 180000, 120, 45, '#111827', '#0f172a', '/assets/cars/vehicle_1_original.png', '/models/vehicles/obsidian_one_apex.glb', 'Car'),
('Titan Enforcer', 'titan_enforcer', 'Legendary / Armored', 'Heavily armored enforcement vehicle', 500000, 60, 100, '#0b0f1a', '#111827', '/assets/cars/vehicle_2_original.png', '/models/vehicles/titan_enforcer.glb', 'Car'),
('Neon Hatch S', 'neon_hatch_s', 'Street', 'Compact hatchback for city runs', 8000, 48, 22, '#22d3ee', '#3b82f6', '/assets/cars/vehicle_3_original.png', '/models/vehicles/neon_hatch_s.glb', 'Car'),
('Courier Spark Bike', 'courier_spark_bike', 'Street', 'Delivery bike built for fast runs', 7000, 55, 16, '#f59e0b', '#f97316', '/assets/cars/vehicle_4_original.png', '/models/vehicles/courier_spark_bike.glb', 'Car'),
('Apex Trail SUV', 'apex_trail_suv', 'Mid', 'Sport SUV with rugged stance', 22000, 70, 45, '#60a5fa', '#1d4ed8', '/assets/cars/vehicle_5_original.png', '/models/vehicles/apex_trail_suv.glb', 'Car'),
('Quantum Veil', 'quantum_veil', 'Super', 'Experimental prototype hypercar', 220000, 130, 38, '#7c3aed', '#ec4899', '/assets/cars/vehicle_6_original.png', '/models/vehicles/quantum_veil.glb', 'Car'),
('Driftline Pulse Bike', 'driftline_pulse_bike', 'Mid', 'Drift-ready performance bike', 16000, 78, 20, '#06b6d4', '#3b82f6', '/assets/cars/vehicle_7_original.png', '/models/vehicles/driftline_pulse_bike.glb', 'Car'),
('Regal Meridian', 'regal_meridian', 'Luxury', 'Executive luxury sedan', 85000, 88, 50, '#0f172a', '#334155', '/assets/cars/vehicle_8_original.png', '/models/vehicles/regal_meridian.glb', 'Car'),
('Luxe Voyager', 'luxe_voyager', 'Luxury', 'Luxury cruiser bike', 78000, 86, 32, '#1f2937', '#111827', '/assets/cars/vehicle_1_original.png', '/models/vehicles/luxe_voyager.glb', 'Car'),
('Eclipse Seraph', 'eclipse_seraph', 'Super', 'Exotic supercar', 260000, 138, 42, '#312e81', '#9333ea', '/assets/cars/vehicle_2_original.png', '/models/vehicles/eclipse_seraph.glb', 'Car')
ON CONFLICT (name) DO NOTHING;

-- 2. Verify the grant_starter_vehicle function exists and works
-- If it doesn't exist, recreate it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_starter_vehicle') THEN
        CREATE OR REPLACE FUNCTION public.grant_starter_vehicle(p_user_id UUID)
        RETURNS UUID
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_starter_car RECORD;
            v_new_car_id UUID;
        BEGIN
            -- Find the starter car from vehicles_catalog
            -- Using case-insensitive search for 'Starter' tier
            SELECT * INTO v_starter_car
            FROM public.vehicles_catalog
            WHERE LOWER(tier) = LOWER('Starter')
            ORDER BY price ASC
            LIMIT 1;

            -- If no starter car found with 'Starter' tier, try to find the cheapest car
            IF NOT FOUND THEN
                SELECT * INTO v_starter_car
                FROM public.vehicles_catalog
                ORDER BY price ASC
                LIMIT 1;
            END IF;

            -- If still no car found, raise an error
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Starter vehicle not found in vehicles_catalog';
            END IF;

            -- Insert the starter car for the user
            INSERT INTO public.user_cars (
                user_id,
                car_id,
                model_url,
                customization_json,
                is_active
            ) VALUES (
                p_user_id,
                v_starter_car.slug,
                v_starter_car.model_url,
                jsonb_build_object(
                    'color', v_starter_car.color_from,
                    'car_model_id', v_starter_car.id,
                    'source', 'starter_grant'
                ),
                false
            )
            RETURNING id INTO v_new_car_id;

            -- If this is the user's first car, make it active
            IF NOT EXISTS (SELECT 1 FROM public.user_cars WHERE user_id = p_user_id AND is_active = true) THEN
                UPDATE public.user_cars SET is_active = true WHERE id = v_new_car_id;
            END IF;

            RETURN v_new_car_id;
        END;
        $$;
        
        -- Grant execute permission to authenticated users
        GRANT EXECUTE ON FUNCTION public.grant_starter_vehicle(UUID) TO authenticated;
    END IF;
END $$;

-- 3. Ensure the trigger for handle_new_user_credit exists
DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
CREATE TRIGGER on_auth_user_created_credit
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_credit();

-- 4. Verify trigger function exists (recreate if needed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user_credit') THEN
        CREATE OR REPLACE FUNCTION public.handle_new_user_credit()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, extensions
        AS $$
        BEGIN
            -- Create user credit record
            INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
            VALUES (
                NEW.id,
                400, -- Default starting score
                'Building', -- Default tier
                0, -- No trend yet
                NOW()
            )
            ON CONFLICT (user_id) DO NOTHING;

            -- Grant starter vehicle (this will not fail if it can't find one, it will just log a warning)
            BEGIN
                PERFORM public.grant_starter_vehicle(NEW.id);
            EXCEPTION WHEN OTHERS THEN
                -- Log the error but don't fail user creation
                RAISE WARNING 'Could not grant starter vehicle for user %: %', NEW.id, SQLERRM;
            END;

            RETURN NEW;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail auth user creation
            RAISE WARNING 'Error in handle_new_user_credit for %: %', NEW.id, SQLERRM;
            RETURN NEW;
        END;
        $$;
    END IF;
END $$;

-- 5. Test: Grant starter vehicle to a specific user (for testing)
-- Usage: SELECT public.grant_starter_vehicle('user-uuid-here');
