-- Add is_pinned column to troll_wall_posts
ALTER TABLE troll_wall_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Index for efficient querying of pinned posts
CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_is_pinned ON troll_wall_posts(is_pinned) WHERE is_pinned = true;
