-- Neighborhood System Database Schema
-- Run this SQL to set up the neighborhood tables

-- 1. Neighborhoods table
CREATE TABLE IF NOT EXISTS neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  officer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Neighborhood Members table
CREATE TABLE IF NOT EXISTS neighborhood_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('leader', 'member', 'follower')) DEFAULT 'follower',
  house_id UUID,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(neighborhood_id, user_id)
);

-- 3. Houses table
CREATE TABLE IF NOT EXISTS houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID REFERENCES neighborhoods(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  upgrade_level INTEGER DEFAULT 1,
  condition INTEGER DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  is_reposessed BOOLEAN DEFAULT FALSE,
  electric_on BOOLEAN DEFAULT FALSE,
  water_on BOOLEAN DEFAULT FALSE,
  internet_on BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. House Upgrades table
CREATE TABLE IF NOT EXISTS house_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  upgrade_type TEXT NOT NULL,
  cost INTEGER NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. House Loans table
CREATE TABLE IF NOT EXISTS house_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  monthly_payment INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  default_at TIMESTAMPTZ
);

-- 6. Vehicles table (extended from existing)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_name TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  plate_number TEXT,
  plate_status TEXT CHECK (plate_status IN ('none', 'active', 'suspended')) DEFAULT 'none',
  loan_id UUID,
  insurance_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Vehicle Loans table
CREATE TABLE IF NOT EXISTS vehicle_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  monthly_payment INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  default_at TIMESTAMPTZ,
  cashout_hold_until TIMESTAMPTZ
);

-- 8. Driver Tests table
CREATE TABLE IF NOT EXISTS driver_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  test_date TIMESTAMPTZ DEFAULT NOW(),
  license_number TEXT
);

-- 9. User Licenses table
CREATE TABLE IF NOT EXISTS user_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  license_number TEXT NOT NULL UNIQUE,
  status TEXT CHECK (status IN ('active', 'suspended', 'none')) DEFAULT 'none',
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  suspended_until TIMESTAMPTZ,
  reports_count_week INTEGER DEFAULT 0,
  arrests_count_week INTEGER DEFAULT 0
);

-- 10. Neighborhood Invites table
CREATE TABLE IF NOT EXISTS neighborhood_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leader_user_id, follower_user_id)
);

-- 11. House Raids table
CREATE TABLE IF NOT EXISTS house_raids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  raided_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  damage_level TEXT CHECK (damage_level IN ('minor', 'major', 'destroyed')) DEFAULT 'minor',
  raided_at TIMESTAMPTZ DEFAULT NOW(),
  repaired_at TIMESTAMPTZ
);

-- 12. Homeowners Insurances table
CREATE TABLE IF NOT EXISTS homeowners_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  deductible_paid INTEGER DEFAULT 0
);

-- 13. Car Insurances table
CREATE TABLE IF NOT EXISTS car_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  deductible_paid INTEGER DEFAULT 0
);

-- 14. Broadcast Insurances table
CREATE TABLE IF NOT EXISTS broadcast_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
   expires_at TIMESTAMPTZ NOT NULL,
   coverage_type TEXT CHECK (coverage_type IN ('raid_damage', 'vandalism', 'all')) DEFAULT 'all'
 );

 -- Add missing columns to existing tables (for schema updates)
ALTER TABLE houses ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add new columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS neighborhood_id UUID;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS house_id UUID;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vehicle_id UUID;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS license_id UUID;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS troll_avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS drivers_test_passed BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS homeowners_insurance_expiry TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS car_insurance_expiry TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS license_plate TEXT;

-- Enable RLS
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_raids ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowners_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_insurances ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic owner access)
CREATE POLICY "Users can view own neighborhood" ON neighborhoods FOR SELECT USING (leader_user_id = auth.uid());
CREATE POLICY "Users can view own membership" ON neighborhood_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own house" ON houses FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "Users can view own vehicle" ON vehicles FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "Users can view own license" ON user_licenses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own driver tests" ON driver_tests FOR SELECT USING (user_id = auth.uid());

-- Update house condition function
CREATE OR REPLACE FUNCTION update_house_condition(house_id UUID, condition_change INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE houses 
  SET condition = GREATEST(0, LEAST(100, condition + condition_change))
  WHERE id = house_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_neighborhood_members_user ON neighborhood_members(user_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_members_neighborhood ON neighborhood_members(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_houses_owner ON houses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_house_raids_house ON house_raids(house_id);
