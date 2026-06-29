-- Diagnostic: Check survey RLS status and admin access
-- Run this in Supabase SQL Editor to diagnose why responses show 0

-- 1. Check current user's admin status
SELECT 
  auth.uid() as current_user_id,
  up.id,
  up.role,
  up.is_admin,
  up.is_superadmin,
  up.is_ceo
FROM user_profiles up
WHERE up.id = auth.uid();

-- 2. Check all RLS policies on survey_responses
SELECT 
  policyname, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'survey_responses';

-- 3. Check all RLS policies on weekly_surveys
SELECT 
  policyname, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'weekly_surveys';

-- 4. Count total responses (bypass RLS as service_role, or check if visible)
SELECT COUNT(*) as total_responses FROM survey_responses;

-- 5. Check if responses exist for your survey
SELECT id, survey_id, user_id, submitted_at 
FROM survey_responses 
ORDER BY submitted_at DESC 
LIMIT 10;

-- 6. Test: Can current user see responses? (run as authenticated user)
SELECT auth.uid(), COUNT(*) as visible_responses FROM survey_responses;
