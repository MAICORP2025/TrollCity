-- Fix schema for family_members and family_tasks to align with troll_families
-- This migration resolves conflicts between 20251120 and 20251211 migrations

-- 1. Ensure family_members references troll_families
DO $$
BEGIN
    -- Check if family_members exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_members') THEN
        -- Check if troll_families exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_families') THEN
            -- Attempt to drop the old constraint (referencing 'families')
            BEGIN
                ALTER TABLE family_members DROP CONSTRAINT IF EXISTS family_members_family_id_fkey;
            EXCEPTION WHEN OTHERS THEN
                NULL; -- Ignore if it doesn't exist
            END;

            -- Cleanup orphan members (members pointing to non-existent troll_families)
            -- This assumes IDs in 'families' and 'troll_families' are different or we only care about troll_families
            DELETE FROM family_members WHERE family_id NOT IN (SELECT id FROM troll_families);
            
            -- Add new constraint pointing to troll_families
            ALTER TABLE family_members ADD CONSTRAINT family_members_family_id_fkey 
                FOREIGN KEY (family_id) REFERENCES troll_families(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 2. Fix family_tasks table structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_tasks') THEN
        -- Robust column normalization to handle mixed legacy/new schemas
        -- 1. title -> task_title
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'title') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'task_title') THEN
                UPDATE family_tasks SET task_title = COALESCE(task_title, title);
                ALTER TABLE family_tasks DROP COLUMN title;
            ELSE
                ALTER TABLE family_tasks RENAME COLUMN title TO task_title;
            END IF;
        END IF;
        
        -- 2. description -> task_description
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'description') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'task_description') THEN
                UPDATE family_tasks SET task_description = COALESCE(task_description, description);
                ALTER TABLE family_tasks DROP COLUMN description;
            ELSE
                ALTER TABLE family_tasks RENAME COLUMN description TO task_description;
            END IF;
        END IF;

        -- 3. reward_coins -> reward_family_coins
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'reward_coins') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'reward_family_coins') THEN
                UPDATE family_tasks SET reward_family_coins = COALESCE(reward_family_coins, reward_coins);
                ALTER TABLE family_tasks DROP COLUMN reward_coins;
            ELSE
                ALTER TABLE family_tasks RENAME COLUMN reward_coins TO reward_family_coins;
            END IF;
        END IF;

        -- 4. reward_xp -> reward_family_xp (ensure target exists first)
        ALTER TABLE family_tasks ADD COLUMN IF NOT EXISTS reward_family_xp BIGINT NOT NULL DEFAULT 0;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'reward_xp') THEN
            UPDATE family_tasks SET reward_family_xp = COALESCE(reward_family_xp, reward_xp);
            ALTER TABLE family_tasks DROP COLUMN reward_xp;
        END IF;

        -- 5. Drop legacy columns that may enforce NOT NULL without defaults
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'task_type') THEN
            ALTER TABLE family_tasks DROP COLUMN task_type;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'category') THEN
            ALTER TABLE family_tasks DROP COLUMN category;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'deadline') THEN
            ALTER TABLE family_tasks DROP COLUMN deadline;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'target_family_id') THEN
            ALTER TABLE family_tasks DROP COLUMN target_family_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'target_streamer_id') THEN
            ALTER TABLE family_tasks DROP COLUMN target_streamer_id;
        END IF;

        -- Drop old FK constraint
        BEGIN
            ALTER TABLE family_tasks DROP CONSTRAINT IF EXISTS family_tasks_family_id_fkey;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        -- Re-link to troll_families
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_families') THEN
            DELETE FROM family_tasks WHERE family_id NOT IN (SELECT id FROM troll_families);
            
            ALTER TABLE family_tasks ADD CONSTRAINT family_tasks_family_id_fkey 
                FOREIGN KEY (family_id) REFERENCES troll_families(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 3. Add missing columns to family_tasks
ALTER TABLE family_tasks 
    ADD COLUMN IF NOT EXISTS goal_value BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS current_value BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metric TEXT NOT NULL DEFAULT 'generic',
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Fix status constraint
ALTER TABLE family_tasks DROP CONSTRAINT IF EXISTS family_tasks_status_check;
UPDATE family_tasks SET status = 'active' WHERE status IN ('pending', 'in_progress');
ALTER TABLE family_tasks ADD CONSTRAINT family_tasks_status_check 
    CHECK (status IN ('active', 'completed', 'expired'));

-- 5. Ensure column types
ALTER TABLE family_tasks 
    ALTER COLUMN task_title SET NOT NULL,
    ALTER COLUMN reward_family_coins TYPE BIGINT;

-- 6. Insert sample tasks for existing families
DO $$
DECLARE
    family_record RECORD;
    has_task_title BOOLEAN;
    has_title BOOLEAN;
    has_reward_family_coins BOOLEAN;
    has_reward_coins BOOLEAN;
    has_reward_family_xp BOOLEAN;
    has_reward_xp BOOLEAN;
BEGIN
    -- Detect column names to support both legacy and new schemas
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='task_title') INTO has_task_title;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='title') INTO has_title;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='reward_family_coins') INTO has_reward_family_coins;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='reward_coins') INTO has_reward_coins;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='reward_family_xp') INTO has_reward_family_xp;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='reward_xp') INTO has_reward_xp;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_families') THEN
        FOR family_record IN SELECT id FROM public.troll_families LOOP
            -- Check if family has active tasks
            IF NOT EXISTS (
                SELECT 1 FROM public.family_tasks 
                WHERE family_id = family_record.id 
                AND status = 'active'
            ) THEN
                IF has_task_title THEN
                    -- New schema (20251211) with task_title, reward_family_* columns
                    INSERT INTO public.family_tasks (
                        family_id, task_title, task_description,
                        reward_family_coins, reward_family_xp,
                        goal_value, current_value, metric, status, expires_at
                    ) VALUES (
                        family_record.id,
                        'Recruit New Trolls',
                        'Grow your family by recruiting 3 new members this week.',
                        500, 100,
                        3, 0, 'family_members_recruited', 'active',
                        NOW() + INTERVAL '7 days'
                    );

                    INSERT INTO public.family_tasks (
                        family_id, task_title, task_description,
                        reward_family_coins, reward_family_xp,
                        goal_value, current_value, metric, status, expires_at
                    ) VALUES (
                        family_record.id,
                        'Host a Clan Stream',
                        'Start a live stream representing your family.',
                        200, 50,
                        1, 0, 'streams_started', 'active',
                        NOW() + INTERVAL '3 days'
                    );

                    INSERT INTO public.family_tasks (
                        family_id, task_title, task_description,
                        reward_family_coins, reward_family_xp,
                        goal_value, current_value, metric, status, expires_at
                    ) VALUES (
                        family_record.id,
                        'Gift Raid',
                        'Send 5 gifts to support other trolls.',
                        300, 75,
                        5, 0, 'gifts_sent', 'active',
                        NOW() + INTERVAL '5 days'
                    );
                ELSIF has_title THEN
                    -- Legacy schema (20251120) with title/description and reward_coins/reward_xp
                    INSERT INTO public.family_tasks (
                        family_id, title, description, category,
                        reward_coins, reward_xp,
                        status, expires_at
                    ) VALUES (
                        family_record.id,
                        'Recruit New Trolls',
                        'Grow your family by recruiting 3 new members this week.',
                        'General',
                        500, 100,
                        'active',
                        NOW() + INTERVAL '7 days'
                    );

                    INSERT INTO public.family_tasks (
                        family_id, title, description, category,
                        reward_coins, reward_xp,
                        status, expires_at
                    ) VALUES (
                        family_record.id,
                        'Host a Clan Stream',
                        'Start a live stream representing your family.',
                        'General',
                        200, 50,
                        'active',
                        NOW() + INTERVAL '3 days'
                    );

                    INSERT INTO public.family_tasks (
                        family_id, title, description, category,
                        reward_coins, reward_xp,
                        status, expires_at
                    ) VALUES (
                        family_record.id,
                        'Gift Raid',
                        'Send 5 gifts to support other trolls.',
                        'General',
                        300, 75,
                        'active',
                        NOW() + INTERVAL '5 days'
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;
