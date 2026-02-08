-- Fix family_wars table
ALTER TABLE public.family_wars ADD COLUMN IF NOT EXISTS winner_family_id UUID REFERENCES public.troll_families(id);

-- Create family_war_scores table
CREATE TABLE IF NOT EXISTS public.family_war_scores (
    war_id UUID NOT NULL REFERENCES public.family_wars(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (war_id, family_id)
);

ALTER TABLE public.family_war_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read scores" ON public.family_war_scores FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON public.family_war_scores FOR ALL USING (true);
