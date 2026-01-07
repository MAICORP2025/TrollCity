-- Fix officer_actions relationship for LeadOfficerDashboard
-- The dashboard queries officer_actions with !officer_actions_officer_id_fkey hint pointing to user_profiles

DO $$ 
BEGIN
  -- First drop the constraint if it exists (it might point to auth.users)
  ALTER TABLE IF EXISTS officer_actions 
  DROP CONSTRAINT IF EXISTS officer_actions_officer_id_fkey;

  -- Add the constraint pointing to user_profiles
  -- This allows PostgREST to join officer_actions with user_profiles
  ALTER TABLE officer_actions
  ADD CONSTRAINT officer_actions_officer_id_fkey 
  FOREIGN KEY (officer_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  
  -- Also fix target_user_id just in case
  ALTER TABLE IF EXISTS officer_actions 
  DROP CONSTRAINT IF EXISTS officer_actions_target_user_id_fkey;

  ALTER TABLE officer_actions
  ADD CONSTRAINT officer_actions_target_user_id_fkey 
  FOREIGN KEY (target_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
END $$;
