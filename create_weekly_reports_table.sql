-- Create weekly_reports table for officer weekly reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  officer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  officer_username TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  work_summary TEXT NOT NULL,
  challenges_faced TEXT,
  achievements TEXT,
  streams_moderated INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  recommendations TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_weekly_reports_officer_id ON weekly_reports(officer_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week_start ON weekly_reports(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_submitted_at ON weekly_reports(submitted_at);

-- Enable RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- Create policy for officers to view their own reports
CREATE POLICY "Officers can view own reports" ON weekly_reports
  FOR SELECT USING (auth.uid() = officer_id);

-- Create policy for officers to insert their own reports
CREATE POLICY "Officers can insert own reports" ON weekly_reports
  FOR INSERT WITH CHECK (auth.uid() = officer_id);

-- Create policy for admins to view all reports
CREATE POLICY "Admins can view all reports" ON weekly_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for lead officers to view all reports
CREATE POLICY "Lead officers can view all reports" ON weekly_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND is_lead_officer = true
    )
  );