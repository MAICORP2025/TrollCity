-- ============================================================================
-- BACKEND UPDATE: Prevent jailed users from running for president
-- ============================================================================
-- This function replaces the existing signup_president_candidate function
-- to add a check for active or recent jail status.

CREATE OR REPLACE FUNCTION public.signup_president_candidate(
  p_election_id UUID,
  p_banner_path TEXT,
  p_display_name TEXT,
  p_slogan TEXT,
  p_statement TEXT
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_jail_record RECORD;
  v_profile RECORD;
BEGIN
  -- Check for active jail (release_time in the future)
  SELECT * INTO v_jail_record
  FROM public.jail
  WHERE user_id = v_user_id
    AND release_time > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'You cannot run for president while incarcerated. Please serve your sentence first.';
  END IF;

  -- Check for background jail (released within last 24 hours)
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_profile.is_background_jailed AND v_profile.background_jail_date > NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'You cannot run for president while your jail record is recent. Please wait 24 hours after release.';
  END IF;

  -- Original logic: insert the candidate record
  -- Note: Adjust the column list if your president_candidates table has different columns.
  INSERT INTO public.president_candidates (
    election_id,
    user_id,
    slogan,
    status, -- Assuming default status is 'pending'
    vote_count,
    score,
    created_at
  ) VALUES (
    p_election_id,
    v_user_id,
    p_slogan,
    'pending',
    0,
    0,
    NOW()
  );

  -- If your function originally did more (e.g., setting banner_path, display_name),
  -- you must add those updates here based on your table structure.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;