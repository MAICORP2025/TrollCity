-- Check user_levels table for current user
-- Run this in Supabase SQL Editor

-- First, see what data exists
SELECT 
  ul.user_id,
  ul.level,
  ul.xp,
  ul.updated_at,
  up.display_name,
  up.username
FROM user_levels ul
LEFT JOIN user_profiles up ON ul.user_id = up.id
ORDER BY ul.level DESC
LIMIT 10;

-- Check if there's a specific user with level 101
SELECT * FROM user_levels WHERE level = 101;

-- Check all columns in user_levels table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_levels' 
  AND table_schema = 'public';

-- If you need to create a user_levels row for a specific user:
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID
-- INSERT INTO user_levels (user_id, level, xp)
-- VALUES ('YOUR_USER_ID_HERE', 101, 10100)
-- ON CONFLICT (user_id) 
-- DO UPDATE SET level = 101, xp = 10100, updated_at = NOW();
