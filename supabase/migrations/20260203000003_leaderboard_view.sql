-- Materialized View for O(1) Leaderboards
CREATE MATERIALIZED VIEW IF NOT EXISTS public.broadcaster_stats AS
SELECT 
    receiver_id as user_id,
    SUM(coins) as total_coins,
    COUNT(*) as total_gifts,
    MAX(created_at) as last_gift_at
FROM public.gift_ledger
GROUP BY receiver_id;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS broadcaster_stats_user_id_idx ON public.broadcaster_stats (user_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_broadcaster_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.broadcaster_stats;
END;
$$;

-- Grant access
GRANT SELECT ON public.broadcaster_stats TO anon, authenticated, service_role;
