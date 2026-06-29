-- Diagnostic 2: Check your actual profile and test RLS visibility
-- Run this while logged in as your admin user in the app (via browser console)
-- OR run in SQL Editor to check the profile data directly

-- Find your admin user's profile (replace with your actual user UUID or email)
SELECT id, role, is_admin, is_superadmin, is_ceo, username, email
FROM user_profiles
WHERE role IN ('admin', 'superadmin', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary')
   OR is_admin = true
ORDER BY created_at DESC
LIMIT 10;

-- Check ALL responses that exist
SELECT COUNT(*) as total_responses FROM survey_responses;

-- Check responses with survey info
SELECT sr.id, sr.survey_id, sr.user_id, sr.submitted_at, ws.title
FROM survey_responses sr
JOIN weekly_surveys ws ON ws.id = sr.survey_id
ORDER BY sr.submitted_at DESC
LIMIT 10;

-- Check if RLS is actually enabled on survey_responses
SELECT tablename, rowsecurity, rowsecurityforced 
FROM pg_tables 
WHERE tablename IN ('survey_responses', 'weekly_surveys');
