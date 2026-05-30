-- Add display_text column to auction_shows for real-time auctioneer announcements
ALTER TABLE auction_shows
  ADD COLUMN IF NOT EXISTS display_text TEXT DEFAULT '';

-- Add index for real-time subscription performance
CREATE INDEX IF NOT EXISTS idx_auction_shows_display_text ON auction_shows(id) WHERE display_text IS NOT NULL AND display_text != '';

COMMENT ON COLUMN auction_shows.display_text IS 'Real-time display message shown to all auction viewers. Max 5000 characters. Updated by auctioneer and synced via Supabase realtime.';
