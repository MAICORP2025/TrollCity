-- Migration: Add announcement preferences and dismissal tracking
-- Run this in Supabase SQL Editor

-- 1. Add announcements_enabled column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS announcements_enabled boolean DEFAULT true;

-- 2. Add is_dismissed column to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_dismissed boolean DEFAULT false;

-- 3. Add dismissed_at column to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- 4. Update RLS policies to allow users to update their own notifications
-- (Existing policies should already allow this, but let's ensure they work for dismissal)

-- 5. Create index for faster queries on user's undismissed notifications
CREATE INDEX IF NOT EXISTS idx_notifications_undismissed 
ON notifications (user_id) WHERE is_dismissed = false;

-- 6. Update notifications view if exists to include dismissal status
