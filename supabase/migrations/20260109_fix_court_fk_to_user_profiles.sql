-- Align court tables to user_profiles for PostgREST relationships
DO $$
BEGIN
  -- Ensure columns exist on court_cases
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'court_cases' AND column_name = 'plaintiff_id'
  ) THEN
    ALTER TABLE public.court_cases ADD COLUMN plaintiff_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'court_cases' AND column_name = 'defendant_id'
  ) THEN
    ALTER TABLE public.court_cases ADD COLUMN defendant_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'court_cases' AND column_name = 'judge_id'
  ) THEN
    ALTER TABLE public.court_cases ADD COLUMN judge_id UUID;
  END IF;

  -- court_cases foreign keys
  BEGIN
    ALTER TABLE public.court_cases DROP CONSTRAINT IF EXISTS court_cases_plaintiff_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER TABLE public.court_cases DROP CONSTRAINT IF EXISTS court_cases_defendant_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER TABLE public.court_cases DROP CONSTRAINT IF EXISTS court_cases_judge_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  ALTER TABLE public.court_cases
    ADD CONSTRAINT court_cases_plaintiff_id_fkey
    FOREIGN KEY (plaintiff_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

  ALTER TABLE public.court_cases
    ADD CONSTRAINT court_cases_defendant_id_fkey
    FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

  ALTER TABLE public.court_cases
    ADD CONSTRAINT court_cases_judge_id_fkey
    FOREIGN KEY (judge_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

  -- case_participants.user_id
  BEGIN
    ALTER TABLE public.case_participants DROP CONSTRAINT IF EXISTS case_participants_user_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE public.case_participants
    ADD CONSTRAINT case_participants_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

  -- case_evidence.uploader_id, verified_by
  BEGIN
    ALTER TABLE public.case_evidence DROP CONSTRAINT IF EXISTS case_evidence_uploader_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER TABLE public.case_evidence DROP CONSTRAINT IF EXISTS case_evidence_verified_by_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE public.case_evidence
    ADD CONSTRAINT case_evidence_uploader_id_fkey
    FOREIGN KEY (uploader_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  ALTER TABLE public.case_evidence
    ADD CONSTRAINT case_evidence_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

  -- case_audit_logs.actor_id
  BEGIN
    ALTER TABLE public.case_audit_logs DROP CONSTRAINT IF EXISTS case_audit_logs_actor_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE public.case_audit_logs
    ADD CONSTRAINT case_audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
END $$;
