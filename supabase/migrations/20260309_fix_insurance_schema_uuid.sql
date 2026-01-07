-- Fix for UUID error in Coin Store
-- The insurance_id column in user_insurances was created as UUID but we use text IDs (e.g. 'insurance_kick_24h')

BEGIN;

  -- 1. Alter the column type to TEXT
  ALTER TABLE user_insurances 
  ALTER COLUMN insurance_id TYPE TEXT;

  -- 2. Add foreign key constraint to insurance_options if it doesn't exist
  -- First drop if exists to be safe
  ALTER TABLE user_insurances DROP CONSTRAINT IF EXISTS user_insurances_insurance_id_fkey;
  
  -- Add the constraint
  ALTER TABLE user_insurances
  ADD CONSTRAINT user_insurances_insurance_id_fkey 
  FOREIGN KEY (insurance_id) 
  REFERENCES insurance_options(id)
  ON DELETE CASCADE;

COMMIT;
