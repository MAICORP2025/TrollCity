-- Add Gift Card specific columns to cashout_requests
ALTER TABLE public.cashout_requests 
ADD COLUMN IF NOT EXISTS gift_card_provider text DEFAULT 'Visa',
ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'App Delivery',
ADD COLUMN IF NOT EXISTS gift_card_code text,
ADD COLUMN IF NOT EXISTS gift_card_number text,
ADD COLUMN IF NOT EXISTS gift_card_cvv text,
ADD COLUMN IF NOT EXISTS gift_card_expiry text,
ADD COLUMN IF NOT EXISTS security_checks_passed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_time_estimate text DEFAULT 'Under 30 minutes';

-- Create a view or policy for users to see their own fulfilled gift cards
-- (Assuming RLS is already set up for cashout_requests for owners)

-- Add index for faster lookups on user_id and status
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user_status ON public.cashout_requests(user_id, status);
