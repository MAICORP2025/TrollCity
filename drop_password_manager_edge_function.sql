-- Drop the password-manager edge function and related database objects
-- This function is no longer needed since we now use Supabase Auth's built-in
-- password reset flow (resetPasswordForEmail / updateUser)

-- Remove the edge function (if deployed via Supabase CLI, this is done by removing the file)
-- If it was created manually in the dashboard or via SQL, drop it:

-- Note: Supabase Edge Functions are deployed as part of the /supabase/functions directory.
-- Removing the function directory and redeploying is sufficient.
-- The following SQL cleans up any related database objects if they exist:

-- Drop the password reset PIN column from user_profiles if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'reset_pin_hash'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN reset_pin_hash;
    RAISE NOTICE 'Dropped reset_pin_hash column from user_profiles';
  END IF;
END $$;

-- Drop any password_manager related functions
DROP FUNCTION IF EXISTS public.reset_password_via_pin CASCADE;
DROP FUNCTION IF EXISTS public.set_user_reset_pin CASCADE;

-- Drop the password-manager edge function if it was registered in the database
-- (Edge functions are typically managed via the Supabase CLI, but if there's a reference:)
DELETE FROM supabase_functions.functions WHERE name = 'password-manager';

-- Clean up the PIN_SALT environment variable reference (remove from your Supabase dashboard)
-- Go to: Supabase Dashboard > Edge Functions > password-manager > Secrets
-- Remove: PIN_SALT
