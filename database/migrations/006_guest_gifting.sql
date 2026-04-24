CREATE OR REPLACE FUNCTION public.send_guest_gift(
    p_guest_id TEXT,
    p_receiver_id UUID,
    p_stream_id UUID,
    p_gift_id UUID,
    p_cost INTEGER,
    p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ledger_item_id UUID;
BEGIN
    -- Record the gift
    INSERT INTO public.stream_gifts (stream_id, sender_id, recipient_id, gift_id)
    VALUES (p_stream_id, p_guest_id::uuid, p_receiver_id, p_gift_id);

    RETURN jsonb_build_object('success', true);
END;
$$;