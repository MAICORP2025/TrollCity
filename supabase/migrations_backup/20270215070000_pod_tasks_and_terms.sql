-- Add terms_accepted to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

-- Clean up Gamerz tasks
DELETE FROM public.troll_wars_tasks 
WHERE category = 'gamerz' OR category = 'gaming';

-- Add Pod Tasks
INSERT INTO public.troll_wars_tasks 
(task_id, name, description, tier, category, progress_type, target_value, is_repeatable, reset_cycle, is_active)
VALUES 
('host_pod_1', 'Voice of the City', 'Host a podcast for at least 10 minutes', 'medium', 'social', 'time', 10, true, 'weekly', true),
('listen_pod_1', 'Good Listener', 'Listen to podcasts for 30 minutes', 'easy', 'social', 'time', 30, true, 'weekly', true)
ON CONFLICT (task_id) DO NOTHING;

-- Fix/Ensure permissions for terms_accepted
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;
