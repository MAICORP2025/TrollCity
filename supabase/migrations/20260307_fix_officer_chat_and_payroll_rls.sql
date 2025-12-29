-- Fix RLS policies for officer_chat_messages and officer_monthly_payroll
-- These tables had overly restrictive RLS policies that prevented access

BEGIN;

-- Drop existing restrictive officer_chat_messages policies
DROP POLICY IF EXISTS "Officer chat access" ON officer_chat_messages;
DROP POLICY IF EXISTS "Allow officers and admin to select" ON officer_chat_messages;
DROP POLICY IF EXISTS "Allow officers/admin to insert" ON officer_chat_messages;

-- Rename columns if needed to match frontend expectations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'officer_chat_messages' AND column_name = 'sender_id'
  ) THEN
    ALTER TABLE officer_chat_messages RENAME COLUMN sender_id TO user_id;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'officer_chat_messages' AND column_name = 'content'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'officer_chat_messages' AND column_name = 'message'
  ) THEN
    ALTER TABLE officer_chat_messages RENAME COLUMN content TO message;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create new permissive RLS policies for officer_chat_messages
-- Officers and admins can select
CREATE POLICY "Officer chat select" ON officer_chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role IN ('admin', 'troll_officer')
      OR up.is_admin = true
      OR up.is_troll_officer = true
    )
  )
);

-- Officers and admins can insert their own messages
CREATE POLICY "Officer chat insert" ON officer_chat_messages
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role IN ('admin', 'troll_officer')
      OR up.is_admin = true
      OR up.is_troll_officer = true
    )
  )
);

-- Now handle officer_monthly_payroll view - fix RLS on underlying tables
-- Drop restrictive policies on officer_shift_logs if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own officer shifts" ON officer_shift_logs;
  DROP POLICY IF EXISTS "Officers view own shifts" ON officer_shift_logs;
  DROP POLICY IF EXISTS "Admins view all shifts" ON officer_shift_logs;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Enable RLS if not already
ALTER TABLE officer_shift_logs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for officer_shift_logs
-- Officers can view their own and admins can view all
CREATE POLICY "Officer shift logs view" ON officer_shift_logs
FOR SELECT
USING (
  officer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND (up.role = 'admin' OR up.is_admin = true)
  )
);

-- Also allow user_profiles to be visible for the view join
-- user_profiles should already have a permissive SELECT policy
-- Verify and create if needed
DO $$
BEGIN
  CREATE POLICY "user_profiles view select" ON user_profiles
  FOR SELECT
  USING (true);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;
