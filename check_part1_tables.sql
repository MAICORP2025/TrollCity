-- PART 1: CHECK MISSING TABLES USED IN FRONTEND
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
SELECT 
    ft.table_name,
    CASE WHEN t.table_name IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM frontend_tables ft
LEFT JOIN information_schema.tables t ON ft.table_name = t.table_name AND t.table_schema = 'public'
WHERE t.table_name IS NULL
ORDER BY ft.table_name;