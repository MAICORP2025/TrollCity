-- FORCE FIX DEADLOCK SCRIPT
-- Purpose: Kill blocking processes and apply the critical recursion fix.
-- Run this ENTIRE script in the Supabase SQL Editor.

BEGIN;

-- 1. 🚨 KILL SWITCH: Terminate all other connections accessing user_profiles
-- This breaks the deadlock by stopping the app's infinite retry loop.
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND datname = current_database()
  AND (
    query ILIKE '%user_profiles%' 
    OR query ILIKE '%system_errors%'
    OR state = 'idle in transaction'
  );

-- 2. Fix system_errors (Add context column)
CREATE TABLE IF NOT EXISTS public.system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text,
  stack text,
  user_id uuid,
  url text,
  component text,
  context jsonb,
  status text DEFAULT 'open',
  admin_response text,
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'context'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN context jsonb;
  END IF;
END $$;

ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Reset system_errors policies
DROP POLICY IF EXISTS "Public can insert errors" ON public.system_errors;
CREATE POLICY "Public can insert errors" ON public.system_errors FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view errors" ON public.system_errors;
CREATE POLICY "Admins can view errors" ON public.system_errors FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 3. Fix user_profiles (Drop ALL recursive policies)
DROP POLICY IF EXISTS "Anyone can view user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow everyone to view all user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;

-- 4. Apply SAFE, NON-RECURSIVE policies
CREATE POLICY "Anyone can view user profiles"
  ON public.user_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
