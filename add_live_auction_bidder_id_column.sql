-- ============================================================================
-- Add missing bidder_id column to auction_bids for live auctions
-- Run this before create_live_auctions_part2_functions.sql if your DB returns
-- "column bidder_id does not exist".
-- ============================================================================

-- Add bidder_id if missing
ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS bidder_id UUID;

-- Backfill bidder_id from bidder_user_id if that legacy column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'auction_bids'
          AND column_name = 'bidder_user_id'
    ) THEN
        UPDATE auction_bids
        SET bidder_id = bidder_user_id
        WHERE bidder_id IS NULL;
    END IF;
END$$;

-- Add foreign key constraint if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_auction_bids_bidder'
    ) THEN
        ALTER TABLE auction_bids
        ADD CONSTRAINT fk_auction_bids_bidder
        FOREIGN KEY (bidder_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END$$;

-- Add indexes for bidder lookup
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id_created ON auction_bids(bidder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_user_id ON auction_bids(bidder_user_id);
