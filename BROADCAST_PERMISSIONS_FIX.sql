-- BROADCAST PERMISSIONS FIX
-- This file contains all necessary database changes for the broadcast permissions system

-- ============================================
-- 1. Ensure broadcast_officers table exists
-- ============================================
CREATE TABLE IF NOT EXISTS broadcast_officers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    broadcaster_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(broadcaster_id, officer_id)
);

-- ============================================
-- 2. RLS Policies for broadcast_officers
-- ============================================
ALTER TABLE broadcast_officers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Broadcasters can view their own officers" ON broadcast_officers;
DROP POLICY IF EXISTS "Everyone can view officers" ON broadcast_officers;
DROP POLICY IF EXISTS "Broadcasters can add officers" ON broadcast_officers;
DROP POLICY IF EXISTS "Broadcasters can remove officers" ON broadcast_officers;

-- Create policies
CREATE POLICY "Broadcasters can view their own officers" ON broadcast_officers
    FOR SELECT USING (auth.uid() = broadcaster_id);

CREATE POLICY "Everyone can view officers" ON broadcast_officers
    FOR SELECT USING (true);

CREATE POLICY "Broadcasters can add officers" ON broadcast_officers
    FOR INSERT WITH CHECK (auth.uid() = broadcaster_id);

CREATE POLICY "Broadcasters can remove officers" ON broadcast_officers
    FOR DELETE USING (auth.uid() = broadcaster_id);

-- ============================================
-- 3. RPC Functions for Broadofficer Management
-- ============================================

