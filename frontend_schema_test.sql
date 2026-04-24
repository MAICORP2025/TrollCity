-- ============================================================================
-- FRONTEND SCHEMA TEST - Comprehensive Database Verification
-- Run this in Supabase SQL Editor to audit schema against frontend expectations
-- ============================================================================

-- ============================================================================
-- PART 1: CHECK TABLES USED IN FRONTEND BUT NOT IN DATABASE
-- ============================================================================
SELECT '=== MISSING TABLES (from frontend) ===' AS check_type;

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
    SELECT 'admin_for_week_queue' UNION ALL
    SELECT 'broadcast_rankings' UNION ALL
    SELECT 'creators_over_600' UNION ALL
    SELECT 'trollmers_weekly_leaderboard' UNION ALL
    SELECT 'user_entrance_effects' UNION ALL
    SELECT 'user_active_entrance_effect' UNION ALL
    SELECT 'store_items' UNION ALL
    SELECT 'user_active_items' UNION ALL
    SELECT 'purchasable_items' UNION ALL
    SELECT 'purchase_ledger' UNION ALL
    SELECT 'user_insurances' UNION ALL
    SELECT 'insurance_options' UNION ALL
    SELECT 'user_cars' UNION ALL
    SELECT 'vehicles_catalog' UNION ALL
    SELECT 'car_insurance_policies' UNION ALL
    SELECT 'property_insurance_policies' UNION ALL
    SELECT 'user_credit' UNION ALL
    SELECT 'credit_events' UNION ALL
    SELECT 'loans' UNION ALL
    SELECT 'loan_payments' UNION ALL
    SELECT 'bank_loans' UNION ALL
    SELECT 'properties' UNION ALL
    SELECT 'property_types' UNION ALL
    SELECT 'leases' UNION ALL
    SELECT 'rent_payment_log' UNION ALL
    SELECT 'property_loans' UNION ALL
    SELECT 'invoices' UNION ALL
    SELECT 'court_cases' UNION ALL
    SELECT 'court_sentences' UNION ALL
    SELECT 'court_dockets' UNION ALL
    SELECT 'court_participants' UNION ALL
    SELECT 'court_verdicts' UNION ALL
    SELECT 'court_payments' UNION ALL
    SELECT 'paid_chat_access' UNION ALL
    SELECT 'paid_chat_payments' UNION ALL
    SELECT 'pod_rooms' UNION ALL
    SELECT 'pod_room_participants' UNION ALL
    SELECT 'pod_chat_messages' UNION ALL
    SELECT 'pod_bans' UNION ALL
    SELECT 'pod_episodes' UNION ALL
    SELECT 'broadcast_officers' UNION ALL
    SELECT 'officer_patrols' UNION ALL
    SELECT 'officer_chat_messages' UNION ALL
    SELECT 'officer_badges' UNION ALL
    SELECT 'officer_shift_slots' UNION ALL
    SELECT 'officer_work_sessions' UNION ALL
    SELECT 'officer_live_assignments' UNION ALL
    SELECT 'officer_actions' UNION ALL
    SELECT 'officer_earnings' UNION ALL
    SELECT 'role_change_log' UNION ALL
    SELECT 'creator_panic_alerts' UNION ALL
    SELECT 'ip_bans' UNION ALL
    SELECT 'audit_logs' UNION ALL
    SELECT 'moderation_actions_log' UNION ALL
    SELECT 'support_tickets' UNION ALL
    SELECT 'referrals' UNION ALL
    SELECT 'referral_rewards' UNION ALL
    SELECT 'tromody_queue' UNION ALL
    SELECT 'tromody_matches' UNION ALL
    SELECT 'user_agreements' UNION ALL
    SELECT 'weekly_reports' UNION ALL
    SELECT 'troll_wheel_spins' UNION ALL
    SELECT 'wheel_spins' UNION ALL
    SELECT 'daily_rewards' UNION ALL
    SELECT 'user_purchases' UNION ALL
    SELECT 'user_boosts' UNION ALL
    SELECT 'family_boosts' UNION ALL
    SELECT 'entrance_effects' UNION ALL
    SELECT 'gifts_catalog' UNION ALL
    SELECT 'onboarding_progress' UNION ALL
    SELECT 'onboarding_events' UNION ALL
    SELECT 'landlord_applications' UNION ALL
    SELECT 'landlord_loans' UNION ALL
    SELECT 'landlord_loan_payments' UNION ALL
    SELECT 'marketplace_purchases' UNION ALL
    SELECT 'rentals' UNION ALL
    SELECT 'trollz_transactions' UNION ALL
    SELECT 'bonus_coin_transactions' UNION ALL
    SELECT 'stream_presets' UNION ALL
    SELECT 'stream_entries' UNION ALL
    SELECT 'user_reports' UNION ALL
    SELECT 'revenue_settings' UNION ALL
    SELECT 'user_risk_profile' UNION ALL
    SELECT 'risk_events' UNION ALL
    SELECT 'broadcaster_earnings' UNION ALL
    SELECT 'broadcast_lockdown' UNION ALL
    SELECT 'broadcaster_limits' UNION ALL
    SELECT 'home_feature_cycles' UNION ALL
    SELECT 'home_feature_spend' UNION ALL
    SELECT 'perks' UNION ALL
    SELECT 'empire_partner_rewards' UNION ALL
    SELECT 'tournaments' UNION ALL
    SELECT 'tournament_participants' UNION ALL
    SELECT 'user_stats' UNION ALL
    SELECT 'xp_ledger' UNION ALL
    SELECT 'abuse_reports' UNION ALL
    SELECT 'payout_requests' UNION ALL
    SELECT 'coin_transactions' UNION ALL
    SELECT 'broadcaster_applications' UNION ALL
    SELECT 'profiles' UNION ALL
    SELECT 'user_roles' UNION ALL
    SELECT 'system_roles' UNION ALL
    SELECT 'user_role_grants' UNION ALL
    SELECT 'troll_drops' UNION ALL
    SELECT 'user_avatar_customization' UNION ALL
    SELECT 'troll_mart_clothing' UNION ALL
    SELECT 'user_troll_mart_purchases' UNION ALL
    SELECT 'coin_orders' UNION ALL
    SELECT 'payouts' UNION ALL
    SELECT 'user_payment_methods' UNION ALL
    SELECT 'cashout_requests' UNION ALL
    SELECT 'admin_broadcasts' UNION ALL
    SELECT 'admin_settings' UNION ALL
    SELECT 'admin_app_settings' UNION ALL
    SELECT 'admin_pool' UNION ALL
    SELECT 'admin_pool_transactions' UNION ALL
    SELECT 'admin_pool_buckets' UNION ALL
    SELECT 'system_backup_requests' UNION ALL
    SELECT 'payout_tiers' UNION ALL
    SELECT 'visa_redemptions' UNION ALL
    SELECT 'manual_coin_orders' UNION ALL
    SELECT 'paypal_transactions' UNION ALL
    SELECT 'bank_audit_log' UNION ALL
    SELECT 'car_upgrades' UNION ALL
    SELECT 'user_car_upgrades' UNION ALL
    SELECT 'vehicle_listings' UNION ALL
    SELECT 'vehicle_upgrades' UNION ALL
    SELECT 'vehicle_auction_bids' UNION ALL
    SELECT 'town_parcels' UNION ALL
    SELECT 'town_houses' UNION ALL
    SELECT 'town_player_state' UNION ALL
    SELECT 'town_raids' UNION ALL
    SELECT 'live_sessions' UNION ALL
    SELECT 'wallet_transactions' UNION ALL
    SELECT 'gas_requests' UNION ALL
    SELECT 'pool_donations' UNION ALL
    SELECT 'pitch_contests' UNION ALL
    SELECT 'pitches' UNION ALL
    SELECT 'pitch_votes' UNION ALL
    SELECT 'revenue_splits' UNION ALL
    SELECT 'church_passages' UNION ALL
    SELECT 'church_prayers' UNION ALL
    SELECT 'church_prayer_likes' UNION ALL
    SELECT 'church_sermon_notes' UNION ALL
    SELECT 'daily_login_posts' UNION ALL
    SELECT 'battle_queue' UNION ALL
    SELECT 'battle_skips' UNION ALL
    SELECT 'troll_battle_weekly_stats' UNION ALL
    SELECT 'mai_judge_seats' UNION ALL
    SELECT 'mai_talent_auditions' UNION ALL
    SELECT 'mai_talent_votes' UNION ALL
    SELECT 'mai_talent_judges' UNION ALL
    SELECT 'mai_talent_leaderboard' UNION ALL
    SELECT 'user_house_upgrades' UNION ALL
    SELECT 'house_catalog' UNION ALL
    SELECT 'advertisements' UNION ALL
    SELECT 'ad_assets' UNION ALL
    SELECT 'city_ads' UNION ALL
    SELECT 'messages' UNION ALL
    SELECT 'troll_posts' UNION ALL
    SELECT 'troll_post_reactions' UNION ALL
    SELECT 'troll_post_gifts' UNION ALL
    SELECT 'trollg_applications' UNION ALL
    SELECT 'neighbors' UNION ALL
    SELECT 'neighbor_jobs' UNION ALL
    SELECT 'neighbor_businesses' UNION ALL
    SELECT 'neighbor_events' UNION ALL
    SELECT 'neighbor_approvals' UNION ALL
    SELECT 'broadcast_challenges' UNION ALL
    SELECT 'stream_viewers_and_bans' UNION ALL
    SELECT 'stream_likes' UNION ALL
    SELECT 'users_involved' UNION ALL
    SELECT 'global_events' UNION ALL
    SELECT 'event_participation_badges' UNION ALL
    SELECT 'featured_broadcasts' UNION ALL
    SELECT 'conversations' UNION ALL
    SELECT 'conversation_invites' UNION ALL
    SELECT 'user_blocks' UNION ALL
    SELECT 'blocked_users' UNION ALL
    SELECT 'user_reactions' UNION ALL
    SELECT 'post_media' UNION ALL
    SELECT 'broadcast_theme_prices' UNION ALL
    SELECT 'housing_revenue' UNION ALL
    SELECT 'payout_schedule' UNION ALL
    SELECT 'payout_history' UNION ALL
    SELECT 'leaderboard' UNION ALL
    SELECT 'family_achievements' UNION ALL
    SELECT 'family_tasks' UNION ALL
    SELECT 'family_call_minutes' UNION ALL
    SELECT 'family_gift_logs' UNION ALL
    SELECT 'family_payouts' UNION ALL
    SELECT 'family_call_rates' UNION ALL
    SELECT 'troll_wheel_wins' UNION ALL
    SELECT 'troll_wheel_locked' UNION ALL
    SELECT 'emergency_alerts' UNION ALL
    SELECT 'user_event_dismissals' UNION ALL
    SELECT 'trolls_night_applications' UNION ALL
    SELECT 'trolls_night_guest_agreements' UNION ALL
    SELECT 'family_call_history' UNION ALL
    SELECT 'left_sidebar_ads' UNION ALL
    SELECT 'user_sidebar_views' UNION ALL
    SELECT 'sidebar_updates' UNION ALL
    SELECT 'coin_audit_log' UNION ALL
    SELECT 'broadcast_seat_bans' UNION ALL
    SELECT 'test_stream_deletion_log' UNION ALL
    SELECT 'sellers_with_fraud_holds' UNION ALL
    SELECT 'active_marketplace_disputes' UNION ALL
    SELECT 'role_bonuses' UNION ALL
    SELECT 'scheduled_announcements' UNION ALL
    SELECT 'telemetry_events' UNION ALL
    SELECT 'stream_guests' UNION ALL
    SELECT 'creator_migration_claims' UNION ALL
    SELECT 'revenue_system_config' UNION ALL
    SELECT 'apartment_applications' UNION ALL
    SELECT 'user_sidebar_prefs' UNION ALL
    SELECT 'hand_raise_queue' 
)
SELECT 
    ft.table_name,
    CASE 
        WHEN t.table_name IS NULL THEN 'MISSING'
        ELSE 'EXISTS'
    END AS status
