-- Add duration column to global_events table
ALTER TABLE global_events ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 5;

-- Create index for querying ticker messages
CREATE INDEX IF NOT EXISTS idx_global_events_type_created ON global_events (type, created_at DESC);