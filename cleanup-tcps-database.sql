-- ============================================
-- TCPS (Troll City Postal Service) Cleanup SQL
-- Run this in Supabase SQL Editor to remove
-- all TCPS-related database objects
-- ============================================

-- 1. Drop TCPS-related tables (in dependency order)
DROP TABLE IF EXISTS public.tcps_messages CASCADE;
DROP TABLE IF EXISTS public.conversation_messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.officer_chat_messages CASCADE;
DROP TABLE IF EXISTS public.call_rooms CASCADE;
DROP TABLE IF EXISTS public.call_minutes CASCADE;
DROP TABLE IF EXISTS public.call_history CASCADE;

-- 2. Drop TCPS-related RPC functions
DROP FUNCTION IF EXISTS public.get_user_conversations_optimized(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_conversations(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.find_shared_conversation(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_message_notification() CASCADE;
DROP FUNCTION IF EXISTS public.get_call_balances(uuid) CASCADE;

-- 3. Remove tables from realtime publication
-- (Tables are already dropped above, but if you need to run this separately:)
DO $$
BEGIN
    PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'conversation_messages';
    IF FOUND THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.conversation_messages;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop conversation_messages from publication: %', SQLERRM;
END $$;

DO $$
BEGIN
    PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'conversations';
    IF FOUND THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.conversations;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop conversations from publication: %', SQLERRM;
END $$;

DO $$
BEGIN
    PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'conversation_members';
    IF FOUND THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.conversation_members;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop conversation_members from publication: %', SQLERRM;
END $$;

DO $$
BEGIN
    PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'tcps_messages';
    IF FOUND THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.tcps_messages;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop tcps_messages from publication: %', SQLERRM;
END $$;

-- 4. Clean up any TCPS-related notifications (safe - only runs if table/column exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'notifications'
        AND column_name = 'type'
    ) THEN
        DELETE FROM public.notifications WHERE type IN ('tcps_mail_received', 'paid_message_received');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not clean notifications: %', SQLERRM;
END $$;

-- 5. Remove message_cost column from user_profiles if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'message_cost'
    ) THEN
        ALTER TABLE public.user_profiles DROP COLUMN message_cost;
    END IF;
END $$;

-- 6. Remove chat_disabled columns from user_profiles if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'chat_disabled'
    ) THEN
        ALTER TABLE public.user_profiles DROP COLUMN chat_disabled;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'chat_disabled_until'
    ) THEN
        ALTER TABLE public.user_profiles DROP COLUMN chat_disabled_until;
    END IF;
END $$;

-- 7. Clean up user_relationships table if it only had block functionality
-- (Only drop if you're sure it's not used for other purposes)
-- Uncomment the following if you want to remove it entirely:
-- DROP TABLE IF EXISTS public.user_relationships CASCADE;

-- ============================================
-- Verification: Check what's left
-- ============================================
-- Run these SELECT statements to verify cleanup:

-- Check for remaining TCPS-related tables:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('conversations', 'conversation_members', 'conversation_messages',
--                    'tcps_messages', 'officer_chat_messages', 'call_rooms',
--                    'call_minutes', 'call_history');

-- Check for remaining TCPS-related functions:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name IN ('get_user_conversations_optimized', 'get_user_conversations',
--                      'find_shared_conversation', 'mark_conversation_read',
--                      'handle_new_message_notification', 'get_call_balances');
