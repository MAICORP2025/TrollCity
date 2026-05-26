-- Talent Offices Agency System Schema
-- Run this in Supabase SQL Editor to create agency tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AGENCIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    bio TEXT,
    logo_url TEXT,
    banner_url TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'suspended', 'denied')) DEFAULT 'pending',
    default_split_percent INTEGER DEFAULT 10 CHECK (default_split_percent >= 0 AND default_split_percent <= 50),
    agency_fee_percent INTEGER DEFAULT 0 CHECK (agency_fee_percent >= 0 AND agency_fee_percent <= 100),
    platform_fee_percent INTEGER DEFAULT 0 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
    leader_commission_percent INTEGER DEFAULT 0 CHECK (leader_commission_percent >= 0 AND leader_commission_percent <= 100),
    recruiter_commission_percent INTEGER DEFAULT 0 CHECK (recruiter_commission_percent >= 0 AND recruiter_commission_percent <= 100),
    fee_updated_at TIMESTAMPTZ,
    fee_updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'manager', 'recruiter', 'creator')) NOT NULL,
    status TEXT CHECK (status IN ('active', 'removed', 'left', 'suspended')) DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index to prevent duplicate active memberships
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_members_unique_active 
    ON public.agency_members (agency_id, user_id) 
    WHERE status = 'active';

-- ============================================
-- AGENCY APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT,
    content_type TEXT,
    live_schedule TEXT,
    battle_interest BOOLEAN DEFAULT FALSE,
    social_links JSONB DEFAULT '{}',
    status TEXT CHECK (status IN ('pending', 'approved', 'denied', 'withdrawn')) DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    application_fee_paid BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================
