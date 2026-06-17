-- ============================================================
-- Rate Limiting: Report Submission
-- Prevents spam reporting that could harass users or overwhelm moderation
-- ============================================================

-- Add rate limiting trigger for moderation_reports
CREATE OR REPLACE FUNCTION enforce_report_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Count reports by this user in the last hour
  SELECT COUNT(*) INTO recent_count
  FROM moderation_reports
  WHERE reporter_id = auth.uid()
  AND created_at > now() - interval '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 10 reports per hour. Please wait before submitting another report.'
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_report_rate_limit
  BEFORE INSERT ON moderation_reports
  FOR EACH ROW
  EXECUTE FUNCTION enforce_report_rate_limit();

-- Add rate limiting trigger for utromail_reports
CREATE OR REPLACE FUNCTION enforce_utromail_report_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM utromail_reports
  WHERE reporter_id = auth.uid()
  AND created_at > now() - interval '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 10 reports per hour. Please wait before submitting another report.'
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_utromail_report_rate_limit
  BEFORE INSERT ON utromail_reports
  FOR EACH ROW
  EXECUTE FUNCTION enforce_utromail_report_rate_limit();
