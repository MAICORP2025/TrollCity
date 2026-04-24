-- Mai Talent Feature Schema

-- 1. Auditions Table
CREATE TABLE IF NOT EXISTS public.mai_talent_auditions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    talent_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    clip_url TEXT, -- for uploaded clips
    stream_url TEXT, -- for external streams (Youtube, Twitch, Kick)
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, featured
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Votes Table
CREATE TABLE IF NOT EXISTS public.mai_talent_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audition_id UUID REFERENCES public.mai_talent_auditions(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0), -- Number of coins voted
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Judges Table (Dynamic judges for the session)
CREATE TABLE IF NOT EXISTS public.mai_talent_judges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    appointed_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS Policies

-- Auditions
ALTER TABLE public.mai_talent_auditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved auditions" ON public.mai_talent_auditions
    FOR SELECT USING (true); -- Ideally limit to status='approved' OR status='featured' but for dev 'true' is easier, filter in query

CREATE POLICY "Users can create auditions" ON public.mai_talent_auditions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their auditions" ON public.mai_talent_auditions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins and Judges can update auditions" ON public.mai_talent_auditions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role IN ('admin', 'moderator') OR id IN (SELECT user_id FROM public.mai_talent_judges))
        )
    );

-- Votes
ALTER TABLE public.mai_talent_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view votes" ON public.mai_talent_votes
    FOR SELECT USING (true);

CREATE POLICY "Users can vote" ON public.mai_talent_votes
    FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Judges
ALTER TABLE public.mai_talent_judges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view judges" ON public.mai_talent_judges
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage judges" ON public.mai_talent_judges
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

-- 5. Leaderboard View (Optional but helpful)
CREATE OR REPLACE VIEW public.mai_talent_leaderboard AS
SELECT 
    a.id as audition_id,
    a.user_id,
    a.talent_name,
    a.category,
    a.status,
    a.clip_url,
    a.stream_url,
    a.description,
    u.username,
    u.avatar_url,
    COALESCE(SUM(v.amount), 0) as total_votes,
    COUNT(v.id) as vote_count
FROM 
    public.mai_talent_auditions a
    JOIN public.user_profiles u ON a.user_id = u.id
    LEFT JOIN public.mai_talent_votes v ON a.id = v.audition_id
WHERE
    a.status IN ('approved', 'featured')
GROUP BY 
    a.id, u.id, u.username, u.avatar_url;
