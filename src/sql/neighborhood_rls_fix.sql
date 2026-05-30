-- ============================================================
-- RLS FIX: Allow city-wide read access for neighborhood map
-- Run this in Supabase SQL Editor
-- This replaces the old restrictive per-neighborhood policies
-- ============================================================

-- 1. HOUSES: Allow anyone to view all houses (city map needs all properties)
DROP POLICY IF EXISTS "Users can view own house" ON houses;
DROP POLICY IF EXISTS "Neighborhood members can view all houses" ON houses;
DROP POLICY IF EXISTS "Users can update own house" ON houses;
DROP POLICY IF EXISTS "Users can insert houses" ON houses;

CREATE POLICY "Anyone can view all houses" ON houses FOR SELECT
  USING (true);

CREATE POLICY "Users can update own house" ON houses FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert houses" ON houses FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- 2. NEIGHBORHOODS: Allow anyone to view all neighborhoods
DROP POLICY IF EXISTS "Users can view own neighborhood" ON neighborhoods;
DROP POLICY IF EXISTS "Neighborhood members can view neighborhood" ON neighborhoods;

CREATE POLICY "Anyone can view all neighborhoods" ON neighborhoods FOR SELECT
  USING (true);

-- 3. NEIGHBORHOOD_MEMBERS: Allow anyone to view all members
DROP POLICY IF EXISTS "Users can view own membership" ON neighborhood_members;
DROP POLICY IF EXISTS "Neighborhood members can view all members" ON neighborhood_members;

CREATE POLICY "Anyone can view all members" ON neighborhood_members FOR SELECT
  USING (true);

-- 4. USER_PROFILES: Allow anyone to view all profiles (for map owner info)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles'
    AND policyname = 'Anyone can view all profiles'
  ) THEN
    CREATE POLICY "Anyone can view all profiles" ON user_profiles FOR SELECT
      USING (true);
  END IF;
END
$$;

-- 5. USER_LICENSES: Allow anyone to view licenses
DROP POLICY IF EXISTS "Users can view own license" ON user_licenses;

CREATE POLICY "Anyone can view all licenses" ON user_licenses FOR SELECT
  USING (true);

-- 6. VEHICLES: Allow anyone to view vehicles
DROP POLICY IF EXISTS "Users can view own vehicle" ON vehicles;

CREATE POLICY "Anyone can view all vehicles" ON vehicles FOR SELECT
  USING (true);
