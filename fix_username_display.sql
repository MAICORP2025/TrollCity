-- Fix for TCPS username display
-- Uses username only with user ID fallback

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
      COALESCE(up.username, 'user' || LEFT(cm.user_id::TEXT, 6)) AS other_username,
      COALESCE(up.avatar_url, '') AS other_avatar_url,
      COALESCE(up.rgb_username_expires_at, '1970-01-01'::TIMESTAMPTZ) AS rgb_username_expires_at,
      COALESCE(up.glowing_username_color, '') AS glowing_username_color,
      COALESCE(up.created_at, NOW()) AS other_created_at
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
    om.conv_id,
    om.other_user_id,
    om.other_username,
    om.other_avatar_url,
    COALESCE(lm.last_message, 'No messages yet'::TEXT),
    COALESCE(lm.last_timestamp, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(uc.unread_count, 0::BIGINT),
    FALSE,
    om.rgb_username_expires_at,
    om.glowing_username_color,
    om.other_created_at
  FROM other_members om
  LEFT JOIN last_messages lm ON om.conv_id = lm.conv_id
  LEFT JOIN unread_counts uc ON om.conv_id = uc.conv_id

  ORDER BY lm.last_timestamp DESC NULLS LAST;
END;
$$;
