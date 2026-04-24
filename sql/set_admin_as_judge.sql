-- Set admin user as judge
-- Run this SQL to make your user a judge in Troll Court

-- Step 1: Enable is_judge on your profile
UPDATE user_profiles 
SET is_judge = true 
WHERE id = '8dff9f37-21b5-4b8e-adc2-b9286874be1a';

-- Step 2: (Optional) Update active court sessions to set you as judge
-- UPDATE court_sessions 
-- SET judge_id = '8dff9f37-21b5-4b8e-adc2-b9286874be1a', 
--     judge_username = (SELECT username FROM user_profiles WHERE id = '8dff9f37-21b5-4b8e-adc2-b9286874be1a')
-- WHERE status IN ('active', 'live', 'waiting');