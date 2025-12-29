-- Fix user_profiles table columns that are missing for the Home page "New Trollerz" section
-- This migration ensures all columns selected in the Home.tsx loadNewUsers function exist

DO $$
BEGIN
  -- Add tier column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'tier') THEN
    ALTER TABLE user_profiles ADD COLUMN tier TEXT DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'));
  END IF;

  -- Add troll_coins column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'troll_coins') THEN
    ALTER TABLE user_profiles ADD COLUMN troll_coins INTEGER DEFAULT 0 CHECK (troll_coins >= 0);
  END IF;

  -- Add troll_coins column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'troll_coins') THEN
    ALTER TABLE user_profiles ADD COLUMN troll_coins INTEGER DEFAULT 0 CHECK (troll_coins >= 0);
  END IF;

  -- Add role column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
    ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin', 'troll_officer'));
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'created_at') THEN
    ALTER TABLE user_profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add avatar_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT;
  END IF;

  -- Add username column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'username') THEN
    ALTER TABLE user_profiles ADD COLUMN username TEXT UNIQUE;
  END IF;

END $$;