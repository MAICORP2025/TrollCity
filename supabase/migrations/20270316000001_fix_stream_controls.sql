-- Ensure stream_seat_sessions table exists (Moved from 000002)
CREATE TABLE IF NOT EXISTS public.stream_seat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    seat_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'kicked')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    price_paid INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (Moved from 000002)
-- EVERYONE must be able to see active sessions to render the grid
DROP POLICY IF EXISTS "Anyone can view active seat sessions" ON public.stream_seat_sessions;
CREATE POLICY "Anyone can view active seat sessions" 
ON public.stream_seat_sessions FOR SELECT 
USING (true);

-- Users can insert their own session
DROP POLICY IF EXISTS "Users can insert their own session" ON public.stream_seat_sessions;
CREATE POLICY "Users can insert their own session" 
ON public.stream_seat_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own session
DROP POLICY IF EXISTS "Users can update their own session" ON public.stream_seat_sessions;
CREATE POLICY "Users can update their own session" 
ON public.stream_seat_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Ensure kick_reason column exists (Added in 000001)
ALTER TABLE public.stream_seat_sessions ADD COLUMN IF NOT EXISTS kick_reason TEXT;

-- Fix End Stream RPC
DROP FUNCTION IF EXISTS public.end_stream(UUID);

CREATE OR REPLACE FUNCTION public.end_stream(p_stream_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = v_user_id AND (role IN ('admin', 'superadmin') OR is_admin = true)
    ) INTO v_is_admin;

    -- Update stream if owner or admin
    UPDATE public.streams
    SET 
        status = 'ended',
        is_live = false,
        ended_at = NOW()
    WHERE 
        id = p_stream_id 
        AND (user_id = v_user_id OR v_is_admin = true);

    IF FOUND THEN
        RETURN QUERY SELECT true, 'Stream ended successfully'::TEXT;
    ELSE
        RETURN QUERY SELECT false, 'Permission denied or stream not found'::TEXT;
    END IF;
END;
$$;

-- RPC: Leave Seat Atomic
DROP FUNCTION IF EXISTS public.leave_seat_atomic(UUID);
CREATE OR REPLACE FUNCTION public.leave_seat_atomic(p_session_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Verify ownership of session
    IF NOT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions
        WHERE id = p_session_id AND user_id = v_user_id
    ) THEN
        RETURN QUERY SELECT false, 'Session not found or not yours'::TEXT;
        RETURN;
    END IF;

    -- Update status
    UPDATE public.stream_seat_sessions
    SET status = 'left', left_at = NOW()
    WHERE id = p_session_id;

    RETURN QUERY SELECT true, 'Left seat successfully'::TEXT;
END;
$$;

-- RPC: Kick Participant Atomic
DROP FUNCTION IF EXISTS public.kick_participant_atomic(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.kick_participant_atomic(p_stream_id UUID, p_target_user_id UUID, p_reason TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    -- Check if requester is host or admin
    SELECT EXISTS (
        SELECT 1 FROM public.streams
        WHERE id = p_stream_id AND user_id = v_user_id
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = v_user_id AND (role IN ('admin', 'moderator') OR is_admin = true)
        ) INTO v_is_admin;
    END IF;

    IF NOT v_is_admin THEN
        RETURN QUERY SELECT false, 'Permission denied'::TEXT;
        RETURN;
    END IF;

    -- End active sessions for this user on this stream
    UPDATE public.stream_seat_sessions
    SET status = 'kicked', left_at = NOW(), kick_reason = p_reason
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id AND status = 'active';

    RETURN QUERY SELECT true, 'User kicked from seat'::TEXT;
END;
$$;


