-- ============================================================================
-- Add missing lot_id columns and constraints for live auctions
-- Run this before Part 2 if your DB schema is missing the lot_id fields.
-- ============================================================================

-- Add lot_id columns if they don't exist
ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS lot_id UUID;
ALTER TABLE auction_reports ADD COLUMN IF NOT EXISTS lot_id UUID;
ALTER TABLE auction_wins ADD COLUMN IF NOT EXISTS lot_id UUID;
ALTER TABLE auction_audit_logs ADD COLUMN IF NOT EXISTS lot_id UUID;

-- Add foreign key constraints only if they are not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_bids_lot'
    ) THEN
        ALTER TABLE auction_bids
        ADD CONSTRAINT fk_bids_lot FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_reports_lot'
    ) THEN
        ALTER TABLE auction_reports
        ADD CONSTRAINT fk_reports_lot FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_wins_lot'
    ) THEN
        ALTER TABLE auction_wins
        ADD CONSTRAINT fk_wins_lot FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_audit_lot'
    ) THEN
        ALTER TABLE auction_audit_logs
        ADD CONSTRAINT fk_audit_lot FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE SET NULL;
    END IF;
END$$;

-- Add required indexes for lot lookups
CREATE INDEX IF NOT EXISTS idx_auction_bids_lot_id_created ON auction_bids(lot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_reports_lot_id ON auction_reports(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_wins_lot_id ON auction_wins(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_audit_logs_lot_id ON auction_audit_logs(lot_id);
