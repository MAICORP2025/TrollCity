-- Fix 1: Update record_agreement_acceptance to set court_recording_consent
CREATE OR REPLACE FUNCTION public.record_agreement_acceptance(
  p_user_id uuid,
  p_agreement_version text DEFAULT '1.0',
  p_ip_address text DEFAULT null,
  p_user_agent text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agreement_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.user_agreements (
    id,
    user_id,
    agreement_version,
    agreed_at,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    v_agreement_id,
    p_user_id,
    COALESCE(p_agreement_version, '1.0'),
    now(),
    p_ip_address,
    p_user_agent,
    now()
  );

  -- Fix: Set court_recording_consent = true as well
  UPDATE public.user_profiles
  SET terms_accepted = true,
      court_recording_consent = true,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN v_agreement_id;
END;
$$;

-- Fix 2: Add trigger for gift coins to update stream total
CREATE OR REPLACE FUNCTION public.update_stream_coins_from_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.streams
  SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + NEW.coins_spent
  WHERE id = NEW.stream_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_stream_coins_trigger ON public.gifts;
CREATE TRIGGER update_stream_coins_trigger
AFTER INSERT ON public.gifts
FOR EACH ROW
EXECUTE FUNCTION public.update_stream_coins_from_gift();

-- Fix 3: Add secure function to update viewer count
CREATE OR REPLACE FUNCTION public.update_viewer_count(
  p_stream_id uuid,
  p_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.streams
  SET current_viewers = p_count
  WHERE id = p_stream_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_viewer_count(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_agreement_acceptance(uuid, text, text, text) TO authenticated;
