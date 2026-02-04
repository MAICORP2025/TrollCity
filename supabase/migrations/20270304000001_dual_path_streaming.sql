-- Migration: Dual-Path Streaming & Legal System
-- Description: Implements atomic seat reservation, paid seats, kick grace period, and court lawsuits.

-- 1. Create stream_seat_sessions table (The "Ledger" for seats)
CREATE TABLE IF NOT EXISTS public.stream_seat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seat_index INTEGER NOT NULL,
    price_paid INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('active', 'left', 'kicked', 'disconnected')),
    kick_reason TEXT,
    
    -- Ensure only one active session per seat per stream
    -- Partial unique index for active sessions
    CONSTRAINT unique_active_seat EXCLUDE USING gist (
        stream_id WITH =, 
        seat_index WITH =
    ) WHERE (status = 'active')
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_stream_status ON stream_seat_sessions(stream_id, status);
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_user ON stream_seat_sessions(user_id);

-- 2. Create court_cases table
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plaintiff_id UUID NOT NULL REFERENCES public.user_profiles(id),
    defendant_id UUID NOT NULL REFERENCES public.user_profiles(id),
    session_id UUID NOT NULL REFERENCES public.stream_seat_sessions(id),
    claim_amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    evidence_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    verdict_reason TEXT
);

-- 3. RPC: Atomic Join Seat
CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id UUID,
    p_seat_index INTEGER,
    p_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_balance INTEGER;
    v_active_session_id UUID;
    v_already_paid BOOLEAN := FALSE;
    v_stream_owner UUID;
    v_new_session_id UUID;
BEGIN
    -- 1. Validate Stream & Owner
    SELECT user_id INTO v_stream_owner FROM public.streams WHERE id = p_stream_id;
    IF v_stream_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
    END IF;

    -- 2. Check if seat is occupied
    -- The EXCLUDE constraint handles race conditions, but a quick check saves an exception
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat already taken');
    END IF;

    -- 3. Check Payment History (Idempotency for this stream)
    -- If user has already paid for a seat in this stream session (and maybe left/rejoined), 
    -- we might want to allow free rejoin? 
    -- User requirement: "If already paid -> do NOT charge again."
    -- We check if they have a previous session with price_paid > 0 for this stream?
    -- Or should we track "paid access" separately? 
    -- Let's assume if they paid for *this specific seat* or just *any seat*?
    -- Requirement: "Check if the user has already paid for THIS SPECIFIC SEAT for the current broadcast session."
    -- Implementation: Check prior sessions for this stream/seat.
    
    -- BUT, what defines "current broadcast session"? 
    -- Assuming 'streams' table represents a single broadcast session (id is unique per stream).
    
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions
        WHERE stream_id = p_stream_id
        AND user_id = v_user_id
        AND seat_index = p_seat_index
        AND price_paid >= p_price -- They paid at least this amount before
    ) THEN
        v_already_paid := TRUE;
    END IF;

    -- 4. Process Payment
    IF p_price > 0 AND NOT v_already_paid THEN
        -- Lock & Check Balance
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
        
        IF v_user_balance < p_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
        END IF;

        -- Deduct from User
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - p_price 
        WHERE id = v_user_id;

        -- Credit to Host (90%) - Burn 10%
        -- Or use the 'spend_coins' logic? For now, simple transfer.
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + FLOOR(p_price * 0.9)
        WHERE id = v_stream_owner;
        
        -- Log Transaction (optional but recommended)
        INSERT INTO public.coin_transactions (user_id, amount, type, description)
        VALUES (v_user_id, -p_price, 'purchase', 'Seat ' || p_seat_index || ' in stream ' || p_stream_id);
    END IF;

    -- 5. Create Session
    INSERT INTO public.stream_seat_sessions (
        stream_id, user_id, seat_index, price_paid, status, joined_at
    ) VALUES (
        p_stream_id, v_user_id, p_seat_index, CASE WHEN v_already_paid THEN 0 ELSE p_price END, 'active', now()
    ) RETURNING id INTO v_new_session_id;

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', v_new_session_id,
        'paid', CASE WHEN v_already_paid THEN 0 ELSE p_price END
    );

EXCEPTION 
    WHEN exclusion_violation THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat already taken (race)');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. RPC: Leave Seat
