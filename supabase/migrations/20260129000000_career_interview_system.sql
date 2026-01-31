-- Career and Interview System Migration
-- Creates interview_sessions table for scheduling interviews with applicants

-- Create interview_sessions table
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interviewer_id UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_interview_sessions_application_id ON interview_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_scheduled_at ON interview_sessions(scheduled_at);

-- Add interview_sessions to RLS
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own interview sessions
DROP POLICY IF EXISTS "Users can view own interview sessions" ON interview_sessions;
CREATE POLICY "Users can view own interview sessions"
  ON interview_sessions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = interviewer_id);

-- Policy: Admins and lead officers can view all interview sessions
DROP POLICY IF EXISTS "Admins can view all interview sessions" ON interview_sessions;
CREATE POLICY "Admins can view all interview sessions"
  ON interview_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'lead_troll_officer')
    )
  );

-- Policy: Admins and lead officers can create interview sessions
DROP POLICY IF EXISTS "Admins can create interview sessions" ON interview_sessions;
CREATE POLICY "Admins can create interview sessions"
  ON interview_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'lead_troll_officer')
    )
  );

-- Policy: Admins and lead officers can update interview sessions
DROP POLICY IF EXISTS "Admins can update interview sessions" ON interview_sessions;
CREATE POLICY "Admins can update interview sessions"
  ON interview_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'lead_troll_officer')
    )
  );

-- Create RPC function to schedule interview
CREATE OR REPLACE FUNCTION schedule_interview(
  p_application_id UUID,
  p_scheduled_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_user_id UUID;
BEGIN
  -- Get user_id from application
  SELECT user_id INTO v_user_id
  FROM applications
  WHERE id = p_application_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Create interview session
  INSERT INTO interview_sessions (
    application_id,
    user_id,
    interviewer_id,
    scheduled_at,
    status
  ) VALUES (
    p_application_id,
    v_user_id,
    auth.uid(),
    p_scheduled_at,
    'scheduled'
  )
  RETURNING id INTO v_session_id;

  -- Update application status to 'interview_scheduled'
  UPDATE applications
  SET status = 'interview_scheduled'
  WHERE id = p_application_id;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to complete interview and hire
CREATE OR REPLACE FUNCTION complete_interview_and_hire(
  p_session_id UUID,
  p_hire BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT ''
) RETURNS BOOLEAN AS $$
DECLARE
  v_application_id UUID;
  v_user_id UUID;
  v_application_type TEXT;
BEGIN
  -- Get session details
  SELECT application_id, user_id INTO v_application_id, v_user_id
  FROM interview_sessions
  WHERE id = p_session_id;

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION 'Interview session not found';
  END IF;

  -- Get application type
  SELECT type INTO v_application_type
  FROM applications
  WHERE id = v_application_id;

  -- Update interview session
  UPDATE interview_sessions
  SET 
    status = 'completed',
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_session_id;

  IF p_hire THEN
    -- Update application status
    UPDATE applications
    SET 
      status = 'approved',
      reviewed_at = NOW(),
      review_notes = p_notes
    WHERE id = v_application_id;

    -- Update user role based on application type
    UPDATE user_profiles
    SET role = CASE
      WHEN v_application_type = 'troll_officer' THEN 'troll_officer'
      WHEN v_application_type = 'lead_officer' THEN 'lead_troll_officer'
      WHEN v_application_type = 'pastor' THEN 'pastor'
      ELSE 'troller'
    END
    WHERE id = v_user_id;
  ELSE
    -- Reject application
    UPDATE applications
    SET 
      status = 'rejected',
      reviewed_at = NOW(),
      review_notes = p_notes
    WHERE id = v_application_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
