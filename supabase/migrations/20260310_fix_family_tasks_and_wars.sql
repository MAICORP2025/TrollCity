-- Fix family_tasks RLS and FKs, and family_wars relationships

-- 1. Fix family_tasks Foreign Key and RLS
DO $$
BEGIN
    -- Drop old FK if it exists and points to families (we want it to point to troll_families)
    -- Note: We can't easily check target, so we'll try to drop and re-add if needed.
    -- But safe approach: add constraint if not exists.
    -- If family_tasks.family_id contains IDs that are NOT in troll_families, this will fail.
    -- We assume the app is moving to troll_families.
    
    -- Check if we can switch FK
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_tasks_family_id_fkey') THEN
        ALTER TABLE family_tasks DROP CONSTRAINT family_tasks_family_id_fkey;
    END IF;
    
    -- Add FK to troll_families
    -- We use ON DELETE CASCADE to clean up tasks if family is deleted
    ALTER TABLE family_tasks 
    ADD CONSTRAINT family_tasks_family_id_fkey 
    FOREIGN KEY (family_id) REFERENCES troll_families(id) ON DELETE CASCADE;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update family_tasks FK: %', SQLERRM;
END $$;

-- Update RLS for family_tasks to use troll_family_members
ALTER TABLE family_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Family members can view tasks" ON family_tasks;
DROP POLICY IF EXISTS "Family admins can create tasks" ON family_tasks;
DROP POLICY IF EXISTS "Assigned users can update task status" ON family_tasks;
DROP POLICY IF EXISTS "tasks by family members" ON family_tasks;

CREATE POLICY "family_tasks_select_policy" ON family_tasks
  FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM troll_family_members 
        WHERE family_id = family_tasks.family_id 
        AND user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM family_members 
        WHERE family_id = family_tasks.family_id 
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "family_tasks_insert_policy" ON family_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM troll_family_members 
        WHERE family_id = family_tasks.family_id 
        AND user_id = auth.uid() 
        AND role IN ('leader', 'officer', 'royal_troll')
    ) OR
    EXISTS (
        SELECT 1 FROM family_members 
        WHERE family_id = family_tasks.family_id 
        AND user_id = auth.uid() 
        AND role IN ('founder', 'admin', 'leader')
    )
  );

CREATE POLICY "family_tasks_update_policy" ON family_tasks
  FOR UPDATE USING (
    -- Leader/Officer can update any task
    EXISTS (
        SELECT 1 FROM troll_family_members 
        WHERE family_id = family_tasks.family_id 
        AND user_id = auth.uid() 
        AND role IN ('leader', 'officer', 'royal_troll')
    ) OR
    -- Assigned user can update their own task
    (assigned_to = auth.uid())
  );

-- 2. Fix family_wars relationships
-- The frontend expects family_a_id and family_b_id with specific FK names
DO $$
BEGIN
    -- Ensure columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_wars' AND column_name = 'family_a_id') THEN
        ALTER TABLE family_wars ADD COLUMN family_a_id UUID REFERENCES troll_families(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_wars' AND column_name = 'family_b_id') THEN
        ALTER TABLE family_wars ADD COLUMN family_b_id UUID REFERENCES troll_families(id) ON DELETE CASCADE;
    END IF;

    -- Ensure FK constraints have the specific names expected by frontend
    -- "family_wars_family_a_id_fkey"
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_wars_family_a_id_fkey') THEN
        ALTER TABLE family_wars DROP CONSTRAINT IF EXISTS family_wars_family_a_id_fkey_old; -- safety
        ALTER TABLE family_wars ADD CONSTRAINT family_wars_family_a_id_fkey FOREIGN KEY (family_a_id) REFERENCES troll_families(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'family_wars_family_b_id_fkey') THEN
        ALTER TABLE family_wars DROP CONSTRAINT IF EXISTS family_wars_family_b_id_fkey_old; -- safety
        ALTER TABLE family_wars ADD CONSTRAINT family_wars_family_b_id_fkey FOREIGN KEY (family_b_id) REFERENCES troll_families(id) ON DELETE CASCADE;
    END IF;

END $$;

-- Enable RLS for family_wars just in case
ALTER TABLE family_wars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_wars_select" ON family_wars;
CREATE POLICY "family_wars_select_all" ON family_wars FOR SELECT USING (true);

DROP POLICY IF EXISTS "family_wars_insert" ON family_wars;
CREATE POLICY "family_wars_insert_auth" ON family_wars FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "family_wars_update" ON family_wars;
CREATE POLICY "family_wars_update_auth" ON family_wars FOR UPDATE USING (auth.role() = 'authenticated');
