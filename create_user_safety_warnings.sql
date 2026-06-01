-- ============================================================================
-- USER SAFETY WARNINGS TABLE — Phase 1 Safety Warning System
-- ============================================================================
-- Stores safety warnings/concerns raised by authorized staff against users
-- in various contexts (broadcast, podcast, walkie talkie, TCPC, jail, court, etc.)
--
-- RLS: Only authorized roles (full role stack EXCLUDING troller) can INSERT.
--      Only authorized roles can SELECT/UPDATE.
--      Regular users and troller cannot read warning history.
--      superadmin is NOT used — is_admin boolean or role='admin' is used instead.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_safety_warnings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Context/source of the warning
  source            text NOT NULL DEFAULT 'other'
                    CHECK (source IN (
                      'broadcast', 'podcast', 'walkie_talkie', 'tcpc_call',
                      'jail_call', 'inmate_call', 'troll_court', 'hearing',
                      'auction_live', 'church_live', 'marketplace_live', 'other'
                    )),

  -- Severity
  severity          text NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Category
  category          text NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'harassment', 'threats', 'sexual_content', 'self_harm_concern',
                      'scam', 'spam', 'impersonation', 'illegal_activity',
                      'underage_concern', 'platform_abuse', 'safety_concern', 'other'
                    )),

  -- Free-text note/reason
  note              text,

  -- Optional context IDs (only populate what's available)
  stream_id         uuid,
  podcast_id        uuid,
  room_id           uuid,
  court_case_id     uuid,
  call_id           uuid,
  jail_case_id      uuid,
  inmate_id         uuid,
  auction_id        uuid,
  church_session_id uuid,

  -- Status tracking
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'reviewed', 'dismissed', 'escalated')),

  -- Review tracking
  reviewed_by       uuid REFERENCES auth.users(id),
  reviewed_at       timestamptz,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_safety_warnings_target_user
  ON public.user_safety_warnings (target_user_id);
CREATE INDEX IF NOT EXISTS idx_safety_warnings_actor_user
  ON public.user_safety_warnings (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_safety_warnings_source
  ON public.user_safety_warnings (source);
CREATE INDEX IF NOT EXISTS idx_safety_warnings_severity
  ON public.user_safety_warnings (severity);
CREATE INDEX IF NOT EXISTS idx_safety_warnings_status
  ON public.user_safety_warnings (status);
CREATE INDEX IF NOT EXISTS idx_safety_warnings_created
  ON public.user_safety_warnings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_warnings_target_status
  ON public.user_safety_warnings (target_user_id, status);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.user_safety_warnings ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is authorized for safety warnings
-- (full role stack EXCLUDING troller, NOT using superadmin)
-- This is used via inline subqueries in policies

-- SELECT: Authorized staff can view warnings
DROP POLICY IF EXISTS "safety_warnings_select_staff" ON public.user_safety_warnings;
CREATE POLICY "safety_warnings_select_staff"
  ON public.user_safety_warnings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role != 'troller'
        AND (
          role IN (
            'admin', 'ceo', 'staff', 'officer', 'broadofficer',
            'troll_officer', 'lead_troll_officer', 'secretary',
            'president', 'vice_president', 'temp_city_admin',
            'troll_city_secretary', 'troll_city_treasurer',
            'temp_admin', 'executive_secretary',
            'agency_hr_manager', 'hr_admin',
            'moderator', 'owner'
          )
          OR is_admin = true
          OR is_troll_officer = true
          OR is_lead_officer = true
          OR is_officer = true
          OR is_secretary = true
          OR is_president = true
          OR is_ceo = true
          OR is_prosecutor = true
          OR is_judge = true
          OR is_attorney = true
          OR is_auctioneer = true
          OR is_pastor = true
          OR is_journalist = true
          OR is_news_caster = true
          OR is_chief_news_caster = true
        )
    )
  );

-- INSERT: Authorized staff can create warnings
DROP POLICY IF EXISTS "safety_warnings_insert_staff" ON public.user_safety_warnings;
CREATE POLICY "safety_warnings_insert_staff"
  ON public.user_safety_warnings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role != 'troller'
        AND (
          role IN (
            'admin', 'ceo', 'staff', 'officer', 'broadofficer',
            'troll_officer', 'lead_troll_officer', 'secretary',
            'president', 'vice_president', 'temp_city_admin',
            'troll_city_secretary', 'troll_city_treasurer',
            'temp_admin', 'executive_secretary',
            'agency_hr_manager', 'hr_admin',
            'moderator', 'owner'
          )
          OR is_admin = true
          OR is_troll_officer = true
          OR is_lead_officer = true
          OR is_officer = true
          OR is_secretary = true
          OR is_president = true
          OR is_ceo = true
          OR is_prosecutor = true
          OR is_judge = true
          OR is_attorney = true
          OR is_auctioneer = true
          OR is_pastor = true
          OR is_journalist = true
          OR is_news_caster = true
          OR is_chief_news_caster = true
        )
    )
  );

-- UPDATE: Authorized staff can update warnings (review, dismiss, escalate)
DROP POLICY IF EXISTS "safety_warnings_update_staff" ON public.user_safety_warnings;
CREATE POLICY "safety_warnings_update_staff"
  ON public.user_safety_warnings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role != 'troller'
        AND (
          role IN (
            'admin', 'ceo', 'staff', 'officer', 'broadofficer',
            'troll_officer', 'lead_troll_officer', 'secretary',
            'president', 'vice_president', 'temp_city_admin',
            'troll_city_secretary', 'troll_city_treasurer',
            'temp_admin', 'executive_secretary',
            'agency_hr_manager', 'hr_admin',
            'moderator', 'owner'
          )
          OR is_admin = true
          OR is_troll_officer = true
          OR is_lead_officer = true
          OR is_officer = true
          OR is_secretary = true
          OR is_president = true
          OR is_ceo = true
          OR is_prosecutor = true
          OR is_judge = true
          OR is_attorney = true
          OR is_auctioneer = true
          OR is_pastor = true
          OR is_journalist = true
          OR is_news_caster = true
          OR is_chief_news_caster = true
        )
    )
  );

-- No DELETE policy — warnings are kept for audit trail

-- ============================================================================
-- updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_safety_warning_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS safety_warning_updated_at ON public.user_safety_warnings;
CREATE TRIGGER safety_warning_updated_at
  BEFORE UPDATE ON public.user_safety_warnings
  FOR EACH ROW EXECUTE FUNCTION public.handle_safety_warning_updated_at();