-- Check if user is broadofficer for a specific broadcaster
CREATE OR REPLACE FUNCTION is_broadofficer(p_broadcaster_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM broadcast_officers
        WHERE broadcaster_id = p_broadcaster_id AND officer_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can manage boxes (broadcaster, broadofficer, or staff)
CREATE OR REPLACE FUNCTION can_manage_stream_boxes(p_broadcaster_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_broadcaster BOOLEAN;
    v_is_broadofficer BOOLEAN;
    v_is_staff BOOLEAN;
BEGIN
    -- Check if user is the broadcaster
    v_is_broadcaster := (p_user_id = p_broadcaster_id);
    
    -- Check if user is a broadofficer
    v_is_broadofficer := EXISTS (
        SELECT 1 FROM broadcast_officers
        WHERE broadcaster_id = p_broadcaster_id AND officer_id = p_user_id
    );
    
    -- Check if user is staff
    v_is_staff := is_stream_staff(p_user_id);
    
    -- Return true if broadcaster, broadofficer, or staff
    RETURN v_is_broadcaster OR v_is_broadofficer OR v_is_staff;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get officers for a broadcaster
CREATE OR REPLACE FUNCTION get_broadofficers(p_broadcaster_id UUID)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT up.id, up.username, up.avatar_url
    FROM broadcast_officers bo
    JOIN user_profiles up ON bo.officer_id = up.id
    WHERE bo.broadcaster_id = p_broadcaster_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign broadofficer (max 10 per broadcaster)
CREATE OR REPLACE FUNCTION assign_broadofficer(p_broadcaster_id UUID, p_officer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_count INT;
BEGIN
    -- Check if requester is the broadcaster
    IF auth.uid() != p_broadcaster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the broadcaster can assign officers');
    END IF;

    -- Check limit
    SELECT COUNT(*) INTO v_count FROM broadcast_officers WHERE broadcaster_id = p_broadcaster_id;
    IF v_count >= 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum 10 officers allowed');
    END IF;

    -- Insert
    INSERT INTO broadcast_officers (broadcaster_id, officer_id)
    VALUES (p_broadcaster_id, p_officer_id)
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove broadofficer
CREATE OR REPLACE FUNCTION remove_broadofficer(p_broadcaster_id UUID, p_officer_id UUID)
RETURNS JSONB AS $$
BEGIN
    -- Check if requester is the broadcaster
    IF auth.uid() != p_broadcaster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the broadcaster can remove officers');
    END IF;

    DELETE FROM broadcast_officers
    WHERE broadcaster_id = p_broadcaster_id AND officer_id = p_officer_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Staff Role Check Functions
-- ============================================

-- Check if user is staff (admin, lead_troll_officer, secretary, pastor, troll_officer)
CREATE OR REPLACE FUNCTION is_stream_staff(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_is_admin BOOLEAN;
BEGIN
    SELECT role, is_admin INTO v_role, v_is_admin FROM user_profiles WHERE id = p_user_id;
    
    RETURN v_is_admin OR v_role IN ('admin', 'lead_troll_officer', 'secretary', 'pastor', 'troll_officer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can use officer tools (broadcaster, staff, or broadofficer for specific broadcast)
CREATE OR REPLACE FUNCTION can_use_officer_tools(p_broadcaster_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_broadcaster BOOLEAN;
    v_is_staff BOOLEAN;
    v_is_broadofficer BOOLEAN;
BEGIN
    v_is_broadcaster := (p_user_id = p_broadcaster_id);
    v_is_staff := is_stream_staff(p_user_id);
    v_is_broadofficer := is_broadofficer(p_broadcaster_id, p_user_id);
    
    RETURN v_is_broadcaster OR v_is_staff OR v_is_broadofficer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Moderation Actions RPC Functions
-- ============================================

-- Kick user from stream
CREATE OR REPLACE FUNCTION kick_user_from_stream(
    p_stream_id UUID,
    p_target_user_id UUID,
    p_kicker_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_broadcaster_id UUID;
BEGIN
    -- Get broadcaster ID
    SELECT broadcaster_id INTO v_broadcaster_id FROM streams WHERE id = p_stream_id;

    -- Check permissions
    IF NOT can_use_officer_tools(v_broadcaster_id, p_kicker_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to kick users');
    END IF;

    UPDATE streams_participants
    SET is_active = false, left_at = NOW()
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mute user in stream
CREATE OR REPLACE FUNCTION mute_user_in_stream(
    p_stream_id UUID,
    p_target_user_id UUID,
    p_minutes INTEGER,
    p_muter_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_mute_until TIMESTAMP WITH TIME ZONE;
    v_broadcaster_id UUID;
BEGIN
    -- Get broadcaster ID
    SELECT broadcaster_id INTO v_broadcaster_id FROM streams WHERE id = p_stream_id;

    -- Check permissions
    IF NOT can_use_officer_tools(v_broadcaster_id, p_muter_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to mute users');
    END IF;

    v_mute_until := NOW() + (p_minutes || ' minutes')::INTERVAL;

    UPDATE streams_participants
    SET can_chat = false, chat_mute_until = v_mute_until
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'mute_until', v_mute_until);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disable user chat
CREATE OR REPLACE FUNCTION disable_user_chat_in_stream(
    p_stream_id UUID,
    p_target_user_id UUID,
    p_muter_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_broadcaster_id UUID;
BEGIN
    -- Get broadcaster ID
    SELECT broadcaster_id INTO v_broadcaster_id FROM streams WHERE id = p_stream_id;

    -- Check permissions
    IF NOT can_use_officer_tools(v_broadcaster_id, p_muter_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to disable chat');
    END IF;

    UPDATE streams_participants
    SET can_chat = false, chat_mute_until = NULL
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove user from seat/box
CREATE OR REPLACE FUNCTION remove_user_from_seat(
    p_seat_index INTEGER,
    p_room_name TEXT,
    p_target_user_id UUID,
    p_remover_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_broadcaster_id UUID;
BEGIN
    -- Try to get broadcaster_id if room name is a stream ID
    -- We cast to text to handle UUID comparison safely, though explicit UUID cast is better if p_room_name is UUID string
    -- If p_room_name is not a valid UUID, the cast in WHERE might fail if we cast p_room_name to UUID.
    -- So we cast id to text.
    SELECT broadcaster_id INTO v_broadcaster_id 
    FROM streams 
    WHERE id::text = p_room_name 
    LIMIT 1;
    
    -- If no stream found, v_broadcaster_id is NULL.
    -- can_use_officer_tools handles NULL broadcaster_id by allowing staff (admin/mods) to proceed.

    -- Check permissions
    IF NOT can_use_officer_tools(v_broadcaster_id, p_remover_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to remove users from seats');
    END IF;

    UPDATE broadcast_seats
    SET user_id = NULL, assigned_at = NULL
    WHERE room = p_room_name AND seat_index = p_seat_index;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_broadcast_officers_broadcaster ON broadcast_officers(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_officers_officer ON broadcast_officers(officer_id);
CREATE INDEX IF NOT EXISTS idx_streams_participants_stream_user ON streams_participants(stream_id, user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_seats_room ON broadcast_seats(room);

-- ============================================
-- 7. Grant execute permissions on functions
-- ============================================
GRANT EXECUTE ON FUNCTION is_broadofficer(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_manage_stream_boxes(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_broadofficers(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION assign_broadofficer(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION remove_broadofficer(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_stream_staff(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_use_officer_tools(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION kick_user_from_stream(UUID, UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION mute_user_in_stream(UUID, UUID, INTEGER, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION disable_user_chat_in_stream(UUID, UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION remove_user_from_seat(INTEGER, TEXT, UUID, UUID) TO PUBLIC;

-- Done
SELECT 'Broadcast permissions fix applied successfully' as result;
