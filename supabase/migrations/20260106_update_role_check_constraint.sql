-- Remove the existing check constraint on the role column
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'user_profiles' AND column_name = 'role'
    ) LOOP
        EXECUTE 'ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Add a new check constraint with all valid roles
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_role_check
CHECK (role IN (
    'user',
    'moderator',
    'admin',
    'hr_admin',
    'lead_troll_officer',
    'troll_officer',
    'troll_family',
    'troller',
    'empire_partner',
    'secretary',
    'broadcaster',
    'family_leader',
    'member',
    'guest'
));

-- Update sync_troll_role function to handle secretary and other missing roles
CREATE OR REPLACE FUNCTION sync_troll_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Determine troll_role based on hierarchy
  -- 1. Admin (Highest)
  IF NEW.is_admin = true OR NEW.role = 'admin' THEN
    NEW.troll_role := 'admin';
  
  -- 2. Lead Troll Officer
  ELSIF NEW.is_lead_officer = true OR NEW.role = 'lead_troll_officer' THEN
    NEW.troll_role := 'lead_troll_officer';
  
  -- 3. Troll Officer
  ELSIF NEW.is_troll_officer = true OR NEW.role = 'troll_officer' THEN
    NEW.troll_role := 'troll_officer';
  
  -- 4. Troller
  ELSIF NEW.is_troller = true OR NEW.role = 'troller' THEN
    NEW.troll_role := 'troller';
    
  -- 5. Broadcaster
  ELSIF NEW.role = 'broadcaster' THEN
    NEW.troll_role := 'broadcaster';
    
  -- 6. Family roles
  ELSIF NEW.role = 'family_leader' THEN
    NEW.troll_role := 'family_leader';
  ELSIF NEW.role = 'member' OR NEW.role = 'troll_family' THEN
    NEW.troll_role := 'troll_family';
    
  -- 7. Empire Partner
  ELSIF NEW.role = 'empire_partner' THEN
    NEW.troll_role := 'empire_partner';
    
  -- 8. Secretary
  ELSIF NEW.role = 'secretary' THEN
    NEW.troll_role := 'secretary';

  -- 9. HR Admin
  ELSIF NEW.role = 'hr_admin' THEN
    NEW.troll_role := 'hr_admin';

  -- 10. Default/Fallback
  ELSE
    -- If troll_role is not already set or we are recalculating, set to user or keep existing role if valid
    IF NEW.troll_role IS NULL THEN
        NEW.troll_role := COALESCE(NEW.role, 'user');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
