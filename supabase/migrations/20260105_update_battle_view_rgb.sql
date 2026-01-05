-- Update battle_arena_view to include rgb_username_expires_at for guests

DROP VIEW IF EXISTS public.battle_arena_view;

CREATE OR REPLACE VIEW public.battle_arena_view AS
SELECT
  tb.*,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'user_id', sp.user_id,
        'username', up.username,
        'avatar_url', up.avatar_url,
        'role', sp.role,
        'joined_at', sp.joined_at,
        'rgb_username_expires_at', up.rgb_username_expires_at
      ))
      FROM (
        SELECT *
        FROM streams_participants sp
        WHERE sp.stream_id = tb.host_stream_id
          AND sp.battle_side = 'A'
          AND sp.role = 'guest'
          AND sp.is_active = true
        ORDER BY sp.joined_at
        LIMIT 4
      ) sp
      LEFT JOIN user_profiles up ON up.id = sp.user_id
    ),
    '[]'::json
  ) AS host_guests,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'user_id', sp.user_id,
        'username', up.username,
        'avatar_url', up.avatar_url,
        'role', sp.role,
        'joined_at', sp.joined_at,
        'rgb_username_expires_at', up.rgb_username_expires_at
      ))
      FROM (
        SELECT *
        FROM streams_participants sp
        WHERE sp.stream_id = tb.challenger_stream_id
          AND sp.battle_side = 'B'
          AND sp.role = 'guest'
          AND sp.is_active = true
        ORDER BY sp.joined_at
        LIMIT 4
      ) sp
      LEFT JOIN user_profiles up ON up.id = sp.user_id
    ),
    '[]'::json
  ) AS challenger_guests
FROM troll_battles tb;
