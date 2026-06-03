-- ============================================================================
-- ENABLE PUSH NOTIFICATIONS FOR USERS
-- ============================================================================
-- Option 1: Enable for ALL users
-- ============================================================================

UPDATE user_profiles
SET push_notifications_enabled = TRUE,
    updated_at = NOW()
WHERE push_notifications_enabled IS NOT TRUE;

-- Verify the update
SELECT COUNT(*) as users_enabled
FROM user_profiles
WHERE push_notifications_enabled = TRUE;


-- ============================================================================
-- Option 2: Enable for SPECIFIC USER by ID
-- ============================================================================
-- Uncomment and replace USER_ID to enable a specific user:
-- ============================================================================

-- UPDATE user_profiles
-- SET push_notifications_enabled = TRUE,
--     updated_at = NOW()
-- WHERE id = 'USER_ID_HERE'
--   AND push_notifications_enabled IS NOT TRUE;


-- ============================================================================
-- Option 3: Force users to RE-SUBSCRIBE by clearing subscriptions
-- ============================================================================
-- Run this AFTER enabling to force a fresh subscription flow:
-- ============================================================================

-- UPDATE web_push_subscriptions
-- SET is_active = FALSE,
--     updated_at = NOW()
-- WHERE is_active = TRUE;

-- Then users will need to:
-- 1. Refresh the app
-- 2. See the "Enable Push Notifications" prompt again
-- 3. Click "Allow" to re-subscribe
-- 4. Subscriptions will be re-created in DB with fresh data
