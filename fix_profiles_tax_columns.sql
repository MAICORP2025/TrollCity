-- Add missing tax_status column to profiles table for payout trigger
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_status TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_last_updated TIMESTAMPTZ;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('tax_status', 'tax_last_updated');