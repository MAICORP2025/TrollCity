-- ============================================================================
-- COMPLETE PUSH NOTIFICATION SYSTEM RESET
-- ============================================================================
-- This clears all subscriptions and disables push, forcing users to 
-- re-subscribe with a fresh authentication flow
-- ============================================================================

-- STEP 1: Disable push notifications for all users
UPDATE user_profiles
SET push_notifications_enabled = FALSE,
    updated_at = NOW()
WHERE push_notifications_enabled IS NOT FALSE;

-- STEP 2: Clear all web push subscriptions (force re-subscription)
UPDATE web_push_subscriptions
SET is_active = FALSE,
    updated_at = NOW()
WHERE is_active = TRUE;

-- Optional: Delete old subscriptions if you want a complete wipe:
-- DELETE FROM web_push_subscriptions;

-- STEP 3: Clear any queued offline notifications
-- (optional - keep if you want to preserve notification history)
-- DELETE FROM offline_notifications WHERE status IN ('queued', 'failed');

-- STEP 4: Verify the reset
SELECT 
  (SELECT COUNT(*) FROM user_profiles WHERE push_notifications_enabled = FALSE) as users_disabled,
  (SELECT COUNT(*) FROM web_push_subscriptions WHERE is_active = FALSE) as subscriptions_inactive,
  (SELECT COUNT(*) FROM offline_notifications WHERE status = 'queued') as pending_notifications;

-- ============================================================================
-- NEXT STEPS FOR USERS:
-- ============================================================================
-- 1. User refreshes app in browser
-- 2. HomeNotificationPrompt component shows permission prompt again
-- 3. User clicks "Allow" → browser grants notification permission
-- 4. Service worker subscribes → new subscription created in DB
-- 5. Subscription marked is_active = TRUE
-- 6. user_profiles.push_notifications_enabled = TRUE
-- 7. User now receives offline notifications
-- ============================================================================
