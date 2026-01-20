-- Fix type mismatch in admin wallet view
-- The view/RPC was returning numeric for total_coins, but the return type was bigint.
-- This caused: "Returned type numeric does not match expected type bigint in column 3"

DROP FUNCTION IF EXISTS public.get_admin_user_wallets_secure();

CREATE OR REPLACE FUNCTION public.get_admin_user_wallets_secure()
RETURNS TABLE (
    user_id uuid,
    username text,
    total_coins bigint,
    escrowed_coins bigint,
    available_coins bigint,
    is_cashout_eligible boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH ledger_stats AS (
        SELECT 
            cl.user_id,
            COALESCE(SUM(cl.delta), 0)::bigint as total_balance,
            COALESCE(SUM(CASE WHEN cl.bucket = 'escrow' THEN cl.delta ELSE 0 END), 0)::bigint as escrow_balance
        FROM 
            public.coin_ledger cl
        GROUP BY 
            cl.user_id
    )
    SELECT 
        u.id as user_id,
        u.username,
        COALESCE(ls.total_balance, 0)::bigint as total_coins,
        COALESCE(ls.escrow_balance, 0)::bigint as escrowed_coins,
        (COALESCE(ls.total_balance, 0) - COALESCE(ls.escrow_balance, 0))::bigint as available_coins,
        CASE 
            WHEN (COALESCE(ls.total_balance, 0) - COALESCE(ls.escrow_balance, 0)) >= 500000 THEN true 
            ELSE false 
        END as is_cashout_eligible
    FROM 
        public.user_profiles u
    LEFT JOIN 
        ledger_stats ls ON u.id = ls.user_id
    WHERE 
        u.role != 'admin' -- Exclude admins from this view
        AND (ls.total_balance > 0 OR ls.escrow_balance > 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_wallets_secure() TO authenticated;
