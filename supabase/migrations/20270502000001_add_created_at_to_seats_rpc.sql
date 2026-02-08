-- Migration: Add created_at to get_stream_seats RPC
-- Description: Adds created_at field to the returned table of get_stream_seats function so the frontend can display account age without extra fetches.

CREATE OR REPLACE FUNCTION public.get_stream_seats(p_stream_id UUID)
RETURNS TABLE (
    id UUID,
    seat_index INTEGER,
    user_id UUID,
    status TEXT,
    joined_at TIMESTAMPTZ,
    username TEXT,
    avatar_url TEXT,
    is_gold BOOLEAN,
    role TEXT,
    troll_coins INTEGER,
    rgb_username_expires_at TIMESTAMPTZ,
    glowing_username_color TEXT,
    troll_role TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.seat_index,
        s.user_id,
        s.status,
        s.joined_at,
        COALESCE(u.username, 'Guest') as username,
        COALESCE(u.avatar_url, 'https://ui-avatars.com/api/?name=Guest&background=random') as avatar_url,
        COALESCE(u.is_gold, false) as is_gold,
        COALESCE(u.role, 'user') as role,
        COALESCE(u.troll_coins, 0) as troll_coins,
        u.rgb_username_expires_at,
        u.glowing_username_color,
        u.troll_role,
        u.created_at
    FROM public.stream_seat_sessions s
    LEFT JOIN public.user_profiles u ON s.user_id = u.id
    WHERE s.stream_id = p_stream_id
    AND s.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO anon;
