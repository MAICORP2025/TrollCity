-- P1 Reliability & Scalability Fix: Implement Gift Ledger & Stats Table
-- This replaces the old view-based or incorrect gift_ledger with a high-performance append-only table.
-- It also converts broadcaster_stats from a View/MV to a real Table for O(1) updates via batch processor.

-- 1. Cleanup Old Objects
DROP VIEW IF EXISTS public.gift_ledger CASCADE;
DROP TABLE IF EXISTS public.gift_ledger CASCADE; -- In case it was a table
DROP MATERIALIZED VIEW IF EXISTS public.broadcaster_stats CASCADE;
DROP TABLE IF EXISTS public.broadcaster_stats CASCADE;

-- 2. Create Gift Ledger Table (Append-Only)
CREATE TABLE public.gift_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id),
    receiver_id UUID NOT NULL REFERENCES public.user_profiles(id),
    stream_id UUID, -- Optional, if associated with a stream
    gift_id TEXT NOT NULL, -- ID or Slug
    amount INTEGER NOT NULL, -- Cost in Coins
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, failed
    idempotency_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Index for batch processing
CREATE INDEX idx_gift_ledger_pending ON public.gift_ledger(status, created_at) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_gift_ledger_idempotency ON public.gift_ledger(sender_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Create Broadcaster Stats Table (Real Table)
CREATE TABLE public.broadcaster_stats (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id),
    total_gifts_24h INTEGER DEFAULT 0,
    total_gifts_all_time INTEGER DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcaster_stats_24h ON public.broadcaster_stats(total_gifts_24h DESC);

-- 4. RPC: Process Gift Ledger (Batch Processor)
-- This function is called by pg_cron every 10s
CREATE OR REPLACE FUNCTION process_gift_ledger_batch(p_batch_size INTEGER DEFAULT 1000)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_processed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_sender_totals RECORD;
    v_receiver_totals RECORD;
BEGIN
    -- 1. Lock Pending Rows (Skip Locked to allow parallel workers)
    CREATE TEMPORARY TABLE temp_batch AS
    SELECT * FROM public.gift_ledger
    WHERE status = 'pending'
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED;

    IF NOT EXISTS (SELECT 1 FROM temp_batch) THEN
        DROP TABLE temp_batch;
        RETURN jsonb_build_object('success', true, 'processed', 0, 'message', 'No pending gifts');
    END IF;

    -- 2. Process by Sender (Deduct Balance)
    FOR v_sender_totals IN 
        SELECT sender_id, SUM(amount) as total_spend 
        FROM temp_batch 
        GROUP BY sender_id
    LOOP
        -- Check and Deduct
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_sender_totals.total_spend
        WHERE id = v_sender_totals.sender_id AND troll_coins >= v_sender_totals.total_spend;

        IF FOUND THEN
            -- Success
            NULL;
        ELSE
            -- Fail: Insufficient funds
            UPDATE public.gift_ledger
            SET status = 'failed', error_message = 'Insufficient funds at batch processing', processed_at = NOW()
            WHERE id IN (SELECT id FROM temp_batch WHERE sender_id = v_sender_totals.sender_id);
            
            v_failed_count := v_failed_count + (SELECT COUNT(*) FROM temp_batch WHERE sender_id = v_sender_totals.sender_id);
            
            -- Remove from temp_batch so we don't credit receiver
            DELETE FROM temp_batch WHERE sender_id = v_sender_totals.sender_id;
        END IF;
    END LOOP;

    -- 3. Credit Receivers (Bulk Update)
    FOR v_receiver_totals IN
        SELECT receiver_id, SUM(amount) as total_receive
        FROM temp_batch
        GROUP BY receiver_id
    LOOP
        UPDATE public.user_profiles
        SET total_earned_coins = COALESCE(total_earned_coins, 0) + v_receiver_totals.total_receive
        WHERE id = v_receiver_totals.receiver_id;
        
        -- Update Broadcaster Stats
        INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
        VALUES (v_receiver_totals.receiver_id, v_receiver_totals.total_receive, v_receiver_totals.total_receive, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
            total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
            last_updated_at = NOW();
    END LOOP;

    -- 4. Mark remaining as Processed
    UPDATE public.gift_ledger
    SET status = 'processed', processed_at = NOW()
    WHERE id IN (SELECT id FROM temp_batch);

    v_processed_count := (SELECT COUNT(*) FROM temp_batch);

    DROP TABLE temp_batch;

    -- 5. Log Observability (If table exists)
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'gift_batch_logs') THEN
        INSERT INTO public.gift_batch_logs (processed_count, backlog_count, duration_ms)
        VALUES (v_processed_count, (SELECT COUNT(*) FROM public.gift_ledger WHERE status = 'pending'), 0);
    END IF;

    RETURN jsonb_build_object('success', true, 'processed', v_processed_count, 'failed', v_failed_count);
END;
$$;
