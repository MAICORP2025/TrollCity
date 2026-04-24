-- Check for all columns used in ProfileSetup
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN (
    'message_cost', 
    'profile_view_cost', 
    'gender', 
    'full_name',
    'bio',
    'avatar_url',
    'banner_url',
    'updated_at'
  );
