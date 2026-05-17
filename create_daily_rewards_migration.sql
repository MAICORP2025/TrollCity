-- Migration: Create daily_rewards table for tracking daily reward claims
-- This tracks when users claim broadcaster and viewer rewards

-- Create daily_rewards table
CREATE TABLE IF NOT EXISTS daily_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('broadcaster_daily', 'viewer_daily')),
  date DATE NOT NULL,  -- Calendar date (YYYY-MM-DD)
  broadcast_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'public_pool',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint: one reward per user per type per day
  UNIQUE(user_id, reward_type, date)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_date 
  ON daily_rewards(user_id, reward_type, date);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_date 
  ON daily_rewards(date);

-- Add RLS policies
ALTER TABLE daily_rewards ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own daily rewards
CREATE POLICY "Users can view own daily rewards" ON daily_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Allow service role to insert (for background jobs)
CREATE POLICY "Service role can manage daily rewards" ON daily_rewards
  FOR ALL USING (auth.role() = 'service_role');

-- Add settings using admin_app_settings table (has setting_key as PK)
-- Using admin_app_settings since it has proper primary key on setting_key

-- Broadcaster reward settings
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('broadcaster_daily_reward_enabled', 'true'::jsonb, 'Enable/disable broadcaster daily rewards')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('broadcaster_daily_reward_amount', '25'::jsonb, 'Coins rewarded to broadcasters')
ON CONFLICT (setting_key) DO NOTHING;

-- Viewer reward settings
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('viewer_daily_reward_enabled', 'true'::jsonb, 'Enable/disable viewer daily rewards')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('viewer_daily_reward_amount', '10'::jsonb, 'Coins rewarded to viewers')
ON CONFLICT (setting_key) DO NOTHING;

-- Public Pool threshold settings
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('daily_reward_pool_threshold', '10000'::jsonb, 'Pool level to trigger fail-safe')
ON CONFLICT (setting_key) DO NOTHING;

-- Fallback percentage when pool is low
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('daily_reward_pool_reduction_pct', '50'::jsonb, 'Percentage reduction when pool low')
ON CONFLICT (setting_key) DO NOTHING;

-- Minimum account age (in hours) for viewer rewards
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('viewer_reward_min_account_age_hours', '24'::jsonb, 'Minimum account age for viewer rewards (hours)')
ON CONFLICT (setting_key) DO NOTHING;

-- Minimum broadcast duration (in seconds) for broadcaster reward
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('broadcaster_reward_min_duration_seconds', '60'::jsonb, 'Min broadcast duration for reward (seconds)')
ON CONFLICT (setting_key) DO NOTHING;

-- Minimum viewer stay duration (in seconds) for viewer reward
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('viewer_reward_min_stay_seconds', '30'::jsonb, 'Min viewer stay for reward (seconds)')
ON CONFLICT (setting_key) DO NOTHING;

-- Fail-safe mode: 'disable' or 'reduce'
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('daily_reward_fail_safe_mode', '"reduce"'::jsonb, 'Fail-safe mode when pool is low')
ON CONFLICT (setting_key) DO NOTHING;

-- Initial public pool balance
INSERT INTO admin_app_settings (setting_key, setting_value, description)
VALUES 
  ('public_pool_balance', '1000000'::jsonb, 'Current public pool balance for rewards')
ON CONFLICT (setting_key) DO NOTHING;

-- Update comment
COMMENT ON TABLE daily_rewards IS 'Tracks daily reward claims for broadcasters and viewers. Used to prevent duplicate rewards and enforce one-per-day limits.';
