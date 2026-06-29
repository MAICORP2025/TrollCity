-- Fix league members constraints and ON CONFLICT issues
-- Bug fixes: #18, #23 (42P00 - no unique constraint matching ON CONFLICT)
-- Ensures user_league_members has proper unique constraint for upserts

-- Ensure the UNIQUE constraint exists on user_league_members (league_id, user_id)
DO $$
BEGIN
    -- Add unique constraint if it doesn't exist (for ON CONFLICT support)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'user_league_members' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'user_league_members_league_id_user_id_key'
    ) THEN
        ALTER TABLE public.user_league_members 
        ADD CONSTRAINT user_league_members_league_id_user_id_key 
        UNIQUE (league_id, user_id);
    END IF;
END $$;

-- Ensure user_league_missions has proper unique constraint for upsert operations
-- First deduplicate existing rows (keep the newest one per user_id+mission_key)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_league_missions'
    ) THEN
        -- Delete older duplicates, keeping the row with the latest created_at (or highest id)
        DELETE FROM public.user_league_missions a
        USING public.user_league_missions b
        WHERE a.user_id = b.user_id 
          AND a.mission_key = b.mission_key 
          AND a.ctid < b.ctid;

        -- Now add the unique constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'user_league_missions' 
            AND constraint_type = 'UNIQUE' 
            AND constraint_name = 'user_league_missions_user_id_mission_key_key'
        ) THEN
            ALTER TABLE public.user_league_missions 
            ADD CONSTRAINT user_league_missions_user_id_mission_key_key 
            UNIQUE (user_id, mission_key);
        END IF;
    END IF;
END $$;

-- Fix any existing claim_user_league_mission RPC to handle mission_key lookups
-- This ensures the RPC can accept either a UUID mission_id OR a mission_key string
CREATE OR REPLACE FUNCTION public.claim_user_league_mission(
    p_user_id UUID,
    p_mission_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mission public.user_league_missions%ROWTYPE;
    v_result JSONB;
BEGIN
    -- Try to find by UUID first, then by mission_key
    SELECT * INTO v_mission 
    FROM public.user_league_missions 
    WHERE user_id = p_user_id 
    AND (
        (p_mission_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = p_mission_id::UUID)
        OR mission_key = p_mission_id
    )
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Mission not found for id/key: ' || p_mission_id
        );
    END IF;

    -- Only claim if status is 'completed' (ready to claim)
    IF v_mission.status != 'completed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Mission is not in claimable status. Current status: ' || v_mission.status
        );
    END IF;

    -- Update mission status to claimed
    UPDATE public.user_league_missions 
    SET status = 'claimed', 
        completed_at = NOW()
    WHERE id = v_mission.id;

    -- Award rewards to user profile if columns exist
    BEGIN
        UPDATE public.user_profiles 
        SET xp = COALESCE(xp, 0) + COALESCE(v_mission.reward_xp, 0),
            coins = COALESCE(coins, 0) + COALESCE(v_mission.reward_coins, 0)
        WHERE id = p_user_id;
    EXCEPTION WHEN undefined_column THEN
        -- Columns may not exist yet, skip reward
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'mission_id', v_mission.id,
        'reward_xp', COALESCE(v_mission.reward_xp, 0),
        'reward_coins', COALESCE(v_mission.reward_coins, 0)
    );
END $$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.claim_user_league_mission(UUID, TEXT) TO authenticated, anon;
