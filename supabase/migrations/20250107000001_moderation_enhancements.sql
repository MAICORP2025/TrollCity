-- Moderation System Enhancements
-- Add ban time limits, reporting chain, and kick/ban reason requirements

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'moderation_actions'
  ) THEN
    -- Add ban_expires_at to moderation_actions
    ALTER TABLE moderation_actions 
    ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMPTZ;

    -- Add ban_duration_hours to moderation_actions (for reference)
    ALTER TABLE moderation_actions 
    ADD COLUMN IF NOT EXISTS ban_duration_hours INTEGER;

    -- Add honesty_message_shown to moderation_actions
    ALTER TABLE moderation_actions 
    ADD COLUMN IF NOT EXISTS honesty_message_shown BOOLEAN DEFAULT false;

    -- Add reason column to moderation_actions if it doesn't exist
    ALTER TABLE moderation_actions
    ADD COLUMN IF NOT EXISTS reason TEXT;

    -- Update moderation_actions to require reason (only if column exists and has no nulls)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'moderation_actions' AND column_name = 'reason'
    ) THEN
      -- Check if there are any null values
      IF NOT EXISTS (
        SELECT 1 FROM moderation_actions WHERE reason IS NULL
      ) THEN
        ALTER TABLE moderation_actions
        ALTER COLUMN reason SET NOT NULL;
      END IF;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'moderation_actions'
  ) THEN
    COMMENT ON COLUMN moderation_actions.ban_expires_at IS 'When the ban expires (NULL for permanent)';
    COMMENT ON COLUMN moderation_actions.ban_duration_hours IS 'Duration of ban in hours';
    COMMENT ON COLUMN moderation_actions.honesty_message_shown IS 'Whether honesty message was shown to user';
  END IF;
END $$;

