-- Fix broadcast_seats RLS policies
-- Enable RLS on broadcast_seats table
ALTER TABLE public.broadcast_seats ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read broadcast seats (for the list action)
CREATE POLICY "Allow read access to broadcast seats" 
ON public.broadcast_seats 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow service role (used by Edge Functions) full access
CREATE POLICY "Allow service role full access to broadcast seats" 
ON public.broadcast_seats 
FOR ALL 
TO service_role 
USING (true);

-- Note: Insert, Update, and Delete operations are handled by RPC functions
-- which are called by the Edge Function with service role permissions