FROM frontend_tables ft
LEFT JOIN information_schema.tables t 
    ON ft.table_name = t.table_name 
    AND t.table_schema = 'public'
WHERE t.table_name IS NULL
ORDER BY ft.table_name;

-- ============================================================================
-- PART 2: CHECK CRITICAL FUNCTIONS USED IN FRONTEND
-- ============================================================================
SELECT '=== MISSING FUNCTIONS (critical) ===' AS check_type;

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
    SELECT 'tip_journalist' UNION ALL
    SELECT 'approve_neighbor_business' UNION ALL
    SELECT 'approve_neighbor_event' UNION ALL
    SELECT 'approve_neighbor_job' UNION ALL
    SELECT 'admin_get_referral_overview' UNION ALL
    SELECT 'admin_get_all_referrers' UNION ALL
    SELECT 'admin_get_all_referrals' UNION ALL
    SELECT 'admin_toggle_founding_partner' UNION ALL
    SELECT 'admin_toggle_referred_bonus' UNION ALL
    SELECT 'get_cashout_forecast' UNION ALL
    SELECT 'refresh_user_earnings_summary' UNION ALL
    SELECT 'get_officer_payroll_stats' UNION ALL
    SELECT 'distribute_officer_payroll' UNION ALL
    SELECT 'prestige_user' UNION ALL
    SELECT 'set_broadcaster_moderation_lock' UNION ALL
    SELECT 'summon_user_to_court' UNION ALL
    SELECT 'approve_empire_partner' UNION ALL
    SELECT 'reject_empire_partner' UNION ALL
    SELECT 'ban_officer' UNION ALL
    SELECT 'unban_officer' UNION ALL
    SELECT 'approve_officer_application' UNION ALL
    SELECT 'set_lead_officer_status' UNION ALL
    SELECT 'submit_weekly_report' UNION ALL
    SELECT 'pay_kick_fee' UNION ALL
    SELECT 'submit_cashout_request' UNION ALL
    SELECT 'approve_advertisement' UNION ALL
    SELECT 'add_ad_to_queue' UNION ALL
    SELECT 'deny_advertisement' UNION ALL
    SELECT 'rotate_ad_queue' UNION ALL
    SELECT 'submit_advertisement' UNION ALL
    SELECT 'validate_broadcast_password' UNION ALL
    SELECT 'approve_visa_redemption' UNION ALL
    SELECT 'fulfill_visa_redemption' UNION ALL
    SELECT 'reject_visa_redemption' UNION ALL
    SELECT 'notify_user_rpc' UNION ALL
    SELECT 'set_user_role' UNION ALL
    SELECT 'end_court_session' UNION ALL
    SELECT 'approve_creator_claim' UNION ALL
    SELECT 'reject_creator_claim' UNION ALL
    SELECT 'refund_payout_run' UNION ALL
    SELECT 'is_lead_officer_position_filled' UNION ALL
    SELECT 'deny_application' UNION ALL
    SELECT 'approve_attorney_application' UNION ALL
    SELECT 'deny_attorney_application' UNION ALL
    SELECT 'approve_prosecutor_application' UNION ALL
    SELECT 'deny_prosecutor_application' UNION ALL
    SELECT 'admin_assign_zip_officers' UNION ALL
    SELECT 'admin_set_officer_rank' UNION ALL
    SELECT 'admin_suspend_officer' UNION ALL
    SELECT 'get_active_trollmers_tournament' UNION ALL
    SELECT 'admin_create_poll' UNION ALL
    SELECT 'admin_trigger_event' UNION ALL
    SELECT 'admin_create_announcement' UNION ALL
    SELECT 'admin_grant_temp_coins' UNION ALL
    SELECT 'admin_waive_court_fine' UNION ALL
    SELECT 'get_nearby_neighbors' UNION ALL
    SELECT 'get_user_stream_key' UNION ALL
    SELECT 'process_gift' UNION ALL
    SELECT 'send_gift' UNION ALL
    SELECT 'create_stream' UNION ALL
    SELECT 'end_stream' UNION ALL
    SELECT 'flag_economy_abuse' UNION ALL
    SELECT 'mai_flag_economy_abuse' UNION ALL
    SELECT 'is_trolls_night_staff' UNION ALL
    SELECT 'grant_family_crown' UNION ALL
    SELECT 'activate_entrance_effect' UNION ALL
    SELECT 'activate_item'
)
SELECT 
    f.function_name,
    CASE 
        WHEN p.oid IS NULL THEN 'MISSING'
        ELSE 'EXISTS'
    END AS status
