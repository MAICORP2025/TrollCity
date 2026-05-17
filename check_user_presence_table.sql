-- ============================================================================
-- PRESENCE SYSTEM FIX: Use correct table for online status
-- ============================================================================
-- Check if user_presence table exists and its structure
-- If it does, we should use it instead of user_profiles.is_online
-- ============================================================================

-- 1. Check if user_presence table exists and its columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_presence'
ORDER BY ordinal_position;

-- 2. If user_presence exists, check sample data
SELECT *
FROM user_presence
ORDER BY last_seen_at DESC
LIMIT 5;

-- 3. Count total records in user_presence
SELECT COUNT(*) FROM user_presence;

-- 4. Check RLS policies on user_presence
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_presence'
ORDER BY policyname;

-- ============================================================================
-- RECOMMENDATION:
-- ============================================================================
-- If user_presence has: user_id, last_seen_at, is_online (or similar)
-- Then we should query THAT table for presence, not user_profiles.
--
-- If user_presence has ONLY recent activity (last 2 minutes), then:
--   SELECT user_id FROM user_presence WHERE last_seen_at > NOW() - INTERVAL '2 minutes'
-- is the correct online query.
--
-- If user_presence is empty or doesn't exist, fall back to user_profiles.is_online.
-- ============================================================================