-- Fix stream_momentum RLS policies
-- Enable RLS on stream_momentum table if not already enabled

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'stream_momentum'
    AND n.nspname = 'public'
  ) THEN
    -- Create stream_momentum table if it doesn't exist
    CREATE TABLE stream_momentum (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
      momentum INTEGER DEFAULT 100,
      last_gift_at TIMESTAMPTZ,
      last_decay_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Create unique index on stream_id
    CREATE UNIQUE INDEX idx_stream_momentum_stream_id ON stream_momentum(stream_id);

    -- Create indexes for performance
    CREATE INDEX idx_stream_momentum_momentum ON stream_momentum(momentum);
    CREATE INDEX idx_stream_momentum_last_gift_at ON stream_momentum(last_gift_at);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE stream_momentum ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view stream momentum" ON stream_momentum;
DROP POLICY IF EXISTS "Stream owners can manage momentum" ON stream_momentum;
DROP POLICY IF EXISTS "Admins can manage all momentum" ON stream_momentum;

-- Allow all users to view stream momentum (needed for home page display)
CREATE POLICY "Users can view stream momentum"
  ON stream_momentum FOR SELECT
  USING (true);

-- Allow stream owners to update their own momentum
CREATE POLICY "Stream owners can manage momentum"
  ON stream_momentum FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_momentum.stream_id
      AND streams.broadcaster_id = auth.uid()
    )
  );

-- Allow admins to manage all momentum
CREATE POLICY "Admins can manage all momentum"
  ON stream_momentum FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

GRANT SELECT ON stream_momentum TO authenticated;
GRANT SELECT ON stream_momentum TO anonymous;