-- AGENCY INVITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')) DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY CONTRACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    contract_type TEXT DEFAULT 'agency_leader',
    contract_body TEXT,
    body TEXT,
    fee_percentage INTEGER DEFAULT 0 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
    payout_terms TEXT,
    agency_responsibilities TEXT,
    leader_responsibilities TEXT,
    termination_terms TEXT,
    split_percent INTEGER NOT NULL CHECK (split_percent >= 0 AND split_percent <= 50),
    applies_to TEXT CHECK (applies_to = 'gifts') DEFAULT 'gifts',
    status TEXT CHECK (status IN ('pending', 'active', 'ended', 'cancelled')) DEFAULT 'pending',
    creator_accepted_at TIMESTAMPTZ NULL,
    agency_accepted_at TIMESTAMPTZ NULL,
    effective_date TIMESTAMPTZ,
    expiration_date TIMESTAMPTZ,
    starts_at TIMESTAMPTZ NULL,
    ends_at TIMESTAMPTZ NULL,
    cooldown_ends_at TIMESTAMPTZ NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    goal_type TEXT CHECK (goal_type IN ('live_hours', 'gift_earnings', 'battle_count', 'creator_count')) NOT NULL,
    target_value INTEGER NOT NULL CHECK (target_value > 0),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('active', 'completed', 'expired', 'cancelled')) DEFAULT 'active',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY GOAL PROGRESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_goal_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES public.agency_goals(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    progress_value INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY EARNINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT CHECK (source_type = 'gift') DEFAULT 'gift',
    source_id UUID NOT NULL, -- References gift transaction ID
    gross_coins INTEGER NOT NULL CHECK (gross_coins >= 0),
    split_percent INTEGER NOT NULL CHECK (split_percent >= 0 AND split_percent <= 50),
    agency_coins INTEGER NOT NULL CHECK (agency_coins >= 0),
    creator_coins INTEGER NOT NULL CHECK (creator_coins >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY PAYOUT REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
    status TEXT CHECK (status IN ('open', 'submitted', 'completed', 'denied')) DEFAULT 'open',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENCY ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Agencies indexes
CREATE INDEX IF NOT EXISTS idx_agencies_owner_id ON public.agencies(owner_id);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON public.agencies(status);
CREATE INDEX IF NOT EXISTS idx_agencies_slug ON public.agencies(slug);
CREATE INDEX IF NOT EXISTS idx_agencies_created_at ON public.agencies(created_at DESC);

-- Agency members indexes
CREATE INDEX IF NOT EXISTS idx_agency_members_agency_id ON public.agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_user_id ON public.agency_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_role ON public.agency_members(role);
CREATE INDEX IF NOT EXISTS idx_agency_members_status ON public.agency_members(status);
CREATE INDEX IF NOT EXISTS idx_agency_members_joined_at ON public.agency_members(joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_members_created_at ON public.agency_members(created_at DESC);

-- Agency applications indexes
CREATE INDEX IF NOT EXISTS idx_agency_applications_agency_id ON public.agency_applications(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_applications_applicant_id ON public.agency_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_agency_applications_status ON public.agency_applications(status);
CREATE INDEX IF NOT EXISTS idx_agency_applications_created_at ON public.agency_applications(created_at DESC);

-- Agency invites indexes
CREATE INDEX IF NOT EXISTS idx_agency_invites_agency_id ON public.agency_invites(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_invites_invited_user_id ON public.agency_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_invites_status ON public.agency_invites(status);
CREATE INDEX IF NOT EXISTS idx_agency_invites_expires_at ON public.agency_invites(expires_at);

-- Agency contracts indexes
CREATE INDEX IF NOT EXISTS idx_agency_contracts_agency_id ON public.agency_contracts(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_contracts_creator_id ON public.agency_contracts(creator_id);
CREATE INDEX IF NOT EXISTS idx_agency_contracts_status ON public.agency_contracts(status);
CREATE INDEX IF NOT EXISTS idx_agency_contracts_created_at ON public.agency_contracts(created_at DESC);

-- Agency goals indexes
CREATE INDEX IF NOT EXISTS idx_agency_goals_agency_id ON public.agency_goals(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_goals_goal_type ON public.agency_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_agency_goals_status ON public.agency_goals(status);
CREATE INDEX IF NOT EXISTS idx_agency_goals_created_at ON public.agency_goals(created_at DESC);

-- Agency goal progress indexes
CREATE INDEX IF NOT EXISTS idx_agency_goal_progress_agency_id ON public.agency_goal_progress(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_goal_progress_goal_id ON public.agency_goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_agency_goal_progress_creator_id ON public.agency_goal_progress(creator_id);
CREATE INDEX IF NOT EXISTS idx_agency_goal_progress_updated_at ON public.agency_goal_progress(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_goal_progress_created_at ON public.agency_goal_progress(created_at DESC);

-- Agency earnings indexes
CREATE INDEX IF NOT EXISTS idx_agency_earnings_agency_id ON public.agency_earnings(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_earnings_creator_id ON public.agency_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_agency_earnings_source_type ON public.agency_earnings(source_type);
CREATE INDEX IF NOT EXISTS idx_agency_earnings_created_at ON public.agency_earnings(created_at DESC);

-- Agency payout requests indexes
CREATE INDEX IF NOT EXISTS idx_agency_payout_requests_agency_id ON public.agency_payout_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_payout_requests_requested_by ON public.agency_payout_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_agency_payout_requests_status ON public.agency_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_agency_payout_requests_created_at ON public.agency_payout_requests(created_at DESC);

-- Agency activity logs indexes
CREATE INDEX IF NOT EXISTS idx_agency_activity_logs_agency_id ON public.agency_activity_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_activity_logs_actor_id ON public.agency_activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_agency_activity_logs_target_user_id ON public.agency_activity_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_activity_logs_action ON public.agency_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_agency_activity_logs_created_at ON public.agency_activity_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_activity_logs ENABLE ROW LEVEL SECURITY;

-- Agencies policies
CREATE POLICY "Approved agencies are viewable by everyone" ON public.agencies
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Agency owners can manage their own agencies" ON public.agencies
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all agencies" ON public.agencies
  FOR ALL USING (true); -- Admin checks handled at application level

-- Agency members policies
CREATE POLICY "Agency members can view their own agency membership" ON public.agency_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Agency owners and managers can view agency members" ON public.agency_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_members.agency_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_members.agency_id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
    )
  );

CREATE POLICY "Agency owners can manage agency members" ON public.agency_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_members.agency_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Agency managers can manage agency members (except owner)" ON public.agency_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_members.agency_id AND user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
    AND auth.uid() != (
      SELECT owner_id FROM public.agencies WHERE id = agency_members.agency_id
    )
  );

-- Agency applications policies
CREATE POLICY "Agency owners and managers can view agency applications" ON public.agency_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_applications.agency_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_applications.agency_id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
    )
  );

CREATE POLICY "Agency owners and managers can manage agency applications" ON public.agency_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_applications.agency_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_applications.agency_id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
    )
  );

-- Agency invites policies
CREATE POLICY "Agency owners and managers can manage agency invites" ON public.agency_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_invites.agency_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_invites.agency_id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
    )
  );

CREATE POLICY "Users can create agency invites" ON public.agency_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_invites.agency_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_invites.agency_id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
    )
  );

-- Agency contracts policies
CREATE POLICY "Agency owners can manage agency contracts" ON public.agency_contracts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_contracts.agency_id AND owner_id = auth.uid()
    )
  );