FROM critical_functions f
LEFT JOIN pg_proc p 
    ON f.function_name = p.proname 
    AND p.pronamespace = 'public'::regnamespace
WHERE p.oid IS NULL
ORDER BY f.function_name;

-- ============================================================================
-- PART 3: CHECK NULL CONSTRAINT ISSUES
-- ============================================================================
SELECT '=== COLUMNS WITH POTENTIAL NULL ISSUES ===' AS check_type;

SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
AND c.table_name IN ('user_profiles', 'streams', 'notifications', 'battles', 'gift_ledger')
AND c.is_nullable = 'NO'
AND c.column_default IS NULL
ORDER BY c.table_name, c.ordinal_position;

-- ============================================================================
-- PART 4: CHECK RLS POLICIES
-- ============================================================================
SELECT '=== TABLES WITHOUT RLS ===' AS check_type;

SELECT 
    t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.tablename = t.table_name 
    AND p.schemaname = 'public'
)
AND t.table_name NOT IN ('spatial_ref_sys', 'topology', 'tiger', 'tiger_data', '肉', 'zzz')
ORDER BY t.table_name;

-- ============================================================================
-- PART 5: CHECK FOREIGN KEY CONSTRAINTS
-- ============================================================================
SELECT '=== FOREIGN KEY ISSUES ===' AS check_type;

SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE WHEN ccu.table_name IS NULL THEN 'MISSING FK TARGET' ELSE 'OK' END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================================
-- PART 6: SAMPLE DATA CHECKS (critical tables should have data)
-- ============================================================================
SELECT '=== TABLES WITH NO DATA ===' AS check_type;

SELECT 'user_profiles' AS table_name, 0 AS count WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles LIMIT 1)
UNION ALL
SELECT 'streams', 0 WHERE NOT EXISTS (SELECT 1 FROM public.streams LIMIT 1)
UNION ALL
SELECT 'notifications', 0 WHERE NOT EXISTS (SELECT 1 FROM public.notifications LIMIT 1)
UNION ALL
SELECT 'user_balances', 0 WHERE NOT EXISTS (SELECT 1 FROM public.user_balances LIMIT 1);

-- ============================================================================
-- END
-- ============================================================================
SELECT 'Schema test complete!' AS status;