-- Concurrent Login Detection System
-- This migration adds session tracking to prevent multiple logins from different devices

-- Create active_sessions table to track user sessions
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_session_id ON active_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_active ON active_sessions(is_active);

-- Function to check if user has active sessions on other devices
CREATE OR REPLACE FUNCTION check_concurrent_login(
    p_user_id UUID,
    p_current_session_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    active_session_count INTEGER;
    user_role TEXT;
    is_admin_flag BOOLEAN;
    is_lead_officer_flag BOOLEAN;
BEGIN
    -- Check if user has admin or any officer role (these bypass concurrent login restrictions)
    SELECT
        COALESCE(role, '') INTO user_role
    FROM user_profiles
    WHERE id = p_user_id;
    
    SELECT
        COALESCE(is_admin, false) INTO is_admin_flag
    FROM user_profiles
    WHERE id = p_user_id;
    
    SELECT
        COALESCE(is_lead_officer, false) INTO is_lead_officer_flag
    FROM user_profiles
    WHERE id = p_user_id;
    
    -- Check for any officer flags
    SELECT
        COALESCE(is_troll_officer, false) INTO is_officer_flag
    FROM user_profiles
    WHERE id = p_user_id;
    
    -- Admins and all officers can bypass concurrent login restrictions (allow multiple sessions)
    IF user_role IN ('admin', 'lead_troll_officer', 'troll_officer', 'moderator')
       OR is_admin_flag = TRUE
       OR is_lead_officer_flag = TRUE
       OR is_officer_flag = TRUE THEN
        RETURN FALSE; -- No concurrent login detected (allow multiple sessions)
    END IF;
    
    -- Count active sessions for this user, excluding the current session
    SELECT COUNT(*) INTO active_session_count
    FROM active_sessions
    WHERE user_id = p_user_id
      AND session_id != p_current_session_id
      AND is_active = TRUE
      AND created_at > NOW() - INTERVAL '30 minutes';
    
    -- Return true if there are other active sessions (concurrent login detected)
    RETURN active_session_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to register a new session
CREATE OR REPLACE FUNCTION register_session(
    p_user_id UUID,
    p_session_id UUID,
    p_device_info JSONB DEFAULT '{}',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    user_role TEXT;
    is_admin_flag BOOLEAN;
    is_lead_officer_flag BOOLEAN;
BEGIN
    -- Check if user has admin or any officer role (these can have multiple sessions)
    SELECT
        COALESCE(role, '') INTO user_role
    FROM user_profiles
    WHERE id = p_user_id;
    
    SELECT
        COALESCE(is_admin, false) INTO is_admin_flag
    FROM user_profiles
    WHERE id = p_user_id;
    
    SELECT
        COALESCE(is_lead_officer, false) INTO is_lead_officer_flag
    FROM user_profiles
    WHERE id = p_user_id;
    
    -- Check for any officer flags
    SELECT
        COALESCE(is_troll_officer, false) INTO is_officer_flag
    FROM user_profiles
    WHERE id = p_user_id;
    
    -- For regular users: Deactivate any existing sessions (single device policy)
    -- For admins/officers: Allow multiple sessions (bypass quiz and training restrictions)
    IF NOT (user_role IN ('admin', 'lead_troll_officer', 'troll_officer', 'moderator')
            OR is_admin_flag = TRUE
            OR is_lead_officer_flag = TRUE
            OR is_officer_flag = TRUE) THEN
        UPDATE active_sessions
        SET is_active = FALSE, last_active = NOW()
        WHERE user_id = p_user_id AND is_active = TRUE;
    END IF;
    
    -- Insert new session with proper JSON handling
    INSERT INTO active_sessions (user_id, session_id, device_info, ip_address, user_agent)
    VALUES (p_user_id, p_session_id,
            COALESCE(p_device_info, '{}'::JSONB),
            p_ip_address, p_user_agent)
    ON CONFLICT (session_id) DO UPDATE
    SET is_active = TRUE, last_active = NOW(),
        device_info = COALESCE(p_device_info, '{}'::JSONB),
        ip_address = p_ip_address,
        user_agent = p_user_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup inactive sessions
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions() RETURNS VOID AS $$
BEGIN
    -- Delete sessions older than 30 days
    DELETE FROM active_sessions
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete inactive sessions older than 1 hour
    DELETE FROM active_sessions
    WHERE is_active = FALSE AND last_active < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically cleanup sessions on insert
CREATE OR REPLACE FUNCTION trigger_cleanup_sessions()
RETURNS TRIGGER AS $$
BEGIN
    -- Run cleanup every 100 inserts to keep the table manageable
    IF (SELECT COUNT(*) FROM active_sessions) % 100 = 0 THEN
        PERFORM cleanup_inactive_sessions();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_sessions_trigger
AFTER INSERT ON active_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_cleanup_sessions();

-- Grant permissions
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow session management for authenticated users"
ON active_sessions FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow session reads for service role"
ON active_sessions FOR SELECT
TO authenticated
USING (true);

COMMENT ON TABLE active_sessions IS 'Tracks active user sessions to prevent concurrent logins from different devices';
COMMENT ON FUNCTION check_concurrent_login(UUID, UUID) IS 'Check if user has active sessions on other devices';
COMMENT ON FUNCTION register_session(UUID, UUID, JSONB, TEXT, TEXT) IS 'Register a new user session and deactivate previous ones';
COMMENT ON FUNCTION cleanup_inactive_sessions() IS 'Cleanup old and inactive sessions';