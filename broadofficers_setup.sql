-- Create broadcast_officers table
CREATE TABLE IF NOT EXISTS broadcast_officers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    broadcaster_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(broadcaster_id, officer_id)
);

-- RLS Policies
ALTER TABLE broadcast_officers ENABLE ROW LEVEL SECURITY;

-- Broadcasters can view their own officers
CREATE POLICY "Broadcasters can view their own officers" ON broadcast_officers
    FOR SELECT USING (auth.uid() = broadcaster_id);

-- Everyone can view officers (to check permissions)
CREATE POLICY "Everyone can view officers" ON broadcast_officers
    FOR SELECT USING (true);

-- Broadcasters can insert their own officers
CREATE POLICY "Broadcasters can add officers" ON broadcast_officers
    FOR INSERT WITH CHECK (auth.uid() = broadcaster_id);

-- Broadcasters can delete their own officers
CREATE POLICY "Broadcasters can remove officers" ON broadcast_officers
    FOR DELETE USING (auth.uid() = broadcaster_id);

-- RPC to check if user is broadofficer
CREATE OR REPLACE FUNCTION is_broadofficer(p_broadcaster_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM broadcast_officers
        WHERE broadcaster_id = p_broadcaster_id AND officer_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to get officers for a broadcaster
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

-- RPC to assign officer (checking limit of 10)
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

-- RPC to remove officer
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
