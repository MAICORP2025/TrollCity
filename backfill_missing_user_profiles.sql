-- ============================================================================
-- BACKFILL: Add missing public.user_profiles rows for auth.users
-- This migration is safe to run multiple times and will not overwrite existing
-- profiles. Missing profiles are created with conservative defaults.
-- ============================================================================

BEGIN;

INSERT INTO public.user_profiles (
  id,
  username,
  avatar_url,
  bio,
  role,
  tier,
  paid_coins,
  troll_coins,
  total_earned_coins,
  total_spent_coins,
  email,
  terms_accepted,
  onboarding_completed,
  credit_score,
  created_at,
  updated_at
)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'username',
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'user' || substr(replace(u.id::text, '-', ''), 1, 8)
  ) AS username,
  COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || COALESCE(
      u.raw_user_meta_data->>'username',
      NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
      'user' || substr(replace(u.id::text, '-', ''), 1, 8)
    )
  ) AS avatar_url,
  'New troll in the city!' AS bio,
  'user' AS role,
  'Bronze' AS tier,
  0 AS paid_coins,
  100 AS troll_coins,
  100 AS total_earned_coins,
  0 AS total_spent_coins,
  COALESCE(u.email, '') AS email,
  false AS terms_accepted,
  false AS onboarding_completed,
  400 AS credit_score,
  NOW() AS created_at,
  NOW() AS updated_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT 'Done: backfilled missing public.user_profiles rows.' AS status;
