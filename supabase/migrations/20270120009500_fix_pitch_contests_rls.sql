-- Fix RLS policies for pitch_contests
-- Ensure admins can manage contests

-- Drop existing policy to avoid conflicts/duplicates
DROP POLICY IF EXISTS "Admins can manage contests" ON public.pitch_contests;

-- Re-create the policy with a robust check
CREATE POLICY "Admins can manage contests" ON public.pitch_contests 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true)
    )
);

-- Ensure public can view
DROP POLICY IF EXISTS "Public can view contests" ON public.pitch_contests;
CREATE POLICY "Public can view contests" ON public.pitch_contests 
FOR SELECT 
USING (true);

-- Also ensure contest_eligibility is manageable by admins
DROP POLICY IF EXISTS "Admins can manage eligibility" ON public.contest_eligibility;
CREATE POLICY "Admins can manage eligibility" ON public.contest_eligibility 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true)
    )
);
