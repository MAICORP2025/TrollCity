-- Create admin_settings table for global broadcast control
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB DEFAULT '{}',
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create initial broadcast_lockdown setting
INSERT INTO public.admin_settings (setting_key, setting_value, description)
VALUES 
  ('broadcast_lockdown_enabled', '{"enabled": false, "admin_broadcast_room": null}', 'Controls whether only admin can broadcast or everyone can')
ON CONFLICT (setting_key) DO NOTHING;

-- Grant permissions
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admin can view and update
CREATE POLICY "admin_can_manage_settings" ON public.admin_settings
  USING (
    auth.jwt() ->> 'email' = 'trollcity2025@gmail.com' OR
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'trollcity2025@gmail.com' OR
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Everyone can read broadcast_lockdown_enabled setting
CREATE POLICY "public_read_broadcast_lockdown" ON public.admin_settings
  FOR SELECT
  USING (setting_key = 'broadcast_lockdown_enabled');

-- Ensure at least one admin can always update
GRANT SELECT, INSERT, UPDATE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
