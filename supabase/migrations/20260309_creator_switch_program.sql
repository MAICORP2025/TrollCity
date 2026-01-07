CREATE TABLE IF NOT EXISTS public.creator_migration_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform_name TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    platform_profile_url TEXT,
    proof_screenshot_url TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_migration_claims_user_id ON public.creator_migration_claims(user_id);

ALTER TABLE public.creator_migration_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own claims
CREATE POLICY "Users can view own migration claims" 
ON public.creator_migration_claims FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can insert their own claims
CREATE POLICY "Users can create own migration claim" 
ON public.creator_migration_claims FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own claims if pending
CREATE POLICY "Users can update own pending migration claim" 
ON public.creator_migration_claims FOR UPDATE 
USING (auth.uid() = user_id AND verification_status = 'pending');
