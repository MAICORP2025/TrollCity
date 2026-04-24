-- Create interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES user_profiles(id),
  interviewer_id UUID REFERENCES user_profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'hired', 'declined')),
  room_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  notes TEXT
);

-- Enable RLS
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Lead Officers can manage interviews"
  ON interviews
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'lead_troll_officer', 'secretary') OR is_admin = true OR is_lead_officer = true)
    )
  );

CREATE POLICY "Applicants can view their own interviews"
  ON interviews
  FOR SELECT
  USING (applicant_id = auth.uid());

-- Add hourly_rate to user_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'hourly_rate') THEN
    ALTER TABLE user_profiles ADD COLUMN hourly_rate NUMERIC DEFAULT 0;
  END IF;
END $$;
