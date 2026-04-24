-- ============================================================================
-- Add missing accepted/rejection_reason columns to auction_bids
-- Run this before create_live_auctions_part2_functions.sql if your DB returns
-- "column accepted does not exist".
-- ============================================================================

ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_auction_bids_accepted ON auction_bids(accepted) WHERE accepted = true;
CREATE INDEX IF NOT EXISTS idx_auction_bids_rejection_reason ON auction_bids(rejection_reason);
