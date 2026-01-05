-- Add troll_role column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS troll_role text;

-- Function to sync troll_role based on other flags/roles
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
  ELSIF NEW.role = 'member' THEN
    NEW.troll_role := 'member';
    
  -- 7. Default/Fallback
  ELSE
    -- If troll_role is not already set or we are recalculating, set to user or keep existing role if valid
    IF NEW.troll_role IS NULL THEN
        NEW.troll_role := COALESCE(NEW.role, 'user');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update troll_role
DROP TRIGGER IF EXISTS trigger_sync_troll_role ON user_profiles;
CREATE TRIGGER trigger_sync_troll_role
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_troll_role();

-- Backfill existing users
UPDATE user_profiles
SET updated_at = now(); -- This will trigger the sync function due to the BEFORE UPDATE trigger
