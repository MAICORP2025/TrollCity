-- PART 2: CHECK CRITICAL FUNCTIONS
SELECT '=== MISSING FUNCTIONS ===' AS check_type;

WITH critical_functions AS (
    SELECT 'heartbeat_presence' AS function_name UNION ALL
    SELECT 'get_unread_notification_count' UNION ALL
    SELECT 'mark_all_notifications_read' UNION ALL
    SELECT 'mark_onboarding_complete' UNION ALL
    SELECT 'is_ip_banned' UNION ALL
    SELECT 'check_daily_login' UNION ALL
    SELECT 'ban_user' UNION ALL
    SELECT 'kick_user_from_stream' UNION ALL
    SELECT 'deduct_coins' UNION ALL
    SELECT 'add_coins' UNION ALL
    SELECT 'purchase_rgb_broadcast' UNION ALL
    SELECT 'crypt_password' UNION ALL
    SELECT 'get_user_conversations_optimized' UNION ALL
    SELECT 'find_shared_conversation' UNION ALL
    SELECT 'start_auction_show' UNION ALL
    SELECT 'end_auction_show' UNION ALL
    SELECT 'activate_auction_lot' UNION ALL
    SELECT 'mark_lot_sold' UNION ALL
    SELECT 'mark_lot_unsold' UNION ALL
    SELECT 'get_live_auction_state' UNION ALL
    SELECT 'place_bid' UNION ALL
    SELECT 'create_auction_show' UNION ALL
    SELECT 'create_auction_lot' UNION ALL
    SELECT 'review_auction_report' UNION ALL
    SELECT 'review_auctioneer_application' UNION ALL
    SELECT 'submit_auctioneer_application' UNION ALL
    SELECT 'schedule_interview' UNION ALL
    SELECT 'join_court_session' UNION ALL
    SELECT 'court_raise_hand' UNION ALL
    SELECT 'court_lower_hand' UNION ALL
    SELECT 'court_call_next' UNION ALL
    SELECT 'increment_ad_clicks' UNION ALL
    SELECT 'send_marketplace_message' UNION ALL
    SELECT 'purchase_listing_premium' UNION ALL
    SELECT 'create_marketplace_listing' UNION ALL
    SELECT 'admin_update_user_role' UNION ALL
    SELECT 'increment_article_views' UNION ALL
    SELECT 'tip_journalist'
)
SELECT 
    f.function_name,
    CASE WHEN p.oid IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM critical_functions f
LEFT JOIN pg_proc p ON f.function_name = p.proname AND p.pronamespace = 'public'::regnamespace
WHERE p.oid IS NULL
ORDER BY f.function_name;