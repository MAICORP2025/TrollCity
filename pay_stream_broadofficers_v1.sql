-- ============================================================
-- pay_stream_broadofficers_v1 RPC (2026-05-31)
-- ============================================================
-- STATUS: PREPARED ONLY — DO NOT RUN WITHOUT APPROVAL
--
-- Pays all current BroadOfficers in a stream from the broadcaster's
-- own troll_coins balance. Atomic: either all officers are paid or
-- nothing changes.
--
-- BroadOfficer source: broadcast_officers table
--   (broadcaster_id, officer_id) with RLS policies
--
-- Called from: PayBroadOfficersModal.tsx (frontend)
-- ============================================================

CREATE OR REPLACE FUNCTION public.pay_stream_broadofficers_v1(
    p_stream_id UUID,
    p_amount_per_officer INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_broadcaster_id UUID;
    v_broadcaster_balance BIGINT;
    v_officer RECORD;
    v_officer_count INTEGER := 0;
    v_total_amount BIGINT;
    v_batch_id UUID := gen_random_uuid();
BEGIN
    -- 1. Get stream owner
    SELECT user_id INTO v_broadcaster_id
    FROM public.streams
    WHERE id = p_stream_id;

    IF v_broadcaster_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
    END IF;

    -- 2. Only the stream broadcaster may call this
    IF auth.uid() != v_broadcaster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the stream broadcaster can pay officers');
    END IF;

    -- 3. Validate amount
    IF p_amount_per_officer IS NULL OR p_amount_per_officer <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- 4. Count current BroadOfficers (exclude broadcaster)
    SELECT COUNT(*) INTO v_officer_count
    FROM public.broadcast_officers
    WHERE broadcaster_id = v_broadcaster_id
      AND officer_id != v_broadcaster_id;

    IF v_officer_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No BroadOfficers to pay');
    END IF;

    v_total_amount := p_amount_per_officer::BIGINT * v_officer_count;

    -- 5. Check broadcaster balance
    SELECT troll_coins INTO v_broadcaster_balance
    FROM public.user_profiles
    WHERE id = v_broadcaster_id;

    IF v_broadcaster_balance IS NULL OR v_broadcaster_balance < v_total_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',
            format('Insufficient balance. Need %s, have %s', v_total_amount, COALESCE(v_broadcaster_balance, 0))
        );
    END IF;

    -- 6. Deduct total from broadcaster (single deduction)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_total_amount,
        updated_at = NOW()
    WHERE id = v_broadcaster_id;

    -- 7. Credit each BroadOfficer and create ledger rows
    FOR v_officer IN
        SELECT officer_id
        FROM public.broadcast_officers
        WHERE broadcaster_id = v_broadcaster_id
          AND officer_id != v_broadcaster_id
    LOOP
        -- Credit officer balance
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + p_amount_per_officer,
            earned_balance = COALESCE(earned_balance, 0) + p_amount_per_officer,
            total_earned_coins = COALESCE(total_earned_coins, 0) + p_amount_per_officer,
            updated_at = NOW()
        WHERE id = v_officer.officer_id;

        -- Ledger row for officer (credit)
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
        VALUES (
            v_officer.officer_id,
            p_amount_per_officer,
            'paid',
            'broadofficer_pay',
            v_batch_id::text,
            format('BroadOfficer pay from stream %s', p_stream_id)
        );

        -- Notification for officer
        PERFORM public.create_notification(
            v_officer.officer_id,
            'broadofficer_paid',
            'BroadOfficer Pay Received! 💰',
            format('You received %s Troll Coins from the broadcaster.', p_amount_per_officer),
            jsonb_build_object('stream_id', p_stream_id, 'amount', p_amount_per_officer, 'batch_id', v_batch_id)
        );
    END LOOP;

    -- 8. Ledger row for broadcaster (debit)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES (
        v_broadcaster_id,
        -v_total_amount,
        'paid',
        'broadofficer_pay',
        v_batch_id::text,
        format('Paid %s BroadOfficers %s coins each', v_officer_count, p_amount_per_officer)
    );

    RETURN jsonb_build_object(
        'success', true,
        'officer_count', v_officer_count,
        'amount_per_officer', p_amount_per_officer,
        'total_amount', v_total_amount,
        'batch_id', v_batch_id
    );
END;
$$;

-- Grant to authenticated (frontend calls via supabase client)
GRANT EXECUTE ON FUNCTION public.pay_stream_broadofficers_v1(UUID, INTEGER) TO authenticated;
