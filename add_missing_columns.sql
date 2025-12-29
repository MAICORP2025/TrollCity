-- Add missing Troll_coins column to user_profiles table
DO $$
BEGIN
  -- Add Troll_coins column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'Troll_coins') THEN
    ALTER TABLE user_profiles ADD COLUMN Troll_coins INTEGER DEFAULT 0 CHECK (Troll_coins >= 0);
    RAISE NOTICE 'Added Troll_coins column to user_profiles';
  ELSE
    RAISE NOTICE 'Troll_coins column already exists';
  END IF;
  
  -- Also ensure troll_coins exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'troll_coins') THEN
    ALTER TABLE user_profiles ADD COLUMN troll_coins INTEGER DEFAULT 0 CHECK (troll_coins >= 0);
    RAISE NOTICE 'Added troll_coins column to user_profiles';
  ELSE
    RAISE NOTICE 'troll_coins column already exists';
  END IF;
END $$;