CREATE OR REPLACE FUNCTION public.leave_seat_atomic(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.stream_seat_sessions
    SET status = 'left', left_at = now()
    WHERE id = p_session_id AND user_id = auth.uid() AND status = 'active';

    IF FOUND THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Session not found or already ended');
    END IF;
END;
$$;

-- 5. RPC: Kick Participant (Host Only)
CREATE OR REPLACE FUNCTION public.kick_participant_atomic(
    p_stream_id UUID,
    p_target_user_id UUID,
    p_reason TEXT DEFAULT 'Host kicked'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Verify Host
    IF NOT EXISTS (SELECT 1 FROM public.streams WHERE id = p_stream_id AND user_id = auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- Find Active Session
    SELECT id INTO v_session_id
    FROM public.stream_seat_sessions
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id AND status = 'active'
    LIMIT 1;

    IF v_session_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not in seat');
    END IF;

    -- Update Session
    UPDATE public.stream_seat_sessions
    SET status = 'kicked', left_at = now(), kick_reason = p_reason
    WHERE id = v_session_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

-- 6. RPC: File Lawsuit (The 2x Claim)
CREATE OR REPLACE FUNCTION public.file_seat_lawsuit(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_claim_amount INTEGER;
    v_grace_seconds CONSTANT INTEGER := 10;
BEGIN
    SELECT * INTO v_session FROM public.stream_seat_sessions WHERE id = p_session_id;

    -- Validation
    IF v_session.user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not your session');
    END IF;

    IF v_session.status != 'kicked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not eligible: Was not kicked');
    END IF;

    -- Check Grace Period (Joined vs Left)
    IF EXTRACT(EPOCH FROM (v_session.left_at - v_session.joined_at)) > v_grace_seconds THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not eligible: Kicked after grace period');
    END IF;

    -- Check Double Filing
    IF EXISTS (SELECT 1 FROM public.court_cases WHERE session_id = p_session_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lawsuit already filed');
    END IF;

    -- Calculate Claim (2x Price Paid)
    -- We need to check if they actually paid > 0 in this session OR previous sessions?
    -- The prompt says "2x the original seat price". 
    -- If they rejoined for free, they might still claim 2x of the original price?
    -- Let's check the `price_paid` in the session. If 0 (rejoin), we might need to find the original payment?
    -- For simplicity/strictness: We only refund 2x of what was *paid in this specific session transaction*.
    -- OR, look up the stream seat price. 
    -- "The claim amount is: 2× the original seat price"
    -- Let's use the stream's current seat price as the basis if session price is 0? 
    -- No, safer to use what they actually paid to avoid exploiting free rejoins.
    -- Wait, if I pay 100, get kicked, file lawsuit -> get 200.
    -- If I rejoin (free), get kicked -> get 0? 
    -- This seems fair to prevent infinite farming.
    
    v_claim_amount := v_session.price_paid * 2;
    
    IF v_claim_amount <= 0 THEN
         RETURN jsonb_build_object('success', false, 'message', 'No coins were paid for this specific session entry');
    END IF;

    -- Create Case (Auto-approve for now as "Court System" is logic-based here?)
    -- "Is adjudicated by the Troll City Court system"
    -- "If the guest wins: Award 2x..."
    -- Let's just create it as 'pending' and have a separate "Judge" step? 
    -- Or if the rules are strict code, we can auto-judge.
    -- Prompt: "The lawsuit ... Is adjudicated by the Troll City Court system"
    -- Prompt: "If the guest wins... Coins are issued by the court system"
    -- I will implement an "Auto-Judge" RPC or just handle it here if the evidence is irrefutable (timestamps).
    -- Since the grace rule is strict code: "If the kick occurs within grace window... eligible".
    -- I'll make it auto-approve for immediate gratification/feedback in this MVP, 
    -- or leave pending if "Court" is a manual roleplay feature.
    -- Given "Troll City Court" implies roleplay, I will leave it PENDING.
    
    -- BUT, user said "Court Outcome... If guest wins... Award".
    -- I will create it as PENDING. The user (or an admin/judge) needs to approve it.
    -- However, for the purpose of this task "Implement dual-path...", I should provide the MECHANISM.
    
    INSERT INTO public.court_cases (
        plaintiff_id, defendant_id, session_id, claim_amount, status, evidence_snapshot
    ) 
    SELECT 
        v_session.user_id, 
        s.user_id, -- Defendant is Stream Owner
        v_session.id,
        v_claim_amount,
        'pending',
        jsonb_build_object(
            'joined_at', v_session.joined_at,
            'kicked_at', v_session.left_at,
            'duration_sec', EXTRACT(EPOCH FROM (v_session.left_at - v_session.joined_at)),
            'kick_reason', v_session.kick_reason
        )
    FROM public.streams s
    WHERE s.id = v_session.stream_id;

    RETURN jsonb_build_object('success', true, 'message', 'Lawsuit filed with Troll City Court');
END;
$$;
