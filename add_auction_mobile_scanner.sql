-- ============================================================================
-- AUCTION MOBILE SCANNER — Database Migration
-- ============================================================================
-- Adds support for auctioneer mobile scanner sessions and scan events.
-- Enables the desktop auction studio + mobile scanner workflow.
-- ============================================================================

-- ============================================================================
-- 1. AUCTION DEVICE SESSIONS — tracks mobile scanner pairing sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS auction_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES auction_shows(id) ON DELETE SET NULL,
  auctioneer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pairing_code TEXT NOT NULL UNIQUE,
  session_token TEXT NOT NULL UNIQUE,
  device_id TEXT,
  device_name TEXT,
  device_info JSONB DEFAULT '{}'::JSONB,
  connected_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paired', 'connected', 'disconnected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_device_sessions_auction ON auction_device_sessions(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_device_sessions_auctioneer ON auction_device_sessions(auctioneer_id);
CREATE INDEX IF NOT EXISTS idx_auction_device_sessions_pairing_code ON auction_device_sessions(pairing_code);
CREATE INDEX IF NOT EXISTS idx_auction_device_sessions_status ON auction_device_sessions(status);
CREATE INDEX IF NOT EXISTS idx_auction_device_sessions_expires ON auction_device_sessions(expires_at);

-- Enable RLS
ALTER TABLE auction_device_sessions ENABLE ROW LEVEL SECURITY;

-- Auctioneers can read/write their own sessions
CREATE POLICY "auctioneers_read_own_sessions"
  ON auction_device_sessions
  FOR SELECT
  USING (auctioneer_id = auth.uid());

CREATE POLICY "auctioneers_insert_own_sessions"
  ON auction_device_sessions
  FOR INSERT
  WITH CHECK (auctioneer_id = auth.uid());

CREATE POLICY "auctioneers_update_own_sessions"
  ON auction_device_sessions
  FOR UPDATE
  USING (auctioneer_id = auth.uid());

CREATE POLICY "auctioneers_delete_own_sessions"
  ON auction_device_sessions
  FOR DELETE
  USING (auctioneer_id = auth.uid());

-- Admins can read all sessions
CREATE POLICY "admin_read_all_sessions"
  ON auction_device_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- Admins can delete any session
CREATE POLICY "admin_delete_all_sessions"
  ON auction_device_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- Auto-expire stale pairing sessions
CREATE OR REPLACE FUNCTION expire_auction_device_sessions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auction_device_sessions
  SET status = 'expired', updated_at = now()
  WHERE status IN ('pending', 'paired')
    AND expires_at < now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run expiration check every minute via pg_cron (if available) or on access
-- For now, we check on read via the status field

-- ============================================================================
-- 2. AUCTION SCAN EVENTS — records barcode/QR scans from mobile devices
-- ============================================================================

CREATE TABLE IF NOT EXISTS auction_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES auction_shows(id) ON DELETE SET NULL,
  device_session_id UUID REFERENCES auction_device_sessions(id) ON DELETE SET NULL,
  device_id TEXT,
  barcode TEXT NOT NULL,
  barcode_type TEXT DEFAULT 'unknown'
    CHECK (barcode_type IN ('qr', 'upc', 'ean', 'code128', 'code39', 'itf', 'unknown')),
  payload JSONB DEFAULT '{}'::JSONB,
  processed BOOLEAN NOT NULL DEFAULT false,
  lot_id UUID REFERENCES auction_lots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_scan_events_auction ON auction_scan_events(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_scan_events_device ON auction_scan_events(device_session_id);
CREATE INDEX IF NOT EXISTS idx_auction_scan_events_barcode ON auction_scan_events(barcode);
CREATE INDEX IF NOT EXISTS idx_auction_scan_events_created ON auction_scan_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_scan_events_processed ON auction_scan_events(processed);

-- ============================================================================
-- 3. ENABLE REALTIME on new tables
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE auction_device_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_scan_events;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE auction_device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_scan_events ENABLE ROW LEVEL SECURITY;

-- Auction device sessions: auctioneers can manage their own sessions
CREATE POLICY "Auctioneers can manage their own device sessions"
  ON auction_device_sessions
  FOR ALL
  USING (auctioneer_id = auth.uid())
  WITH CHECK (auctioneer_id = auth.uid());

-- Auction scan events: auctioneers can read scans for their auctions
CREATE POLICY "Auctioneers can read scan events for their auctions"
  ON auction_scan_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auction_shows
      WHERE auction_shows.id = auction_scan_events.auction_id
        AND auction_shows.auctioneer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM auction_device_sessions
      WHERE auction_device_sessions.id = auction_scan_events.device_session_id
        AND auction_device_sessions.auctioneer_id = auth.uid()
    )
  );

-- Auction scan events: connected devices can insert scans
CREATE POLICY "Devices can insert scan events"
  ON auction_scan_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auction_device_sessions
      WHERE auction_device_sessions.id = auction_scan_events.device_session_id
        AND auction_device_sessions.status IN ('paired', 'connected')
        AND auction_device_sessions.expires_at > now()
    )
  );

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Generate a random 6-digit pairing code
CREATE OR REPLACE FUNCTION generate_auction_pairing_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM auction_device_sessions WHERE pairing_code = code AND status IN ('pending', 'paired', 'connected')) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired device sessions (call periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_auction_device_sessions()
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  UPDATE auction_device_sessions
  SET status = 'expired', updated_at = now()
  WHERE status IN ('pending', 'paired')
    AND expires_at < now();
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE auction_device_sessions IS 'Tracks mobile scanner pairing sessions for auctioneers';
COMMENT ON TABLE auction_scan_events IS 'Records barcode/QR scans from mobile scanner devices';