-- Agency goals policies
CREATE POLICY "Agency goals are viewable by agency members" ON public.agency_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_goals.agency_id AND (owner_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.agency_members 
          WHERE agency_id = agency_goals.agency_id AND user_id = auth.uid() AND status = 'active'
        )
      )
    )
  );

CREATE POLICY "Agency owners and managers can manage agency goals" ON public.agency_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_goals.agency_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_goals.agency_id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
    )
  );

-- Agency goal progress policies
CREATE POLICY "Agency goal progress is viewable by agency members" ON public.agency_goal_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_goal_progress.agency_id AND (owner_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.agency_members 
          WHERE agency_id = agency_goal_progress.agency_id AND user_id = auth.uid() AND status = 'active'
        )
      )
    )
  );

CREATE POLICY "Agency owners and managers can manage agency goal progress" ON public.agency_goal_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_goal_progress.agency_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.agency_members 
      WHERE agency_id = agency_goal_progress.agency_id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND status = 'active'
    )
  );

-- Agency earnings policies
CREATE POLICY "Agency earnings are viewable by agency members" ON public.agency_earnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_earnings.agency_id AND (owner_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.agency_members 
          WHERE agency_id = agency_earnings.agency_id AND user_id = auth.uid() AND status = 'active'
        )
      )
    )
  );

-- Agency payout requests policies
CREATE POLICY "Agency payout requests are viewable by agency members" ON public.agency_payout_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_payout_requests.agency_id AND (owner_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.agency_members 
          WHERE agency_id = agency_payout_requests.agency_id AND user_id = auth.uid() AND status = 'active'
        )
      )
    )
  );

CREATE POLICY "Agency owners can manage agency payout requests" ON public.agency_payout_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_payout_requests.agency_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create agency payout requests" ON public.agency_payout_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_payout_requests.agency_id AND owner_id = auth.uid()
    )
  );

-- Agency activity logs policies
CREATE POLICY "Agency activity logs are viewable by agency members" ON public.agency_activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agencies 
      WHERE id = agency_activity_logs.agency_id AND (owner_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.agency_members 
          WHERE agency_id = agency_activity_logs.agency_id AND user_id = auth.uid() AND status = 'active'
        )
      )
    )
  );

CREATE POLICY "Users can create agency applications" ON public.agency_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- Agency invites policies
CREATE POLICY "Users can view their own agency invites" ON public.agency_invites
  FOR SELECT USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);

-- Agency contracts policies
CREATE POLICY "Users can view their own agency contracts" ON public.agency_contracts
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can create agency contracts" ON public.agency_contracts
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Agency goal progress policies
CREATE POLICY "Users can update their own agency goal progress" ON public.agency_goal_progress
  FOR ALL USING (auth.uid() = creator_id);

-- Agency earnings policies
CREATE POLICY "System can create agency earnings" ON public.agency_earnings
  FOR INSERT WITH CHECK (true); -- System/trigger only

-- Agency activity logs policies
CREATE POLICY "System can create agency activity logs" ON public.agency_activity_logs
  FOR INSERT WITH CHECK (true); -- System/trigger only

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update agency member counts
CREATE OR REPLACE FUNCTION update_agency_member_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.agencies 
  SET updated_at = NOW()
  WHERE id = NEW.agency_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_agency_on_member_change
  AFTER INSERT OR UPDATE OR DELETE ON public.agency_members
  FOR EACH ROW EXECUTE FUNCTION update_agency_member_count();

-- Function to log agency activities
CREATE OR REPLACE FUNCTION log_agency_activity(
    p_agency_id UUID,
    p_actor_id UUID,
    p_action TEXT,
    p_target_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.agency_activity_logs (
    agency_id, actor_id, target_user_id, action, metadata
  ) VALUES (
    p_agency_id, p_actor_id, p_target_user_id, p_action, p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.agencies IS 'Talent Offices agency profiles';
COMMENT ON TABLE public.agency_members IS 'Members of talent offices (owners, managers, recruiters, creators)';
COMMENT ON TABLE public.agency_applications IS 'Creator applications to join talent offices';
COMMENT ON TABLE public.agency_invites IS 'Invitations sent to creators to join talent offices';
COMMENT ON TABLE public.agency_contracts IS 'Creator-agency split agreements';
COMMENT ON TABLE public.agency_goals IS 'Agency-level goals and targets';
COMMENT ON TABLE public.agency_goal_progress IS 'Progress toward agency goals';
COMMENT ON TABLE public.agency_earnings IS 'Agency split earnings from creator activities';
COMMENT ON TABLE public.agency_payout_requests IS 'Agency payout requests to wallet';
COMMENT ON TABLE public.agency_activity_logs IS 'Audit log of agency actions';

-- ============================================
-- COMPLETE!
-- ============================================