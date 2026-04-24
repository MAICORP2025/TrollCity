-- Fix for auction_bids table - ensure bid_amount column exists
-- Run this in Supabase SQL editor

-- Check if bid_amount column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_bids' AND column_name = 'bid_amount'
    ) THEN
        ALTER TABLE auction_bids ADD COLUMN bid_amount BIGINT NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Also ensure other required columns exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_bids' AND column_name = 'accepted'
    ) THEN
        ALTER TABLE auction_bids ADD COLUMN accepted BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_bids' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE auction_bids ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_bids' AND column_name = 'auction_show_id'
    ) THEN
        ALTER TABLE auction_bids ADD COLUMN auction_show_id UUID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_bids' AND column_name = 'lot_id'
    ) THEN
        ALTER TABLE auction_bids ADD COLUMN lot_id UUID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_bids' AND column_name = 'bidder_id'
    ) THEN
        ALTER TABLE auction_bids ADD COLUMN bidder_id UUID;
    END IF;
END $$;