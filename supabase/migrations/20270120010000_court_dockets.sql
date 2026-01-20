
-- Court Dockets Table
CREATE TABLE IF NOT EXISTS public.court_dockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_date DATE NOT NULL,
    max_cases INTEGER DEFAULT 20,
    status TEXT DEFAULT 'open', -- open, full, closed, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(court_date)
);

-- Court Cases Table
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id UUID REFERENCES public.court_dockets(id),
    defendant_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    plaintiff_id UUID REFERENCES public.user_profiles(id), -- Staff who summoned
    reason TEXT NOT NULL,
    incident_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, warrant_issued, resolved, extended, dismissed
    warrant_active BOOLEAN DEFAULT FALSE,
    users_involved TEXT, -- usernames involved
    judgment TEXT, -- Judge's decision
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add warrant flag to user_profiles for fast access check
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS has_active_warrant BOOLEAN DEFAULT FALSE;

-- RLS Policies
ALTER TABLE public.court_dockets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view dockets" ON public.court_dockets FOR SELECT USING (true);
CREATE POLICY "Staff manage dockets" ON public.court_dockets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') OR is_admin = true OR is_troll_officer = true))
);

ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view cases" ON public.court_cases FOR SELECT USING (true);
CREATE POLICY "Staff manage cases" ON public.court_cases FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') OR is_admin = true OR is_troll_officer = true))
);

-- Function to systematically generate/get dockets
CREATE OR REPLACE FUNCTION public.get_or_create_next_docket()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_date DATE;
    v_count INT;
BEGIN
    -- Find the earliest open docket with space
    SELECT d.id INTO v_docket_id
    FROM public.court_dockets d
    LEFT JOIN public.court_cases c ON c.docket_id = d.id
    WHERE d.status = 'open' AND d.court_date >= CURRENT_DATE
    GROUP BY d.id
    HAVING COUNT(c.id) < MAX(d.max_cases)
    ORDER BY d.court_date ASC
    LIMIT 1;

    IF v_docket_id IS NOT NULL THEN
        RETURN v_docket_id;
    END IF;

    -- If no open docket, create one for tomorrow (or next available day)
    -- Simple logic: Look at last docket date, add 1 day. If none, tomorrow.
    SELECT MAX(court_date) INTO v_date FROM public.court_dockets;
    
    IF v_date IS NULL OR v_date < CURRENT_DATE THEN
        v_date := CURRENT_DATE + INTERVAL '1 day';
    ELSE
        v_date := v_date + INTERVAL '1 day';
    END IF;

    INSERT INTO public.court_dockets (court_date, status)
    VALUES (v_date, 'open')
    RETURNING id INTO v_docket_id;

    RETURN v_docket_id;
END;
$$;

-- Function to summon user (Double Click Action)
CREATE OR REPLACE FUNCTION public.summon_user_to_court(
    p_defendant_id UUID,
    p_reason TEXT,
    p_users_involved TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_case_id UUID;
    v_staff_id UUID;
BEGIN
    v_staff_id := auth.uid();
    
    -- Verify staff
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_staff_id AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') OR is_admin = true OR is_troll_officer = true)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get Docket
    v_docket_id := public.get_or_create_next_docket();

    -- Create Case
    INSERT INTO public.court_cases (docket_id, defendant_id, plaintiff_id, reason, users_involved)
    VALUES (v_docket_id, p_defendant_id, v_staff_id, p_reason, p_users_involved)
    RETURNING id INTO v_case_id;

    -- Check if docket is now full
    IF (SELECT COUNT(*) FROM public.court_cases WHERE docket_id = v_docket_id) >= 20 THEN
        UPDATE public.court_dockets SET status = 'full' WHERE id = v_docket_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'docket_id', v_docket_id);
END;
$$;

-- Function to issue warrant (instead of ban)
CREATE OR REPLACE FUNCTION public.issue_warrant(
    p_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_staff_id UUID;
    v_docket_id UUID;
BEGIN
    v_staff_id := auth.uid();
    
    -- Verify staff
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_staff_id AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') OR is_admin = true OR is_troll_officer = true)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- 1. Create a court case if not exists or use existing? 
    -- The requirement says "instead of banning... issue a warrant... revoke access... until they appear in court".
    -- This implies they need a court date too.
    
    v_docket_id := public.get_or_create_next_docket();

    INSERT INTO public.court_cases (docket_id, defendant_id, plaintiff_id, reason, status, warrant_active)
    VALUES (v_docket_id, p_user_id, v_staff_id, p_reason, 'warrant_issued', TRUE);

    -- 2. Update User Profile
    UPDATE public.user_profiles
    SET has_active_warrant = TRUE
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to extend/reschedule court date
CREATE OR REPLACE FUNCTION public.extend_court_date(
    p_case_id UUID,
    p_new_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_judge_id UUID;
    v_new_docket_id UUID;
    v_old_docket_id UUID;
BEGIN
    v_judge_id := auth.uid();
    
    -- Verify judge/admin
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_judge_id AND (role IN ('admin', 'judge') OR is_admin = true)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Find or create docket for new date
    SELECT id INTO v_new_docket_id FROM public.court_dockets WHERE court_date = p_new_date;
    
    IF v_new_docket_id IS NULL THEN
        INSERT INTO public.court_dockets (court_date, status) VALUES (p_new_date, 'open') RETURNING id INTO v_new_docket_id;
    END IF;

    -- Check capacity
    IF (SELECT COUNT(*) FROM public.court_cases WHERE docket_id = v_new_docket_id) >= 20 THEN
         RETURN jsonb_build_object('success', false, 'error', 'Target docket is full');
    END IF;

    -- Update Case
    SELECT docket_id INTO v_old_docket_id FROM public.court_cases WHERE id = p_case_id;
    
    UPDATE public.court_cases
    SET docket_id = v_new_docket_id, status = 'extended'
    WHERE id = p_case_id;

    -- Update old docket status if it was full
    UPDATE public.court_dockets SET status = 'open' WHERE id = v_old_docket_id AND status = 'full';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to remove ban/warrant (Judge)
CREATE OR REPLACE FUNCTION public.judge_pardon_user(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify judge/admin
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'judge') OR is_admin = true)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    UPDATE public.user_profiles
    SET has_active_warrant = FALSE,
        is_banned = FALSE
    WHERE id = p_user_id;
    
    UPDATE public.court_cases
    SET warrant_active = FALSE,
        status = 'resolved'
    WHERE defendant_id = p_user_id AND (status = 'pending' OR status = 'warrant_issued');

    RETURN jsonb_build_object('success', true);
END;
$$;
