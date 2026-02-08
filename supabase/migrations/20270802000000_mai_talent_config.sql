
-- Create configuration table for Mai Talent (Singleton pattern)
CREATE TABLE IF NOT EXISTS public.mai_talent_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_live BOOLEAN DEFAULT false,
    current_round TEXT DEFAULT 'auditions', -- auditions, semi-finals, finals
    live_stream_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES public.user_profiles(id),
    CONSTRAINT singleton_check CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE public.mai_talent_config ENABLE ROW LEVEL SECURITY;

-- Public can read
CREATE POLICY "Public can read mai talent config" ON public.mai_talent_config
    FOR SELECT USING (true);

-- Only admins/staff can update
CREATE POLICY "Staff can update mai talent config" ON public.mai_talent_config
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'moderator', 'troll_officer', 'lead_troll_officer') OR is_admin = true)
        )
    );

-- Insert default row if not exists
INSERT INTO public.mai_talent_config (id, is_live)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
