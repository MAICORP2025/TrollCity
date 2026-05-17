-- Add organization_id to user_profiles
-- Created: 2026-04-27
-- Purpose: Link users to their organizations

-- Add organization_id column if it doesn't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization_id);

-- Update RLS policy to allow users to view organization info for themselves
-- (existing policies from user_profiles already handle this via SELECT)

-- Grant update permission on organization_id to authenticated users (for signup/join)
GRANT UPDATE(organization_id) ON user_profiles TO authenticated;
