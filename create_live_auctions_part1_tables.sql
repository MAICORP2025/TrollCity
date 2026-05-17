-- ============================================================================
-- LIVE AUCTIONS - Part 1: Tables Only
-- Run this first to create all tables
-- ============================================================================

-- A. Auctioneer Applications - Users apply to become approved auctioneers
CREATE TABLE IF NOT EXISTS auctioneer_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    display_name TEXT NOT NULL,
    application_text TEXT NOT NULL,
    selling_plan TEXT,
    experience TEXT,
    agreement_accepted BOOLEAN NOT NULL DEFAULT false,
    admin_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B. Auctioneer Profiles - Approved auctioneer registry
CREATE TABLE IF NOT EXISTS auctioneer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    strike_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. Auction Shows - Live/scheduled auction shows hosted by approved auctioneers
CREATE TABLE IF NOT EXISTS auction_shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auctioneer_id UUID NOT NULL REFERENCES auctioneer_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    category TEXT,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
    scheduled_for TIMESTAMPTZ,
    live_started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    livekit_room_name TEXT UNIQUE,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    current_lot_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D. Auction Lots - Items sold inside each show
CREATE TABLE IF NOT EXISTS auction_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
    starting_bid BIGINT NOT NULL CHECK (starting_bid >= 0),
    min_increment BIGINT NOT NULL DEFAULT 1 CHECK (min_increment > 0),
    current_highest_bid BIGINT,
    current_highest_bidder_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'sold', 'unsold', 'cancelled')),
    order_index INTEGER NOT NULL DEFAULT 0,
    winner_user_id UUID REFERENCES auth.users(id),
    final_bid BIGINT,
    sold_at TIMESTAMPTZ,
    countdown_end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E. Auction Bids - Immutable bid ledger
CREATE TABLE IF NOT EXISTS auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL,
    bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bid_amount BIGINT NOT NULL CHECK (bid_amount > 0),
    accepted BOOLEAN NOT NULL DEFAULT false,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F. Auction Bid Blocks - Block users from bidding while still allowing view access
CREATE TABLE IF NOT EXISTS auction_bid_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auctioneer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    auction_show_id UUID NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
    reason TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G. Auction Reports - Auctioneer reports to Lead Troll Officers
CREATE TABLE IF NOT EXISTS auction_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reporter_role TEXT,
    reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
    lot_id UUID NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'action_taken', 'dismissed')),
    reviewed_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- H. Auction Wins - Winning record / payment obligation
CREATE TABLE IF NOT EXISTS auction_wins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL UNIQUE,
    winner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    final_bid BIGINT NOT NULL CHECK (final_bid > 0),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'held', 'paid', 'failed', 'cancelled', 'refunded')),
    fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- I. Auction Presence - Analytics/presence snapshots
CREATE TABLE IF NOT EXISTS auction_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    presence_role TEXT NOT NULL CHECK (presence_role IN ('viewer', 'bidder', 'auctioneer', 'mod')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- J. Auction Audit Logs - Immutable moderation and auction event tracking
CREATE TABLE IF NOT EXISTS auction_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    auction_show_id UUID REFERENCES auction_shows(id) ON DELETE SET NULL,
    lot_id UUID,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);