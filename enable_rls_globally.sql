-- 1. Helper Function: is_admin()
-- Checks if the current user is an admin or has high-level privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (
      role = 'admin' 
      OR is_admin = true
      OR role = 'super_admin'
      OR role = 'developer'
    )
  );
$$;

-- 2. Master Policy Application Script
-- This script iterates through ALL tables in the public schema and applies appropriate policies.
-- It attempts to be "safe" by defaulting to Public Read for non-user tables, and Owner Access for user tables.
-- It ALWAYS adds a Service Role and Admin bypass.

DO $$
DECLARE
    t text;
    has_user_id boolean;
    -- Tables that should be PUBLIC READ (everyone can see rows)
    public_read_tables text[] := ARRAY[
        'user_profiles', 'streams', 'troll_posts', 'troll_post_reactions', 'troll_post_gifts',
        'comments', 'marketplace_items', 'system_settings', 'app_settings', 'news', 
        'announcements', 'leaderboards', 'badges', 'broadcast_themes', 'call_sound_catalog',
        'city_districts', 'city_events', 'clan_rewards', 'public_pool_deeds',
        'pod_rooms', 'pod_episodes', 'pod_chat_messages', 'pod_room_participants', 'pod_bans',
        -- Mai Talent
        'mai_talent_auditions', 'mai_talent_votes', 'mai_talent_judges', 'mai_talent_leaderboard',
        -- Battles & Content
        'troll_battles', 'battle_history', 'battle_rewards',
        -- Court (Public Records)
        'court_cases', 'court_sentences', 'court_verdicts', 'court_dockets', 'court_sessions', 'troll_court_cases',
        -- Catalogs & Public Listings
        'vehicles_catalog', 'insurance_options', 'vehicle_listings', 'royal_family_leaderboard',
        'ledger_recent', 'church_sermon_notes'
    ];
    -- Tables that should be PRIVATE (Owner only see their own rows)
    private_tables text[] := ARRAY[
        'user_payment_methods', 'payouts', 'coin_transactions', 'notifications', 
        'inventory', 'user_inventory', 'messages', 'conversations', 'conversation_members',
        'broadcaster_earnings', 'cashout_requests',
        -- User Assets
        'user_cars', 'vehicle_upgrades', 'car_insurance_policies', 'property_insurance_policies',
        'user_perks', 'user_insurances', 'user_active_items', 'user_call_sounds',
        -- Private Requests
        'officer_time_off_requests', 'applications'
    ];
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        
        -- A. Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        RAISE NOTICE 'Enabled RLS on %', t;

        -- B. Service Role Bypass (Always Allow)
        -- Drop first to allow re-running
        EXECUTE format('DROP POLICY IF EXISTS "Service Role Bypass" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Service Role Bypass" ON public.%I USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t, t);

        -- C. Admin Bypass (Always Allow)
        EXECUTE format('DROP POLICY IF EXISTS "Admin Bypass" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Admin Bypass" ON public.%I USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);

        -- D. Determine Policy Strategy
        
        -- Check if table has user_id column
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'user_id') INTO has_user_id;

        IF t = ANY(public_read_tables) THEN
            -- Strategy: Public Read, Owner Write (if user_id exists), Admin Write (already covered)
            
            -- 1. Public Read
            EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Public Read" ON public.%I FOR SELECT USING (true)', t);
            
            -- 2. Owner Write (if user_id exists)
            IF has_user_id THEN
                EXECUTE format('DROP POLICY IF EXISTS "Owner Write" ON public.%I', t);
                EXECUTE format('CREATE POLICY "Owner Write" ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid())', t);
                EXECUTE format('DROP POLICY IF EXISTS "Owner Update" ON public.%I', t);
                EXECUTE format('CREATE POLICY "Owner Update" ON public.%I FOR UPDATE USING (user_id = auth.uid())', t);
                EXECUTE format('DROP POLICY IF EXISTS "Owner Delete" ON public.%I', t);
                EXECUTE format('CREATE POLICY "Owner Delete" ON public.%I FOR DELETE USING (user_id = auth.uid())', t);
            END IF;
            
        ELSIF t = ANY(private_tables) THEN
            -- Strategy: Owner Access Only (Read/Write)
            
            IF has_user_id THEN
                EXECUTE format('DROP POLICY IF EXISTS "Owner Access" ON public.%I', t);
                EXECUTE format('CREATE POLICY "Owner Access" ON public.%I USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t, t);
            ELSE
                -- No user_id but marked private? Default to Admin Only (covered by Admin Bypass)
                -- Maybe add a specific message or just leave it to Admin/Service
                RAISE NOTICE 'Table % is marked private but has no user_id column. Restricted to Admin/Service only.', t;
            END IF;

        ELSIF t = 'properties' THEN
            -- Special Case: properties uses 'owner_user_id'
            EXECUTE format('DROP POLICY IF EXISTS "Owner Access" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Owner Access" ON public.%I USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid())', t, t);
            -- Also allow Public Read for properties? Usually yes, people visit homes.
            EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Public Read" ON public.%I FOR SELECT USING (true)', t);

        ELSE
            -- Strategy: Catch-All (Unknown Tables)
            -- To avoid breaking code, we default to Public Read if no user_id, or Owner Access if user_id.
            
            IF has_user_id THEN
                -- Assume it's user data -> Owner Access
                EXECUTE format('DROP POLICY IF EXISTS "Owner Access" ON public.%I', t);
                EXECUTE format('CREATE POLICY "Owner Access" ON public.%I USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t, t);
                
                -- OPTIONAL: Uncomment to allow public read on unknown user tables (riskier but less breaking)
                -- EXECUTE format('CREATE POLICY "Public Read" ON public.%I FOR SELECT USING (true)', t);
            ELSE
                -- No user_id -> Likely config/system/public data -> Public Read
                EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON public.%I', t);
                EXECUTE format('CREATE POLICY "Public Read" ON public.%I FOR SELECT USING (true)', t);
            END IF;
        END IF;

    END LOOP;
END $$;
