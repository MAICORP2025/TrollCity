-- Safe RPC: log_app_bug_report
-- Inserts or updates bug reports with duplicate detection
CREATE OR REPLACE FUNCTION public.log_app_bug_report(
  payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_duplicate_window_seconds INTEGER := 60;
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_source TEXT;
  v_severity TEXT;
  v_page_url TEXT;
  v_route_path TEXT;
  v_stream_id UUID;
  v_function_name TEXT;
  v_table_name TEXT;
  v_error_code TEXT;
  v_error_message TEXT;
  v_error_details TEXT;
  v_error_hint TEXT;
  v_stack_trace TEXT;
  v_request_payload JSONB;
  v_response_payload JSONB;
  v_browser_info JSONB;
  v_app_context JSONB;
BEGIN
  -- Safely extract fields from payload with defaults
  v_source        := COALESCE(payload->>'source', 'frontend');
  v_severity      := COALESCE(payload->>'severity', 'medium');
  v_page_url      := payload->>'page_url';
  v_route_path    := payload->>'route_path';
  v_user_id       := (payload->>'user_id')::UUID;
  v_user_email    := payload->>'user_email';
  v_user_role     := payload->>'user_role';
  v_stream_id     := (payload->>'stream_id')::UUID;
  v_function_name := payload->>'function_name';
  v_table_name    := payload->>'table_name';
  v_error_code    := payload->>'error_code';
  v_error_message := COALESCE(payload->>'error_message', 'Unknown application error');
  v_error_details := payload->>'error_details';
  v_error_hint    := payload->>'error_hint';
  v_stack_trace   := payload->>'stack_trace';
  v_request_payload  := payload->'request_payload';
  v_response_payload := payload->'response_payload';
  v_browser_info     := payload->'browser_info';
  v_app_context      := payload->'app_context';

  -- Validate severity
  IF v_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    v_severity := 'medium';
  END IF;

  -- Validate source
  IF v_source IS NULL OR length(trim(v_source)) = 0 THEN
    v_source := 'frontend';
  END IF;

  -- Check for duplicate within time window
  SELECT id INTO v_id
  FROM public.app_bug_reports
  WHERE source = v_source
    AND route_path = v_route_path
    AND error_message = v_error_message
    AND status IN ('open', 'in_progress')
    AND last_seen_at > (v_now - (v_duplicate_window_seconds * INTERVAL '1 second'))
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Duplicate found: increment occurrence_count and update last_seen_at
    UPDATE public.app_bug_reports
    SET
      occurrence_count = occurrence_count + 1,
      last_seen_at = v_now,
      updated_at = v_now,
      page_url = COALESCE(v_page_url, page_url),
      error_code = COALESCE(v_error_code, error_code),
      error_details = COALESCE(v_error_details, error_details),
      error_hint = COALESCE(v_error_hint, error_hint),
      stack_trace = COALESCE(v_stack_trace, stack_trace)
    WHERE id = v_id;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_id,
      'duplicate', true,
      'occurrence_count', (SELECT occurrence_count FROM public.app_bug_reports WHERE id = v_id)
    );
  END IF;

  -- Insert new bug report
  INSERT INTO public.app_bug_reports (
    source,
    severity,
    page_url,
    route_path,
    user_id,
    user_email,
    user_role,
    stream_id,
    function_name,
    table_name,
    error_code,
    error_message,
    error_details,
    error_hint,
    stack_trace,
    request_payload,
    response_payload,
    browser_info,
    app_context,
    created_at,
    updated_at,
    occurrence_count,
    last_seen_at
  ) VALUES (
    v_source,
    v_severity,
    v_page_url,
    v_route_path,
    v_user_id,
    v_user_email,
    v_user_role,
    v_stream_id,
    v_function_name,
    v_table_name,
    v_error_code,
    v_error_message,
    v_error_details,
    v_error_hint,
    v_stack_trace,
    v_request_payload,
    v_response_payload,
    v_browser_info,
    v_app_context,
    v_now,
    v_now,
    1,
    v_now
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'duplicate', false
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Never throw to frontend - just log and return error
    RAISE LOG 'Error in log_app_bug_report: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'id', NULL
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_app_bug_report(JSONB) TO authenticated;
