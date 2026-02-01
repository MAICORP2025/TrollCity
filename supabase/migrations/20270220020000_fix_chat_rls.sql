-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view messages (public)
CREATE POLICY "Public can view messages"
ON messages FOR SELECT
USING (true);

-- Policy: Authenticated users can insert messages (must match their user_id)
CREATE POLICY "Authenticated users can insert messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access (implicit, but good to know)
-- No need to explicitly define for service_role as it bypasses RLS
