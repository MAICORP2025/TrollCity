-- Fix user_profiles RLS policies to allow INSERT operations for signup
-- The service role should bypass RLS, but we need INSERT policies for proper operation

BEGIN;

-- Add INSERT policy for users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Add INSERT policy for service role (used by auth edge function)
CREATE POLICY "Service role can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

COMMIT;