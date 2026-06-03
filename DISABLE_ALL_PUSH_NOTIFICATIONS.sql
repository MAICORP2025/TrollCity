-- ============================================================================
-- DISABLE ALL PUSH NOTIFICATIONS FOR ALL USERS
-- ============================================================================
-- This sets push_notifications_enabled to FALSE for all users
-- Existing subscriptions remain in DB but will be ignored by push system

UPDATE user_profiles
SET push_notifications_enabled = FALSE,
    updated_at = NOW()
WHERE push_notifications_enabled IS NOT FALSE;

-- Verify the update
SELECT COUNT(*) as users_disabled
FROM user_profiles
WHERE push_notifications_enabled = FALSE;

-- Check how many subscriptions exist (they'll be ignored):
SELECT COUNT(*) as active_subscriptions
FROM web_push_subscriptions
WHERE is_active = TRUE;

-- ============================================================================
-- Optional: Also mark all subscriptions as inactive (full reset)
-- Uncomment below if you want to completely clear subscriptions:
-- ============================================================================
-- UPDATE web_push_subscriptions
-- SET is_active = FALSE,
--     updated_at = NOW()
-- WHERE is_active = TRUE;
