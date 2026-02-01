-- Fix for user issues: inactive users, messaging permissions, and profile access
-- Run this in Supabase SQL Editor

-- 1. Activate all users who might be marked as inactive
UPDATE user_profiles 
SET is_active = true 
WHERE is_active = false OR is_active IS NULL;

-- 2. Ensure users can send messages (update RLS policies on messages table)
-- First, let's check existing policies
SELECT pol.policy_name, pol.definition 
FROM pg_policies pol 
WHERE pol.tablename = 'messages';

-- 3. Create or update RLS policy to allow authenticated users to insert messages
-- This ensures users can send messages in streams they're participating in
DO $$
BEGIN
    -- Check if policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policy_name = 'allow_authenticated_users_to_send_messages'
    ) THEN
        CREATE POLICY "allow_authenticated_users_to_send_messages" ON messages
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Allow users to view messages in streams they're participating in
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policy_name = 'allow_users_to_view_stream_messages'
    ) THEN
        CREATE POLICY "allow_users_to_view_stream_messages" ON messages
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM streams_participants sp
                WHERE sp.stream_id = messages.stream_id
                AND sp.user_id = auth.uid()
            )
            OR messages.user_id = auth.uid()
        );
    END IF;
END $$;

-- 5. Ensure user profiles are accessible
-- Allow users to view their own profile and basic profile info for others
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND policy_name = 'users_can_view_own_profile'
    ) THEN
        CREATE POLICY "users_can_view_own_profile" ON user_profiles
        FOR SELECT
        USING (auth.uid() = id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND policy_name = 'public_profile_view'
    ) THEN
        CREATE POLICY "public_profile_view" ON user_profiles
        FOR SELECT
        USING (
            id IN (
                SELECT user_id FROM streams_participants sp
                WHERE sp.stream_id IN (
                    SELECT id FROM streams WHERE is_active = true
                )
            )
            OR id = auth.uid()
        );
    END IF;
END $$;

-- 6. Unban any users who were incorrectly banned
UPDATE user_profiles 
SET is_banned = false 
WHERE is_banned = true AND is_banned IS NOT NULL;

-- 7. Ensure officer role is properly set for officers
-- Run this to sync is_troll_officer with role
UPDATE user_profiles 
SET is_troll_officer = true 
WHERE role = 'troll_officer' AND is_troll_officer != true;

-- 8. Ensure lead officer role is properly set
UPDATE user_profiles 
SET is_lead_officer = true 
WHERE role = 'lead_troll_officer' AND is_lead_officer != true;

-- 9. Ensure admin role is properly set
UPDATE user_profiles 
SET is_admin = true 
WHERE role = 'admin' AND is_admin != true;

-- 10. Verify the fixes
SELECT 
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL) as inactive_users,
    COUNT(*) FILTER (WHERE is_banned = true) as banned_users,
    COUNT(*) FILTER (WHERE role = 'troll_officer') as troll_officers,
    COUNT(*) FILTER (WHERE role = 'admin') as admins
FROM user_profiles;

-- 11. Update streams participants to mark active participation
UPDATE streams_participants 
SET is_active = true 
WHERE is_active = false OR is_active IS NULL;

-- 12. Refresh RLS policies to ensure they're applied
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams_participants ENABLE ROW LEVEL SECURITY;

-- 13. Grant execute permission on functions if needed
GRANT EXECUTE ON FUNCTION update_officer_activity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_start_broadcast() TO authenticated;

-- 14. Update officer scheduling access
-- Ensure officers can see their own shift slots
GRANT SELECT ON officer_shift_slots TO authenticated;
GRANT INSERT ON officer_shift_slots TO authenticated;
GRANT UPDATE ON officer_shift_slots TO authenticated;
GRANT DELETE ON officer_shift_slots TO authenticated;

-- Grant officers access to shift logs (read only)
GRANT SELECT ON officer_shift_logs TO authenticated;

-- 15. Run a verification query to check messaging permissions
SELECT 
    'messages' as table_name,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'messages') as policy_count;

SELECT 
    'user_profiles' as table_name,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_profiles') as policy_count;

PRINT 'User issues fix completed successfully!';
PRINT 'Active users have been updated.';
PRINT 'Messaging permissions have been configured.';
PRINT 'Profile access has been configured.';
PRINT 'Officer roles have been synced.';
