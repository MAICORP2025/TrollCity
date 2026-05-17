-- Add license enforcement fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'none' CHECK (license_status IN ('none', 'active', 'suspended')),
ADD COLUMN IF NOT EXISTS license_strikes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS license_suspended_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS license_restored_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS driver_test_passed_at TIMESTAMPTZ NULL;

-- Update existing records to use new license_status
UPDATE user_profiles
SET license_status = CASE
  WHEN drivers_license_status = 'active' THEN 'active'
  WHEN drivers_license_status = 'suspended' THEN 'suspended'
  ELSE 'none'
END
WHERE license_status = 'none' AND drivers_license_status IS NOT NULL;

-- Ensure car_insurances table has proper structure
ALTER TABLE car_insurances
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS premium_coins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deductible_coins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coverage_level TEXT DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add constraint for insurance status
ALTER TABLE car_insurances DROP CONSTRAINT IF EXISTS car_insurances_status_check;
ALTER TABLE car_insurances ADD CONSTRAINT car_insurances_status_check CHECK (status IN ('active', 'inactive', 'expired'));

-- Create index for active insurance checks
CREATE INDEX IF NOT EXISTS idx_car_insurances_active ON car_insurances(user_id, status, expires_at) WHERE status = 'active';