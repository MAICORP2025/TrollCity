-- Add missing columns for gifts quantity and stream like counters
ALTER TABLE IF EXISTS gifts ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
ALTER TABLE IF EXISTS gifts ADD COLUMN IF NOT EXISTS gift_id text;

-- Add a total_likes counter to streams for troll-like button
ALTER TABLE IF EXISTS streams ADD COLUMN IF NOT EXISTS total_likes integer DEFAULT 0;

-- Notes: Run this migration in your Postgres/Supabase DB.
-- If you use a migrations system, integrate this file into that pipeline.
