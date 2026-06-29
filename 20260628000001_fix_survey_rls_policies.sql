-- Fix Survey RLS Policies
-- The previous policies only checked is_admin = true, but many admin accounts
-- have role = 'admin' with is_admin = false/null. This fix broadens the check
-- to match the pattern used throughout the rest of the codebase.

-- Fix weekly_surveys admin policy
DO $$
BEGIN
  -- Drop old policy if exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_surveys' AND policyname = 'Admins can manage surveys') THEN
    DROP POLICY "Admins can manage surveys" ON weekly_surveys;
  END IF;
  
  -- Create broader policy
  CREATE POLICY "Admins can manage surveys" ON weekly_surveys FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR role IN ('admin', 'superadmin', 'ceo', 'owner', 'president', 'secretary', 'executive_secretary', 'troll_city_secretary', 'moderator', 'troll_officer', 'lead_troll_officer'))
    )
  );
END
$$;

-- Fix survey_responses admin read policy
DO $$
BEGIN
  -- Drop old policy if exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_responses' AND policyname = 'Admins can read all responses') THEN
    DROP POLICY "Admins can read all responses" ON survey_responses;
  END IF;
  
  -- Create broader policy
  CREATE POLICY "Admins can read all responses" ON survey_responses FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR role IN ('admin', 'superadmin', 'ceo', 'owner', 'president', 'secretary', 'executive_secretary', 'troll_city_secretary', 'moderator', 'troll_officer', 'lead_troll_officer'))
    )
  );
END
$$;
