-- ============================================================
-- Broadcast Viewer Cap & Restriction Settings (2026-05-31)
-- ============================================================
-- Adds new admin_settings keys for:
--   1. broadcast_viewer_cap_enabled — restrict viewers per broadcast
--   2. broadcast_viewer_cap_max — max viewers per stream (default 10)
--   3. broadcast_viewer_cap_hours — hours the cap is active after stream start (default 24)
--   4. broadcast_start_cap_enabled — restrict who can start broadcasts
--   5. broadcast_start_cap_max — max concurrent broadcasters (default 10)
--   5. broadcast_all_restrictions_disabled — master override to remove all restrictions
-- ============================================================

-- Ensure admin_settings table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT DEFAULT '{}',
    description TEXT,
    key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Public read policy for lockdown-like settings
DROP POLICY IF EXISTS "public_read_broadcast_settings" ON public.admin_settings;
CREATE POLICY "public_read_broadcast_settings" ON public.admin_settings
    FOR SELECT
    USING (
        setting_key IN (
            'broadcast_lockdown_enabled',
            'broadcast_viewer_cap_enabled',
            'broadcast_viewer_cap_max',
            'broadcast_viewer_cap_hours',
            'broadcast_start_cap_enabled',
            'broadcast_start_cap_max',
            'broadcast_all_restrictions_disabled'
        )
    );

-- Authenticated read all
DROP POLICY IF EXISTS "authenticated_read_all_settings" ON public.admin_settings;
CREATE POLICY "authenticated_read_all_settings" ON public.admin_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Admin update
DROP POLICY IF EXISTS "admin_update_settings" ON public.admin_settings;
CREATE POLICY "admin_update_settings" ON public.admin_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Insert default settings (all disabled by default)
INSERT INTO public.admin_settings (setting_key, setting_value, description, key)
VALUES 
    ('broadcast_viewer_cap_enabled', '{"enabled": false}', 'Enable per-broadcast viewer cap (e.g. max 10 viewers per stream for first 24h)', 'broadcast_viewer_cap_enabled'),
    ('broadcast_viewer_cap_max', '{"value": 10}', 'Maximum viewers per broadcast when cap is active', 'broadcast_viewer_cap_max'),
    ('broadcast_viewer_cap_hours', '{"value": 24}', 'Hours after stream start that viewer cap is enforced', 'broadcast_viewer_cap_hours'),
    ('broadcast_start_cap_enabled', '{"enabled": false}', 'Restrict number of users who can start broadcasts concurrently', 'broadcast_start_cap_enabled'),
    ('broadcast_start_cap_max', '{"value": 10}', 'Maximum concurrent broadcasters when start cap is active', 'broadcast_start_cap_max'),
    ('broadcast_all_restrictions_disabled', '{"enabled": false}', 'Master override: when true, all broadcast restrictions are removed (allow all to broadcast and watch)', 'broadcast_all_restrictions_disabled')
ON CONFLICT (setting_key) DO NOTHING;

-- Function to check if all restrictions are disabled
CREATE OR REPLACE FUNCTION public.are_all_broadcast_restrictions_disabled()
RETURNS BOOLEAN AS $$
DECLARE
    val TEXT;
BEGIN
    SELECT setting_value INTO val
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_all_restrictions_disabled'
    LIMIT 1;
    
    IF val IS NOT NULL AND val LIKE '%enabled%true%' THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if viewer cap is active for a stream
-- Returns true if the stream is within the cap window and cap is enabled
CREATE OR REPLACE FUNCTION public.is_viewer_cap_active(p_stream_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_cap_enabled BOOLEAN := false;
    v_cap_hours INTEGER := 24;
    v_stream_created TIMESTAMPTZ;
BEGIN
    -- If all restrictions disabled, cap is never active
    IF public.are_all_broadcast_restrictions_disabled() THEN
        RETURN false;
    END IF;
    
    -- Check if viewer cap is enabled
    SELECT setting_value LIKE '%enabled%true%' INTO v_cap_enabled
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_viewer_cap_enabled'
    LIMIT 1;
    
    IF NOT v_cap_enabled THEN
        RETURN false;
    END IF;
    
    -- Get cap hours
    SELECT (setting_value::jsonb->>'value')::INTEGER INTO v_cap_hours
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_viewer_cap_hours'
    LIMIT 1;
    
    v_cap_hours := COALESCE(v_cap_hours, 24);
    
    -- Check if stream is within the cap window
    SELECT created_at INTO v_stream_created
    FROM public.streams
    WHERE id = p_stream_id;
    
    IF v_stream_created IS NULL THEN
        RETURN false;
    END IF;
    
    -- Cap is active if stream started within the cap window
    RETURN v_stream_created > (NOW() - (v_cap_hours || ' hours')::INTERVAL);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get current viewer cap max
CREATE OR REPLACE FUNCTION public.get_viewer_cap_max()
RETURNS INTEGER AS $$
DECLARE
    v_max INTEGER;
BEGIN
    SELECT (setting_value::jsonb->>'value')::INTEGER INTO v_max
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_viewer_cap_max'
    LIMIT 1;
    
    RETURN COALESCE(v_max, 10);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if start cap is active
CREATE OR REPLACE FUNCTION public.is_start_cap_active()
RETURNS BOOLEAN AS $$
DECLARE
    v_cap_enabled BOOLEAN := false;
BEGIN
    -- If all restrictions disabled, cap is never active
    IF public.are_all_broadcast_restrictions_disabled() THEN
        RETURN false;
    END IF;
    
    SELECT setting_value LIKE '%enabled%true%' INTO v_cap_enabled
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_start_cap_enabled'
    LIMIT 1;
    
    RETURN COALESCE(v_cap_enabled, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get current start cap max
CREATE OR REPLACE FUNCTION public.get_start_cap_max()
RETURNS INTEGER AS $$
DECLARE
    v_max INTEGER;
BEGIN
    SELECT (setting_value::jsonb->>'value')::INTEGER INTO v_max
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_start_cap_max'
    LIMIT 1;
    
    RETURN COALESCE(v_max, 10);
END;
$$ LANGUAGE plpgsql STABLE;
