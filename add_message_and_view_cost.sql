-- Add message_cost and profile_view_cost to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS message_cost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_view_cost INTEGER DEFAULT 0;

-- Verify columns exist
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('message_cost', 'profile_view_cost');
