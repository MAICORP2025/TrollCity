-- Optimized function to get user conversations in a single query
-- This replaces multiple queries in the application
CREATE OR REPLACE FUNCTION get_user_conversations_optimized(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_username TEXT,
  other_avatar_url TEXT,
  last_message TEXT,
  last_timestamp TIMESTAMPTZ,
  unread_count BIGINT,
  is_online BOOLEAN,
  rgb_username_expires_at TIMESTAMPTZ,
  glowing_username_color TEXT,
  other_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT cm.conversation_id AS conv_id
    FROM conversation_members cm
    WHERE cm.user_id = p_user_id
  ),
  other_members AS (
    SELECT 
      cm.conversation_id AS conv_id,
      cm.user_id AS other_user_id,
      COALESCE(NULLIF(up.display_name, ''), up.username, 'user' || left(cm.user_id::text, 6)) AS other_username,
      COALESCE(up.avatar_url, '') AS other_avatar_url,
      COALESCE(up.rgb_username_expires_at, '1970-01-01'::TIMESTAMPTZ) AS rgb_username_expires_at,
      COALESCE(up.glowing_username_color, '') AS glowing_username_color,
      COALESCE(up.created_at, now()) AS other_created_at
    FROM conversation_members cm
    LEFT JOIN user_profiles up ON cm.user_id = up.id
    WHERE cm.conversation_id IN (SELECT uc.conv_id FROM user_conversations uc)
      AND cm.user_id != p_user_id
  ),
  last_messages AS (
    SELECT DISTINCT ON (msg.conversation_id)
      msg.conversation_id AS conv_id,
      msg.body AS last_message,
      msg.created_at AS last_timestamp
    FROM conversation_messages msg
    WHERE msg.conversation_id IN (SELECT uc.conv_id FROM user_conversations uc)
      AND msg.is_deleted = false
    ORDER BY msg.conversation_id, msg.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      msg.conversation_id AS conv_id,
      COUNT(*)::BIGINT AS unread_count
    FROM conversation_messages msg
    WHERE msg.conversation_id IN (SELECT uc.conv_id FROM user_conversations uc)
      AND msg.sender_id != p_user_id
      AND msg.read_at IS NULL
      AND msg.is_deleted = FALSE
    GROUP BY msg.conversation_id
  )
  SELECT 
    om.conv_id AS conversation_id,
    om.other_user_id,
    COALESCE(NULLIF(om.other_username, ''), 'user' || left(om.other_user_id::text, 6)) AS other_username,
    om.other_avatar_url,
    COALESCE(lm.last_message, 'No messages yet'::TEXT) AS last_message,
    COALESCE(lm.last_timestamp, '1970-01-01'::TIMESTAMPTZ) AS last_timestamp,
    COALESCE(uc.unread_count, 0::BIGINT) AS unread_count,
    FALSE AS is_online,
    om.rgb_username_expires_at,
    om.glowing_username_color,
    om.other_created_at
  FROM other_members om
  LEFT JOIN last_messages lm ON om.conv_id = lm.conv_id
  LEFT JOIN unread_counts uc ON om.conv_id = uc.conv_id

  ORDER BY lm.last_timestamp DESC NULLS LAST;
END;
$$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_read ON conversation_messages(conversation_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(created_at DESC);
