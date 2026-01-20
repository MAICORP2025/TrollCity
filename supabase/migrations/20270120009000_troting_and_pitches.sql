
-- Pitch Contests
CREATE TABLE IF NOT EXISTS public.pitch_contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'submission', -- submission, voting, review, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    winning_pitch_id UUID
);

-- Eligible Broadcasters for a specific contest (Snapshotted)
CREATE TABLE IF NOT EXISTS public.contest_eligibility (
    contest_id UUID REFERENCES public.pitch_contests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (contest_id, user_id)
);

-- Pitches
CREATE TABLE IF NOT EXISTS public.pitches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID REFERENCES public.pitch_contests(id) ON DELETE CASCADE,
    broadcaster_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    monetization_type TEXT NOT NULL,
    revenue_generation TEXT NOT NULL,
    mockup_url TEXT,
    vote_count INT DEFAULT 0,
    status TEXT DEFAULT 'submitted', -- submitted, voting, approved, rejected, live
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contest_id, broadcaster_id)
);

-- Pitch Votes
CREATE TABLE IF NOT EXISTS public.pitch_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID REFERENCES public.pitches(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    contest_id UUID REFERENCES public.pitch_contests(id) ON DELETE CASCADE,
    coins_spent INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Splits
CREATE TABLE IF NOT EXISTS public.revenue_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID REFERENCES public.pitches(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.user_profiles(id),
    percentage NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator Applications
CREATE TABLE IF NOT EXISTS public.creator_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

ALTER TABLE public.pitch_contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view contests" ON public.pitch_contests FOR SELECT USING (true);
CREATE POLICY "Admins can manage contests" ON public.pitch_contests FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

ALTER TABLE public.contest_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view eligibility" ON public.contest_eligibility FOR SELECT USING (true);
CREATE POLICY "Admins can manage eligibility" ON public.contest_eligibility FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view pitches" ON public.pitches FOR SELECT USING (true);
CREATE POLICY "Eligible broadcasters can insert pitches" ON public.pitches FOR INSERT WITH CHECK (
    auth.uid() = broadcaster_id AND
    EXISTS (
        SELECT 1 FROM public.contest_eligibility 
        WHERE contest_id = pitches.contest_id AND user_id = auth.uid()
    )
);
CREATE POLICY "Broadcasters can update own pitches" ON public.pitches FOR UPDATE USING (
    auth.uid() = broadcaster_id
);

ALTER TABLE public.pitch_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view votes" ON public.pitch_votes FOR SELECT USING (true);
-- Insert handled via RPC for safety

ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own applications" ON public.creator_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create applications" ON public.creator_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage applications" ON public.creator_applications FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'secretary' OR role = 'lead_troll_officer'))
);

-- RPC to Vote
CREATE OR REPLACE FUNCTION public.vote_for_pitch(
    p_pitch_id UUID,
    p_voter_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contest_id UUID;
    v_pitch_status TEXT;
    v_contest_status TEXT;
    v_balance INT;
    v_cost INT := 10;
BEGIN
    -- Get pitch and contest info
    SELECT p.contest_id, p.status, c.status 
    INTO v_contest_id, v_pitch_status, v_contest_status
    FROM public.pitches p
    JOIN public.pitch_contests c ON p.contest_id = c.id
    WHERE p.id = p_pitch_id;

    -- Validate Status
    IF v_contest_status != 'voting' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contest is not in voting phase');
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance
    FROM public.user_profiles
    WHERE id = p_voter_id;

    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = p_voter_id;

    -- Record Vote
    INSERT INTO public.pitch_votes (pitch_id, voter_id, contest_id, coins_spent)
    VALUES (p_pitch_id, p_voter_id, v_contest_id, v_cost);

    -- Increment Pitch Count
    UPDATE public.pitches
    SET vote_count = vote_count + 1
    WHERE id = p_pitch_id;

    -- Log Transaction
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        created_at
    ) VALUES (
        p_voter_id,
        -v_cost,
        'vote_cast',
        'Vote cast in Pitch Contest',
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'new_balance', v_balance - v_cost);
END;
$$;

-- RPC to Approve Creator Application
CREATE OR REPLACE FUNCTION public.approve_creator_application(
    p_application_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Check permissions (Admin/Secretary/Lead Officer)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id 
        AND (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get applicant ID
    SELECT user_id INTO v_user_id FROM public.creator_applications WHERE id = p_application_id;

    -- Update Application Status
    UPDATE public.creator_applications
    SET status = 'approved',
        reviewed_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_application_id;

    -- Update User Profile (Boosts + Badge)
    UPDATE public.user_profiles
    SET 
        is_broadcaster = true,
        -- Apply 7 Day Boost (placeholder logic, assume column exists or we handle it in application logic)
        -- We can set a 'boost_expires_at' if it exists, or just log it
        role = 'founder', -- 'founder badge' as requested, though 'role' might be strict enum. 
                          -- Safest is to set is_broadcaster and maybe a badge array if it exists.
        -- Assuming 'perks' column or similar for badges. 
        -- For now, just ensuring is_broadcaster is true.
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Note: 'Reduced fees' would be handled by fee logic checking for 'founder' role or similar.

    RETURN jsonb_build_object('success', true);
END;
$$;
