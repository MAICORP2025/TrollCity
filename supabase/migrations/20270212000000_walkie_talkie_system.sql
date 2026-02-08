-- Walkie Talkie & Paging System Tables

-- 1. Walkie Sessions
CREATE TABLE IF NOT EXISTS public.walkie_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('standard', 'bug')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    created_by UUID REFERENCES auth.users(id),
    participants JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of user IDs
    bug_report_id UUID -- Optional link to a bug report if we decide to store them separately, but metadata might be enough
);

ALTER TABLE public.walkie_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Paging Requests
CREATE TABLE IF NOT EXISTS public.walkie_paging_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('standard', 'bug')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'missed', 'expired')),
    metadata JSONB DEFAULT '{}'::JSONB, -- Stores bug details: { issueType, severity, description }
    session_id UUID REFERENCES public.walkie_sessions(id) -- Link to session if accepted
);

ALTER TABLE public.walkie_paging_requests ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Walkie Sessions: Visible to participants
CREATE POLICY "Walkie sessions visible to participants" ON public.walkie_sessions
    FOR SELECT USING (
        auth.uid() = created_by OR
        auth.uid()::text IN (SELECT jsonb_array_elements_text(participants)) OR
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );

-- Paging Requests: Visible to sender and receiver
CREATE POLICY "Paging requests visible to parties" ON public.walkie_paging_requests
    FOR SELECT USING (
        auth.uid() = sender_id OR
        auth.uid() = receiver_id
    );

CREATE POLICY "Paging requests insertable by sender" ON public.walkie_paging_requests
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
    );

CREATE POLICY "Paging requests updatable by receiver" ON public.walkie_paging_requests
    FOR UPDATE USING (
        auth.uid() = receiver_id OR auth.uid() = sender_id
    );

-- 4. RPC Functions for Logic

-- Function to check if user is admin
-- NOTE: Renamed or skipped to avoid conflict with existing is_admin(uid)
-- We will use the existing is_admin if available, or create a specific helper.
CREATE OR REPLACE FUNCTION public.is_walkie_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = check_user_id AND (role = 'admin' OR is_admin = true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is high rank (Lead Troll Officer or Secretary)
CREATE OR REPLACE FUNCTION public.is_high_rank(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = check_user_id AND (
            role IN ('lead_troll_officer', 'secretary') OR 
            is_lead_officer = true
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send Page RPC
CREATE OR REPLACE FUNCTION public.send_walkie_page(
    target_user_id UUID,
    page_type TEXT,
    bug_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
    sender_is_admin BOOLEAN;
    sender_is_high_rank BOOLEAN;
    target_is_admin BOOLEAN;
    officer_paging_allowed BOOLEAN;
    new_page_id UUID;
    settings_json JSONB;
BEGIN
    -- Check permissions
    sender_is_admin := public.is_walkie_admin(auth.uid());
    sender_is_high_rank := public.is_high_rank(auth.uid());
    target_is_admin := public.is_walkie_admin(target_user_id);

    -- Get settings
    SELECT setting_value INTO settings_json FROM public.admin_app_settings WHERE setting_key = 'allow_officer_admin_paging';
    officer_paging_allowed := COALESCE((settings_json->>'enabled')::BOOLEAN, false);

    -- Validation Logic
    IF page_type = 'standard' THEN
        IF target_is_admin AND NOT sender_is_admin THEN
            -- Only High Rank can page Admin in Standard mode, unless override is ON
            IF NOT sender_is_high_rank AND NOT officer_paging_allowed THEN
                RAISE EXCEPTION 'Admin paging restricted';
            END IF;
        END IF;
    END IF;

    -- Create Page Request
    INSERT INTO public.walkie_paging_requests (sender_id, receiver_id, type, metadata)
    VALUES (auth.uid(), target_user_id, page_type, bug_metadata)
    RETURNING id INTO new_page_id;

    RETURN jsonb_build_object('success', true, 'page_id', new_page_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Respond to Page RPC
CREATE OR REPLACE FUNCTION public.respond_to_walkie_page(
    page_id UUID,
    response TEXT -- 'accepted' or 'declined'
)
RETURNS JSONB AS $$
DECLARE
    req RECORD;
    new_session_id UUID;
BEGIN
    SELECT * INTO req FROM public.walkie_paging_requests WHERE id = page_id;

    IF req.receiver_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to respond to this page';
    END IF;

    IF req.status != 'pending' THEN
        RAISE EXCEPTION 'Page is no longer pending';
    END IF;

    UPDATE public.walkie_paging_requests
    SET status = response
    WHERE id = page_id;

    IF response = 'accepted' THEN
        -- Create Session
        INSERT INTO public.walkie_sessions (created_by, type, participants, bug_report_id)
        VALUES (
            req.sender_id, -- Initiator is creator usually, or maybe receiver? Let's say sender.
            req.type,
            jsonb_build_array(req.sender_id, req.receiver_id),
            NULL
        )
        RETURNING id INTO new_session_id;

        -- Link session to request
        UPDATE public.walkie_paging_requests
        SET session_id = new_session_id
        WHERE id = page_id;

        RETURN jsonb_build_object('success', true, 'session_id', new_session_id);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed default setting if not exists
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES ('allow_officer_admin_paging', '{"enabled": false}', 'Allow Officers to page Admin in Standard Mode')
ON CONFLICT (setting_key) DO NOTHING;
