-- ============================================================================
-- LIVE AUCTIONS - Part 2: Indexes, Triggers, Functions, FKs, RLS
-- Run this after Part 1 completes successfully
-- ============================================================================

-- Drop existing auction-specific functions to allow recreation with new parameter names
-- Note: We cannot drop is_admin/is_lead_troll_officer as they are used by other parts of the system
-- Instead we'll rename our helper functions to avoid conflicts
DROP FUNCTION IF EXISTS is_approved_auctioneer(UUID);
DROP FUNCTION IF EXISTS get_auctioneer_profile(UUID);
DROP FUNCTION IF EXISTS user_coin_balance(UUID);
DROP FUNCTION IF EXISTS user_can_bid(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS log_auction_audit(UUID, TEXT, UUID, UUID, UUID, JSONB);

-- ============================================================================
-- PART 1: INDEXES
-- ============================================================================

-- auctioneer_applications indexes
CREATE INDEX IF NOT EXISTS idx_auctioneer_applications_status ON auctioneer_applications(status);
CREATE INDEX IF NOT EXISTS idx_auctioneer_applications_user_id ON auctioneer_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_auctioneer_applications_created_at ON auctioneer_applications(created_at DESC);

-- auctioneer_profiles indexes
CREATE INDEX IF NOT EXISTS idx_auctioneer_profiles_user_id ON auctioneer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_auctioneer_profiles_is_active ON auctioneer_profiles(is_active);

-- auction_shows indexes
CREATE INDEX IF NOT EXISTS idx_auction_shows_auctioneer_id ON auction_shows(auctioneer_id);
CREATE INDEX IF NOT EXISTS idx_auction_shows_status ON auction_shows(status);
CREATE INDEX IF NOT EXISTS idx_auction_shows_scheduled_for ON auction_shows(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_auction_shows_live_started_at ON auction_shows(live_started_at);
CREATE INDEX IF NOT EXISTS idx_auction_shows_slug ON auction_shows(slug);
CREATE INDEX IF NOT EXISTS idx_auction_shows_livekit_room_name ON auction_shows(livekit_room_name);
CREATE INDEX IF NOT EXISTS idx_auction_shows_is_featured ON auction_shows(is_featured) WHERE is_featured = true;

-- auction_lots indexes
CREATE INDEX IF NOT EXISTS idx_auction_lots_auction_show_id ON auction_lots(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_lots_status ON auction_lots(status);
CREATE INDEX IF NOT EXISTS idx_auction_lots_order_index ON auction_lots(order_index);
CREATE INDEX IF NOT EXISTS idx_auction_lots_current_highest_bid ON auction_lots(current_highest_bid DESC);
CREATE INDEX IF NOT EXISTS idx_auction_lots_current_highest_bidder ON auction_lots(current_highest_bidder_id);

-- auction_bids indexes
CREATE INDEX IF NOT EXISTS idx_auction_bids_lot_id_created ON auction_bids(lot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id_created ON auction_bids(bidder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bids_show_id_created ON auction_bids(auction_show_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bids_accepted ON auction_bids(accepted) WHERE accepted = true;

-- auction_bid_blocks indexes
CREATE INDEX IF NOT EXISTS idx_auction_bid_blocks_auctioneer ON auction_bid_blocks(auctioneer_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_bid_blocks_blocked_user ON auction_bid_blocks(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_bid_blocks_show ON auction_bid_blocks(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_bid_blocks_active ON auction_bid_blocks(active) WHERE active = true;

-- auction_reports indexes
CREATE INDEX IF NOT EXISTS idx_auction_reports_status ON auction_reports(status);
CREATE INDEX IF NOT EXISTS idx_auction_reports_reported_user ON auction_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_reports_reporter ON auction_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_auction_reports_show ON auction_reports(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_reports_created_at ON auction_reports(created_at DESC);

-- auction_wins indexes
CREATE INDEX IF NOT EXISTS idx_auction_wins_winner ON auction_wins(winner_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_wins_payment ON auction_wins(payment_status);
CREATE INDEX IF NOT EXISTS idx_auction_wins_fulfillment ON auction_wins(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_auction_wins_created_at ON auction_wins(created_at DESC);

-- auction_presence indexes
CREATE INDEX IF NOT EXISTS idx_auction_presence_show ON auction_presence(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_presence_user ON auction_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_presence_is_active ON auction_presence(is_active) WHERE is_active = true;

-- auction_audit_logs indexes
CREATE INDEX IF NOT EXISTS idx_auction_audit_event_type ON auction_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auction_audit_show ON auction_audit_logs(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_audit_target_user ON auction_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_audit_created_at ON auction_audit_logs(created_at DESC);

-- ============================================================================
-- PART 2: ADD FOREIGN KEYS
-- ============================================================================

ALTER TABLE auction_shows ADD CONSTRAINT fk_current_lot FOREIGN KEY (current_lot_id) REFERENCES auction_lots(id) ON DELETE SET NULL;

-- ============================================================================
-- PART 3: TRIGGER FUNCTIONS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all mutable tables
CREATE TRIGGER trigger_auctioneer_applications_updated_at
    BEFORE UPDATE ON auctioneer_applications
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auctioneer_profiles_updated_at
    BEFORE UPDATE ON auctioneer_profiles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auction_shows_updated_at
    BEFORE UPDATE ON auction_shows
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auction_lots_updated_at
    BEFORE UPDATE ON auction_lots
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auction_bids_updated_at
    BEFORE UPDATE ON auction_bids
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auction_bid_blocks_updated_at
    BEFORE UPDATE ON auction_bid_blocks
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auction_reports_updated_at
    BEFORE UPDATE ON auction_reports
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auction_wins_updated_at
    BEFORE UPDATE ON auction_wins
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trigger_auction_presence_updated_at
    BEFORE UPDATE ON auction_presence
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================================
-- PART 4: HELPER FUNCTIONS
-- ============================================================================

-- NOTE: is_admin() and is_lead_troll_officer() already exist in the system
-- We only define auction-specific helper functions here

-- Check if user is approved auctioneer
CREATE OR REPLACE FUNCTION is_approved_auctioneer(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auctioneer_profiles
        WHERE user_id = p_user_id AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's auctioneer profile
CREATE OR REPLACE FUNCTION get_auctioneer_profile(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    is_active BOOLEAN,
    strike_count INTEGER,
    approved_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT ap.id, ap.user_id, ap.is_active, ap.strike_count, ap.approved_at
    FROM auctioneer_profiles ap
    WHERE ap.user_id = p_user_id AND ap.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's troll coin balance
CREATE OR REPLACE FUNCTION user_coin_balance(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
    balance BIGINT := 0;
BEGIN
    SELECT COALESCE(troll_coins, 0) INTO balance
    FROM public.user_profiles
    WHERE id = p_user_id;
    RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can bid - returns detailed response
CREATE OR REPLACE FUNCTION user_can_bid(
    p_user_id UUID,
    p_show_id UUID,
    p_lot_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_balance BIGINT;
    v_min_required BIGINT := 5000;
    v_blocked BOOLEAN := false;
    v_block_reason TEXT;
    v_show_status TEXT;
    v_lot_status TEXT;
    v_auctioneer_id UUID;
    v_globally_restricted BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Get user balance
    v_balance := user_coin_balance(p_user_id);
    
    -- Get show status
    SELECT status INTO v_show_status
    FROM auction_shows
    WHERE id = p_show_id;
    
    -- Get lot status
    SELECT status INTO v_lot_status
    FROM auction_lots
    WHERE id = p_lot_id;
    
    -- Get auctioneer_id from show
    SELECT auctioneer_id INTO v_auctioneer_id
    FROM auction_shows
    WHERE id = p_show_id;
    
    -- Check if user is the auctioneer (cannot bid on own auction)
    IF v_auctioneer_id IN (SELECT id FROM auctioneer_profiles WHERE user_id = p_user_id) THEN
        v_blocked := true;
        v_block_reason := 'Auctioneers cannot bid on their own shows';
    END IF;
    
    -- Check for active bid blocks (either show-specific or auctioneer-level)
    IF NOT v_blocked THEN
        SELECT abb.reason INTO v_block_reason
        FROM auction_bid_blocks abb
        WHERE abb.blocked_user_id = p_user_id
          AND abb.active = true
          AND (abb.auction_show_id = p_show_id OR abb.auction_show_id IS NULL)
          AND abb.auctioneer_user_id = (
              SELECT ap.user_id FROM auctioneer_profiles ap 
              WHERE ap.id = v_auctioneer_id
          )
        LIMIT 1;
        
        IF FOUND THEN
            v_blocked := true;
        END IF;
    END IF;
    
    -- Build result
    v_result := jsonb_build_object(
        'allowed', NOT v_blocked AND v_balance >= v_min_required AND v_show_status = 'live' AND v_lot_status = 'live',
        'reason', CASE 
            WHEN v_blocked THEN v_block_reason
            WHEN v_balance < v_min_required THEN 'Insufficient troll coins. Minimum 5000 required.'
            WHEN v_show_status != 'live' THEN 'Auction show is not live'
            WHEN v_lot_status != 'live' THEN 'Lot is not currently live for bidding'
            ELSE NULL
        END,
        'balance', v_balance,
        'min_required', v_min_required,
        'blocked', v_blocked,
        'globally_restricted', v_globally_restricted,
        'show_restricted', v_show_status != 'live'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate unique slug for auction shows
CREATE OR REPLACE FUNCTION generate_auction_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
    v_slug TEXT;
    v_counter INT := 0;
BEGIN
    v_slug := LOWER(REGEXP_REPLACE(title, '[^a-z0-9]+', '-', 'g'));
    v_slug := TRIM(v_slug, '-');
    
    -- Ensure unique
    LOOP
        IF v_counter = 0 THEN
            IF NOT EXISTS (SELECT 1 FROM auction_shows WHERE slug = v_slug) THEN
                RETURN v_slug;
            END IF;
        ELSE
            IF NOT EXISTS (SELECT 1 FROM auction_shows WHERE slug = v_slug || '-' || v_counter) THEN
                RETURN v_slug || '-' || v_counter;
            END IF;
        END IF;
        v_counter := v_counter + 1;
        IF v_counter > 100 THEN
            RETURN gen_random_uuid()::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate unique LiveKit room name
CREATE OR REPLACE FUNCTION generate_livekit_room_name()
RETURNS TEXT AS $$
DECLARE
    v_room_name TEXT;
BEGIN
    LOOP
        v_room_name := 'auction-' || gen_random_uuid()::TEXT;
        IF NOT EXISTS (SELECT 1 FROM auction_shows WHERE livekit_room_name = v_room_name) THEN
            RETURN v_room_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Log auction audit event
CREATE OR REPLACE FUNCTION log_auction_audit(
    p_actor_user_id UUID,
    p_event_type TEXT,
    p_auction_show_id UUID,
    p_lot_id UUID,
    p_target_user_id UUID,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO auction_audit_logs (
        actor_user_id,
        event_type,
        auction_show_id,
        lot_id,
        target_user_id,
        metadata
    ) VALUES (
        p_actor_user_id,
        p_event_type,
        p_auction_show_id,
        p_lot_id,
        p_target_user_id,
        p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count pending auctioneer applications
CREATE OR REPLACE FUNCTION count_pending_applications()
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM auctioneer_applications
    WHERE status = 'pending';
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: RPC FUNCTIONS (Server-Authoritative Auction Operations)
-- ============================================================================

-- Submit auctioneer application
CREATE OR REPLACE FUNCTION submit_auctioneer_application(
    p_display_name TEXT,
    p_application_text TEXT,
    p_agreement_accepted BOOLEAN,
    p_selling_plan TEXT DEFAULT NULL,
    p_experience TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_application_id UUID;
    v_current_count INT;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Require agreement acceptance
    IF NOT p_agreement_accepted THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must accept the auctioneer agreement');
    END IF;
    
    -- Check pending applications limit (50 max)
    v_current_count := count_pending_applications();
    IF v_current_count >= 50 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum 50 pending applications allowed. Please try again later.');
    END IF;
    
    -- Check user doesn't already have a pending application
    IF EXISTS (
        SELECT 1 FROM auctioneer_applications
        WHERE user_id = v_user_id AND status = 'pending'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already have a pending application');
    END IF;
    
    -- Create application
    INSERT INTO auctioneer_applications (
        user_id,
        display_name,
        application_text,
        selling_plan,
        experience,
        agreement_accepted
    ) VALUES (
        v_user_id,
        p_display_name,
        p_application_text,
        p_selling_plan,
        p_experience,
        p_agreement_accepted
    )
    RETURNING id INTO v_application_id;
    
    -- Log audit event
    PERFORM log_auction_audit(
        v_user_id,
        'application_submitted',
        NULL,
        NULL,
        NULL,
        jsonb_build_object('application_id', v_application_id)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'application_id', v_application_id,
        'message', 'Application submitted successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Review auctioneer application
CREATE OR REPLACE FUNCTION review_auctioneer_application(
    p_application_id UUID,
    p_approve BOOLEAN,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_application auctioneer_applications%ROWTYPE;
    v_profile_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Require admin
    IF NOT is_admin(v_user_id) AND NOT is_lead_troll_officer(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Admin or Lead Troll Officer access required');
    END IF;
    
    -- Get application
    SELECT * INTO v_application
    FROM auctioneer_applications
    WHERE id = p_application_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found');
    END IF;
    
    IF v_application.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application already reviewed');
    END IF;
    
    IF p_approve THEN
        -- Update application status
        UPDATE auctioneer_applications
        SET status = 'approved',
            admin_notes = p_admin_notes,
            reviewed_by = v_user_id,
            reviewed_at = now(),
            updated_at = now()
        WHERE id = p_application_id;
        
        -- Create or update auctioneer profile
        INSERT INTO auctioneer_profiles (user_id, approved_by, approved_at, is_active)
        VALUES (v_application.user_id, v_user_id, now(), true)
        ON CONFLICT (user_id) DO UPDATE SET
            approved_by = v_user_id,
            approved_at = now(),
            is_active = true,
            strike_count = 0,
            updated_at = now();
        
        -- Get profile ID
        SELECT id INTO v_profile_id FROM auctioneer_profiles WHERE user_id = v_application.user_id;
        
        -- Log audit
        PERFORM log_auction_audit(
            v_user_id,
            'application_approved',
            NULL,
            NULL,
            v_application.user_id,
            jsonb_build_object('application_id', p_application_id, 'profile_id', v_profile_id)
        );
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Application approved. User is now an approved auctioneer.'
        );
    ELSE
        -- Reject application
        UPDATE auctioneer_applications
        SET status = 'rejected',
            admin_notes = p_admin_notes,
            reviewed_by = v_user_id,
            reviewed_at = now(),
            updated_at = now()
        WHERE id = p_application_id;
        
        -- Log audit
        PERFORM log_auction_audit(
            v_user_id,
            'application_rejected',
            NULL,
            NULL,
            v_application.user_id,
            jsonb_build_object('application_id', p_application_id)
        );
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Application rejected'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create auction show
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

-- Update auction show
CREATE OR REPLACE FUNCTION update_auction_show(
    p_show_id UUID,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_thumbnail_url TEXT DEFAULT NULL,
    p_scheduled_for TIMESTAMPTZ DEFAULT NULL,
    p_is_featured BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_auctioneer_id UUID;
    v_show auction_shows%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- Check ownership or admin
    SELECT ap.user_id INTO v_auctioneer_id
    FROM auctioneer_profiles ap
    WHERE ap.id = v_show.auctioneer_id;
    
    IF v_auctioneer_id != v_user_id AND NOT is_admin(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to update this show');
    END IF;
    
    -- Update fields (only if provided)
    IF p_title IS NOT NULL THEN
        UPDATE auction_shows SET title = p_title, slug = generate_auction_slug(p_title) WHERE id = p_show_id;
    END IF;
    IF p_description IS NOT NULL THEN
        UPDATE auction_shows SET description = p_description WHERE id = p_show_id;
    END IF;
    IF p_category IS NOT NULL THEN
        UPDATE auction_shows SET category = p_category WHERE id = p_show_id;
    END IF;
    IF p_thumbnail_url IS NOT NULL THEN
        UPDATE auction_shows SET thumbnail_url = p_thumbnail_url WHERE id = p_show_id;
    END IF;
    IF p_scheduled_for IS NOT NULL THEN
        UPDATE auction_shows SET scheduled_for = p_scheduled_for, status = 'scheduled' WHERE id = p_show_id;
    END IF;
    IF p_is_featured IS NOT NULL AND is_admin(v_user_id) THEN
        UPDATE auction_shows SET is_featured = p_is_featured WHERE id = p_show_id;
    END IF;
    
    UPDATE auction_shows SET updated_at = now() WHERE id = p_show_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Show updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create auction lot
CREATE OR REPLACE FUNCTION create_auction_lot(
    p_show_id UUID,
    p_title TEXT,
    p_starting_bid BIGINT,
    p_description TEXT DEFAULT NULL,
    p_image_urls JSONB DEFAULT '[]'::JSONB,
    p_min_increment BIGINT DEFAULT 1,
    p_order_index INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_auctioneer_id UUID;
    v_show auction_shows%ROWTYPE;
    v_lot_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- Check ownership
    SELECT ap.user_id INTO v_auctioneer_id
    FROM auctioneer_profiles ap
    WHERE ap.id = v_show.auctioneer_id;
    
    IF v_auctioneer_id != v_user_id AND NOT is_admin(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to add lots to this show');
    END IF;
    
    -- Validate starting bid
    IF p_starting_bid < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Starting bid must be non-negative');
    END IF;
    
    -- Validate min increment
    IF p_min_increment <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum increment must be positive');
    END IF;
    
    -- Create lot
    INSERT INTO auction_lots (
        auction_show_id,
        title,
        description,
        image_urls,
        starting_bid,
        min_increment,
        order_index
    ) VALUES (
        p_show_id,
        p_title,
        p_description,
        p_image_urls,
        p_starting_bid,
        p_min_increment,
        p_order_index
    )
    RETURNING id INTO v_lot_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'lot_created',
        p_show_id,
        v_lot_id,
        NULL,
        jsonb_build_object('title', p_title, 'starting_bid', p_starting_bid)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'lot_id', v_lot_id,
        'message', 'Lot created successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start auction show (go live)
CREATE OR REPLACE FUNCTION start_auction_show(p_show_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_show auction_shows%ROWTYPE;
    v_lot_id UUID;
    v_livekit_room TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- Check ownership or admin
    DECLARE
        v_auctioneer_user UUID;
    BEGIN
        SELECT ap.user_id INTO v_auctioneer_user
        FROM auctioneer_profiles ap
        WHERE ap.id = v_show.auctioneer_id;
        
        IF v_auctioneer_user != v_user_id AND NOT is_admin(v_user_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized to start this show');
        END IF;
    END;
    
    -- Validate show has at least one lot
    SELECT id INTO v_lot_id
    FROM auction_lots
    WHERE auction_show_id = p_show_id
    ORDER BY order_index
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot start show without any lots');
    END IF;
    
    -- Validate show is not already live
    IF v_show.status = 'live' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show is already live');
    END IF;
    
    -- Update show status
    UPDATE auction_shows
    SET status = 'live',
        live_started_at = now(),
        current_lot_id = v_lot_id,
        updated_at = now()
    WHERE id = p_show_id;
    
    -- Auto-activate first lot
    UPDATE auction_lots
    SET status = 'live',
        countdown_end_at = now() + interval '30 seconds',
        updated_at = now()
    WHERE id = v_lot_id;
    
    -- Get LiveKit room name
    v_livekit_room := v_show.livekit_room_name;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'show_started',
        p_show_id,
        v_lot_id,
        NULL,
        jsonb_build_object('livekit_room', v_livekit_room)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Auction show is now live',
        'livekit_room_name', v_livekit_room,
        'current_lot_id', v_lot_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activate auction lot (make current)
CREATE OR REPLACE FUNCTION activate_auction_lot(
    p_show_id UUID,
    p_lot_id UUID,
    p_countdown_seconds INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_show auction_shows%ROWTYPE;
    v_lot auction_lots%ROWTYPE;
    v_previous_lot_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- Check ownership
    DECLARE
        v_auctioneer_user UUID;
    BEGIN
        SELECT ap.user_id INTO v_auctioneer_user
        FROM auctioneer_profiles ap
        WHERE ap.id = v_show.auctioneer_id;
        
        IF v_auctioneer_user != v_user_id AND NOT is_admin(v_user_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
        END IF;
    END;
    
    -- Verify show is live
    IF v_show.status != 'live' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show must be live to activate lots');
    END IF;
    
    -- Get lot
    SELECT * INTO v_lot
    FROM auction_lots
    WHERE id = p_lot_id AND auction_show_id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lot not found in this show');
    END IF;
    
    -- Verify lot is in upcoming state
    IF v_lot.status != 'upcoming' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lot must be in upcoming status');
    END IF;
    
    -- Deactivate previous live lot if any
    UPDATE auction_lots
    SET status = 'upcoming',
        updated_at = now()
    WHERE auction_show_id = p_show_id AND status = 'live' AND id != p_lot_id;
    
    -- Activate new lot
    UPDATE auction_lots
    SET status = 'live',
        current_highest_bid = NULL,
        current_highest_bidder_id = NULL,
        countdown_end_at = now() + (p_countdown_seconds || ' seconds')::INTERVAL,
        updated_at = now()
    WHERE id = p_lot_id;
    
    -- Update show current lot
    UPDATE auction_shows
    SET current_lot_id = p_lot_id,
        updated_at = now()
    WHERE id = p_show_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'lot_activated',
        p_show_id,
        p_lot_id,
        NULL,
        jsonb_build_object('countdown_seconds', p_countdown_seconds)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Lot is now active',
        'lot_id', p_lot_id,
        'countdown_end_at', now() + (p_countdown_seconds || ' seconds')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CORE: Place bid (server-authoritative)
CREATE OR REPLACE FUNCTION place_bid(
    p_show_id UUID,
    p_lot_id UUID,
    p_bid_amount BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_lot auction_lots%ROWTYPE;
    v_show auction_shows%ROWTYPE;
    v_bid_id UUID;
    v_min_bid BIGINT;
    v_new_highest_bid BIGINT;
    v_new_bidder_id UUID;
    v_current_time TIMESTAMPTZ;
    v_countdown_remaining INT;
    v_can_bid JSONB;
    v_seconds_between_bids CONSTANT INT := 1;
    v_last_bid_time TIMESTAMPTZ;
    v_anti_snipe_threshold INT := 10;
    v_anti_snipe_extension INT := 10;
BEGIN
    v_user_id := auth.uid();
    v_current_time := now();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('accepted', false, 'reason', 'Authentication required');
    END IF;
    
    -- Get show (with lock for update)
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('accepted', false, 'reason', 'Show not found');
    END IF;
    
    IF v_show.status != 'live' THEN
        RETURN jsonb_build_object('accepted', false, 'reason', 'Show is not live');
    END IF;
    
    -- Get lot with row lock
    SELECT * INTO v_lot
    FROM auction_lots
    WHERE id = p_lot_id AND auction_show_id = p_show_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('accepted', false, 'reason', 'Lot not found');
    END IF;
    
    IF v_lot.status != 'live' THEN
        RETURN jsonb_build_object('accepted', false, 'reason', 'Lot is not live for bidding');
    END IF;
    
    IF v_show.current_lot_id != p_lot_id THEN
        RETURN jsonb_build_object('accepted', false, 'reason', 'This is not the current active lot');
    END IF;
    
    -- Check user eligibility
    v_can_bid := user_can_bid(v_user_id, p_show_id, p_lot_id);
    IF NOT (v_can_bid->>'allowed')::BOOLEAN THEN
        RETURN jsonb_build_object('accepted', false, 'reason', v_can_bid->>'reason');
    END IF;
    
    -- Check bid amount
    IF p_bid_amount <= 0 THEN
        INSERT INTO auction_bids (auction_show_id, lot_id, bidder_id, bid_amount, accepted, rejection_reason)
        VALUES (p_show_id, p_lot_id, v_user_id, p_bid_amount, false, 'Bid amount must be positive')
        RETURNING id INTO v_bid_id;
        
        RETURN jsonb_build_object('accepted', false, 'reason', 'Bid amount must be positive');
    END IF;
    
    -- Calculate minimum bid
    IF v_lot.current_highest_bid IS NULL THEN
        v_min_bid := v_lot.starting_bid;
    ELSE
        v_min_bid := v_lot.current_highest_bid + v_lot.min_increment;
    END IF;
    
    IF p_bid_amount < v_min_bid THEN
        INSERT INTO auction_bids (auction_show_id, lot_id, bidder_id, bid_amount, accepted, rejection_reason)
        VALUES (p_show_id, p_lot_id, v_user_id, p_bid_amount, false, 'Bid below minimum')
        RETURNING id INTO v_bid_id;
        
        RETURN jsonb_build_object(
            'accepted', false,
            'reason', 'Bid must be at least ' || v_min_bid,
            'min_bid', v_min_bid
        );
    END IF;
    
    -- Rate limiting: check last bid time for this user on this lot
    SELECT created_at INTO v_last_bid_time
    FROM auction_bids
    WHERE lot_id = p_lot_id AND bidder_id = v_user_id AND accepted = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_last_bid_time IS NOT NULL AND (v_current_time - v_last_bid_time) < (v_seconds_between_bids || ' seconds')::INTERVAL THEN
        RETURN jsonb_build_object('accepted', false, 'reason', 'Please wait before placing another bid');
    END IF;
    
    -- Anti-snipe: extend countdown if bid is placed near the end
    IF v_lot.countdown_end_at IS NOT NULL THEN
        v_countdown_remaining := EXTRACT(EPOCH FROM (v_lot.countdown_end_at - v_current_time))::INT;
        IF v_countdown_remaining <= v_anti_snipe_threshold AND v_countdown_remaining > 0 THEN
            UPDATE auction_lots
            SET countdown_end_at = v_current_time + (v_anti_snipe_extension || ' seconds')::INTERVAL
            WHERE id = p_lot_id;
            
            v_lot.countdown_end_at := v_current_time + (v_anti_snipe_extension || ' seconds')::INTERVAL;
        END IF;
    END IF;
    
    -- Accept bid and update lot
    INSERT INTO auction_bids (auction_show_id, lot_id, bidder_id, bid_amount, accepted)
    VALUES (p_show_id, p_lot_id, v_user_id, p_bid_amount, true)
    RETURNING id INTO v_bid_id;
    
    v_new_highest_bid := p_bid_amount;
    v_new_bidder_id := v_user_id;
    
    UPDATE auction_lots
    SET current_highest_bid = v_new_highest_bid,
        current_highest_bidder_id = v_new_bidder_id,
        updated_at = now()
    WHERE id = p_lot_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'bid_accepted',
        p_show_id,
        p_lot_id,
        v_user_id,
        jsonb_build_object('bid_amount', p_bid_amount, 'bid_id', v_bid_id)
    );
    
    RETURN jsonb_build_object(
        'accepted', true,
        'highest_bid', v_new_highest_bid,
        'highest_bidder_id', v_new_bidder_id,
        'countdown_end_at', v_lot.countdown_end_at,
        'message', 'Bid accepted!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark lot as sold
CREATE OR REPLACE FUNCTION mark_lot_sold(p_show_id UUID, p_lot_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_show auction_shows%ROWTYPE;
    v_lot auction_lots%ROWTYPE;
    v_winner_id UUID;
    v_final_bid BIGINT;
    v_win_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- Check ownership
    DECLARE
        v_auctioneer_user UUID;
    BEGIN
        SELECT ap.user_id INTO v_auctioneer_user
        FROM auctioneer_profiles ap
        WHERE ap.id = v_show.auctioneer_id;
        
        IF v_auctioneer_user != v_user_id AND NOT is_admin(v_user_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
        END IF;
    END;
    
    -- Get lot
    SELECT * INTO v_lot
    FROM auction_lots
    WHERE id = p_lot_id AND auction_show_id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lot not found');
    END IF;
    
    IF v_lot.status != 'live' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lot must be live to be sold');
    END IF;
    
    IF v_lot.current_highest_bidder_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot sell lot without any bids');
    END IF;
    
    v_winner_id := v_lot.current_highest_bidder_id;
    v_final_bid := v_lot.current_highest_bid;
    
    -- Update lot status
    UPDATE auction_lots
    SET status = 'sold',
        winner_user_id = v_winner_id,
        final_bid = v_final_bid,
        sold_at = now(),
        updated_at = now()
    WHERE id = p_lot_id;
    
    -- Clear current lot from show if it's this one
    UPDATE auction_shows
    SET current_lot_id = NULL,
        updated_at = now()
    WHERE id = p_show_id AND current_lot_id = p_lot_id;
    
    -- Create win record
    INSERT INTO auction_wins (
        auction_show_id,
        lot_id,
        winner_user_id,
        final_bid,
        payment_status,
        fulfillment_status
    ) VALUES (
        p_show_id,
        p_lot_id,
        v_winner_id,
        v_final_bid,
        'pending',
        'pending'
    )
    RETURNING id INTO v_win_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'lot_sold',
        p_show_id,
        p_lot_id,
        v_winner_id,
        jsonb_build_object('final_bid', v_final_bid, 'win_id', v_win_id)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'winner_user_id', v_winner_id,
        'final_bid', v_final_bid,
        'message', 'Lot sold to highest bidder'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark lot as unsold
CREATE OR REPLACE FUNCTION mark_lot_unsold(p_show_id UUID, p_lot_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_show auction_shows%ROWTYPE;
    v_lot auction_lots%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- Check ownership
    DECLARE
        v_auctioneer_user UUID;
    BEGIN
        SELECT ap.user_id INTO v_auctioneer_user
        FROM auctioneer_profiles ap
        WHERE ap.id = v_show.auctioneer_id;
        
        IF v_auctioneer_user != v_user_id AND NOT is_admin(v_user_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
        END IF;
    END;
    
    -- Get lot
    SELECT * INTO v_lot
    FROM auction_lots
    WHERE id = p_lot_id AND auction_show_id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lot not found');
    END IF;
    
    IF v_lot.status != 'live' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lot must be live to be marked unsold');
    END IF;
    
    -- Update lot status
    UPDATE auction_lots
    SET status = 'unsold',
        current_highest_bid = NULL,
        current_highest_bidder_id = NULL,
        updated_at = now()
    WHERE id = p_lot_id;
    
    -- Clear current lot if this is it
    UPDATE auction_shows
    SET current_lot_id = NULL,
        updated_at = now()
    WHERE id = p_show_id AND current_lot_id = p_lot_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'lot_unsold',
        p_show_id,
        p_lot_id,
        NULL,
        jsonb_build_object('reason', 'Marked unsold by auctioneer')
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Lot marked as unsold');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End auction show
CREATE OR REPLACE FUNCTION end_auction_show(p_show_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_show auction_shows%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- Check ownership
    DECLARE
        v_auctioneer_user UUID;
    BEGIN
        SELECT ap.user_id INTO v_auctioneer_user
        FROM auctioneer_profiles ap
        WHERE ap.id = v_show.auctioneer_id;
        
        IF v_auctioneer_user != v_user_id AND NOT is_admin(v_user_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
        END IF;
    END;
    
    IF v_show.status NOT IN ('live', 'scheduled') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show cannot be ended in current state');
    END IF;
    
    -- End show
    UPDATE auction_shows
    SET status = 'ended',
        ended_at = now(),
        current_lot_id = NULL,
        updated_at = now()
    WHERE id = p_show_id;
    
    -- Mark any live lots
    UPDATE auction_lots
    SET status = CASE WHEN status = 'live' THEN 'unsold' ELSE status END,
        updated_at = now()
    WHERE auction_show_id = p_show_id AND status = 'live';
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'show_ended',
        p_show_id,
        NULL,
        NULL,
        jsonb_build_object('previous_status', v_show.status)
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Auction show ended');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set bid block (disable user from bidding)
CREATE OR REPLACE FUNCTION set_bid_block(
    p_blocked_user_id UUID,
    p_show_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_auctioneer_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get auctioneer user ID from show
    SELECT ap.user_id INTO v_auctioneer_user_id
    FROM auction_shows s
    JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
    WHERE s.id = p_show_id;
    
    -- Verify ownership or admin
    IF v_auctioneer_user_id != v_user_id AND NOT is_admin(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to block bidders in this show');
    END IF;
    
    -- Insert or update block
    INSERT INTO auction_bid_blocks (
        auctioneer_user_id,
        blocked_user_id,
        auction_show_id,
        reason,
        active
    ) VALUES (
        v_auctioneer_user_id,
        p_blocked_user_id,
        p_show_id,
        p_reason,
        true
    )
    ON CONFLICT (auctioneer_user_id, blocked_user_id, auction_show_id)
    DO UPDATE SET
        reason = COALESCE(p_reason, EXCLUDED.reason),
        active = true,
        updated_at = now();
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'bid_block_set',
        p_show_id,
        NULL,
        p_blocked_user_id,
        jsonb_build_object('reason', p_reason)
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'User blocked from bidding');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove bid block
CREATE OR REPLACE FUNCTION remove_bid_block(
    p_blocked_user_id UUID,
    p_show_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_auctioneer_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Get auctioneer user ID from show
    SELECT ap.user_id INTO v_auctioneer_user_id
    FROM auction_shows s
    JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
    WHERE s.id = p_show_id;
    
    -- Verify ownership or admin
    IF v_auctioneer_user_id != v_user_id AND NOT is_admin(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Deactivate block
    UPDATE auction_bid_blocks
    SET active = false,
        updated_at = now()
    WHERE blocked_user_id = p_blocked_user_id
      AND auction_show_id = p_show_id
      AND auctioneer_user_id = v_auctioneer_user_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'bid_block_removed',
        p_show_id,
        NULL,
        p_blocked_user_id,
        jsonb_build_object('removed_by', v_user_id)
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Bid block removed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- File auction report
CREATE OR REPLACE FUNCTION file_auction_report(
    p_reported_user_id UUID,
    p_show_id UUID,
    p_reason TEXT,
    p_lot_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_report_id UUID;
    v_reporter_role TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Determine reporter role
    IF is_admin(v_user_id) OR is_lead_troll_officer(v_user_id) THEN
        v_reporter_role := 'lead_troll_officer';
    ELSIF is_approved_auctioneer(v_user_id) THEN
        v_reporter_role := 'auctioneer';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'You must be an auctioneer or officer to file reports');
    END IF;
    
    -- Verify show exists
    IF NOT EXISTS (SELECT 1 FROM auction_shows WHERE id = p_show_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Show not found');
    END IF;
    
    -- If auctioneer, verify ownership
    IF v_reporter_role = 'auctioneer' THEN
        IF NOT EXISTS (
            SELECT 1 FROM auction_shows s
            JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
            WHERE s.id = p_show_id AND ap.user_id = v_user_id
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'You can only report on your own auction shows');
        END IF;
    END IF;
    
    -- Create report
    INSERT INTO auction_reports (
        reporter_id,
        reporter_role,
        reported_user_id,
        auction_show_id,
        lot_id,
        reason,
        notes,
        status
    ) VALUES (
        v_user_id,
        v_reporter_role,
        p_reported_user_id,
        p_show_id,
        p_lot_id,
        p_reason,
        p_notes,
        'open'
    )
    RETURNING id INTO v_report_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'report_filed',
        p_show_id,
        p_lot_id,
        p_reported_user_id,
        jsonb_build_object('reason', p_reason, 'report_id', v_report_id)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'report_id', v_report_id,
        'message', 'Report filed successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Review auction report
CREATE OR REPLACE FUNCTION review_auction_report(
    p_report_id UUID,
    p_status TEXT,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_report auction_reports%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Require officer or admin
    IF NOT is_admin(v_user_id) AND NOT is_lead_troll_officer(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lead Troll Officer or Admin access required');
    END IF;
    
    -- Validate status
    IF p_status NOT IN ('under_review', 'action_taken', 'dismissed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
    END IF;
    
    -- Get report
    SELECT * INTO v_report
    FROM auction_reports
    WHERE id = p_report_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Report not found');
    END IF;
    
    -- Update report
    UPDATE auction_reports
    SET status = p_status,
        reviewed_by = v_user_id,
        resolution_notes = p_resolution_notes,
        updated_at = now()
    WHERE id = p_report_id;
    
    -- Log audit
    PERFORM log_auction_audit(
        v_user_id,
        'report_reviewed',
        v_report.auction_show_id,
        v_report.lot_id,
        v_report.reported_user_id,
        jsonb_build_object('report_id', p_report_id, 'new_status', p_status)
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Report reviewed successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get live auction state (for frontend hydration)
CREATE OR REPLACE FUNCTION get_live_auction_state(p_show_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_show auction_shows%ROWTYPE;
    v_lot auction_lots%ROWTYPE;
    v_bids JSONB;
    v_can_bid JSONB;
    v_is_blocked BOOLEAN;
    v_live_bid_count INT;
BEGIN
    v_user_id := auth.uid();
    
    -- Get show
    SELECT * INTO v_show
    FROM auction_shows
    WHERE id = p_show_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Show not found');
    END IF;
    
    -- Get current lot
    SELECT * INTO v_lot
    FROM auction_lots
    WHERE id = v_show.current_lot_id;
    
    -- Get recent bids for current lot
    IF v_lot.id IS NOT NULL THEN
        SELECT jsonb_agg(bid_obj) INTO v_bids
        FROM (
            SELECT jsonb_build_object(
                'id', id,
                'bidder_id', bidder_id,
                'bid_amount', bid_amount,
                'created_at', created_at
            ) AS bid_obj
            FROM auction_bids
            WHERE lot_id = v_lot.id AND accepted = true
            ORDER BY created_at DESC
            LIMIT 20
        ) AS recent_bids;
        
        SELECT COUNT(*) INTO v_live_bid_count
        FROM auction_bids
        WHERE lot_id = v_lot.id AND accepted = true;
    ELSE
        v_bids := '[]'::JSONB;
        v_live_bid_count := 0;
    END IF;
    
    -- Check if current user is blocked
    IF v_user_id IS NOT NULL AND v_show.auctioneer_id IS NOT NULL THEN
        DECLARE
            v_auctioneer_user_id UUID;
        BEGIN
            SELECT ap.user_id INTO v_auctioneer_user_id
            FROM auctioneer_profiles ap
            WHERE ap.id = v_show.auctioneer_id;
            
            v_is_blocked := EXISTS (
                SELECT 1 FROM auction_bid_blocks
                WHERE auctioneer_user_id = v_auctioneer_user_id
                  AND blocked_user_id = v_user_id
                  AND active = true
                  AND (auction_show_id = p_show_id OR auction_show_id IS NULL)
            );
        END;
    ELSE
        v_is_blocked := false;
    END IF;
    
    -- Get user's bid eligibility
    IF v_user_id IS NOT NULL AND v_lot.id IS NOT NULL THEN
        v_can_bid := user_can_bid(v_user_id, p_show_id, v_lot.id);
    ELSE
        v_can_bid := jsonb_build_object('allowed', false, 'reason', 'No active lot');
    END IF;
    
    RETURN jsonb_build_object(
        'show', jsonb_build_object(
            'id', v_show.id,
            'title', v_show.title,
            'status', v_show.status,
            'livekit_room_name', v_show.livekit_room_name,
            'live_started_at', v_show.live_started_at,
            'viewer_count', (
                SELECT COUNT(*) FROM auction_presence
                WHERE auction_show_id = p_show_id AND is_active = true
            )
        ),
        'current_lot', CASE WHEN v_lot.id IS NOT NULL THEN
            jsonb_build_object(
                'id', v_lot.id,
                'title', v_lot.title,
                'description', v_lot.description,
                'image_urls', v_lot.image_urls,
                'starting_bid', v_lot.starting_bid,
                'min_increment', v_lot.min_increment,
                'current_highest_bid', v_lot.current_highest_bid,
                'current_highest_bidder_id', v_lot.current_highest_bidder_id,
                'status', v_lot.status,
                'countdown_end_at', v_lot.countdown_end_at,
                'bid_count', v_live_bid_count
            )
        ELSE NULL END,
        'recent_bids', COALESCE(v_bids, '[]'::JSONB),
        'user_eligibility', v_can_bid,
        'is_blocked', COALESCE(v_is_blocked, false),
        'user_balance', CASE WHEN v_user_id IS NOT NULL THEN user_coin_balance(v_user_id) ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update auction presence
CREATE OR REPLACE FUNCTION update_auction_presence(
    p_show_id UUID,
    p_presence_role TEXT DEFAULT 'viewer'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Upsert presence
    INSERT INTO auction_presence (auction_show_id, user_id, presence_role, is_active)
    VALUES (p_show_id, v_user_id, p_presence_role, true)
    ON CONFLICT (auction_show_id, user_id)
    DO UPDATE SET
        last_seen_at = now(),
        is_active = true,
        presence_role = COALESCE(p_presence_role, EXCLUDED.presence_role);
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get auction shows list (for discovery)
CREATE OR REPLACE FUNCTION get_auction_shows(
    p_status TEXT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_shows JSONB;
    v_total INT;
BEGIN
    -- Get shows based on status filter
    IF p_status IS NOT NULL THEN
        SELECT jsonb_agg(jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'slug', s.slug,
            'description', s.description,
            'thumbnail_url', s.thumbnail_url,
            'status', s.status,
            'scheduled_for', s.scheduled_for,
            'live_started_at', s.live_started_at,
            'is_featured', s.is_featured,
            'livekit_room_name', s.livekit_room_name,
            'current_lot_id', s.current_lot_id,
            'viewer_count', (
                SELECT COUNT(*) FROM auction_presence
                WHERE auction_show_id = s.id AND is_active = true
            ),
            'auctioneer', jsonb_build_object(
                'user_id', ap.user_id,
                'display_name', up.username
            )
        ))
        INTO v_shows
        FROM auction_shows s
        JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
        JOIN public.user_profiles up ON ap.user_id = up.id
        WHERE s.status = p_status
        ORDER BY 
            CASE p_status
                WHEN 'live' THEN s.live_started_at
                WHEN 'scheduled' THEN s.scheduled_for
                ELSE s.created_at
            END DESC
        LIMIT p_limit OFFSET p_offset;
        
        SELECT COUNT(*) INTO v_total
        FROM auction_shows
        WHERE status = p_status;
    ELSE
        -- Get all non-draft shows
        SELECT jsonb_agg(jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'slug', s.slug,
            'status', s.status,
            'livekit_room_name', s.livekit_room_name,
            'viewer_count', (
                SELECT COUNT(*) FROM auction_presence
                WHERE auction_show_id = s.id AND is_active = true
            )
        ))
        INTO v_shows
        FROM auction_shows s
        WHERE s.status != 'draft'
        ORDER BY 
            CASE s.status
                WHEN 'live' THEN s.live_started_at
                WHEN 'scheduled' THEN s.scheduled_for
                ELSE s.created_at
            END DESC
        LIMIT p_limit OFFSET p_offset;
        
        SELECT COUNT(*) INTO v_total
        FROM auction_shows
        WHERE status != 'draft';
    END IF;
    
    RETURN jsonb_build_object(
        'shows', COALESCE(v_shows, '[]'::JSONB),
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE auctioneer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctioneer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bid_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_audit_logs ENABLE ROW LEVEL SECURITY;

-- auctioneer_applications policies
CREATE POLICY "Users can view own applications" ON auctioneer_applications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert own application" ON auctioneer_applications
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all applications" ON auctioneer_applications
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR is_lead_officer = true))
    );

CREATE POLICY "Admins can update applications" ON auctioneer_applications
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR is_lead_officer = true))
    );

-- auctioneer_profiles policies
CREATE POLICY "Public can view active auctioneer profiles" ON auctioneer_profiles
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view own profile" ON auctioneer_profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage auctioneer profiles" ON auctioneer_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- auction_shows policies
CREATE POLICY "Public can view non-draft shows" ON auction_shows
    FOR SELECT USING (status != 'draft');

CREATE POLICY "Auctioneers can manage own shows" ON auction_shows
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auctioneer_profiles ap
            WHERE ap.id = auctioneer_id AND ap.user_id = auth.uid() AND ap.is_active = true
        )
    );

CREATE POLICY "Admins can manage all shows" ON auction_shows
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- auction_lots policies
CREATE POLICY "Public can view lots for visible shows" ON auction_lots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auction_shows s
            WHERE s.id = auction_show_id AND s.status != 'draft'
        )
    );

CREATE POLICY "Auctioneers can manage own lots" ON auction_lots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auction_shows s
            JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
            WHERE s.id = auction_show_id AND ap.user_id = auth.uid() AND ap.is_active = true
        )
    );

CREATE POLICY "Admins can manage all lots" ON auction_lots
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- auction_bids policies
CREATE POLICY "Public can view accepted bids for live shows" ON auction_bids
    FOR SELECT USING (
        accepted = true AND
        EXISTS (
            SELECT 1 FROM auction_shows s
            WHERE s.id = auction_show_id AND s.status IN ('live', 'ended')
        )
    );

CREATE POLICY "Bidders can view own bids" ON auction_bids
    FOR SELECT USING (bidder_id = auth.uid());

CREATE POLICY "Auctioneers can view bids in own shows" ON auction_bids
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auction_shows s
            JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
            WHERE s.id = auction_show_id AND ap.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all bids" ON auction_bids
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR is_lead_officer = true))
    );

-- auction_bid_blocks policies
CREATE POLICY "Blocked users can view own blocks" ON auction_bid_blocks
    FOR SELECT USING (blocked_user_id = auth.uid());

CREATE POLICY "Auctioneers can manage own blocks" ON auction_bid_blocks
    FOR ALL USING (
        auctioneer_user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- auction_reports policies
CREATE POLICY "Reporters can view own reports" ON auction_reports
    FOR SELECT USING (reporter_id = auth.uid());

CREATE POLICY "Admins and officers can view all reports" ON auction_reports
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR is_lead_officer = true))
    );

CREATE POLICY "Auctioneers can create reports for own shows" ON auction_reports
    FOR INSERT WITH CHECK (
        reporter_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR is_lead_officer = true))
    );

CREATE POLICY "Officers can update reports" ON auction_reports
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR is_lead_officer = true))
    );

-- auction_wins policies
CREATE POLICY "Winners can view own wins" ON auction_wins
    FOR SELECT USING (winner_user_id = auth.uid());

CREATE POLICY "Auctioneers can view wins in own shows" ON auction_wins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auction_shows s
            JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
            WHERE s.id = auction_show_id AND ap.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all wins" ON auction_wins
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- auction_presence policies
CREATE POLICY "Users can update own presence" ON auction_presence
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Public can view active presence count" ON auction_presence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auction_shows s
            WHERE s.id = auction_show_id AND s.status != 'draft'
        )
    );

-- auction_audit_logs policies
CREATE POLICY "Admins can view audit logs" ON auction_audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR is_lead_officer = true))
    );

-- ============================================================================
-- PART 7: REALTIME SUBSCRIPTIONS SETUP
-- ============================================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE auction_shows;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_lots;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_bid_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_reports;

-- ============================================================================
-- END OF PART 2
-- ============================================================================