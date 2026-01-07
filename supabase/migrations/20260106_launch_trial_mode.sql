DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='system_settings') THEN
    CREATE TABLE public.system_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payout_lock_enabled boolean DEFAULT true,
      payout_lock_reason text,
      payout_unlock_at timestamptz,
      trial_started_at timestamptz,
      trial_started_by uuid,
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='officer_shifts') THEN
    CREATE TABLE public.officer_shifts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id),
      shift_start timestamptz,
      shift_end timestamptz,
      role text DEFAULT 'officer',
      created_at timestamptz DEFAULT now()
    );
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.get_system_settings()
RETURNS public.system_settings
LANGUAGE sql
AS $$
  SELECT *
  FROM public.system_settings
  ORDER BY updated_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.start_launch_trial(p_admin_id uuid)
RETURNS public.system_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.system_settings;
BEGIN
  DELETE FROM public.system_settings;
  INSERT INTO public.system_settings (
    payout_lock_enabled,
    payout_lock_reason,
    payout_unlock_at,
    trial_started_at,
    trial_started_by,
    updated_at
  )
  VALUES (
    TRUE,
    'Launch Trial Mode: payouts open after 14 days.',
    now() + interval '14 days',
    now(),
    p_admin_id,
    now()
  );
  SELECT * INTO v_settings FROM public.system_settings ORDER BY updated_at DESC LIMIT 1;
  RETURN v_settings;
END
$$;

CREATE OR REPLACE FUNCTION public.end_trial_early()
RETURNS public.system_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.system_settings;
BEGIN
  UPDATE public.system_settings
  SET payout_lock_enabled = FALSE,
      updated_at = now()
  WHERE TRUE;
  SELECT * INTO v_settings FROM public.system_settings ORDER BY updated_at DESC LIMIT 1;
  RETURN v_settings;
END
$$;

CREATE OR REPLACE FUNCTION public.relock_payouts(p_reason text)
RETURNS public.system_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.system_settings;
BEGIN
  UPDATE public.system_settings
  SET payout_lock_enabled = TRUE,
      payout_lock_reason = COALESCE(p_reason, 'Emergency payout lock'),
      updated_at = now()
  WHERE TRUE;
  SELECT * INTO v_settings FROM public.system_settings ORDER BY updated_at DESC LIMIT 1;
  RETURN v_settings;
END
$$;

CREATE OR REPLACE FUNCTION public.auto_unlock_payouts()
RETURNS public.system_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.system_settings;
BEGIN
  UPDATE public.system_settings
  SET payout_lock_enabled = FALSE,
      updated_at = now()
  WHERE payout_lock_enabled = TRUE AND payout_unlock_at IS NOT NULL AND now() >= payout_unlock_at;
  SELECT * INTO v_settings FROM public.system_settings ORDER BY updated_at DESC LIMIT 1;
  RETURN v_settings;
END
$$;

CREATE OR REPLACE FUNCTION public.is_payout_locked()
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_settings public.system_settings;
BEGIN
  SELECT * INTO v_settings FROM public.system_settings ORDER BY updated_at DESC LIMIT 1;
  IF v_settings IS NULL THEN
    RETURN TRUE;
  END IF;
  IF v_settings.payout_lock_enabled = TRUE THEN
    IF v_settings.payout_unlock_at IS NOT NULL AND now() >= v_settings.payout_unlock_at THEN
      PERFORM public.auto_unlock_payouts();
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END
$$;

CREATE OR REPLACE FUNCTION public.ensure_payout_not_locked()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_payout_locked() THEN
    RAISE EXCEPTION 'Payouts are locked during Launch Trial Mode.';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_cashout_requests_block_lock ON public.cashout_requests;
CREATE TRIGGER trg_cashout_requests_block_lock
BEFORE INSERT ON public.cashout_requests
FOR EACH ROW
EXECUTE FUNCTION public.ensure_payout_not_locked();

CREATE OR REPLACE FUNCTION public.notify_all_users(p_title text, p_message text, p_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, is_read, created_at)
  SELECT id, p_title, p_message, COALESCE(p_type, 'system_update'), FALSE, now()
  FROM public.user_profiles;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;
