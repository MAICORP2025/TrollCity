-- Fix UUID error for insurance_id and RLS for notifications
-- Run this in your Supabase SQL Editor

-- 1. Fix user_insurances.insurance_id type (UUID -> TEXT)
DO $$ 
BEGIN
  -- Drop constraint if exists to allow type change (referencing insurance_options.id which is TEXT)
  ALTER TABLE IF EXISTS user_insurances 
  DROP CONSTRAINT IF EXISTS user_insurances_insurance_id_fkey;

  -- Change column type
  ALTER TABLE user_insurances 
  ALTER COLUMN insurance_id TYPE TEXT;

  -- Re-add foreign key if insurance_options exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insurance_options') THEN
    ALTER TABLE user_insurances
    ADD CONSTRAINT user_insurances_insurance_id_fkey 
    FOREIGN KEY (insurance_id) REFERENCES insurance_options(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Fix Notifications RLS
-- Allow authenticated users (and system) to insert notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;

-- Create a broad policy to allow inserts (logic should be handled by app/triggers)
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- 3. Ensure user_insurances allows inserts
DROP POLICY IF EXISTS "Users can insert their own insurances" ON user_insurances;
DROP POLICY IF EXISTS "insurance_insert" ON user_insurances;

CREATE POLICY "insurance_insert" ON user_insurances 
FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
