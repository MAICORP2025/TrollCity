-- Fix RLS for notifications table to allow service role bulk inserts
-- Run this in your Supabase SQL Editor

-- Option 1: Grant bypass RLS to service role (if using service_role key)
ALTER ROLE service_role WITH BYPASSRLS;

-- Option 2: Update the policies to explicitly allow service_role
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;

CREATE POLICY "Service role can insert notifications"
ON notifications FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Authenticated can insert notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (auth.role() IN ('admin', 'service_role'));

-- Option 3: Create a bulk insert function with SECURITY DEFINER
-- This bypasses RLS because it's SECURITY DEFINER
CREATE OR REPLACE FUNCTION bulk_create_notifications(
  p_notifications JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_notification JSONB;
BEGIN
  FOR v_notification IN SELECT * FROM jsonb_array_elements(p_notifications)
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata,
      is_read,
      created_at
    ) VALUES (
      (v_notification->>'user_id')::UUID,
      v_notification->>'type',
      v_notification->>'title',
      v_notification->>'message',
      COALESCE(v_notification->'metadata', '{}'::jsonb),
      COALESCE((v_notification->>'is_read')::BOOLEAN, FALSE),
      COALESCE(v_notification->>'created_at', now()::TEXT)::TIMESTAMPTZ
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_create_notifications(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_create_notifications(JSONB) TO service_role;
