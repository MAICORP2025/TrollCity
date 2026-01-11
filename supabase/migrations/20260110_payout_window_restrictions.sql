-- Restrict payout requests to Monday/Friday starting at 1:00 AM UTC

CREATE OR REPLACE FUNCTION public.is_payout_window_open()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    EXTRACT(DOW FROM (now() AT TIME ZONE 'UTC')) IN (1, 5)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE 'UTC')) >= 1
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_payout_window_open()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_payout_window_open() THEN
    RAISE EXCEPTION 'Payouts are available Mondays and Fridays starting at 1:00 AM UTC.';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_payout_requests_window ON public.payout_requests;
CREATE TRIGGER trg_payout_requests_window
BEFORE INSERT ON public.payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.ensure_payout_window_open();

DROP TRIGGER IF EXISTS trg_visa_redemptions_window ON public.visa_redemptions;
CREATE TRIGGER trg_visa_redemptions_window
BEFORE INSERT ON public.visa_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_payout_window_open();
