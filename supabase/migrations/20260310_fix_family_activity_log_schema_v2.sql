-- Fix family_activity_log schema: ensure user_id exists and points to user_profiles
DO $$
BEGIN
    -- 1. Ensure table exists
    CREATE TABLE IF NOT EXISTS public.family_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL,
        event_type TEXT NOT NULL,
        event_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Add user_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_activity_log' AND column_name = 'user_id') THEN
        ALTER TABLE family_activity_log ADD COLUMN user_id UUID;
    END IF;

    -- 3. Fix FK to point to user_profiles
    -- Drop old constraints if any (referencing profiles or anything else)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_activity_log_user_id_fkey') THEN
        ALTER TABLE family_activity_log DROP CONSTRAINT family_activity_log_user_id_fkey;
    END IF;

    -- Add correct constraint to user_profiles
    ALTER TABLE family_activity_log ADD CONSTRAINT family_activity_log_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

    -- 4. Ensure family_id FK points to troll_families (if not already set)
    -- We won't force drop it in case it's correct, but we'll try to add it if missing
    -- Note: We assume the table is troll_families based on codebase usage
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_activity_log_family_id_fkey') THEN
        BEGIN
            ALTER TABLE family_activity_log ADD CONSTRAINT family_activity_log_family_id_fkey
            FOREIGN KEY (family_id) REFERENCES troll_families(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            -- If it fails (e.g. key exists with different name), ignore
            NULL;
        END;
    END IF;

EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
