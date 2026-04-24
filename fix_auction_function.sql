-- Fix for create_auction_show function
-- Drop and recreate with fixed variable scope

DROP FUNCTION IF EXISTS create_auction_show(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION create_auction_show(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_thumbnail_url TEXT DEFAULT NULL,
    p_scheduled_for TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_auctioneer_id UUID;
    v_show_id UUID;
    v_slug TEXT;
    v_livekit_room TEXT;
    v_initial_status TEXT := 'draft';
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Check approved auctioneer
    SELECT id INTO v_auctioneer_id
    FROM auctioneer_profiles
    WHERE user_id = v_user_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be an approved auctioneer to create shows');
    END IF;
    
    -- Generate slug and LiveKit room name
    v_slug := generate_auction_slug(p_title);
    v_livekit_room := generate_livekit_room_name();
    
    -- Determine initial status
    IF p_scheduled_for IS NOT NULL THEN
        v_initial_status := 'scheduled';
    END IF;
    
    -- Create show
    INSERT INTO auction_shows (
        auctioneer_id,
        title,
        slug,
        description,
        category,
        thumbnail_url,
        status,
        scheduled_for,
        livekit_room_name
    ) VALUES (
        v_auctioneer_id,
        p_title,
        v_slug,
        p_description,
        p_category,
        p_thumbnail_url,
        v_initial_status,
        p_scheduled_for,
        v_livekit_room
    )
    RETURNING id INTO v_show_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'show_created',
        v_show_id,
        NULL,
        NULL,
        jsonb_build_object('title', p_title, 'status', v_initial_status)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'show_id', v_show_id,
        'slug', v_slug,
        'livekit_room_name', v_livekit_room,
        'message', 'Auction show created successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;