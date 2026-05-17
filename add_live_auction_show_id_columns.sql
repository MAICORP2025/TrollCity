-- ============================================================================
-- Add missing auction_show_id columns and constraints for live auctions
-- Run this before create_live_auctions_part2_functions.sql if your DB returns
-- "column auction_show_id does not exist".
-- ============================================================================

-- Add auction_show_id columns if missing
ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS auction_show_id UUID;
ALTER TABLE auction_bid_blocks ADD COLUMN IF NOT EXISTS auction_show_id UUID;
ALTER TABLE auction_reports ADD COLUMN IF NOT EXISTS auction_show_id UUID;
ALTER TABLE auction_wins ADD COLUMN IF NOT EXISTS auction_show_id UUID;
ALTER TABLE auction_presence ADD COLUMN IF NOT EXISTS auction_show_id UUID;
ALTER TABLE auction_audit_logs ADD COLUMN IF NOT EXISTS auction_show_id UUID;

-- Add foreign key constraints if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_auction_bids_show'
    ) THEN
        ALTER TABLE auction_bids
        ADD CONSTRAINT fk_auction_bids_show FOREIGN KEY (auction_show_id) REFERENCES auction_shows(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_auction_bid_blocks_show'
    ) THEN
        ALTER TABLE auction_bid_blocks
        ADD CONSTRAINT fk_auction_bid_blocks_show FOREIGN KEY (auction_show_id) REFERENCES auction_shows(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_auction_reports_show'
    ) THEN
        ALTER TABLE auction_reports
        ADD CONSTRAINT fk_auction_reports_show FOREIGN KEY (auction_show_id) REFERENCES auction_shows(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_auction_wins_show'
    ) THEN
        ALTER TABLE auction_wins
        ADD CONSTRAINT fk_auction_wins_show FOREIGN KEY (auction_show_id) REFERENCES auction_shows(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_auction_presence_show'
    ) THEN
        ALTER TABLE auction_presence
        ADD CONSTRAINT fk_auction_presence_show FOREIGN KEY (auction_show_id) REFERENCES auction_shows(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_auction_audit_show'
    ) THEN
        ALTER TABLE auction_audit_logs
        ADD CONSTRAINT fk_auction_audit_show FOREIGN KEY (auction_show_id) REFERENCES auction_shows(id) ON DELETE SET NULL;
    END IF;
END$$;

-- Add indexes for auction_show_id lookups
CREATE INDEX IF NOT EXISTS idx_auction_bids_show_id_created ON auction_bids(auction_show_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bid_blocks_show ON auction_bid_blocks(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_reports_show ON auction_reports(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_wins_show ON auction_wins(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_presence_show ON auction_presence(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_audit_show ON auction_audit_logs(auction_show_id);
