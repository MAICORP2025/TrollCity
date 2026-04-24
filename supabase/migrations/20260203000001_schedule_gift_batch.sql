-- P1 Reliability Fix: Schedule Gift Ledger Batch (Every 10 seconds)
-- We use pg_cron with pg_sleep offsets to achieve 10s resolution.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing jobs if any to avoid duplicates
DO $$
BEGIN
    PERFORM cron.unschedule('process_gifts_00');
    PERFORM cron.unschedule('process_gifts_10');
    PERFORM cron.unschedule('process_gifts_20');
    PERFORM cron.unschedule('process_gifts_30');
    PERFORM cron.unschedule('process_gifts_40');
    PERFORM cron.unschedule('process_gifts_50');
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
END $$;

-- Job 1: 0s offset
SELECT cron.schedule('process_gifts_00', '* * * * *', $$SELECT public.process_gift_ledger_batch()$$);

-- Job 2: 10s offset
SELECT cron.schedule('process_gifts_10', '* * * * *', $$SELECT pg_sleep(10); SELECT public.process_gift_ledger_batch()$$);

-- Job 3: 20s offset
SELECT cron.schedule('process_gifts_20', '* * * * *', $$SELECT pg_sleep(20); SELECT public.process_gift_ledger_batch()$$);

-- Job 4: 30s offset
SELECT cron.schedule('process_gifts_30', '* * * * *', $$SELECT pg_sleep(30); SELECT public.process_gift_ledger_batch()$$);

-- Job 5: 40s offset
SELECT cron.schedule('process_gifts_40', '* * * * *', $$SELECT pg_sleep(40); SELECT public.process_gift_ledger_batch()$$);

-- Job 6: 50s offset
SELECT cron.schedule('process_gifts_50', '* * * * *', $$SELECT pg_sleep(50); SELECT public.process_gift_ledger_batch()$$);
