-- Migration: Add Daily Login Wall Post Tracking
-- Purpose: Track when users have posted to the wall for daily login rewards
-- Date: January 21, 2026

-- Create table to track daily login posts
CREATE TABLE IF NOT EXISTS daily_login_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES troll_wall_posts(id) ON DELETE CASCADE,
  coins_earned INTEGER NOT NULL CHECK (coins_earned >= 0 AND coins_earned <= 100),
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure one post per user per day
  UNIQUE(user_id, DATE(posted_at))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_login_posts_user_id ON daily_login_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_login_posts_post_id ON daily_login_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_daily_login_posts_date ON daily_login_posts(DATE(posted_at));

-- Add column to troll_wall_posts to mark as daily login post (optional, for easy filtering)
ALTER TABLE troll_wall_posts 
ADD COLUMN IF NOT EXISTS is_daily_login_post BOOLEAN DEFAULT FALSE;

-- Create index for filtering daily login posts
CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_daily_login ON troll_wall_posts(is_daily_login_post) 
WHERE is_daily_login_post = TRUE;

-- Function to check if user can post today
CREATE OR REPLACE FUNCTION can_post_daily_login()
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_post_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  SELECT COUNT(*) INTO v_post_count
  FROM daily_login_posts
  WHERE user_id = v_user_id
  AND DATE(posted_at) = CURRENT_DATE;
  
  RETURN v_post_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record daily login post and award coins
CREATE OR REPLACE FUNCTION record_daily_login_post(
  p_post_id UUID,
  p_coins INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_post_exists BOOLEAN;
  v_already_posted BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if post exists
  SELECT EXISTS(
    SELECT 1 FROM troll_wall_posts 
    WHERE id = p_post_id AND user_id = v_user_id
  ) INTO v_post_exists;
  
  IF NOT v_post_exists THEN
    RETURN json_build_object('success', FALSE, 'error', 'Post not found');
  END IF;
  
  -- Check if user already posted today
  SELECT EXISTS(
    SELECT 1 FROM daily_login_posts
    WHERE user_id = v_user_id
    AND DATE(posted_at) = CURRENT_DATE
  ) INTO v_already_posted;
  
  IF v_already_posted THEN
    RETURN json_build_object('success', FALSE, 'error', 'Already posted today');
  END IF;
  
  -- Validate coin amount
  IF p_coins < 0 OR p_coins > 100 THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invalid coin amount');
  END IF;
  
  -- Record the post
  INSERT INTO daily_login_posts (user_id, post_id, coins_earned, posted_at)
  VALUES (v_user_id, p_post_id, p_coins, NOW());
  
  -- Update wall post as daily login
  UPDATE troll_wall_posts
  SET is_daily_login_post = TRUE
  WHERE id = p_post_id;
  
  -- Award coins to user
  UPDATE user_profiles
  SET 
    troll_coins = troll_coins + p_coins,
    total_earned_coins = total_earned_coins + p_coins
  WHERE id = v_user_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'coins_earned', p_coins,
    'message', 'Daily post recorded and coins awarded!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on daily_login_posts table
ALTER TABLE daily_login_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own daily posts
CREATE POLICY IF NOT EXISTS "Users can view own daily posts"
  ON daily_login_posts FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own daily posts (through function)
CREATE POLICY IF NOT EXISTS "Users can insert own daily posts"
  ON daily_login_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION can_post_daily_login TO authenticated;
GRANT EXECUTE ON FUNCTION record_daily_login_post TO authenticated;
