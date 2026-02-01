-- ============================================
-- BROADCAST SYSTEM COMPLETE FIXES
-- ============================================
-- Run this in Supabase SQL Editor
-- This file addresses:
-- 1. coin_ledger.to_userid column fix
-- 2. Broadcast lock system
-- 3. Broadcaster limit system
-- 4. Gift/coin transaction fixes
-- 5. Viewer count accuracy
-- ============================================

-- ============================================
-- 1. FIX COIN_LEDGER COLUMN ERRORS
-- ============================================

-- Check if coin_ledger table exists and fix column names
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'coin_ledger') THEN
        -- Add missing columns if they don't exist
        ALTER TABLE public.coin_ledger 
        ADD COLUMN IF NOT EXISTS from_userid UUID,
        ADD COLUMN IF NOT EXISTS to_userid UUID,
        ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS description TEXT;
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_coin_ledger_from_userid ON public.coin_ledger(from_userid);
        CREATE INDEX IF NOT EXISTS idx_coin_ledger_to_userid ON public.coin_ledger(to_userid);
        CREATE INDEX IF NOT EXISTS idx_coin_ledger_transaction_type ON public.coin_ledger(transaction_type);
        
        RAISE NOTICE 'coin_ledger columns fixed successfully';
    ELSE
        RAISE NOTICE 'coin_ledger table does not exist yet';
    END IF;
END $$;

-- ============================================
-- 2. BROADCAST LOCK SYSTEM
-- ============================================

-- Create broadcast_lockdown table for global broadcast control
CREATE TABLE IF NOT EXISTS public.broadcast_lockdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled BOOLEAN DEFAULT FALSE,
    admin_id UUID REFERENCES public.user_profiles(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default lockdown record
INSERT INTO public.broadcast_lockdown (id, is_enabled)
SELECT gen_random_uuid(), FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.broadcast_lockdown);

-- Function to check if broadcasting is globally locked
CREATE OR REPLACE FUNCTION public.is_broadcast_locked()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    lockdown BOOLEAN;
BEGIN
    SELECT is_enabled INTO lockdown FROM public.broadcast_lockdown ORDER BY created_at DESC LIMIT 1;
    RETURN COALESCE(lockdown, FALSE);
END;
$$;

-- Function to toggle broadcast lockdown
CREATE OR REPLACE FUNCTION public.toggle_broadcast_lockdown(p_admin_id UUID, p_enabled BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.broadcast_lockdown 
    SET is_enabled = p_enabled, 
        admin_id = p_admin_id,
        reason = p_reason,
        updated_at = NOW()
    WHERE id = (SELECT id FROM public.broadcast_lockdown LIMIT 1);
    
    RETURN p_enabled;
END;
$$;

-- ============================================
-- 3. BROADCASTER LIMIT SYSTEM (MAX 100)
-- ============================================

-- Create broadcaster limit settings table
CREATE TABLE IF NOT EXISTS public.broadcaster_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    max_broadcasters INTEGER DEFAULT 100,
    current_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default limit
INSERT INTO public.broadcaster_limits (id, max_broadcasters, current_count)
SELECT gen_random_uuid(), 100, 0
WHERE NOT EXISTS (SELECT 1 FROM public.broadcaster_limits);

-- Add has_broadcast_badge column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS has_broadcast_badge BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_broadcast_locked BOOLEAN DEFAULT FALSE;

-- Create index for broadcast badge
CREATE INDEX IF NOT EXISTS idx_user_profiles_broadcast_badge ON public.user_profiles(has_broadcast_badge) WHERE has_broadcast_badge = TRUE;

-- Function to check broadcaster limit
CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    max_limit INTEGER;
    current_count INTEGER;
    user_has_badge BOOLEAN;
    is_locked BOOLEAN;
BEGIN
    -- Check global broadcast lock
    SELECT is_enabled INTO is_locked FROM public.broadcast_lockdown ORDER BY created_at DESC LIMIT 1;
    IF COALESCE(is_locked, FALSE) THEN
        RETURN FALSE;
    END IF;
    
    -- Get limit settings
    SELECT max_broadcasters, current_count INTO max_limit, current_count 
    FROM public.broadcaster_limits ORDER BY updated_at DESC LIMIT 1;
    
    -- Check if user has broadcast badge
    SELECT has_broadcast_badge INTO user_has_badge 
    FROM public.user_profiles WHERE id = p_user_id;
    
    -- Admin always can broadcast
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND (is_admin = TRUE OR role = 'admin')) THEN
        RETURN TRUE;
    END IF;
    
    -- Check badge
    IF NOT COALESCE(user_has_badge, FALSE) THEN
        RETURN FALSE;
    END IF;
    
    -- Check limit
    IF current_count >= max_limit THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Function to grant broadcaster badge
