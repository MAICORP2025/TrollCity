
-- Fix pitch_contests status check constraint
-- The error "new row for relation 'pitch_contests' violates check constraint 'pitch_contests_status_check'"
-- suggests the constraint exists but might not include 'submission'.
-- We recreate it with all required statuses.

ALTER TABLE public.pitch_contests DROP CONSTRAINT IF EXISTS pitch_contests_status_check;

ALTER TABLE public.pitch_contests
ADD CONSTRAINT pitch_contests_status_check
CHECK (status IN ('submission', 'voting', 'review', 'completed'));
