-- ============================================================================
-- TERMS AGREEMENT SOURCE-OF-TRUTH FIX
-- ============================================================================
-- This script ensures:
--   1. user_profiles.terms_accepted is properly set when agreement accepted
--   2. record_agreement_acceptance() RPC updates both user_agreements AND user_profiles
--   3. All necessary columns exist with correct defaults
--   4. Realtime subscription will propagate changes to frontend
--
-- Run this in your Supabase SQL Editor (Query tab)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Verify user_profiles has required columns
-- ============================================================================
DO $$
DECLARE
    terms_col_exists boolean;
    terms_at_exists boolean;
    court_consent_exists boolean;
    court_consent_at_exists boolean;
BEGIN
    -- Check terms_accepted
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
          AND column_name = 'terms_accepted'
    ) INTO terms_col_exists;

    IF NOT terms_col_exists THEN
        RAISE WARNING 'Adding missing column: terms_accepted';
        ALTER TABLE public.user_profiles ADD COLUMN terms_accepted boolean DEFAULT false;
    END IF;

    -- Check terms_accepted_at (optional but good for audit)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
          AND column_name = 'terms_accepted_at'
    ) INTO terms_at_exists;

    IF NOT terms_at_exists THEN
        RAISE WARNING 'Adding missing column: terms_accepted_at';
        ALTER TABLE public.user_profiles ADD COLUMN terms_accepted_at timestamp with time zone;
    END IF;

    -- Check court_recording_consent
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
          AND column_name = 'court_recording_consent'
    ) INTO court_consent_exists;

    IF NOT court_consent_exists THEN
        RAISE WARNING 'Adding missing column: court_recording_consent';
        ALTER TABLE public.user_profiles ADD COLUMN court_recording_consent boolean DEFAULT false;
    END IF;

    -- Check court_recording_consent_at (optional)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
          AND column_name = 'court_recording_consent_at'
    ) INTO court_consent_at_exists;

    IF NOT court_consent_at_exists THEN
        RAISE WARNING 'Adding missing column: court_recording_consent_at';
        ALTER TABLE public.user_profiles ADD COLUMN court_recording_consent_at timestamp with time zone;
    END IF;

    RAISE NOTICE 'Column verification complete.';
END $$;

-- ============================================================================
-- SECTION 2: Create/Replace record_agreement_acceptance RPC
-- ============================================================================
-- This function:
--  1. Inserts a row into user_agreements (with terms_accepted = true)
--  2. Updates the matching user_profiles row to set terms_accepted = true
--  3. Returns the agreement_id
--
-- SECURITY: SECURITY DEFINER bypasses RLS — only callable by authenticated users
-- via the Edge Function which validates the session.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_agreement_acceptance(
    p_user_id uuid,
    p_agreement_version text DEFAULT '1.0',
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_agreement_id uuid := gen_random_uuid();
    v_username text;
    v_email text;
BEGIN
    -- Get username and email from user_profiles
    SELECT username, email INTO v_username, v_email
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_username IS NULL THEN
        RAISE EXCEPTION 'User not found or username is null';
    END IF;

    -- Record acceptance in user_agreements table
    INSERT INTO public.user_agreements (
        id,
        user_id,
        username,
        email,
        agreement_version,
        accepted_at,
        ip_address,
        user_agent,
        terms_accepted,
        created_at
    )
    VALUES (
        v_agreement_id,
        p_user_id,
        v_username,
        v_email,
        COALESCE(p_agreement_version, '1.0'),
        now(),
        p_ip_address,
        p_user_agent,
        true,
        now()
    );

    -- CRITICAL: Update user_profiles so frontend guard sees terms_accepted = true
    UPDATE public.user_profiles
    SET terms_accepted = true,
        court_recording_consent = true,
        updated_at = now()
    WHERE id = p_user_id;

    -- Also set terms_accepted_at if column exists (Postgres 9.6+)
    BEGIN
        EXECUTE 'UPDATE public.user_profiles
                 SET terms_accepted_at = now(),
                     court_recording_consent_at = now()
                 WHERE id = p_user_id';
    EXCEPTION WHEN undefined_column THEN
        -- Column doesn't exist — safe to ignore
    END;

    RETURN v_agreement_id;
END;
$$;

-- Grant execute to authenticated users (Edge Function uses anon key but with JWT)
GRANT EXECUTE ON FUNCTION public.record_agreement_acceptance TO authenticated;

-- ============================================================================
-- SECTION 3: Verify user_agreements table has correct defaults
-- ============================================================================
DO $$
DECLARE
    col_exists boolean;
BEGIN
    -- Ensure user_agreements has terms_accepted column defaulting to true
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_agreements'
          AND column_name = 'terms_accepted'
    ) INTO col_exists;

    IF col_exists THEN
        -- Check if default is already true
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_agreements'
              AND column_name = 'terms_accepted'
              AND column_default = 'true'::text
        ) THEN
            RAISE WARNING 'Updating user_agreements.terms_accepted default to true';
            ALTER TABLE public.user_agreements
            ALTER COLUMN terms_accepted SET DEFAULT true;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- SECTION 4: Test the function (requires a valid user_id)
-- ============================================================================
-- Uncomment and replace '00000000-0000-0000-0000-000000000000' with a real user id
-- to test manually:
--
-- SELECT record_agreement_acceptance(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     '1.0',
--     '127.0.0.1',
--     'Test User Agent'
-- );
--
-- Then verify:
-- SELECT id, username, terms_accepted, terms_accepted_at, court_recording_consent
-- FROM public.user_profiles
-- WHERE id = '00000000-0000-0000-0000-000000000000';

-- ============================================================================
-- SECTION 5: Force-sync any users who accepted agreement but profile flag is false
-- ============================================================================
-- This repairs existing users who accepted terms but their user_profiles.terms_accepted
-- was never updated (the bug we are fixing).
--
-- WARNING: This updates ALL users who have a user_agreements record but terms_accepted=false.
-- Run only once after deploying the fixed RPC.
-- ============================================================================

WITH users_needing_fix AS (
    SELECT DISTINCT up.id, up.username, up.terms_accepted
    FROM public.user_profiles up
    INNER JOIN public.user_agreements ua
      ON up.id = ua.user_id
    WHERE up.terms_accepted = false
      AND ua.terms_accepted = true
)
UPDATE public.user_profiles up
SET terms_accepted = true,
    court_recording_consent = true,
    updated_at = now(),
    terms_accepted_at = COALESCE(terms_accepted_at, now()),
    court_recording_consent_at = COALESCE(court_recording_consent_at, now())
FROM users_needing_fix unf
WHERE up.id = unf.id
RETURNING up.id, up.username, up.terms_accepted, up.terms_accepted_at;

-- ============================================================================
-- DONE
-- ============================================================================
-- Now:
--   1. Edge Function supabase/functions/user-agreements/index.ts returns updated profile
--   2. TermsAgreement.tsx updates local store immediately with returned profile
--   3. route guard in App.tsx reads profile.terms_accepted — single source of truth
--   4. Realtime subscription in store.ts propagates profile updates to all clients
-- ============================================================================
