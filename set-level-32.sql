-- Set your level to 32
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID

UPDATE user_levels
SET 
  level = 32,
  xp = 3200,  -- XP for level 32
  total_xp = 49600,  -- Total XP up to level 32
  next_level_xp = 3300,  -- XP required for level 33
  updated_at = NOW()
WHERE user_id = 'YOUR_USER_ID_HERE';

-- Verify the update
SELECT 
  user_id,
  level,
  xp,
  total_xp,
  next_level_xp,
  updated_at
FROM user_levels
WHERE user_id = 'YOUR_USER_ID_HERE';
