-- Add title column to pitch_contests
ALTER TABLE public.pitch_contests 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Update existing records to have a default title if null
UPDATE public.pitch_contests 
SET title = 'Pitch Contest ' || week_start::text 
WHERE title IS NULL;

-- Make it NOT NULL after backfilling
ALTER TABLE public.pitch_contests 
ALTER COLUMN title SET NOT NULL;
