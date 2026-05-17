-- COMPREHENSIVE MISSING ITEMS CHECK
-- Run all parts together

-- ============================================
-- PART 1: MISSING TABLES
-- ============================================
SELECT '=== MISSING TABLES ===' AS check_type;

WITH frontend_tables AS (
    SELECT 'active_sessions' AS table_name UNION ALL
    SELECT 'user_presence' UNION ALL
    SELECT 'conversation_members' UNION ALL
    SELECT 'conversation_messages' UNION ALL
    SELECT 'user_profiles' UNION ALL
    SELECT 'user_balances' UNION ALL
    SELECT 'streams' UNION ALL
    SELECT 'stream_viewers' UNION ALL
    SELECT 'stream_gifts' UNION ALL
    SELECT 'stream_settings' UNION ALL
    SELECT 'rtc_sessions' UNION ALL
    SELECT 'battles' UNION ALL
    SELECT 'troll_battles' UNION ALL
    SELECT 'jail' UNION ALL
    SELECT 'notifications' UNION ALL
    SELECT 'gifts' UNION ALL
    SELECT 'gift_ledger' UNION ALL
    SELECT 'user_perks' UNION ALL
    SELECT 'avatars' UNION ALL
    SELECT 'verification_docs' UNION ALL
    SELECT 'applications' UNION ALL
    SELECT 'troll_families' UNION ALL
    SELECT 'family_members' UNION ALL
    SELECT 'troll_family_members' UNION ALL
    SELECT 'officer_members' UNION ALL
    SELECT 'auctioneer_profiles' UNION ALL
    SELECT 'auction_shows' UNION ALL
    SELECT 'auction_lots' UNION ALL
    SELECT 'auction_bids' UNION ALL
    SELECT 'call_history' UNION ALL
    SELECT 'officer_chat_messages' UNION ALL
    SELECT 'user_relationships' UNION ALL
    SELECT 'web_push_subscriptions' UNION ALL
    SELECT 'online_users' UNION ALL
    SELECT 'admin_view_active_streams' UNION ALL
    SELECT 'stream_reports' UNION ALL
    SELECT 'admin_actions_log' UNION ALL
    SELECT 'admin_for_week_queue'
)
SELECT ft.table_name, 'MISSING' AS status
FROM frontend_tables ft
LEFT JOIN information_schema.tables t ON ft.table_name = t.table_name AND t.table_schema = 'public'
WHERE t.table_name IS NULL
ORDER BY ft.table_name;

-- ============================================
-- PART 2: MISSING FUNCTIONS
-- ============================================
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
SELECT f.function_name, 'MISSING' AS status
FROM critical_functions f
LEFT JOIN pg_proc p ON f.function_name = p.proname AND p.pronamespace = 'public'::regnamespace
WHERE p.oid IS NULL
ORDER BY f.function_name;

-- ============================================
-- PART 3: TABLES WITHOUT RLS
-- ============================================
SELECT '=== TABLES WITHOUT RLS ===' AS check_type;

SELECT t.table_name, 'NO RLS' AS status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.tablename = t.table_name 
    AND p.schemaname = 'public'
)
AND t.table_name NOT IN ('spatial_ref_sys', 'topology', 'tiger', 'tiger_data')
ORDER BY t.table_name
LIMIT 50;

-- ============================================
-- PART 4: FOREIGN KEYS TO MISSING TABLES
-- ============================================
SELECT '=== FK TO MISSING TABLES ===' AS check_type;

SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, 'MISSING!' AS status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND ccu.table_name IS NULL
ORDER BY tc.table_name
LIMIT 30;

-- ============================================
-- PART 5: NON-NULLABLE COLUMNS WITHOUT DEFAULTS
-- ============================================
SELECT '=== COLUMNS NEEDING DEFAULT ===' AS check_type;

SELECT c.table_name, c.column_name, c.data_type, 'NO DEFAULT' AS status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
AND c.is_nullable = 'NO'
AND c.column_default IS NULL
AND c.table_name IN ('gift_ledger', 'notifications', 'streams')
ORDER BY c.table_name, c.column_name
LIMIT 20;

-- ============================================
-- PART 6: TABLE ROW COUNTS (optional)
-- ============================================
SELECT '=== TABLE COUNTS ===' AS check_type;

SELECT 'user_profiles' AS tbl, COUNT(*) AS cnt FROM user_profiles
UNION ALL
SELECT 'user_agreements', COUNT(*) FROM user_agreements
UNION ALL
SELECT 'verification_requests', COUNT(*) FROM verification_requests
UNION ALL
SELECT 'applications', COUNT(*) FROM applications
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'streams', COUNT(*) FROM streams
UNION ALL
SELECT 'gift_ledger', COUNT(*) FROM gift_ledger
UNION ALL
SELECT 'user_balances', COUNT(*) FROM user_balances;