-- Fix broadcast visibility and streaming issues
-- Issues fixed:
-- 1. Broadcasters were not publishing video/audio tracks properly due to connection timing
-- 2. Viewers and broadcasters were both using POST requests, causing wrong token grants
-- 3. LiveKit tokens for viewers didn't properly indicate read-only access

BEGIN;

-- Ensure streams table is properly accessible
DROP POLICY IF EXISTS "streams_select" ON streams;
CREATE POLICY "streams_select" ON streams
FOR SELECT
USING (true);  -- All authenticated users can see live streams

-- Ensure streams table allows broadcasters to create/update
DROP POLICY IF EXISTS "streams_insert_own" ON streams;
CREATE POLICY "streams_insert_own" ON streams
FOR INSERT
WITH CHECK (broadcaster_id = auth.uid());

DROP POLICY IF EXISTS "streams_update_own" ON streams;
CREATE POLICY "streams_update_own" ON streams
FOR UPDATE
USING (broadcaster_id = auth.uid())
WITH CHECK (broadcaster_id = auth.uid());

-- Ensure stream_participants table is accessible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_participants') THEN
    DROP POLICY IF EXISTS "view stream participants" ON stream_participants;
    CREATE POLICY "view stream participants" ON stream_participants
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Ensure stream_gifts table is accessible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_gifts') THEN
    DROP POLICY IF EXISTS "view stream gifts" ON stream_gifts;
    CREATE POLICY "view stream gifts" ON stream_gifts
    FOR SELECT
    USING (true);
    
    DROP POLICY IF EXISTS "users insert own gifts" ON stream_gifts;
    CREATE POLICY "users insert own gifts" ON stream_gifts
    FOR INSERT
    WITH CHECK (sender_id = auth.uid());
  END IF;
END $$;

-- Ensure stream_messages table is accessible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_messages') THEN
    DROP POLICY IF EXISTS "view stream messages" ON stream_messages;
    CREATE POLICY "view stream messages" ON stream_messages
    FOR SELECT
    USING (true);
    
    DROP POLICY IF EXISTS "users insert own messages" ON stream_messages;
    CREATE POLICY "users insert own messages" ON stream_messages
    FOR INSERT
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

COMMIT;
