
-- Migration to fix Gift System Crashes and Schema Mismatches

-- 1. Ensure gift_ledger has quantity column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_ledger' AND column_name = 'quantity') THEN
        ALTER TABLE public.gift_ledger ADD COLUMN quantity INTEGER DEFAULT 1;
    END IF;
END $$;

-- 2. Ensure gift_transactions has quantity column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_transactions' AND column_name = 'quantity') THEN
        ALTER TABLE public.gift_transactions ADD COLUMN quantity INTEGER DEFAULT 1;
    END IF;
END $$;

-- 3. Update send_gift_ledger RPC to handle p_quantity
CREATE OR REPLACE FUNCTION send_gift_ledger(
    p_receiver_id UUID,
    p_gift_id TEXT,
    p_amount INTEGER,
    p_stream_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_ledger_id UUID;
    v_sender_balance INTEGER;
    v_total_cost INTEGER;
BEGIN
    -- Get Sender ID from Auth
    v_sender_id := auth.uid();
    IF v_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Calculate total cost
    v_total_cost := p_amount * p_quantity;

    -- Check Balance
    SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = v_sender_id;
    
    IF v_sender_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_ledger_id 
        FROM public.gift_ledger 
        WHERE sender_id = v_sender_id AND idempotency_key = p_idempotency_key;
        
        IF v_ledger_id IS NOT NULL THEN
            RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'message', 'Idempotent replay');
        END IF;
    END IF;

    -- Insert into Ledger
    INSERT INTO public.gift_ledger (
        sender_id, 
        receiver_id, 
        gift_id, 
        amount, 
        stream_id, 
        metadata, 
        idempotency_key, 
        status,
        quantity
    )
    VALUES (
        v_sender_id, 
        p_receiver_id, 
        p_gift_id, 
        p_amount, 
        p_stream_id, 
        p_metadata, 
        p_idempotency_key, 
        'pending',
        p_quantity
    )
    RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id);
END;
$$;

-- 4. Update Batch Processor to handle quantity
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
        SELECT sender_id, SUM(amount * COALESCE(quantity, 1)) as total_spend 
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
        SELECT receiver_id, SUM(amount * COALESCE(quantity, 1)) as total_receive
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