CREATE OR REPLACE FUNCTION public.grant_broadcaster_badge(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    max_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Get limit settings
    SELECT max_broadcasters, current_count INTO max_limit, current_count 
    FROM public.broadcaster_limits ORDER BY updated_at DESC LIMIT 1;
    
    -- Check if already has badge
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND has_broadcast_badge = TRUE) THEN
        RETURN TRUE;
    END IF;
    
    -- Check if under limit
    IF current_count >= max_limit THEN
        RAISE EXCEPTION 'Broadcaster limit reached';
    END IF;
    
    -- Grant badge
    UPDATE public.user_profiles 
    SET has_broadcast_badge = TRUE, updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Update count
    UPDATE public.broadcaster_limits 
    SET current_count = current_count + 1, updated_at = NOW()
    WHERE id = (SELECT id FROM public.broadcaster_limits LIMIT 1);
    
    RETURN TRUE;
END;
$$;

-- Function to revoke broadcaster badge
CREATE OR REPLACE FUNCTION public.revoke_broadcaster_badge(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_profiles 
    SET has_broadcast_badge = FALSE, updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Update count
    UPDATE public.broadcaster_limits 
    SET current_count = GREATEST(0, current_count - 1), updated_at = NOW()
    WHERE id = (SELECT id FROM public.broadcaster_limits LIMIT 1);
    
    RETURN TRUE;
END;
$$;

-- ============================================
-- 4. INDIVIDUAL BROADCASTER LOCK
-- ============================================

-- Function to lock/unlock individual broadcaster
CREATE OR REPLACE FUNCTION public.lock_broadcaster(p_user_id UUID, p_locked BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_profiles 
    SET is_broadcast_locked = p_locked, updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN TRUE;
END;
$$;

-- ============================================
-- 5. VIEWER COUNT ACCURACY
-- ============================================

-- Function to update viewer count
CREATE OR REPLACE FUNCTION public.update_viewer_count(p_stream_id UUID, p_count INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.streams 
    SET current_viewers = p_count, updated_at = NOW()
    WHERE id = p_stream_id;
END;
$$;

-- Function to get accurate viewer count
CREATE OR REPLACE FUNCTION public.get_viewer_count(p_stream_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result 
    FROM public.stream_viewers 
    WHERE stream_id = p_stream_id 
    AND last_seen > NOW() - INTERVAL '2 minutes';
    
    RETURN count_result;
END;
$$;

-- ============================================
-- 6. GIFT SYSTEM FIXES
-- ============================================

-- Ensure gifts table has correct columns
ALTER TABLE public.gifts 
ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES public.streams(id),
ADD COLUMN IF NOT EXISTS coin_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gift_type VARCHAR(50);

-- Create index for gift queries
CREATE INDEX IF NOT EXISTS idx_gifts_receiver ON public.gifts(receiver_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sender ON public.gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_gifts_stream ON public.gifts(stream_id);

-- ============================================
-- 7. POST-BROADCAST CLEANUP
-- ============================================

-- Function to end stream and cleanup
CREATE OR REPLACE FUNCTION public.end_stream_cleanup(p_stream_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update stream status
    UPDATE public.streams 
    SET status = 'ended', is_live = FALSE, updated_at = NOW()
    WHERE id = p_stream_id;
    
    -- Clear stream viewers
    DELETE FROM public.stream_viewers WHERE stream_id = p_stream_id;
    
    -- Update broadcaster badge count
    UPDATE public.broadcaster_limits 
    SET current_count = GREATEST(0, current_count - 1), updated_at = NOW()
    WHERE id = (SELECT id FROM public.broadcaster_limits LIMIT 1);
    
    -- Notify via realtime
    PERFORM pg_notify('stream_ended', p_stream_id::TEXT);
END;
$$;

-- ============================================
-- 8. STREAMS TABLE FIXES
-- ============================================

-- Ensure streams table has required columns
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'created',
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_viewers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_gifts_coins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS frame_mode VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{}'::jsonb;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON public.streams(is_live) WHERE is_live = TRUE;
CREATE INDEX IF NOT EXISTS idx_streams_broadcaster ON public.streams(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON public.streams(status);

-- ============================================
-- 9. TROLL BATTLES FIXES
-- ============================================

-- Ensure troll_battles table has correct structure
ALTER TABLE public.troll_battles 
ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS challenger_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS host_guests JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS challenger_guests JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS host_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS challenger_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES public.streams(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_troll_battles_status ON public.troll_battles(status);
CREATE INDEX IF NOT EXISTS idx_troll_battles_host ON public.troll_battles(host_id);
CREATE INDEX IF NOT EXISTS idx_troll_battles_challenger ON public.troll_battles(challenger_id);

-- ============================================
-- 10. BROADCAST LEVEL SYSTEM
-- ============================================

-- Add broadcast XP columns to streams
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS broadcast_xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS broadcast_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_gifts_count INTEGER DEFAULT 0;

-- Function to update broadcast level
CREATE OR REPLACE FUNCTION public.update_broadcast_level(p_stream_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    total_xp INTEGER;
    new_level INTEGER;
BEGIN
    SELECT COALESCE(SUM(coin_amount), 0) INTO total_xp 
    FROM public.gifts 
    WHERE stream_id = p_stream_id;
    
    -- Simple level calculation: 1 level per 1000 coins
    new_level := 1 + FLOOR(total_xp / 1000)::INTEGER;
    
    UPDATE public.streams 
    SET broadcast_xp = total_xp, 
        broadcast_level = new_level,
        total_gifts_count = (SELECT COUNT(*) FROM public.gifts WHERE stream_id = p_stream_id),
        updated_at = NOW()
    WHERE id = p_stream_id;
END;
$$;

-- ============================================
-- 11. LAYOUT/THEME SYNC
-- ============================================

-- Function to sync broadcaster layout changes
CREATE OR REPLACE FUNCTION public.sync_broadcast_layout(
    p_stream_id UUID,
    p_layout_config JSONB,
    p_theme_config JSONB,
    p_frame_mode VARCHAR(20)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.streams 
    SET layout_config = p_layout_config,
        theme_config = p_theme_config,
        frame_mode = p_frame_mode,
        updated_at = NOW()
    WHERE id = p_stream_id;
    
    -- Notify viewers of layout change
    PERFORM pg_notify('broadcast_layout_change', p_stream_id::TEXT);
END;
$$;

-- ============================================
-- 12. MESSAGES TABLE FIX (CHAT)
-- ============================================

-- Ensure messages table exists with correct columns
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES public.streams(id),
    user_id UUID REFERENCES public.user_profiles(id),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'chat',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for chat performance
CREATE INDEX IF NOT EXISTS idx_messages_stream ON public.messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);

-- ============================================
-- APPLY ALL FIXES
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE 'All broadcast system fixes applied successfully';
    RAISE NOTICE 'Key fixes:';
    RAISE NOTICE '1. coin_ledger columns added (from_userid, to_userid)';
    RAISE NOTICE '2. Broadcast lockdown system created';
    RAISE NOTICE '3. Broadcaster limit system (max 100) implemented';
    RAISE NOTICE '4. Viewer count accuracy improved';
    RAISE NOTICE '5. Gift system columns fixed';
    RAISE NOTICE '6. Post-broadcast cleanup function created';
    RAISE NOTICE '7. TrollBattles structure fixed';
    RAISE NOTICE '8. Broadcast level system added';
    RAISE NOTICE '9. Layout/theme sync function created';
    RAISE NOTICE '10. Chat messages table fixed';
END $$;
