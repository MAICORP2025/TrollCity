-- Fix Foreign Key names to match frontend expectations

-- 1. Fix family_wars FKs
DO $$
BEGIN
    -- Drop existing constraints if they have auto-generated names (we'll recreate them with specific names)
    -- We try to drop by the expected names first, and also by column if possible (but SQL requires name)
    
    -- Try to drop constraints if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_wars_family_a_id_fkey') THEN
        ALTER TABLE family_wars DROP CONSTRAINT family_wars_family_a_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_wars_family_b_id_fkey') THEN
        ALTER TABLE family_wars DROP CONSTRAINT family_wars_family_b_id_fkey;
    END IF;

    -- Also checking generic names just in case, but hard to guess. 
    -- Instead, we'll just add the correctly named ones. Postgres allows multiple FKs on same column, but let's try to be clean.
    -- Ideally we would find the constraint name for the column, but that requires complex dynamic SQL.
    -- For now, we will add the constraints with the specific names required by the frontend.
    
    ALTER TABLE family_wars ADD CONSTRAINT family_wars_family_a_id_fkey 
    FOREIGN KEY (family_a_id) REFERENCES troll_families(id);

    ALTER TABLE family_wars ADD CONSTRAINT family_wars_family_b_id_fkey 
    FOREIGN KEY (family_b_id) REFERENCES troll_families(id);

EXCEPTION WHEN duplicate_object THEN
    -- If they already exist with these names, do nothing
    NULL;
END $$;

-- 2. Fix family_activity_log FK
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_activity_log_user_id_fkey') THEN
        ALTER TABLE family_activity_log DROP CONSTRAINT family_activity_log_user_id_fkey;
    END IF;

    ALTER TABLE family_activity_log ADD CONSTRAINT family_activity_log_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id);

EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
