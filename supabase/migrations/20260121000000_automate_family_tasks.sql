
-- Migration to automate family task generation and provide detailed weekly tasks

-- 1. Ensure family_tasks table exists with correct schema
CREATE TABLE IF NOT EXISTS public.family_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    task_title text NOT NULL,
    task_description text,
    reward_family_coins integer DEFAULT 0,
    reward_family_xp integer DEFAULT 0,
    goal_value integer DEFAULT 1,
    current_value integer DEFAULT 0,
    metric text NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure columns exist (idempotent checks)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'task_title') THEN
        ALTER TABLE public.family_tasks ADD COLUMN task_title text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'metric') THEN
        ALTER TABLE public.family_tasks ADD COLUMN metric text;
    END IF;
    -- Add indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_family_tasks_family_id ON public.family_tasks(family_id);
END $$;

-- 2. Create or Replace the create_family_tasks function
DROP FUNCTION IF EXISTS public.create_family_tasks(uuid);

CREATE OR REPLACE FUNCTION public.create_family_tasks(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expires_at timestamptz := now() + interval '7 days';
BEGIN
  -- Insert detailed tasks across categories
  INSERT INTO public.family_tasks (
    family_id,
    task_title,
    task_description,
    reward_family_coins,
    reward_family_xp,
    goal_value,
    current_value,
    metric,
    status,
    expires_at
  ) VALUES
    -- Core Family Participation
    (p_family_id, 'Recruit New Trolls', 'Grow your family by recruiting 3 new members this week.', 500, 100, 3, 0, 'family_members_recruited', 'active', v_expires_at),
    (p_family_id, 'Family Activity', 'Earn 5000 XP collectively as a family.', 1000, 200, 5000, 0, 'xp_earned', 'active', v_expires_at),

    -- Streaming & Broadcasting
    (p_family_id, 'Host a Clan Stream', 'Start a live stream representing your family.', 200, 50, 1, 0, 'streams_started', 'active', v_expires_at),
    (p_family_id, 'Broadcast Dominance', 'Host 5 streams this week.', 1000, 250, 5, 0, 'streams_started', 'active', v_expires_at),

    -- Community & Social
    (p_family_id, 'Gift Raid', 'Send 10 gifts to support other trolls.', 500, 100, 10, 0, 'gifts_sent', 'active', v_expires_at),
    
    -- Economy & Coins
    (p_family_id, 'Economic Power', 'Earn 10,000 coins collectively.', 1000, 200, 10000, 0, 'coins_earned', 'active', v_expires_at),

    -- Family Wars - PVP (Detailed Tasks)
    (p_family_id, 'Declare War', 'Declare war on a rival family.', 300, 75, 1, 0, 'wars_declared', 'active', v_expires_at),
    (p_family_id, 'First Blood', 'Win your first Family War of the week.', 1000, 300, 1, 0, 'wars_won', 'active', v_expires_at),
    (p_family_id, 'War Machine', 'Win 3 Family Wars.', 3000, 1000, 3, 0, 'wars_won', 'active', v_expires_at),
    (p_family_id, 'Total Domination', 'Win 5 Family Wars to prove your supremacy.', 5000, 2000, 5, 0, 'wars_won', 'active', v_expires_at),

    -- Strategy & Leadership
    (p_family_id, 'Strategist', 'Earn 1000 coins from Family Ventures (simulated via coins earned).', 500, 100, 1000, 0, 'coins_earned', 'active', v_expires_at)
  ;

EXCEPTION WHEN OTHERS THEN
  -- Log error or ignore if duplicate keys (though uuid gen should prevent it)
  RAISE NOTICE 'Error creating family tasks: %', SQLERRM;
END;
$$;

-- 3. Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_create_family_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the task generation function for the new family
  PERFORM public.create_family_tasks(NEW.id);
  RETURN NEW;
END;
$$;

-- 4. Create the trigger on troll_families
DROP TRIGGER IF EXISTS trg_create_family_tasks ON public.troll_families;

CREATE TRIGGER trg_create_family_tasks
AFTER INSERT ON public.troll_families
FOR EACH ROW
EXECUTE FUNCTION public.trigger_create_family_tasks();

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.create_family_tasks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_family_tasks(uuid) TO service_role;
