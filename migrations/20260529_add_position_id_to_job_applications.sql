-- Add position_id column to job_applications table to track which position the user applied for
-- Add department column for HR department-based access control
-- These were expected by the frontend code but missing from the original schema

ALTER TABLE public.job_applications
ADD COLUMN IF NOT EXISTS position_id TEXT,
ADD COLUMN IF NOT EXISTS department TEXT;

-- Add indexes for querying
CREATE INDEX IF NOT EXISTS idx_job_applications_position_id ON public.job_applications(position_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_department ON public.job_applications(department);

-- Update the status check constraint to include new statuses used by the frontend
ALTER TABLE public.job_applications
DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
ADD CONSTRAINT job_applications_status_check
CHECK (status = ANY (ARRAY['submitted'::text, 'pending'::text, 'under_review'::text, 'interview_scheduled'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text, 'hired'::text]));