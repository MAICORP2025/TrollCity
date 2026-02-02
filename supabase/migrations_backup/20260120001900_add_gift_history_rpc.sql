-- Function to get gift history for a specific user (admin usage)
CREATE OR REPLACE FUNCTION public.get_user_gift_history(
    p_user_id uuid,
    p_limit int DEFAULT 50
)
RETURNS TABLE (
    id uuid,
    direction text,
    amount int,
    other_username text,
    gift_name text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ct.id,
        CASE
            WHEN ct.type LIKE '%sent%' THEN 'sent'
            ELSE 'received'
        END as direction,
        ABS(ct.amount) as amount,
        COALESCE(up.username, 'Unknown') as other_username,
        COALESCE(
            ct.metadata->>'gift_name',
            ct.metadata->>'item',
            ct.metadata->>'gift_type',
            'Gift'
        ) as gift_name,
        ct.created_at
    FROM coin_transactions ct
    LEFT JOIN user_profiles up ON up.id = (
        CASE
            WHEN ct.type LIKE '%sent%' THEN (ct.metadata->>'receiver_id')::uuid
            ELSE (ct.metadata->>'sender_id')::uuid
        END
    )
    WHERE ct.user_id = p_user_id
    AND (
        ct.type = 'gift_sent' 
        OR ct.type = 'gift_received' 
        OR ct.type = 'gift_sent_wall' 
        OR ct.type = 'gift_received_wall'
        OR ct.type = 'gift' -- legacy
    )
    ORDER BY ct.created_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_gift_history(uuid, int) TO authenticated;
