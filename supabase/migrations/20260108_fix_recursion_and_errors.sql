-- Fix System Errors and User Profiles Recursion
-- Date: 2026-01-08

-- ==========================================
-- 1. Fix system_errors table (Missing context column)
-- ==========================================

-- Ensure table exists
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

-- Safely add 'context' column if it's missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'context'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN context jsonb;
  END IF;
END $$;

-- Enable RLS for system_errors
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anon) to report errors
DROP POLICY IF EXISTS "Public can insert errors" ON public.system_errors;
CREATE POLICY "Public can insert errors" ON public.system_errors FOR INSERT WITH CHECK (true);

-- Allow admins to view/manage errors
DROP POLICY IF EXISTS "Admins can view errors" ON public.system_errors;
CREATE POLICY "Admins can view errors" ON public.system_errors FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- ==========================================
-- 2. Fix Infinite Recursion in user_profiles
-- ==========================================

-- Drop ALL existing policies on user_profiles to ensure a clean slate.
-- We list many known policy names to be thorough.
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

-- Create SAFE, NON-RECURSIVE policies

-- 1. SELECT: Public access (prevents recursion because it doesn't check role)
CREATE POLICY "Anyone can view user profiles"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- 2. UPDATE: Owner only (checks ID against auth.uid(), safe)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 3. INSERT: Owner only (for signups) + Service Role
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

