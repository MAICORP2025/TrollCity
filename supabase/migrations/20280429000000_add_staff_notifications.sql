-- Update can_access_staff_meeting to include organization members
CREATE OR REPLACE FUNCTION can_access_staff_meeting(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  profile RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO profile FROM user_profiles WHERE id = p_user_id;

  IF profile IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check for specific staff roles
  IF profile.role = 'admin' OR profile.is_admin = TRUE OR profile.role = 'superadmin' OR profile.is_superadmin = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'lead_officer' OR profile.is_lead_officer = TRUE OR profile.officer_role = 'lead_officer' THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'troll_officer' OR profile.is_troll_officer = TRUE OR profile.officer_role = 'troll_officer' OR profile.troll_role = 'troll_officer' THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'secretary' OR profile.is_secretary = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'prosecutor' OR profile.is_prosecutor = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'pastor' OR profile.is_pastor = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'auctioneer' OR profile.is_auctioneer = TRUE THEN
    RETURN TRUE;
  END IF;

  -- Check for organization membership
  IF profile.organization_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all staff user IDs for notifications
-- Includes traditional staff roles plus organization members
CREATE OR REPLACE FUNCTION get_staff_user_ids()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT up.id
  FROM user_profiles up
  WHERE
    -- Role-based staff
    up.role IN ('admin', 'lead_troll_officer', 'troll_officer', 'officer', 'secretary', 'prosecutor', 'judge', 'attorney', 'pastor', 'auctioneer', 'moderator', 'ceo')
    -- Boolean flag staff
    OR up.is_admin = true
    OR up.is_ceo = true
    OR up.is_lead_officer = true
    OR up.is_troll_officer = true
    OR up.is_officer = true
    OR up.is_secretary = true
    OR up.is_prosecutor = true
    OR up.is_judge = true
    OR up.is_attorney = true
    OR up.is_pastor = true
    OR up.is_auctioneer = true
    OR up.is_moderator = true
    -- Organization members
    OR up.organization_id IS NOT NULL;
END;
$$;