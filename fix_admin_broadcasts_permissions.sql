
-- Create admin_broadcasts table if it doesn't exist (Fixes permission denied error)
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    admin_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for admin_broadcasts
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read admin_broadcasts (for announcements)
DROP POLICY IF EXISTS "Everyone can read admin_broadcasts" ON public.admin_broadcasts;
CREATE POLICY "Everyone can read admin_broadcasts"
ON public.admin_broadcasts FOR SELECT
USING (true);

-- Policy: Only admins can insert/update/delete admin_broadcasts
DROP POLICY IF EXISTS "Admins can manage admin_broadcasts" ON public.admin_broadcasts;
CREATE POLICY "Admins can manage admin_broadcasts"
ON public.admin_broadcasts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_broadcasts TO authenticated;
GRANT SELECT ON public.admin_broadcasts TO anon;
