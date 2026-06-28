-- ============================================================================
-- LIGHTWEIGHT DIAGNOSTICS - Fast read-only queries
-- ============================================================================

-- BUG #1: Conversation functions (names + arg types only, no heavy function defs)
SELECT '=== BUG #1: Conversation functions ===' AS section;
SELECT proname, proargtypes::regtype[] AS arg_types
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND (proname LIKE '%conversation%' OR proname LIKE '%get_auth_user_conversation%')
ORDER BY proname;

-- Messaging tables
SELECT '=== Messaging tables ===' AS section;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%conversation%' OR table_name LIKE '%message%' OR table_name LIKE '%utromail%' OR table_name LIKE '%mail%')
ORDER BY table_name;

-- BUG #6/#9: Triggers with recipient_id (uses prosrc instead of pg_get_functiondef)
SELECT '=== BUG #6/#9: Triggers with recipient_id ===' AS section;
SELECT t.tgname AS trigger_name, t.tgrelid::regclass AS table_name, p.proname AS function_name
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND p.prosrc LIKE '%recipient_id%';

-- utromail/mail columns
SELECT '=== BUG #6: utromail/mail columns ===' AS section;
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND (table_name LIKE '%utromail%' OR table_name LIKE '%mail%')
ORDER BY table_name, ordinal_position;

-- BUG #8: cashout_requests columns
SELECT '=== BUG #8: cashout_requests ===' AS section;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cashout_requests'
ORDER BY ordinal_position;

-- BUG #10/#11: user_subscriptions constraints
SELECT '=== BUG #10/#11: user_subscriptions constraints ===' AS section;
SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint
WHERE conrelid = 'user_subscriptions'::regclass ORDER BY conname;

-- BUG #12: user_ip_tracking columns
SELECT '=== BUG #12: user_ip_tracking ===' AS section;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_ip_tracking'
ORDER BY ordinal_position;

-- BUG #2/#7/#15/#17: Unique constraints on candidate tables
SELECT '=== BUG #2/#7/#15/#17: Unique constraints ===' AS section;
SELECT tc.table_name, tc.constraint_name, string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS cols
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('user_presence','user_sessions','activity_log','notifications','user_read_status','message_status','broadcast_viewer_sessions','user_stats','daily_rewards','user_streaks','user_follows','user_subscriptions','user_profiles')
GROUP BY tc.table_name, tc.constraint_name ORDER BY tc.table_name;

-- BUG #5: sessions table
SELECT '=== BUG #5: sessions table ===' AS section;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sessions'
ORDER BY ordinal_position;

-- ALL TABLES (quick list)
SELECT '=== ALL PUBLIC TABLES ===' AS section;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;
