-- Officer Training Workflow Implementation
-- Ensures applicants complete training before approval and adds approved officers to scheduled shifts

-- Add training_passed field to applications table for troll_officer applications
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS training_passed BOOLEAN DEFAULT FALSE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_applications_training_passed ON applications(training_passed);

-- Update existing troll_officer applications to have training_passed = false if null
UPDATE applications
SET training_passed = FALSE
WHERE type = 'troll_officer' AND training_passed IS NULL;

-- Add comment
COMMENT ON COLUMN applications.training_passed IS 'Indicates if the troll_officer applicant has completed all required training scenarios';

-- Function to check if a user has completed all required training
CREATE OR REPLACE FUNCTION check_training_completion(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_scenarios INTEGER;
    completed_scenarios INTEGER;
BEGIN
    -- Get total number of training scenarios
    SELECT COUNT(*) INTO total_scenarios FROM training_scenarios;

    -- Get number of correctly answered scenarios by the user
    SELECT COUNT(DISTINCT ts.id) INTO completed_scenarios
    FROM training_scenarios ts
    JOIN officer_training_sessions ots ON ts.id = ots.scenario_id
    WHERE ots.officer_id = p_user_id AND ots.is_correct = TRUE;

    -- User has completed training if they've correctly answered all scenarios
    RETURN completed_scenarios >= total_scenarios;
END;
$$ LANGUAGE plpgsql;

-- Function to update training_passed status for officer applications
CREATE OR REPLACE FUNCTION update_officer_training_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if this is an insert or update to officer_training_sessions
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Check if the officer has completed training
        IF check_training_completion(NEW.officer_id) THEN
            -- Update applications to mark training as passed for troll_officer applications
            UPDATE applications
            SET training_passed = TRUE
            WHERE user_id = NEW.officer_id AND type = 'troll_officer' AND status = 'pending';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update training status when training sessions are completed
DROP TRIGGER IF EXISTS trg_update_officer_training_status ON officer_training_sessions;
CREATE TRIGGER trg_update_officer_training_status
    AFTER INSERT OR UPDATE ON officer_training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_officer_training_status();

-- Function to add newly approved officer to scheduled shifts
CREATE OR REPLACE FUNCTION add_approved_officer_to_shifts(p_officer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_shift_id UUID;
    v_next_shift_start TIMESTAMPTZ;
BEGIN
    -- Calculate next shift start time (next Monday at 9 AM, for example)
    -- This is a simple implementation - you may want to customize the scheduling logic
    v_next_shift_start := DATE_TRUNC('week', NOW() + INTERVAL '1 week') + INTERVAL '9 hours';

    -- Create a scheduled shift for the officer
    INSERT INTO officer_shifts (
        officer_id,
        shift_start,
        shift_end,
        shift_type,
        status,
        assigned_by
    ) VALUES (
        p_officer_id,
        v_next_shift_start,
        v_next_shift_start + INTERVAL '8 hours', -- 8 hour shift
        'regular',
        'scheduled',
        auth.uid()
    ) RETURNING id INTO v_shift_id;

    -- Update officer status to active
    UPDATE user_profiles
    SET is_officer_active = TRUE,
        updated_at = NOW()
    WHERE id = p_officer_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'shift_id', v_shift_id,
        'message', 'Officer added to scheduled shifts successfully'
    );
END;
$$ LANGUAGE plpgsql;

-- Update approve_officer_application to include adding to shifts
CREATE OR REPLACE FUNCTION approve_officer_application(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_reviewer RECORD;
BEGIN
  -- Check if reviewer is admin or lead officer
  SELECT * INTO v_reviewer
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT (v_reviewer.role = 'admin' OR v_reviewer.is_admin = TRUE OR v_reviewer.is_lead_officer = TRUE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins and lead officers can approve officer applications');
  END IF;

  -- Find pending officer application for this user
  SELECT * INTO v_application
  FROM applications
  WHERE user_id = p_user_id
    AND type = 'troll_officer'
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_application IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No pending officer application found for this user');
  END IF;

  -- Update application status
  UPDATE applications
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = v_application.id;

  -- Update user role
  UPDATE user_profiles
  SET
    role = 'troll_officer',
    is_troll_officer = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Add officer to scheduled shifts
  PERFORM add_approved_officer_to_shifts(p_user_id);

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    p_user_id,
    'officer_update',
    'Officer Application Approved',
    'Congratulations! Your Troll Officer application has been approved. You have been added to scheduled shifts.',
    jsonb_build_object('link', '/officer/dashboard')
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Officer application approved and added to scheduled shifts successfully');
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_training_completion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_approved_officer_to_shifts(UUID) TO authenticated;